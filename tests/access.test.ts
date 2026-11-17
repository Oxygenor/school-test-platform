import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FakeDb, MockAnthropic, deps, req, baseBody, token, CLASS_ID, TEACHER, OTHER_TEACHER, STUDENT } from './helpers';
import { handleAiPrep } from '../lib/math-helper/handler';
import { checkPrepAccess } from '../lib/math-helper/access';
import { issuePrepToken, verifyPrepToken } from '../lib/math-helper/prep-token';
import { resetRateLimitMemory } from '../lib/math-helper/rate-limit';
import { resolveWorks, type WorksDeps, type WorkRow, type SessionRow } from '../lib/works-access';

const mock = new MockAnthropic();
before(() => mock.start());
after(() => mock.stop());
beforeEach(() => {
  mock.requests = [];
  mock.queue = [];
  resetRateLimitMemory();
});

test('токен: підпис, строк дії й підробка', () => {
  const t = token();
  assert.ok(verifyPrepToken(t));
  const [payload, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ v: 1, cid: CLASS_ID, tid: OTHER_TEACHER, sid: STUDENT, exp: 9e9 })).toString('base64url');
  assert.equal(verifyPrepToken(`${forged}.${sig}`), null, 'змінений payload відхиляється');
  assert.equal(verifyPrepToken(`${payload}.AAAA`), null);
  const expired = issuePrepToken({ classId: CLASS_ID, teacherId: TEACHER, studentId: STUDENT }, Date.now() - 3 * 3600_000).token;
  assert.equal(verifyPrepToken(expired), null, 'прострочений токен відхиляється');
});

test('доступ: без токена — 401 без виклику моделі', async () => {
  const db = new FakeDb();
  const res = await handleAiPrep(req(baseBody(), null), deps(db, mock));
  assert.equal(res.status, 401);
  assert.equal(mock.requests.length, 0);
});

test('доступ: старий клієнт із classId/teacherId/tasks без токена — 401', async () => {
  const db = new FakeDb();
  const res = await handleAiPrep(
    req({ ...baseBody(), classId: CLASS_ID, teacherId: TEACHER, tasks: ['1. Знайдіть x'], studentName: 'Хтось' }, null),
    deps(db, mock),
  );
  assert.equal(res.status, 401);
  assert.equal(mock.requests.length, 0);
});

test('доступ: після вимкнення підготовки — 403 без виклику моделі', async () => {
  const db = new FakeDb();
  mock.reply([{ type: 'text', text: 'Ок <meta>{}</meta>' }]);
  const ok = await handleAiPrep(req(baseBody()), deps(db, mock));
  assert.equal(ok.status, 200);
  assert.equal(mock.requests.length, 1);

  db.prep.set(`${CLASS_ID}:${TEACHER}:Геометрія`, false);
  const res = await handleAiPrep(req(baseBody()), deps(db, mock));
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /не відкрив підготовку/);
  assert.equal(mock.requests.length, 1, 'модель не викликано вдруге');
});

test('доступ: учень іншого класу / неактивний / вчитель без класу — 401', async () => {
  const db = new FakeDb();
  db.students.get(STUDENT)!.active = false;
  assert.equal((await handleAiPrep(req(baseBody()), deps(db, mock))).status, 401);
  const db2 = new FakeDb();
  db2.teacherClasses.clear();
  assert.equal((await handleAiPrep(req(baseBody()), deps(db2, mock))).status, 401);
  assert.equal(mock.requests.length, 0);
});

test('доступ: під час активного іспиту помічник недоступний', async () => {
  const db = new FakeDb();
  db.activeExam.add(STUDENT);
  const res = await handleAiPrep(req(baseBody()), deps(db, mock));
  assert.equal(res.status, 403);
  assert.equal(mock.requests.length, 0);
});

test('доступ: нематематичний предмет із увімкненою підготовкою — 403', async () => {
  const db = new FakeDb();
  const res = await handleAiPrep(req(baseBody({ subject: 'Історія' })), deps(db, mock));
  assert.equal(res.status, 403);
  const a = await checkPrepAccess(token(), null, db);
  assert.ok(a.ok && a.ctx.subjects.join() === 'Геометрія');
});

test('обмеження частоти: 7-й запит за хвилину — 429 без виклику моделі', async () => {
  const db = new FakeDb();
  for (let i = 0; i < 6; i++) mock.reply([{ type: 'text', text: `Відповідь ${i} <meta>{}</meta>` }]);
  for (let i = 0; i < 6; i++) assert.equal((await handleAiPrep(req(baseBody()), deps(db, mock))).status, 200);
  const res = await handleAiPrep(req(baseBody()), deps(db, mock));
  assert.equal(res.status, 429);
  assert.equal(mock.requests.length, 6);
});

test('обмеження частоти діє через лічильник БД (інший інстанс)', async () => {
  const db = new FakeDb();
  for (let i = 0; i < 6; i++) await db.insertLog({ classId: CLASS_ID, teacherId: TEACHER, studentId: STUDENT, studentName: '', subject: 'Геометрія', message: 'x', mode: 'chat', model: null, usage: null });
  const res = await handleAiPrep(req(baseBody()), deps(db, mock));
  assert.equal(res.status, 429);
  assert.equal(mock.requests.length, 0);
});

// ---------------- /api/works ----------------

function worksDeps(): WorksDeps & { works: WorkRow[]; sessions: Map<string, SessionRow> } {
  const works: WorkRow[] = [
    { class_id: CLASS_ID, teacher_id: TEACHER, variant: 1, subject: 'Геометрія', tasks: [{ text: 'Задача 1', choices: ['1', '2'], correctChoice: 1 }] },
    { class_id: CLASS_ID, teacher_id: TEACHER, variant: 2, subject: 'Геометрія', tasks: [{ type: 'fill_blank', template: '[___]', answers: ['5'] }] },
    { class_id: CLASS_ID, teacher_id: OTHER_TEACHER, variant: 1, subject: 'Алгебра', tasks: [{ text: 'Чужа', correctChoice: 0 }] },
  ];
  const sessions = new Map<string, SessionRow>([
    ['44444444-4444-4444-8444-444444444444', { id: '44444444-4444-4444-8444-444444444444', class_id: CLASS_ID, teacher_id: TEACHER, variant: 2, subject: 'Геометрія', status: 'writing' }],
    ['55555555-5555-4555-8555-555555555555', { id: '55555555-5555-4555-8555-555555555555', class_id: CLASS_ID, teacher_id: TEACHER, variant: 1, subject: 'Геометрія', status: 'finished' }],
  ]);
  return {
    works,
    sessions,
    getTeacher: async (t) => (t === 'teacher-token' ? { id: TEACHER } : null),
    getSession: async (id) => sessions.get(id) ?? null,
    listWorks: async (f) =>
      works.filter(
        (w) =>
          w.class_id === f.classId &&
          (!f.teacherId || w.teacher_id === f.teacherId) &&
          (!f.variant || w.variant === f.variant) &&
          (!f.subject || w.subject === f.subject),
      ),
  };
}

const P = (o: Partial<{ token: string; classId: string; sessionId: string; variant: string; subject: string }>) => ({
  token: o.token ?? null,
  classId: o.classId ?? null,
  sessionId: o.sessionId ?? null,
  variant: o.variant ?? null,
  subject: o.subject ?? null,
});

test('works: сторонній запит за classId не повертає контрольну', async () => {
  const r = await resolveWorks(P({ classId: String(CLASS_ID) }), worksDeps());
  assert.equal(r.status, 401);
  assert.equal(r.body.ok, false);
});

test('works: недійсний токен учителя — 401', async () => {
  const r = await resolveWorks(P({ classId: String(CLASS_ID), token: 'forged' }), worksDeps());
  assert.equal(r.status, 401);
});

test('works: учитель відкриває й друкує лише свою роботу (з ключами)', async () => {
  const d = worksDeps();
  const all = await resolveWorks(P({ classId: String(CLASS_ID), token: 'teacher-token' }), d);
  assert.equal(all.status, 200);
  assert.ok(all.body.ok && all.body.works.every((w) => w.teacher_id === TEACHER));
  assert.ok(all.body.ok && all.body.works.length === 2);
  const print = await resolveWorks(P({ classId: String(CLASS_ID), token: 'teacher-token', variant: '1', subject: 'Геометрія' }), d);
  assert.ok(print.body.ok && print.body.works.length === 1);
  assert.ok(print.body.ok && (print.body.works[0].tasks as { correctChoice: number }[])[0].correctChoice === 1, 'учитель бачить ключ');
});

test('works: учень на іспиті отримує лише призначений варіант без ключів', async () => {
  const r = await resolveWorks(P({ sessionId: '44444444-4444-4444-8444-444444444444', classId: '1' }), worksDeps());
  assert.equal(r.status, 200);
  assert.ok(r.body.ok);
  if (!r.body.ok) return;
  assert.equal(r.body.works.length, 1);
  assert.equal(r.body.works[0].variant, 2);
  assert.deepEqual(r.body.works[0].tasks, [{ type: 'fill_blank', template: '[___]' }]);
});

test('works: завершена або вигадана сесія — немає доступу', async () => {
  const d = worksDeps();
  assert.equal((await resolveWorks(P({ sessionId: '55555555-5555-4555-8555-555555555555' }), d)).status, 403);
  assert.equal((await resolveWorks(P({ sessionId: '66666666-6666-4666-8666-666666666666' }), d)).status, 403);
  assert.equal((await resolveWorks(P({ sessionId: 'not-a-uuid' }), d)).status, 401);
});
