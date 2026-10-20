import { Injectable, Logger } from '@nestjs/common';
import type { User } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { AssignmentsService } from '../assignments/assignments.service';
import { courseLabel } from '../assignments/view';
import { formatDue } from '../common/dates';
import { config, isAllowedLineUser } from '../common/env';
import { extractAssignments } from '../extraction/extract';
import { PrismaService } from '../prisma/prisma.service';
import { DraftCardView, buildDraftMessages, parsePostback, text } from './flex';
import { LineApi, LineApiError, LineMessage } from './line-api';

// Only the webhook fields we use.
export interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { id: string; type: string; text?: string; contentProvider?: { type: string } };
  postback?: { data: string };
  deliveryContext?: { isRedelivery?: boolean };
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const HELP_WORDS = ['help', '/help', '?', 'ช่วย', 'วิธีใช้'];

@Injectable()
export class BotService {
  private readonly log = new Logger('LineBot');

  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: AssignmentsService,
  ) {}

  private get line(): LineApi {
    return new LineApi(config().lineChannelAccessToken);
  }

  /** Called after the webhook has already answered 200 to LINE. */
  async handleEvents(events: LineEvent[]): Promise<void> {
    for (const event of events) {
      try {
        await this.handleEvent(event);
      } catch (err) {
        this.log.error(`Event ${event.type} failed: ${(err as Error).message}`);
      }
    }
  }

  private async handleEvent(event: LineEvent): Promise<void> {
    if (event.deliveryContext?.isRedelivery) return; // already handled the first time
    const lineUserId = event.source?.type === 'user' ? event.source.userId : undefined;
    if (!lineUserId || !event.replyToken) return; // ignore groups/rooms and events we can't answer
    const reply = (messages: LineMessage[]) => this.replyOrPush(event.replyToken!, lineUserId, messages);

    if (!isAllowedLineUser(lineUserId)) {
      if (event.type === 'message' || event.type === 'follow') {
        await reply([text(`Sorry, this bot is private.\n\nYour LINE user ID is:\n${lineUserId}\n\n(The owner can add it to ALLOWED_LINE_USER_IDS.)`)]);
      }
      return;
    }

    const user = await this.getOrCreateUser(lineUserId);

    if (event.type === 'follow') {
      await reply([text(this.helpText(true))]);
      return;
    }
    if (event.type === 'postback' && event.postback) {
      await this.handlePostback(user, event.postback.data, reply);
      return;
    }
    if (event.type !== 'message' || !event.message) return;

    const msg = event.message;
    if (msg.type === 'text') {
      const body = (msg.text ?? '').trim();
      if (!body || HELP_WORDS.includes(body.toLowerCase())) {
        await reply([text(this.helpText(false))]);
        return;
      }
      await this.extractAndReply(user, { text: body }, reply);
      return;
    }
    if (msg.type === 'image') {
      if (msg.contentProvider && msg.contentProvider.type !== 'line') {
        await reply([text('I can only read images sent directly in this chat.')]);
        return;
      }
      await this.extractAndReply(user, { imageMessageId: msg.id }, reply);
      return;
    }
    await reply([text('Send me the assignment as text or a screenshot.')]);
  }

  private async extractAndReply(
    user: User,
    input: { text?: string; imageMessageId?: string },
    reply: (m: LineMessage[]) => Promise<void>,
  ): Promise<void> {
    const cfg = config();
    this.line.startLoading(user.lineUserId, 20).catch(() => undefined);

    try {
      let image: { base64: string; mediaType: string } | undefined;
      let imageFile: string | undefined;
      if (input.imageMessageId) {
        const content = await this.line.getContent(input.imageMessageId);
        if (!IMAGE_TYPES.includes(content.contentType)) {
          await reply([text('That image format is not supported. Send a JPG or PNG screenshot.')]);
          return;
        }
        imageFile = await this.saveImage(input.imageMessageId, content.data, content.contentType);
        image = { base64: content.data.toString('base64'), mediaType: content.contentType };
      }

      const courses = await this.prisma.course.findMany({
        where: { userId: user.id },
        select: { id: true, code: true, name: true, professor: true },
      });
      const items = await extractAssignments(
        { text: input.text, image, sentAt: new Date(), courses },
        cfg.anthropicApiKey,
        cfg.anthropicModel,
      );

      if (items.length === 0) {
        await reply([
          text("I couldn't find an assignment or exam in that.\n\nSend the Classroom post text or a screenshot that shows the title and due date."),
        ]);
        return;
      }

      const drafts = await this.assignments.createDrafts(user.id, items, { text: input.text, image: imageFile });
      const views: DraftCardView[] = drafts.map((d) => {
        const suggested = d.suggestedCourseCode || d.suggestedCourseName;
        return {
          id: d.id,
          title: d.title,
          courseLabel: d.course
            ? courseLabel(d.course)
            : suggested
              ? courseLabel({ code: d.suggestedCourseCode, name: d.suggestedCourseName ?? d.suggestedCourseCode ?? '' })
              : null,
          courseIsNew: !d.course && Boolean(suggested),
          type: d.type,
          startDate: d.startDate.toISOString().slice(0, 10),
          dueAt: d.dueAt,
          dueTimeKnown: d.dueTimeKnown,
          details: d.details,
        };
      });
      await reply(buildDraftMessages(views, { liffId: cfg.liffId, webUrl: cfg.webUrl }));
    } catch (err) {
      this.log.error(`Extraction failed: ${(err as Error).message}`);
      await reply([text(`Sorry, I couldn't read that one. Try again, or add it on the website:\n${cfg.webUrl}`)]);
    }
  }

  private async handlePostback(user: User, data: string, reply: (m: LineMessage[]) => Promise<void>): Promise<void> {
    const pb = parsePostback(data);
    if (!pb) return;
    const row = await this.assignments.findOwned(user.id, pb.id);
    if (!row) {
      await reply([text('That card no longer exists.')]);
      return;
    }

    if (pb.action === 'confirm') {
      if (row.state === 'CONFIRMED') {
        await reply([text(`Already saved ✓ ${row.title}`)]);
        return;
      }
      if (!row.dueAt) {
        await reply([text('Add a due date first — tap Edit on the card.')]);
        return;
      }
      const saved = await this.assignments.confirm(user.id, row.id);
      const course = saved.course ? `${saved.course.code ?? saved.course.name}\n` : '';
      await reply([
        text(
          `Saved ✓\n${saved.title}\n${course}Due ${formatDue(new Date(saved.dueAt!), Boolean(saved.dueTime))}\n\n${config().webUrl}/?open=${saved.id}`,
        ),
      ]);
      return;
    }

    if (pb.action === 'cancel') {
      if (row.state === 'CONFIRMED') {
        await reply([text('This one is already saved. You can delete it on the website.')]);
        return;
      }
      await this.assignments.remove(user.id, row.id);
      await reply([text(`Discarded: ${row.title}`)]);
    }
  }

  private async getOrCreateUser(lineUserId: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { lineUserId } });
    if (existing) return existing;
    const profile = await this.line.getProfile(lineUserId).catch(() => ({ displayName: 'LINE user', pictureUrl: null }));
    return this.prisma.user.create({ data: { lineUserId, displayName: profile.displayName, pictureUrl: profile.pictureUrl } });
  }

  private async saveImage(messageId: string, data: Buffer, contentType: string): Promise<string> {
    const dir = resolve(config().uploadDir);
    await mkdir(dir, { recursive: true });
    const ext = contentType.split('/')[1] === 'jpeg' ? 'jpg' : contentType.split('/')[1];
    const name = `${messageId.replace(/[^\w-]/g, '')}.${ext}`;
    await writeFile(join(dir, name), data);
    return name;
  }

  /** Reply is free; if the token has expired (slow AI), fall back to push. */
  private async replyOrPush(replyToken: string, userId: string, messages: LineMessage[]): Promise<void> {
    try {
      await this.line.reply(replyToken, messages);
    } catch (err) {
      if (err instanceof LineApiError && err.status === 400) {
        this.log.warn('Reply token rejected — sending as push message');
        await this.line.push(userId, messages);
        return;
      }
      throw err;
    }
  }

  private helpText(welcome: boolean): string {
    const intro = welcome ? 'Hi! I keep track of your assignments.\n\n' : '';
    return `${intro}How to use:
1. Send me a Classroom post — paste the text or send a screenshot.
2. I'll read it and show a card. Check it, then tap Confirm (or Edit to fix it).
3. See everything on the website:
${config().webUrl}`;
  }
}
