// Unit tests for the framework-free logic. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { bangkokDate, bangkokTime, fixBuddhistYear, makeDueAt, isValidDate, daysBetween, addDays } from '../src/common/dates';
import { createSessionToken, verifySessionToken, readCookie } from '../src/common/session';
import { parseAssignmentInput, parseCourseInput, ValidationError } from '../src/common/validation';
import { parseEnv } from '../src/common/env';
import { verifyLineSignature } from '../src/line/line-api';
import { buildDraftBubble, buildDraftMessages, parsePostback, dueLabel } from '../src/line/flex';
import { buildRequestBody, normalizeItems, parseResponse, RawResult, EXTRACTION_SCHEMA } from '../src/extraction/extract';

const courses = [
  { id: 'c1', code: 'ITCS258', name: 'Back-end Application Development', professor: 'Aj. Somchai' },
  { id: 'c2', code: 'ITCS312', name: 'Computer and Communication Security', professor: null },
];

// Saturday 17 Oct 2026, 14:30 Bangkok
const sentAt = new Date('2026-10-17T07:30:00Z');

test('Bangkok dates', () => {
  assert.equal(bangkokDate(new Date('2026-10-17T18:00:00Z')), '2026-10-18'); // 01:00 next day in BKK
  assert.equal(bangkokTime(sentAt), '14:30');
  assert.equal(makeDueAt('2026-10-24', null).toISOString(), '2026-10-24T16:59:00.000Z');
  assert.equal(makeDueAt('2026-10-24', '09:00').toISOString(), '2026-10-24T02:00:00.000Z');
  assert.equal(fixBuddhistYear('2569-10-24'), '2026-10-24');
  assert.equal(fixBuddhistYear('2026-10-24'), '2026-10-24');
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('2026-02-28'), true);
  assert.equal(daysBetween('2026-10-17', '2026-10-24'), 7);
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});

test('session token round trip and tamper check', () => {
  const t = createSessionToken('user1', 'secret');
  assert.equal(verifySessionToken(t, 'secret')?.uid, 'user1');
  assert.equal(verifySessionToken(t, 'other'), null);
  assert.equal(verifySessionToken(t.replace(/^./, 'x'), 'secret'), null);
  assert.equal(verifySessionToken(t, 'secret', Date.now() + 31 * 86400_000), null); // expired
  assert.equal(readCookie('a=1; reminder_session=abc.def; b=2', 'reminder_session'), 'abc.def');
});

test('env parser', () => {
  const env = parseEnv('# c\nA=1\r\nB="two words"\nC=\nbad line\n');
  assert.deepEqual(env, { A: '1', B: 'two words', C: '' });
});

test('assignment validation', () => {
  const full = parseAssignmentInput(
    { title: ' Lab 3 ', type: 'GROUP_WORK', startDate: '2026-10-17', dueDate: '2026-10-24', dueTime: '18:00', courseId: 'c1' },
    false,
  );
  assert.equal(full.title, 'Lab 3');
  assert.equal(full.dueAt?.toISOString(), '2026-10-24T11:00:00.000Z');
  assert.equal(full.dueTimeKnown, true);

  const noTime = parseAssignmentInput({ title: 'x', startDate: '2026-10-17', dueDate: '2026-10-24' }, false);
  assert.equal(noTime.dueTimeKnown, false);

  assert.throws(() => parseAssignmentInput({ title: 'x', startDate: '2026-10-20', dueDate: '2026-10-19' }, false), ValidationError);
  assert.throws(() => parseAssignmentInput({ title: '', startDate: '2026-10-20' }, false), ValidationError);
  assert.throws(() => parseAssignmentInput({ status: 'DONE' }, true), ValidationError);

  // PATCH only the due date: checked against the existing start date
  assert.throws(
    () => parseAssignmentInput({ dueDate: '2026-10-01' }, true, { startDate: '2026-10-17', dueDate: '2026-10-24' }),
    ValidationError,
  );
  const patch = parseAssignmentInput({ status: 'COMPLETE' }, true, { startDate: '2026-10-17', dueDate: null });
  assert.deepEqual(patch, { status: 'COMPLETE' });

  const clear = parseAssignmentInput({ dueDate: null }, true);
  assert.equal(clear.dueAt, null);

  assert.equal(parseCourseInput({ name: 'Security', code: 'itcs 312' }, false).code, 'ITCS312');
  assert.throws(() => parseCourseInput({ name: 'x', color: 'red' }, false), ValidationError);
});

test('LINE signature check', () => {
  const body = '{"destination":"U1","events":[]}';
  const sig = createHmac('sha256', 'chsecret').update(body).digest('base64');
  assert.equal(verifyLineSignature(Buffer.from(body), sig, 'chsecret'), true);
  assert.equal(verifyLineSignature(Buffer.from(body + ' '), sig, 'chsecret'), false);
  assert.equal(verifyLineSignature(Buffer.from(body), undefined, 'chsecret'), false);
  assert.equal(verifyLineSignature(Buffer.from(body), sig, ''), false);
});

test('extraction request body', () => {
  const body = buildRequestBody({ text: 'Lab 3 due next Friday', sentAt, courses }, 'claude-haiku-5-5') as any;
  assert.equal(body.model, 'claude-haiku-5-5');
  assert.deepEqual(body.thinking, { type: 'disabled' });
  assert.equal(body.output_config.effort, 'low');
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.match(body.system, /Saturday 2026-10-17 at 14:30/);
  assert.match(body.messages[0].content[0].text, /id: c1 \| code: ITCS258/);

  const other = buildRequestBody({ text: 'x', sentAt, courses }, 'claude-sonnet-5-5') as any;
  assert.equal(other.thinking, undefined);
  assert.equal(other.output_config.effort, undefined);

  const img = buildRequestBody({ image: { base64: 'AAAA', mediaType: 'image/jpeg' }, sentAt, courses: [] }, 'claude-haiku-5-5') as any;
  assert.equal(img.messages[0].content[0].type, 'image');
  assert.equal(img.messages[0].content[1].type, 'text');
});

test('schema follows structured-output rules (additionalProperties false everywhere)', () => {
  const walk = (node: any) => {
    if (node && typeof node === 'object') {
      if (node.type === 'object') assert.equal(node.additionalProperties, false);
      Object.values(node).forEach(walk);
    }
  };
  walk(EXTRACTION_SCHEMA);
});

test('normalize: ids, course matching, Buddhist year, bad dates', () => {
  const raw: RawResult = {
    is_assignment: true,
    items: [
      { title: 'Lab 3', course_id: 'c1', course_code: null, course_name: null, type: 'ASSIGNMENT', start_date: null, due_date: '2569-10-24', due_time: '23:59', details: 'Build REST API' },
      { title: 'Quiz 2', course_id: 'made-up', course_code: 'itcs 312', course_name: null, type: 'small_quiz', start_date: null, due_date: '2026-13-01', due_time: '25:00', details: '' },
      { title: 'Essay', course_id: null, course_code: 'ITLG311', course_name: 'Business Communication', type: 'WEIRD', start_date: null, due_date: '2026-10-10', due_time: null, details: '' },
    ],
  };
  const [a, b, c] = normalizeItems(raw, sentAt, courses);
  assert.equal(a.courseId, 'c1');
  assert.equal(a.dueDate, '2026-10-24');
  assert.equal(a.dueTime, '23:59');
  assert.equal(a.startDate, '2026-10-17');

  assert.equal(b.courseId, 'c2'); // matched by code after rejecting the invented id
  assert.equal(b.type, 'SMALL_QUIZ');
  assert.equal(b.dueDate, null);
  assert.equal(b.dueTime, null);

  assert.equal(c.courseId, null);
  assert.equal(c.suggestedCourseCode, 'ITLG311');
  assert.equal(c.type, 'ASSIGNMENT');
  assert.equal(c.startDate, '2026-10-10'); // deadline already passed → start = deadline

  assert.deepEqual(normalizeItems({ is_assignment: false, items: [] }, sentAt, courses), []);
});

test('parse Claude response', () => {
  const r = parseResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"is_assignment":false,"items":[]}' }] });
  assert.equal(r.is_assignment, false);
  assert.throws(() => parseResponse({ stop_reason: 'refusal', content: [] }));
  assert.throws(() => parseResponse({ content: [{ type: 'text', text: 'not json' }] }));
});

test('flex confirm card', () => {
  const links = { liffId: '1234-abcd', webUrl: 'https://x.test' };
  const draft = {
    id: 'a1', title: 'Lab 3', courseLabel: 'ITCS258 · Back-end', courseIsNew: false, type: 'ASSIGNMENT',
    startDate: '2026-10-17', dueAt: makeDueAt('2026-10-24', '23:59'), dueTimeKnown: true, details: '',
  };
  const bubble: any = buildDraftBubble(draft, links, sentAt);
  const json = JSON.stringify(bubble);
  assert.ok(!json.includes('"text":""'), 'no empty text components');
  const labels = bubble.footer.contents.map((b: any) => b.action.label);
  assert.deepEqual(labels, ['Confirm', 'Edit', 'Cancel']);
  assert.equal(bubble.footer.contents[1].action.uri, 'https://liff.line.me/1234-abcd/liff/drafts/a1');

  // No due date → no Confirm button
  const noDue: any = buildDraftBubble({ ...draft, dueAt: null }, links, sentAt);
  assert.deepEqual(noDue.footer.contents.map((b: any) => b.action.label), ['Edit', 'Cancel']);

  const msgs: any[] = buildDraftMessages([draft, { ...draft, id: 'a2' }], links, sentAt);
  assert.equal(msgs.length, 2);
  assert.equal(msgs[1].contents.type, 'carousel');

  assert.equal(dueLabel(makeDueAt('2026-10-24', '23:59'), true, sentAt), 'Sat, 24 Oct 2026 23:59 (in 7 days)');
  assert.deepEqual(parsePostback('a=confirm&id=a1'), { action: 'confirm', id: 'a1' });
  assert.equal(parsePostback('junk'), null);
});
