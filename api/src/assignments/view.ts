import type { Assignment, Course } from '@prisma/client';
import { bangkokDate, bangkokTime, dbToDate } from '../common/dates';

export type AssignmentWithCourse = Assignment & { course: Course | null };

export interface AssignmentView {
  id: string;
  title: string;
  type: string;
  status: string;
  state: string;
  courseId: string | null;
  course: { id: string; code: string | null; name: string; color: string } | null;
  startDate: string; // YYYY-MM-DD
  dueAt: string | null; // ISO instant
  dueDate: string | null; // YYYY-MM-DD (Bangkok)
  dueTime: string | null; // HH:MM, only if the post had a time
  details: string;
  sourceText: string | null;
  hasImage: boolean;
  suggestedCourseCode: string | null;
  suggestedCourseName: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toAssignmentView(a: AssignmentWithCourse): AssignmentView {
  return {
    id: a.id,
    title: a.title,
    type: a.type,
    status: a.status,
    state: a.state,
    courseId: a.courseId,
    course: a.course ? { id: a.course.id, code: a.course.code, name: a.course.name, color: a.course.color } : null,
    startDate: dbToDate(a.startDate),
    dueAt: a.dueAt ? a.dueAt.toISOString() : null,
    dueDate: a.dueAt ? bangkokDate(a.dueAt) : null,
    dueTime: a.dueAt && a.dueTimeKnown ? bangkokTime(a.dueAt) : null,
    details: a.details,
    sourceText: a.sourceText,
    hasImage: Boolean(a.sourceImage),
    suggestedCourseCode: a.suggestedCourseCode,
    suggestedCourseName: a.suggestedCourseName,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export function courseLabel(course: { code: string | null; name: string } | null): string | null {
  if (!course) return null;
  return course.code ? `${course.code} · ${course.name}` : course.name;
}
