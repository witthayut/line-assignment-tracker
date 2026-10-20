// AI extraction: turn a Classroom post (text or screenshot) into assignment drafts.
// Pure functions + a fetch call to the Claude Messages API (no SDK needed).
import { bangkokDate, bangkokTime, daysBetween, fixBuddhistYear, isValidDate, isValidTime, weekdayName } from '../common/dates';
import { ASSIGNMENT_TYPES, AssignmentTypeValue } from '../common/validation';

export interface CourseRef {
  id: string;
  code: string | null;
  name: string;
  professor: string | null;
}

export interface ExtractInput {
  text?: string;
  image?: { base64: string; mediaType: string };
  sentAt: Date;
  courses: CourseRef[];
}

/** Raw item as returned by the model (shape enforced by the JSON schema). */
export interface RawItem {
  title: string;
  course_id: string | null;
  course_code: string | null;
  course_name: string | null;
  type: string;
  start_date: string | null;
  due_date: string | null;
  due_time: string | null;
  details: string;
}

export interface RawResult {
  is_assignment: boolean;
  items: RawItem[];
}

/** Cleaned-up draft ready to save. */
export interface DraftItem {
  title: string;
  courseId: string | null;
  suggestedCourseCode: string | null;
  suggestedCourseName: string | null;
  type: AssignmentTypeValue;
  startDate: string; // YYYY-MM-DD
  dueDate: string | null; // YYYY-MM-DD
  dueTime: string | null; // HH:MM
  details: string;
}

export const MAX_ITEMS = 10;

const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] };

export const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    is_assignment: { type: 'boolean' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          course_id: nullableString,
          course_code: nullableString,
          course_name: nullableString,
          type: { type: 'string', enum: [...ASSIGNMENT_TYPES] },
          start_date: nullableString,
          due_date: nullableString,
          due_time: nullableString,
          details: { type: 'string' },
        },
        required: ['title', 'course_id', 'course_code', 'course_name', 'type', 'start_date', 'due_date', 'due_time', 'details'],
        additionalProperties: false,
      },
    },
  },
  required: ['is_assignment', 'items'],
  additionalProperties: false,
} as const;

export function buildSystemPrompt(sentAt: Date): string {
  const today = bangkokDate(sentAt);
  return `You extract coursework from messages a university student in Thailand forwards to their assignment tracker: Google Classroom posts (as text or screenshots), LINE chat messages from classmates or teachers, or their own quick notes. Posts may be in Thai, English, or both.

The message was sent on ${weekdayName(today)} ${today} at ${bangkokTime(sentAt)} (Asia/Bangkok). Treat that as "today".

Rules:
- Return one item per distinct piece of work that has its own deadline (assignment, lab, report, project, quiz, exam). A screenshot showing several posts can give several items. If the message contains no work to do (a greeting, an announcement with no task, a random photo), set is_assignment to false and return an empty items array.
- title: short name of the work, as the teacher wrote it (keep the original language).
- course_id: must be exactly one of the ids from the student's course list, or null. Match on course code, course name, or professor. If the post clearly names a course that is not in the list, set course_id to null and fill course_code / course_name with what you see. Otherwise leave course_code and course_name null.
- type: EXAM for midterm / final / exam / สอบ; SMALL_QUIZ for quiz / แบบทดสอบ / ควิซ; GROUP_WORK when the work is done in a group or team (กลุ่ม); otherwise ASSIGNMENT.
- due_date: the deadline as YYYY-MM-DD in the Gregorian calendar. Resolve relative dates ("tomorrow", "next Friday", "พรุ่งนี้", "วันศุกร์หน้า") from today's date above. Convert Buddhist Era years to Gregorian (2569 → 2026). If the year is missing, use the next occurrence on or after today. If no deadline is shown, use null. Never invent a date.
- due_time: the deadline time as 24-hour HH:MM if one is shown ("11:59 PM" → "23:59", "เที่ยงคืน" → "23:59", "เที่ยง" → "12:00"), else null.
- start_date: only when the post says when the work opens or starts (YYYY-MM-DD); otherwise null. Do not use the post date.
- details: the instructions and requirements as clean plain text, in the original language: what to do, format, length, submission method, points, links. Short bullet lines are fine. Do not add anything that is not in the message.`;
}

export function buildUserText(input: ExtractInput): string {
  const courseLines = input.courses.length
    ? input.courses
        .map((c) => `- id: ${c.id} | code: ${c.code ?? '-'} | name: ${c.name} | professor: ${c.professor ?? '-'}`)
        .join('\n')
    : '(no courses yet)';
  const parts = [`The student's courses:\n${courseLines}`];
  if (input.image) parts.push('The screenshot above is the message to extract from.');
  if (input.text) parts.push(`Message:\n<message>\n${input.text}\n</message>`);
  return parts.join('\n\n');
}

export function buildRequestBody(input: ExtractInput, model: string): Record<string, unknown> {
  const content: unknown[] = [];
  if (input.image) {
    content.push({ type: 'image', source: { type: 'base64', media_type: input.image.mediaType, data: input.image.base64 } });
  }
  content.push({ type: 'text', text: buildUserText(input) });

  const outputConfig: Record<string, unknown> = { format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } };
  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    system: buildSystemPrompt(input.sentAt),
    messages: [{ role: 'user', content }],
    output_config: outputConfig,
  };
  // Haiku 5.5: no thinking + low effort = fastest reply (LINE reply token lasts ~1 minute).
  if (/haiku-5/.test(model)) {
    body.thinking = { type: 'disabled' };
    outputConfig.effort = 'low';
  }
  return body;
}

export class ExtractionError extends Error {}

/** Read the JSON result out of a Messages API response. */
export function parseResponse(response: unknown): RawResult {
  const res = response as { stop_reason?: string; content?: Array<{ type: string; text?: string }> };
  if (res.stop_reason === 'refusal') throw new ExtractionError('The AI declined to read this message');
  const text = res.content?.find((b) => b.type === 'text')?.text;
  if (!text) throw new ExtractionError('Empty AI response');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ExtractionError('AI response was not valid JSON');
  }
  const r = parsed as RawResult;
  if (typeof r !== 'object' || r === null || !Array.isArray(r.items)) throw new ExtractionError('AI response had the wrong shape');
  return r;
}

function normKey(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[\s\-_.]/g, '');
}

/** Validate and clean the model's items. Never trust its ids or dates blindly. */
export function normalizeItems(result: RawResult, sentAt: Date, courses: CourseRef[]): DraftItem[] {
  if (!result.is_assignment) return [];
  const sentDate = bangkokDate(sentAt);
  const ids = new Set(courses.map((c) => c.id));

  return result.items.slice(0, MAX_ITEMS).map((item) => {
    let courseId = item.course_id && ids.has(item.course_id) ? item.course_id : null;
    if (!courseId) {
      const code = normKey(item.course_code);
      const name = normKey(item.course_name);
      const match = courses.find(
        (c) => (code && normKey(c.code) === code) || (name && normKey(c.name) === name),
      );
      courseId = match?.id ?? null;
    }

    const type = ASSIGNMENT_TYPES.find((t) => t === String(item.type).toUpperCase()) ?? 'ASSIGNMENT';

    let dueDate = item.due_date ? fixBuddhistYear(item.due_date.trim()) : null;
    if (!isValidDate(dueDate)) dueDate = null;
    const dueTime = dueDate && isValidTime(item.due_time) ? item.due_time : null;

    let startDate = item.start_date ? fixBuddhistYear(item.start_date.trim()) : null;
    if (!isValidDate(startDate)) startDate = sentDate;
    // A deadline before the start (e.g. forwarded late) — start on the deadline day instead.
    if (dueDate && daysBetween(startDate, dueDate) < 0) startDate = dueDate;

    return {
      title: (item.title ?? '').trim().slice(0, 200) || 'Untitled assignment',
      courseId,
      suggestedCourseCode: courseId ? null : item.course_code?.trim().toUpperCase().replace(/\s+/g, '') || null,
      suggestedCourseName: courseId ? null : item.course_name?.trim() || null,
      type,
      startDate,
      dueDate,
      dueTime,
      details: (item.details ?? '').trim().slice(0, 20000),
    };
  });
}

/** Call Claude and return cleaned drafts. */
export async function extractAssignments(input: ExtractInput, apiKey: string, model: string): Promise<DraftItem[]> {
  if (!apiKey) throw new ExtractionError('ANTHROPIC_API_KEY is not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(buildRequestBody(input, model)),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new ExtractionError(`Claude API error ${res.status}: ${detail.slice(0, 300)}`);
  }
  return normalizeItems(parseResponse(await res.json()), input.sentAt, input.courses);
}
