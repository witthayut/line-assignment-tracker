// Date helpers. Everything is in Bangkok time (UTC+7, no daylight saving).

export const BANGKOK_OFFSET = '+07:00';
const OFFSET_MS = 7 * 60 * 60 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Calendar date (YYYY-MM-DD) of an instant, as seen in Bangkok. */
export function bangkokDate(instant: Date): string {
  return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Clock time (HH:MM) of an instant, as seen in Bangkok. */
export function bangkokTime(instant: Date): string {
  return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(11, 16);
}

export function weekdayName(date: string): string {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value);
}

/** Deadline instant from a Bangkok date + optional time. No time → 23:59. */
export function makeDueAt(date: string, time: string | null): Date {
  return new Date(`${date}T${time ?? '23:59'}:00${BANGKOK_OFFSET}`);
}

/** Thai posts often use Buddhist Era years (2569 = 2026). Convert them. */
export function fixBuddhistYear(date: string): string {
  const year = Number(date.slice(0, 4));
  if (year >= 2400) return `${year - 543}${date.slice(4)}`;
  return date;
}

/** Whole days from date a to date b (both YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Prisma @db.Date <-> YYYY-MM-DD */
export function dateToDb(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}
export function dbToDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** "Fri 24 Oct 23:59" style label for LINE messages. */
export function formatDue(dueAt: Date, timeKnown: boolean): string {
  const date = bangkokDate(dueAt);
  const d = new Date(`${date}T00:00:00Z`);
  const label = d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return timeKnown ? `${label} ${bangkokTime(dueAt)}` : label;
}

export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
