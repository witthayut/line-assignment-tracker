// LINE Flex Message builders for the confirm card.
import { daysBetween, bangkokDate, formatDate, formatDue } from '../common/dates';
import type { LineMessage } from './line-api';

export const TYPE_LABELS: Record<string, string> = {
  ASSIGNMENT: 'Assignment',
  GROUP_WORK: 'Group Work',
  SMALL_QUIZ: 'Small Quiz',
  EXAM: 'Exam',
};

export interface DraftCardView {
  id: string;
  title: string;
  courseLabel: string | null; // "ITCS258 · Back-end"
  courseIsNew: boolean; // course will be created on confirm
  type: string;
  startDate: string; // YYYY-MM-DD
  dueAt: Date | null;
  dueTimeKnown: boolean;
  details: string;
}

export interface CardLinks {
  liffId: string;
  webUrl: string;
}

const GREY = '#8c8c8c';
const RED = '#d93025';

/** LINE rejects empty text in Flex components. */
function safe(text: string, max: number): string {
  const t = text.trim();
  if (!t) return '-';
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function row(label: string, value: string, color?: string): Record<string, unknown> {
  return {
    type: 'box',
    layout: 'baseline',
    spacing: 'sm',
    contents: [
      { type: 'text', text: label, size: 'sm', color: GREY, flex: 2 },
      { type: 'text', text: safe(value, 200), size: 'sm', wrap: true, flex: 6, ...(color ? { color } : {}) },
    ],
  };
}

export function editUrl(id: string, links: CardLinks): string {
  return links.liffId
    ? `https://liff.line.me/${links.liffId}/liff/drafts/${id}`
    : `${links.webUrl}/liff/drafts/${id}`;
}

export function dueLabel(dueAt: Date, timeKnown: boolean, now: Date): string {
  const days = daysBetween(bangkokDate(now), bangkokDate(dueAt));
  const rel = days < 0 ? `${-days}d overdue` : days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  return `${formatDue(dueAt, timeKnown)} (${rel})`;
}

export function buildDraftBubble(d: DraftCardView, links: CardLinks, now = new Date()): Record<string, unknown> {
  const course = d.courseLabel ? `${d.courseLabel}${d.courseIsNew ? ' (new)' : ''}` : 'Not matched — tap Edit';
  const due = d.dueAt ? dueLabel(d.dueAt, d.dueTimeKnown, now) : 'Not found — tap Edit';

  const buttons: Record<string, unknown>[] = [];
  if (d.dueAt) {
    buttons.push({
      type: 'button',
      style: 'primary',
      height: 'sm',
      action: { type: 'postback', label: 'Confirm', data: `a=confirm&id=${d.id}`, displayText: 'Confirm' },
    });
  }
  buttons.push({
    type: 'button',
    style: 'secondary',
    height: 'sm',
    action: { type: 'uri', label: 'Edit', uri: editUrl(d.id, links) },
  });
  buttons.push({
    type: 'button',
    style: 'link',
    height: 'sm',
    action: { type: 'postback', label: 'Cancel', data: `a=cancel&id=${d.id}`, displayText: 'Cancel' },
  });

  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        { type: 'text', text: 'Check before saving', size: 'xs', color: GREY },
        { type: 'text', text: safe(d.title, 120), weight: 'bold', size: 'lg', wrap: true },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            row('Course', course, d.courseLabel ? undefined : RED),
            row('Type', TYPE_LABELS[d.type] ?? d.type),
            row('Start', formatDate(d.startDate)),
            row('Due', due, d.dueAt ? undefined : RED),
          ],
        },
        { type: 'separator' },
        { type: 'text', text: safe(d.details || 'No details', 400), size: 'sm', color: '#555555', wrap: true },
      ],
    },
    footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: buttons },
  };
}

export function buildDraftMessages(drafts: DraftCardView[], links: CardLinks, now = new Date()): LineMessage[] {
  const bubbles = drafts.slice(0, 12).map((d) => buildDraftBubble(d, links, now));
  const messages: LineMessage[] = [];
  if (drafts.length > 1) {
    messages.push({ type: 'text', text: `I found ${drafts.length} items. Check each card and tap Confirm.` });
  }
  messages.push({
    type: 'flex',
    altText: safe(drafts.length > 1 ? `${drafts.length} assignments to confirm` : `Confirm: ${drafts[0]?.title ?? ''}`, 300),
    contents: bubbles.length === 1 ? bubbles[0] : { type: 'carousel', contents: bubbles },
  });
  return messages;
}

export function parsePostback(data: string): { action: string; id: string } | null {
  const p = new URLSearchParams(data);
  const action = p.get('a');
  const id = p.get('id');
  if (!action || !id) return null;
  return { action, id };
}

export function text(t: string): LineMessage {
  return { type: 'text', text: safe(t, 4900) };
}
