import http from 'node:http';
import type { AddressInfo } from 'node:net';
import Anthropic from '@anthropic-ai/sdk';
import type { PrepDb, PrepLogRow } from '../lib/math-helper/access';
import { issuePrepToken } from '../lib/math-helper/prep-token';
import type { HelperDeps } from '../lib/math-helper/handler';

process.env.PREP_SESSION_SECRET = 'test-secret-test-secret-test-secret-1234';

export const CLASS_ID = 705;
export const TEACHER = '11111111-1111-4111-8111-111111111111';
export const OTHER_TEACHER = '22222222-2222-4222-8222-222222222222';
export const STUDENT = '33333333-3333-4333-8333-333333333333';
export const STUDENT_NAME = 'Шевченко Тарас';

export class FakeDb implements PrepDb {
  students = new Map([[STUDENT, { classId: CLASS_ID, fullName: STUDENT_NAME, active: true }]]);
  teacherClasses = new Set([`${TEACHER}:${CLASS_ID}`]);
  prep = new Map<string, boolean>([[`${CLASS_ID}:${TEACHER}:Геометрія`, true], [`${CLASS_ID}:${TEACHER}:Історія`, true]]);
  activeExam = new Set<string>();
  logs: PrepLogRow[] = [];
  supportsCount = true;

  async findStudent(id: string, classId: number) {
    const s = this.students.get(id);
    return s && s.active && s.classId === classId ? { id, fullName: s.fullName } : null;
  }
  async teacherHasClass(t: string, c: number) {
    return this.teacherClasses.has(`${t}:${c}`);
  }
  async listPrepSubjects(c: number, t: string) {
    return [...this.prep.entries()].filter(([k, v]) => v && k.startsWith(`${c}:${t}:`)).map(([k]) => k.split(':')[2]);
  }
  async hasActiveExam(s: string) {
    return this.activeExam.has(s);
  }
  async countRecentRequests(s: string, since: string) {
    if (!this.supportsCount) return null;
    return this.logs.filter((l) => l.studentId === s && (l as PrepLogRow & { at?: string }).at! >= since).length;
  }
  async insertLog(row: PrepLogRow) {
    this.logs.push({ ...row, at: new Date().toISOString() } as PrepLogRow);
  }
}

export function token() {
  return issuePrepToken({ classId: CLASS_ID, teacherId: TEACHER, studentId: STUDENT }).token;
}

/** Імітація Anthropic Messages API. Кожен виклик бере наступну відповідь із черги. */
export class MockAnthropic {
  requests: { body: Record<string, unknown>; headers: http.IncomingHttpHeaders }[] = [];
  queue: Array<{ status: number; body: unknown }> = [];
  server!: http.Server;
  url = '';

  async start() {
    this.server = http.createServer((req, res) => {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        this.requests.push({ body: JSON.parse(data || '{}'), headers: req.headers });
        const next = this.queue.shift() ?? { status: 500, body: { type: 'error', error: { type: 'api_error', message: 'no mock' } } };
        res.writeHead(next.status, { 'content-type': 'application/json', 'request-id': 'req_test' });
        res.end(JSON.stringify(next.body));
      });
    });
    await new Promise<void>((r) => this.server.listen(0, '127.0.0.1', r));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }
  stop() {
    return new Promise<void>((r) => this.server.close(() => r()));
  }
  reply(content: unknown[], extra: Record<string, unknown> = {}) {
    this.queue.push({
      status: 200,
      body: {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-haiku-5-5',
        content,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1200, output_tokens: 340, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 },
        ...extra,
      },
    });
  }
  error(status: number, type: string, message: string) {
    this.queue.push({ status, body: { type: 'error', error: { type, message } } });
  }
}

export function deps(db: PrepDb, mock: MockAnthropic | null, logs: Record<string, unknown>[] = []): HelperDeps {
  return {
    db,
    createClient: () => (mock ? new Anthropic({ apiKey: 'sk-test-not-real', baseURL: mock.url, maxRetries: 0 }) : null),
    log: (e) => logs.push(e),
  };
}

export function req(body: Record<string, unknown>, tok: string | null = token()) {
  const json = JSON.stringify(body);
  return new Request('http://localhost/api/ai-prep', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(tok ? { 'x-prep-token': tok } : {}) },
    body: json,
  });
}

export function baseBody(extra: Record<string, unknown> = {}) {
  return {
    subject: 'Геометрія',
    action: 'chat',
    message: 'Як знайти суміжний кут?',
    topic: 'Суміжні й вертикальні кути',
    exercise: { id: '', text: '', source: 'none', attemptMade: false, hintLevel: 0, simplerCount: 0, answerOnlyRequests: 0 },
    history: [],
    ...extra,
  };
}

// Мінімальні валідні зображення (лише заголовки форматів + дані)
export const JPEG_B64 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]).toString('base64');
export const PNG_B64 = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]).toString('base64');
