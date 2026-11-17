import { validateDrawing } from '../geometry/types';
import { validateTask } from '../geometry/tasks';
import {
  HELPER_ACTIONS,
  MAX_HISTORY,
  MAX_HISTORY_ITEM,
  MAX_IMAGE_BASE64,
  MAX_MESSAGE,
  type HelperAction,
  type HelperRequest,
  type HistoryItem,
} from './types';

export type ValidationResult = { ok: true; value: HelperRequest } | { ok: false; status: number; error: string };

const bad = (error: string, status = 400): ValidationResult => ({ ok: false, status, error });

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function str(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' || v.length > max) return null;
  return v;
}

function int(v: unknown, min: number, max: number, dflt: number): number | null {
  if (v === undefined || v === null) return dflt;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) return null;
  return v;
}

/** Перевірка магічних байтів, щоб тип файлу не можна було підмінити полем mediaType. */
export function sniffImage(b64: string): (typeof IMAGE_TYPES)[number] | null {
  const head = Buffer.from(b64.slice(0, 24), 'base64');
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'image/png';
  if (head.slice(0, 4).toString('ascii') === 'RIFF' && head.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export function validateHelperRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('Некоректний запит.');
  const b = body as Record<string, unknown>;

  const action = b.action as HelperAction;
  if (!HELPER_ACTIONS.includes(action)) return bad('Невідома дія.');

  const subject = str(b.subject, 80);
  if (!subject) return bad('Не вказано предмет.');

  const message = str(b.message, MAX_MESSAGE);
  if (message === null) return bad(`Повідомлення задовге (до ${MAX_MESSAGE} символів).`);

  const topic = str(b.topic, 120);
  if (topic === null) return bad('Назва теми задовга.');

  // Історія
  const historyRaw = b.history ?? [];
  if (!Array.isArray(historyRaw) || historyRaw.length > 40) return bad('Некоректна історія.');
  const history: HistoryItem[] = [];
  for (const h of historyRaw.slice(-MAX_HISTORY)) {
    if (!h || typeof h !== 'object') return bad('Некоректна історія.');
    const role = (h as HistoryItem).role;
    const content = (h as HistoryItem).content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return bad('Некоректна історія.');
    const c = content.trim().slice(0, MAX_HISTORY_ITEM);
    if (c) history.push({ role, content: c });
  }
  while (history.length && history[0].role !== 'user') history.shift();

  // Стан вправи
  const e = (b.exercise && typeof b.exercise === 'object' ? b.exercise : {}) as Record<string, unknown>;
  const exText = str(e.text, MAX_MESSAGE);
  const exId = str(e.id, 40);
  const lastAttempt = str(e.lastAttempt, MAX_MESSAGE);
  const hintLevel = int(e.hintLevel, 0, 3, 0);
  const simplerCount = int(e.simplerCount, 0, 50, 0);
  const answerOnly = int(e.answerOnlyRequests, 0, 50, 0);
  const source = e.source ?? 'none';
  if (exText === null || exId === null || lastAttempt === null || hintLevel === null || simplerCount === null || answerOnly === null)
    return bad('Некоректний стан вправи.');
  if (source !== 'student' && source !== 'bot' && source !== 'none') return bad('Некоректний стан вправи.');

  // Мінітест
  let quiz: HelperRequest['quiz'] = null;
  if (action === 'quiz') {
    const q = (b.quiz && typeof b.quiz === 'object' ? b.quiz : null) as Record<string, unknown> | null;
    if (!q) return bad('Некоректний стан мінітесту.');
    const question = int(q.question, 1, 5, 1);
    const score = int(q.score, 0, 5, 0);
    const phase = q.phase;
    if (question === null || score === null || (phase !== 'start' && phase !== 'answer')) return bad('Некоректний стан мінітесту.');
    if (phase === 'start' ? question !== 1 || score !== 0 : score >= question) return bad('Некоректний стан мінітесту.');
    quiz = { question, score, phase };
  }

  // Фото
  let image: HelperRequest['image'] = null;
  if (b.image !== undefined && b.image !== null) {
    const im = b.image as Record<string, unknown>;
    if (typeof im !== 'object' || typeof im.data !== 'string' || typeof im.mediaType !== 'string') return bad('Некоректне фото.');
    if (im.data.length > MAX_IMAGE_BASE64) return bad('Фото завелике. Спробуй зробити знімок ближче або обрати менше фото.', 413);
    if (!IMAGE_TYPES.includes(im.mediaType as (typeof IMAGE_TYPES)[number]) || !BASE64_RE.test(im.data.slice(0, 2000)))
      return bad('Підтримуються фото у форматах JPEG, PNG або WebP.', 415);
    const sniffed = sniffImage(im.data);
    if (!sniffed || sniffed !== im.mediaType) return bad('Підтримуються фото у форматах JPEG, PNG або WebP.', 415);
    if (!BASE64_RE.test(im.data)) return bad('Некоректне фото.');
    image = { mediaType: sniffed, data: im.data };
  }
  const imagePurpose = b.imagePurpose === 'recheck' ? 'recheck' : 'new';

  if (!message.trim() && !image && action !== 'quiz' && action !== 'drawing') return bad('Напиши повідомлення або додай фото.');

  // Креслення
  let drawing: HelperRequest['drawing'] = null;
  if (b.drawing !== undefined && b.drawing !== null) {
    drawing = validateDrawing(b.drawing);
    if (!drawing) return bad('Некоректні дані рисунка.');
  }
  let geometryTask: HelperRequest['geometryTask'] = null;
  if (b.geometryTask !== undefined && b.geometryTask !== null) {
    geometryTask = validateTask(b.geometryTask);
    if (!geometryTask) return bad('Некоректна геометрична задача.');
  }
  if (action === 'drawing' && !drawing) return bad('Немає рисунка для перевірки.');

  return {
    ok: true,
    value: {
      subject,
      action,
      message: message.trim(),
      topic: topic.trim(),
      exercise: {
        id: exId,
        text: exText.trim(),
        source,
        confirmed: e.confirmed === true,
        attemptMade: e.attemptMade === true,
        lastAttempt: lastAttempt.trim(),
        hintLevel,
        simplerCount,
        answerOnlyRequests: answerOnly,
      },
      history,
      quiz,
      image,
      imagePurpose,
      drawing,
      geometryTask,
    },
  };
}
