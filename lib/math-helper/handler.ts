import type Anthropic from '@anthropic-ai/sdk';
import { checkPrepAccess, type PrepDb } from './access';
import { checkRateLimit, recordHit } from './rate-limit';
import { validateHelperRequest } from './validate';
import { BASE_SYSTEM_PROMPT, buildContext } from './prompt';
import { budgetFor, collectText, getModelName, mapModelError, MSG, splitMeta, supportsEffort } from './model';
import { runChecks, type VerificationItem } from './verify';
import { checkDrawing, type DrawingCheckResult } from '../geometry/check';
import type { HelperError, HelperRequest, HelperResponse } from './types';
import { figureForReply, stripAsciiDrawings } from './figure';

export interface HelperDeps {
  db: PrepDb;
  /** null — ключ не налаштовано (модель не викликаємо). */
  createClient: () => Pick<Anthropic, 'messages'> | null;
  log?: (event: Record<string, unknown>) => void;
}

const MAX_BODY_BYTES = 4_000_000;

const json = (body: HelperResponse | HelperError | Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

const fail = (status: number, error: string, retryable = false) => json({ ok: false, error, retryable }, status);

/** Дії, у яких відповідь не можна показувати як «перевірену кодом» (там немає готової відповіді). */
const NO_CHECK_ACTIONS = new Set(['hint', 'solve_together', 'simpler']);

function userText(req: HelperRequest): string {
  if (req.message) return req.message;
  if (req.image) return 'Допоможи розібрати задачу.';
  if (req.action === 'drawing') return 'Перевір мій рисунок.';
  if (req.action === 'quiz') return 'Починаємо мінітест.';
  return 'Допоможи, будь ласка.';
}

function logMessage(req: HelperRequest): string {
  if (req.action === 'quiz') return '[Мінітест]';
  if (req.action === 'check') return '[Перевір мій розв’язок]';
  if (req.action === 'drawing') return '[Рисунок]';
  if (!req.message && req.image) return '[Фото задачі]';
  return req.message.slice(0, 500);
}

export async function handleAiPrep(request: Request, deps: HelperDeps): Promise<Response> {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY_BYTES) return fail(413, 'Фото завелике. Спробуй зробити знімок ближче або обрати менше фото.');

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return fail(413, 'Фото завелике. Спробуй зробити знімок ближче або обрати менше фото.');
    body = JSON.parse(raw);
  } catch {
    return fail(400, 'Некоректний запит.');
  }

  const v = validateHelperRequest(body);
  if (!v.ok) return fail(v.status, v.error);
  const req = v.value;

  // Право на підготовку — до будь-якого звернення до моделі.
  const access = await checkPrepAccess(request.headers.get('x-prep-token'), req.subject, deps.db);
  if (!access.ok) return fail(access.status, access.error);
  const ctx = access.ctx;

  let drawingCheck: DrawingCheckResult | null = null;
  if (req.drawing && req.geometryTask) drawingCheck = checkDrawing(req.geometryTask, req.drawing);

  if (!(await checkRateLimit(ctx.studentId, deps.db))) return fail(429, MSG.tooMany, true);

  const client = deps.createClient();
  if (!client) {
    deps.log?.({ event: 'math_helper_error', tag: 'missing_key' });
    return fail(503, MSG.unavailable);
  }

  const model = getModelName();
  const { maxTokens, effort } = budgetFor(req.action, !!req.image);
  const content: Anthropic.ContentBlockParam[] = [];
  if (req.image) {
    content.push({ type: 'image', source: { type: 'base64', media_type: req.image.mediaType, data: req.image.data } });
  }
  content.push({ type: 'text', text: userText(req) });

  const messages: Anthropic.MessageParam[] = [...req.history.map((h) => ({ role: h.role, content: h.content })), { role: 'user', content }];

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: maxTokens,
    system: [
      { type: 'text', text: BASE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: buildContext(req, ctx.grade, drawingCheck) },
    ],
    messages,
  };
  if (supportsEffort(model)) params.output_config = { effort };

  recordHit(ctx.studentId);
  let response: Anthropic.Message;
  try {
    response = await client.messages.create(params);
  } catch (e) {
    const info = mapModelError(e);
    deps.log?.({ event: 'math_helper_error', tag: info.logTag, model, mode: req.action });
    return fail(info.status, info.error, info.retryable);
  }

  const usage = response.usage
    ? {
        input: response.usage.input_tokens ?? 0,
        output: response.usage.output_tokens ?? 0,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
        cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
      }
    : null;
  deps.log?.({ event: 'math_helper_usage', model: response.model ?? model, mode: req.action, image: !!req.image, stop: response.stop_reason, usage });

  try {
    await deps.db.insertLog({
      classId: ctx.classId,
      teacherId: ctx.teacherId,
      studentId: ctx.studentId,
      studentName: ctx.studentName,
      subject: ctx.subject,
      message: logMessage(req),
      mode: req.action,
      model: response.model ?? model,
      usage,
    });
  } catch {
    deps.log?.({ event: 'math_helper_error', tag: 'log_insert' });
  }

  if (response.stop_reason === 'refusal') {
    return json({
      ok: true,
      reply: 'З цим я допомогти не можу. Давай повернемося до математики: яку тему або вправу розберемо?',
      meta: splitMeta('').meta,
      verification: [],
      drawingCheck,
      figure: null,
      truncated: false,
    } satisfies HelperResponse);
  }

  const raw = collectText(response.content as ReadonlyArray<{ type: string; text?: string }>);
  const { text, meta, checks } = splitMeta(raw);
  if (!text) {
    deps.log?.({ event: 'math_helper_error', tag: `empty:${response.stop_reason}`, model, mode: req.action });
    return fail(502, MSG.empty, true);
  }

  const truncated = response.stop_reason === 'max_tokens';
  // Рисунки символами не показуємо: креслення йде структурованими даними під відповіддю.
  const stripped = stripAsciiDrawings(text);
  const figure = figureForReply({
    action: req.action,
    meta,
    exercise: req.exercise,
    asciiRemoved: stripped.removed,
    contextText: `${req.message}\n${stripped.text}`,
    topic: req.topic,
  });
  let reply = stripped.text || (figure ? 'Ось рисунок:' : text);
  if (truncated) reply += '\n\n_Відповідь вийшла задовгою й обірвалася. Напиши «продовж» або попроси коротше._';

  let verification: VerificationItem[] = [];
  if (!NO_CHECK_ACTIONS.has(req.action)) {
    verification = runChecks(checks);
    const refuted = verification.filter((x) => x.status === 'refuted');
    if (refuted.length) {
      reply += `\n\n> ⚠️ **Перевірка обчислень кодом не збіглася з поясненням вище.** ${refuted.map((r) => r.text).join(' ')} Звір, будь ласка, кроки з цими даними.`;
    }
  }

  return json({ ok: true, reply, meta, verification, drawingCheck, figure, truncated } satisfies HelperResponse);
}
