import { PRESET_TASKS, type GeometryTask } from '../geometry/tasks';
import type { ExerciseState, HelperAction, ReplyFigure, ReplyMeta } from './types';

/** Блок коду, схожий на рисунок символами (ASCII). */
const CODE_BLOCK_RE = /```[^\n]*\n([\s\S]*?)```/g;

function looksLikeAsciiDrawing(body: string): boolean {
  const lines = body.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return false;
  const art = (body.match(/[\/\\|_*^<>·•○●∠-]/g) || []).length;
  const words = (body.match(/[а-яіїєґ]{4,}/gi) || []).length;
  return art >= 4 && words <= lines.length;
}

/** Прибирає з тексту рисунки символами; повертає, чи щось прибрано. */
export function stripAsciiDrawings(text: string): { text: string; removed: boolean } {
  let removed = false;
  const out = text.replace(CODE_BLOCK_RE, (m, body: string) => {
    if (!looksLikeAsciiDrawing(body)) return m;
    removed = true;
    return '';
  });
  return { text: out.replace(/\n{3,}/g, '\n\n').trim(), removed };
}

/** Локальний навчальний зразок за ключовими словами (коли модель намалювала символами). */
export function presetForText(text: string): GeometryTask | null {
  const t = text.toLowerCase();
  const kind =
    /бісектрис/.test(t) && /суміжн|протилежн|доповняльн|продовж/.test(t)
      ? 'bisector_adjacent'
      : /бісектрис/.test(t)
        ? 'angle_bisector'
        : /зовнішн\S* кут/.test(t)
          ? 'triangle_exterior'
          : /сум\S* кутів трикутник/.test(t)
            ? 'triangle_sum'
            : /суміжн/.test(t)
              ? 'adjacent'
              : null;
  return kind ? PRESET_TASKS.find((p) => p.kind === kind) ?? null : null;
}

/**
 * Рисунок для відповіді: з валідованих даних моделі в тій самій відповіді,
 * або локальний зразок, якщо модель спробувала намалювати символами.
 * Для вправи учня до змістовної спроби — лише етап побудови рисунка.
 */
export function figureForReply(input: {
  action: HelperAction;
  meta: ReplyMeta;
  exercise: ExerciseState;
  asciiRemoved: boolean;
  /** Запит учня й текст відповіді — основне джерело ключових слів. */
  contextText: string;
  /** Обрана тема — лише якщо в запиті й відповіді нічого не знайдено. */
  topic?: string;
}): ReplyFigure | null {
  const { action, meta, exercise } = input;
  if (action === 'drawing' || action === 'quiz') return null;

  let task: GeometryTask | null = null;
  if (meta.construction) {
    const forStudent =
      meta.figureSource === 'student' || (meta.figureSource === null && action === 'construction' && exercise.source === 'student');
    task = { ...meta.construction, source: forStudent ? 'student' : 'preset' };
  } else if (input.asciiRemoved) {
    task = presetForText(input.contextText) ?? presetForText(input.topic ?? '');
  }
  if (!task) return null;

  const attempted = exercise.attemptMade || meta.attempt;
  return { task, stage: task.source === 'student' && !attempted ? 'figure' : 'full' };
}
