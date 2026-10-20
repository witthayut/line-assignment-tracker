import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { dateToDb, dbToDate, bangkokDate, makeDueAt } from '../common/dates';
import { config } from '../common/env';
import { validate } from '../common/http';
import { AssignmentData, parseAssignmentInput } from '../common/validation';
import { CoursesService } from '../courses/courses.service';
import type { DraftItem } from '../extraction/extract';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentView, AssignmentWithCourse, toAssignmentView } from './view';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CoursesService,
  ) {}

  /** Confirmed cards only — drafts live in LINE until confirmed. */
  async list(userId: string): Promise<AssignmentView[]> {
    const rows = await this.prisma.assignment.findMany({
      where: { userId, state: 'CONFIRMED' },
      include: { course: true },
      orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    });
    return rows.map(toAssignmentView);
  }

  async get(userId: string, id: string): Promise<AssignmentView> {
    return toAssignmentView(await this.mustOwn(userId, id));
  }

  /** Manual "+ New" from the website. */
  async create(userId: string, body: unknown): Promise<AssignmentView> {
    const data = validate(() => parseAssignmentInput(body, false));
    await this.checkCourse(userId, data);
    const row = await this.prisma.assignment.create({
      data: {
        userId,
        title: data.title!,
        type: data.type ?? 'ASSIGNMENT',
        status: data.status ?? 'NOT_STARTED',
        state: 'CONFIRMED',
        courseId: data.courseId ?? null,
        startDate: data.startDate!,
        dueAt: data.dueAt ?? null,
        dueTimeKnown: data.dueTimeKnown ?? false,
        details: data.details ?? '',
      },
      include: { course: true },
    });
    return toAssignmentView(row);
  }

  async update(userId: string, id: string, body: unknown): Promise<AssignmentView> {
    const current = await this.mustOwn(userId, id);
    const data = validate(() =>
      parseAssignmentInput(body, true, {
        startDate: dbToDate(current.startDate),
        dueDate: current.dueAt ? bangkokDate(current.dueAt) : null,
      }),
    );
    await this.checkCourse(userId, data);
    const row = await this.prisma.assignment.update({
      where: { id },
      data: {
        ...data,
        // Picking a course by hand clears the AI's suggestion
        ...(data.courseId !== undefined ? { suggestedCourseCode: null, suggestedCourseName: null } : {}),
      },
      include: { course: true },
    });
    return toAssignmentView(row);
  }

  /** Confirm a draft (from LINE button or the LIFF edit page). Optional edits are applied first. */
  async confirm(userId: string, id: string, body?: unknown): Promise<AssignmentView> {
    if (body && typeof body === 'object' && Object.keys(body).length > 0) {
      await this.update(userId, id, body);
    }
    const draft = await this.mustOwn(userId, id);
    if (draft.state === 'CONFIRMED') return toAssignmentView(draft);
    if (!draft.dueAt) throw new BadRequestException('Add a due date before saving');

    let courseId = draft.courseId;
    if (!courseId) {
      const course = await this.courses.findOrCreate(userId, draft.suggestedCourseCode, draft.suggestedCourseName);
      courseId = course?.id ?? null;
    }
    const row = await this.prisma.assignment.update({
      where: { id },
      data: { state: 'CONFIRMED', courseId, suggestedCourseCode: null, suggestedCourseName: null },
      include: { course: true },
    });
    return toAssignmentView(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const row = await this.mustOwn(userId, id);
    await this.prisma.assignment.delete({ where: { id } });
    if (row.sourceImage) {
      const stillUsed = await this.prisma.assignment.count({ where: { sourceImage: row.sourceImage } });
      if (!stillUsed) await unlink(this.imagePath(row.sourceImage)).catch(() => undefined);
    }
  }

  /** Called by the LINE bot after AI extraction. */
  async createDrafts(
    userId: string,
    items: DraftItem[],
    source: { text?: string; image?: string },
  ): Promise<AssignmentWithCourse[]> {
    const created: AssignmentWithCourse[] = [];
    for (const item of items) {
      created.push(
        await this.prisma.assignment.create({
          data: {
            userId,
            title: item.title,
            type: item.type,
            state: 'DRAFT',
            courseId: item.courseId,
            suggestedCourseCode: item.suggestedCourseCode,
            suggestedCourseName: item.suggestedCourseName,
            startDate: dateToDb(item.startDate),
            dueAt: item.dueDate ? makeDueAt(item.dueDate, item.dueTime) : null,
            dueTimeKnown: Boolean(item.dueDate && item.dueTime),
            details: item.details,
            sourceText: source.text ?? null,
            sourceImage: source.image ?? null,
          },
          include: { course: true },
        }),
      );
    }
    return created;
  }

  async findOwned(userId: string, id: string): Promise<AssignmentWithCourse | null> {
    return this.prisma.assignment.findFirst({ where: { id, userId }, include: { course: true } });
  }

  async mustOwn(userId: string, id: string): Promise<AssignmentWithCourse> {
    const row = await this.findOwned(userId, id);
    if (!row) throw new NotFoundException('Assignment not found');
    return row;
  }

  /** Absolute path of a stored screenshot (or null if missing). */
  async imageFile(userId: string, id: string): Promise<string | null> {
    const row = await this.mustOwn(userId, id);
    if (!row.sourceImage) return null;
    const file = this.imagePath(row.sourceImage);
    return existsSync(file) ? file : null;
  }

  imagePath(fileName: string): string {
    return join(resolve(config().uploadDir), fileName);
  }

  private async checkCourse(userId: string, data: AssignmentData): Promise<void> {
    if (data.courseId) await this.courses.mustOwn(userId, data.courseId);
  }
}
