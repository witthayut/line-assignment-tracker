import type { Assignment, AssignmentType, Status } from './types';

export const TYPE_LABEL: Record<AssignmentType, string> = {
  ASSIGNMENT: 'Assignment',
  GROUP_WORK: 'Group Work',
  SMALL_QUIZ: 'Small Quiz',
  EXAM: 'Exam',
};

export const STATUS_LABEL: Record<Status, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETE: 'Complete',
};

export const TYPES = Object.keys(TYPE_LABEL) as AssignmentType[];
export const STATUSES = Object.keys(STATUS_LABEL) as Status[];

const bkkDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Today's date in Bangkok as YYYY-MM-DD. */
export function today(): string {
  return bkkDate.format(new Date());
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Days until the deadline (negative = overdue). Null when there is no due date. */
export function daysLeft(a: Pick<Assignment, 'dueDate'>): number | null {
  return a.dueDate ? daysBetween(today(), a.dueDate) : null;
}

export function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function dueText(a: Pick<Assignment, 'dueDate' | 'dueTime'>): string {
  if (!a.dueDate) return 'No due date';
  return a.dueTime ? `${shortDate(a.dueDate)} · ${a.dueTime}` : shortDate(a.dueDate);
}

export function relativeText(days: number | null): string {
  if (days === null) return '';
  if (days < 0) return `${-days}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days left`;
}

/** Tailwind classes for the "days left" pill. */
export function urgencyClass(days: number | null, status: Status): string {
  if (status === 'COMPLETE') return 'bg-emerald-50 text-emerald-700';
  if (days === null) return 'bg-stone-100 text-stone-500';
  if (days < 0) return 'bg-red-600 text-white';
  if (days <= 1) return 'bg-red-50 text-red-700';
  if (days <= 3) return 'bg-amber-50 text-amber-700';
  return 'bg-stone-100 text-stone-600';
}

export function courseShort(a: Pick<Assignment, 'course'>): string {
  return a.course ? (a.course.code ?? a.course.name) : 'No course';
}

export function toInput(a: Assignment) {
  return {
    title: a.title,
    courseId: a.courseId,
    type: a.type,
    status: a.status,
    startDate: a.startDate,
    dueDate: a.dueDate,
    dueTime: a.dueTime,
    details: a.details,
  };
}
