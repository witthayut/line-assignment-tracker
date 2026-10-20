// Input validation for the REST API (no external library needed).
import { dateToDb, daysBetween, isValidDate, isValidTime, makeDueAt } from './dates';

export const ASSIGNMENT_TYPES = ['ASSIGNMENT', 'GROUP_WORK', 'SMALL_QUIZ', 'EXAM'] as const;
export const ASSIGNMENT_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE'] as const;
export type AssignmentTypeValue = (typeof ASSIGNMENT_TYPES)[number];
export type AssignmentStatusValue = (typeof ASSIGNMENT_STATUSES)[number];

export class ValidationError extends Error {}

export interface AssignmentData {
  title?: string;
  courseId?: string | null;
  type?: AssignmentTypeValue;
  status?: AssignmentStatusValue;
  startDate?: Date;
  dueAt?: Date | null;
  dueTimeKnown?: boolean;
  details?: string;
}

function str(body: Record<string, unknown>, key: string, max: number, required: boolean): string | undefined {
  const v = body[key];
  if (v === undefined) {
    if (required) throw new ValidationError(`${key} is required`);
    return undefined;
  }
  if (typeof v !== 'string') throw new ValidationError(`${key} must be text`);
  const t = v.trim();
  if (required && !t) throw new ValidationError(`${key} cannot be empty`);
  if (t.length > max) throw new ValidationError(`${key} is too long (max ${max})`);
  return t;
}

/**
 * Parse an assignment body from the website.
 * Dates come as: startDate "YYYY-MM-DD", dueDate "YYYY-MM-DD" | null, dueTime "HH:MM" | null.
 * `partial` = PATCH (only given fields are changed).
 * `current` = existing start/due, needed to check start <= due on partial updates.
 */
export function parseAssignmentInput(
  raw: unknown,
  partial: boolean,
  current?: { startDate: string; dueDate: string | null },
): AssignmentData {
  if (!raw || typeof raw !== 'object') throw new ValidationError('Body must be a JSON object');
  const body = raw as Record<string, unknown>;
  const data: AssignmentData = {};

  const title = str(body, 'title', 200, !partial);
  if (title !== undefined) data.title = title;

  if (body.courseId !== undefined) {
    if (body.courseId !== null && typeof body.courseId !== 'string') throw new ValidationError('courseId must be text or null');
    data.courseId = (body.courseId as string | null) || null;
  }

  if (body.type !== undefined) {
    if (!ASSIGNMENT_TYPES.includes(body.type as AssignmentTypeValue)) throw new ValidationError('Invalid type');
    data.type = body.type as AssignmentTypeValue;
  }

  if (body.status !== undefined) {
    if (!ASSIGNMENT_STATUSES.includes(body.status as AssignmentStatusValue)) throw new ValidationError('Invalid status');
    data.status = body.status as AssignmentStatusValue;
  }

  const details = str(body, 'details', 20000, false);
  if (details !== undefined) data.details = details;

  let startDate = current?.startDate;
  if (body.startDate !== undefined) {
    if (!isValidDate(body.startDate)) throw new ValidationError('startDate must be YYYY-MM-DD');
    startDate = body.startDate;
    data.startDate = dateToDb(body.startDate);
  } else if (!partial) {
    throw new ValidationError('startDate is required');
  }

  let dueDate = current?.dueDate ?? null;
  if (body.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === '') {
      dueDate = null;
      data.dueAt = null;
      data.dueTimeKnown = false;
    } else {
      if (!isValidDate(body.dueDate)) throw new ValidationError('dueDate must be YYYY-MM-DD');
      const time = body.dueTime === undefined || body.dueTime === null || body.dueTime === '' ? null : body.dueTime;
      if (time !== null && !isValidTime(time)) throw new ValidationError('dueTime must be HH:MM');
      dueDate = body.dueDate;
      data.dueAt = makeDueAt(body.dueDate, time as string | null);
      data.dueTimeKnown = time !== null;
    }
  }

  if (startDate && dueDate && daysBetween(startDate, dueDate) < 0) {
    throw new ValidationError('Due date is before the start date');
  }
  return data;
}

export interface CourseData {
  code?: string | null;
  name?: string;
  professor?: string | null;
  color?: string;
}

export function parseCourseInput(raw: unknown, partial: boolean): CourseData {
  if (!raw || typeof raw !== 'object') throw new ValidationError('Body must be a JSON object');
  const body = raw as Record<string, unknown>;
  const data: CourseData = {};
  const name = str(body, 'name', 120, !partial);
  if (name !== undefined) data.name = name;
  const code = str(body, 'code', 30, false);
  if (code !== undefined) data.code = code ? code.toUpperCase().replace(/\s+/g, '') : null;
  const professor = str(body, 'professor', 120, false);
  if (professor !== undefined) data.professor = professor || null;
  if (body.color !== undefined) {
    if (typeof body.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(body.color)) throw new ValidationError('color must be #RRGGBB');
    data.color = body.color;
  }
  return data;
}

export const COURSE_COLORS = ['#2563eb', '#16a34a', '#db2777', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626', '#4f46e5', '#059669'];

export function pickCourseColor(usedCount: number): string {
  return COURSE_COLORS[usedCount % COURSE_COLORS.length];
}
