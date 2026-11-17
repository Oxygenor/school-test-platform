/**
 * Правила читання робіт (GET /api/works):
 *  - учитель (x-teacher-token) — лише власні роботи класу, з ключами відповідей;
 *  - учень із чинною сесією іспиту (?sessionId, статус writing/blocked) — лише
 *    призначений йому варіант, без ключів відповідей;
 *  - усі інші запити відхиляються. Параметр x-teacher-id-filter більше не діє.
 */

export interface WorkRow {
  id?: string;
  class_id: number;
  teacher_id: string;
  variant: number;
  subject: string;
  tasks: unknown;
  [k: string]: unknown;
}

export interface SessionRow {
  id: string;
  class_id: number;
  teacher_id: string | null;
  variant: number;
  subject: string | null;
  status: string;
}

export interface WorksDeps {
  getTeacher(token: string | null): Promise<{ id: string } | null>;
  getSession(sessionId: string): Promise<SessionRow | null>;
  listWorks(filter: { classId: number; teacherId?: string; variant?: number; subject?: string }): Promise<WorkRow[]>;
}

export type WorksResult = { status: number; body: { ok: true; works: WorkRow[] } | { ok: false; error: string } };

const ANSWER_KEYS = new Set(['correctChoice', 'answers', 'correctAnswer', 'correctAnswers', 'solution', 'answerKey']);

/** Прибирає ключі відповідей з умов для учня. */
export function stripAnswerKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripAnswerKeys(v)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (ANSWER_KEYS.has(k)) continue;
      out[k] = stripAnswerKeys(v);
    }
    return out as T;
  }
  return value;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveWorks(
  params: { token: string | null; classId: string | null; sessionId: string | null; variant: string | null; subject: string | null },
  deps: WorksDeps,
): Promise<WorksResult> {
  const teacher = params.token ? await deps.getTeacher(params.token) : null;
  if (teacher) {
    const classId = Number(params.classId);
    if (!Number.isInteger(classId) || classId <= 0) return { status: 400, body: { ok: false, error: 'Некоректний клас' } };
    const variant = params.variant ? Number(params.variant) : undefined;
    if (variant !== undefined && ![1, 2].includes(variant)) return { status: 400, body: { ok: false, error: 'Некоректний варіант' } };
    const works = await deps.listWorks({ classId, teacherId: teacher.id, variant, subject: params.subject || undefined });
    return { status: 200, body: { ok: true, works } };
  }

  if (params.sessionId) {
    if (!UUID_RE.test(params.sessionId)) return { status: 401, body: { ok: false, error: 'Немає доступу' } };
    const s = await deps.getSession(params.sessionId);
    if (!s || (s.status !== 'writing' && s.status !== 'blocked')) {
      return { status: 403, body: { ok: false, error: 'Сесія іспиту неактивна' } };
    }
    const works = await deps.listWorks({
      classId: s.class_id,
      teacherId: s.teacher_id ?? undefined,
      variant: s.variant,
      subject: s.subject ?? undefined,
    });
    // Для старих сесій без вчителя видаємо роботу лише за однозначного збігу.
    if (!s.teacher_id && works.length !== 1) return { status: 409, body: { ok: false, error: 'Не вдалося визначити роботу' } };
    return { status: 200, body: { ok: true, works: works.slice(0, 1).map(stripAnswerKeys) } };
  }

  return { status: 401, body: { ok: false, error: 'Немає доступу' } };
}
