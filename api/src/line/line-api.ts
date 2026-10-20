// Minimal LINE Messaging API client using fetch, plus webhook signature check.
import { createHmac, timingSafeEqual } from 'node:crypto';

export type LineMessage = Record<string, unknown>;

export class LineApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Webhook signature: base64(HMAC-SHA256(channelSecret, raw request body)). */
export function verifyLineSignature(rawBody: Buffer | string, signature: string | undefined, channelSecret: string): boolean {
  if (!signature || !channelSecret) return false;
  const expected = Buffer.from(createHmac('sha256', channelSecret).update(rawBody).digest('base64'));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export class LineApi {
  constructor(private readonly accessToken: string) {}

  private async call(url: string, body: unknown): Promise<void> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.accessToken}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new LineApiError(`LINE API ${res.status}: ${detail.slice(0, 300)}`, res.status);
    }
  }

  /** Free. Reply token works once, for about a minute after the user's message. */
  reply(replyToken: string, messages: LineMessage[]): Promise<void> {
    return this.call('https://api.line.me/v2/bot/message/reply', { replyToken, messages: messages.slice(0, 5) });
  }

  /** Counts toward the monthly message quota — only used as a fallback. */
  push(to: string, messages: LineMessage[]): Promise<void> {
    return this.call('https://api.line.me/v2/bot/message/push', { to, messages: messages.slice(0, 5) });
  }

  /** "Typing…" animation in a 1:1 chat while the AI reads the post. 5–60 seconds. */
  startLoading(chatId: string, seconds = 20): Promise<void> {
    const s = Math.min(60, Math.max(5, Math.round(seconds / 5) * 5));
    return this.call('https://api.line.me/v2/bot/chat/loading/start', { chatId, loadingSeconds: s });
  }

  /** Display name + picture of a user who has added the bot as a friend. */
  async getProfile(userId: string): Promise<{ displayName: string; pictureUrl: string | null }> {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, {
      headers: { authorization: `Bearer ${this.accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new LineApiError(`LINE profile ${res.status}`, res.status);
    const data = (await res.json()) as { displayName?: string; pictureUrl?: string };
    return { displayName: data.displayName ?? 'LINE user', pictureUrl: data.pictureUrl ?? null };
  }

  /** Download an image the user sent. */
  async getContent(messageId: string): Promise<{ data: Buffer; contentType: string }> {
    const res = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
      headers: { authorization: `Bearer ${this.accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new LineApiError(`LINE content ${res.status}`, res.status);
    return {
      data: Buffer.from(await res.arrayBuffer()),
      contentType: (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim(),
    };
  }
}
