import Anthropic from '@anthropic-ai/sdk';
import { validateTask } from '../geometry/tasks';
import type { HelperAction, PhotoMeta, ReplyMeta } from './types';

export const DEFAULT_MODEL = 'claude-haiku-5-5';

export function getModelName(): string {
  const m = process.env.ANTHROPIC_MODEL?.trim();
  return m && /^[a-z0-9.-]{3,80}$/i.test(m) ? m : DEFAULT_MODEL;
}

/** Моделі, для яких перевірено підтримку output_config.effort. */
const EFFORT_MODELS = new Set([
  'claude-haiku-5-5',
  'claude-sonnet-5-5',
  'claude-sonnet-5',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-fable-5-2',
]);

export function supportsEffort(model: string): boolean {
  return EFFORT_MODELS.has(model);
}

/** Бюджет токенів відповіді (разом із мисленням моделі) та рівень effort для дії. */
export function budgetFor(action: HelperAction, hasImage: boolean): { maxTokens: number; effort: 'low' | 'medium' } {
  const base: Record<HelperAction, number> = {
    hint: 1500,
    solve_together: 2000,
    simpler: 2000,
    quiz: 1600,
    chat: 2500,
    explain: 2500,
    drawing: 1800,
    construction: 2500,
    check: 3500,
    full: 6000,
  };
  const heavy = action === 'full' || action === 'check' || hasImage;
  return { maxTokens: base[action] + (hasImage ? 1500 : 0), effort: heavy ? 'medium' : 'low' };
}

/** Збирає всі текстові блоки в порядку відповіді (thinking та інші блоки пропускаються). */
export function collectText(content: ReadonlyArray<{ type: string; text?: string }>): string {
  return content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('');
}

const META_RE = /<meta>([\s\S]*?)<\/meta>\s*$/;

export function emptyMeta(): ReplyMeta {
  return { exercise: null, newExercise: false, attempt: false, quizCorrect: null, photo: null, construction: null, figureSource: null };
}

/** Відокремлює службовий рядок від тексту для учня. Ніколи не кидає винятків. */
export function splitMeta(raw: string): { text: string; meta: ReplyMeta; checks: unknown } {
  const meta = emptyMeta();
  let text = raw;
  let checks: unknown = [];
  const m = META_RE.exec(raw);
  if (m) {
    text = raw.slice(0, m.index);
    try {
      const j = JSON.parse(m[1]) as Record<string, unknown>;
      if (typeof j.exercise === 'string' && j.exercise.trim()) meta.exercise = j.exercise.trim().slice(0, 1000);
      meta.newExercise = j.new_exercise === true;
      meta.attempt = j.attempt === true;
      meta.quizCorrect = typeof j.quiz_correct === 'boolean' ? j.quiz_correct : null;
      meta.photo = parsePhoto(j.photo);
      meta.construction = j.construction ? validateTask({ ...(j.construction as object), source: 'student' }) : null;
      meta.figureSource = j.figure_source === 'example' || j.figure_source === 'student' ? j.figure_source : null;
      checks = j.checks ?? [];
    } catch {
      /* пошкоджений службовий рядок — ігноруємо */
    }
  } else {
    // обрізаний або відсутній службовий рядок
    const cut = raw.lastIndexOf('<meta>');
    if (cut >= 0) text = raw.slice(0, cut);
  }
  return { text: text.trim(), meta, checks };
}

function parsePhoto(p: unknown): PhotoMeta | null {
  if (!p || typeof p !== 'object') return null;
  const r = p as Record<string, unknown>;
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((s) => s.slice(0, 300)).slice(0, 12) : []);
  const kinds = ['problem', 'attempt', 'several', 'other'] as const;
  return {
    readback: typeof r.readback === 'string' ? r.readback.slice(0, 2000) : '',
    unclear: strs(r.unclear),
    kind: kinds.includes(r.kind as (typeof kinds)[number]) ? (r.kind as PhotoMeta['kind']) : 'other',
    exercises: strs(r.exercises),
  };
}

export interface ModelErrorInfo {
  status: number;
  error: string;
  retryable: boolean;
  /** Для серверного журналу: лише клас помилки та HTTP-статус, без вмісту. */
  logTag: string;
}

export const MSG = {
  unavailable: 'Помічник тимчасово недоступний. Спробуй пізніше або повідом учителя.',
  busy: 'Помічник зараз дуже зайнятий. Спробуй ще раз за хвилину.',
  network: 'Не вдалося зв’язатися з помічником. Перевір інтернет і спробуй ще раз — твоє повідомлення збережено.',
  empty: 'Помічник не зміг відповісти. Спробуй ще раз або переформулюй запитання.',
  tooMany: 'Забагато запитів поспіль. Зроби коротку перерву й спробуй знову.',
};

export function mapModelError(e: unknown): ModelErrorInfo {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return { status: 503, error: MSG.unavailable, retryable: false, logTag: `auth:${(e as InstanceType<typeof Anthropic.APIError>).status}` };
  }
  if (e instanceof Anthropic.RateLimitError) return { status: 503, error: MSG.busy, retryable: true, logTag: 'rate_limit:429' };
  if (e instanceof Anthropic.APIConnectionError) return { status: 503, error: MSG.network, retryable: true, logTag: 'connection' };
  if (e instanceof Anthropic.BadRequestError || e instanceof Anthropic.NotFoundError) {
    // зокрема вичерпані кредити або недійсна модель — це конфігурація, не помилка учня
    return { status: 503, error: MSG.unavailable, retryable: false, logTag: `bad_request:${(e as InstanceType<typeof Anthropic.APIError>).status}` };
  }
  if (e instanceof Anthropic.APIError) {
    const s = e.status ?? 0;
    return { status: 503, error: s >= 500 ? MSG.busy : MSG.unavailable, retryable: s >= 500 || s === 0, logTag: `api:${s}` };
  }
  return { status: 500, error: MSG.empty, retryable: true, logTag: 'unknown' };
}
