import type { Drawing } from '../geometry/types';
import type { GeometryTask } from '../geometry/tasks';
import type { DrawingCheckResult } from '../geometry/check';
import type { VerificationItem } from './verify';

export const HELPER_ACTIONS = [
  'chat',
  'explain',
  'solve_together',
  'check',
  'hint',
  'simpler',
  'full',
  'quiz',
  'drawing',
  'construction',
] as const;

export type HelperAction = (typeof HELPER_ACTIONS)[number];

/** Стан поточної вправи. Живе в браузері; скидається з новою вправою. */
export interface ExerciseState {
  id: string;
  text: string;
  source: 'student' | 'bot' | 'none';
  /** Умову з фото учень підтвердив — далі передаємо текст, а не фото. */
  confirmed: boolean;
  attemptMade: boolean;
  lastAttempt: string;
  hintLevel: number;
  simplerCount: number;
  answerOnlyRequests: number;
}

export interface QuizState {
  question: number; // 1..5
  score: number; // 0..5
  phase: 'start' | 'answer';
}

export interface HistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface ImageInput {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  data: string; // base64 без префікса data:
}

export interface HelperRequest {
  subject: string;
  action: HelperAction;
  message: string;
  topic: string;
  exercise: ExerciseState;
  history: HistoryItem[];
  quiz: QuizState | null;
  image: ImageInput | null;
  imagePurpose: 'new' | 'recheck';
  drawing: Drawing | null;
  geometryTask: GeometryTask | null;
}

export interface PhotoMeta {
  readback: string;
  unclear: string[];
  kind: 'problem' | 'attempt' | 'several' | 'other';
  exercises: string[];
}

export interface ReplyMeta {
  exercise: string | null;
  newExercise: boolean;
  attempt: boolean;
  quizCorrect: boolean | null;
  photo: PhotoMeta | null;
  construction: GeometryTask | null;
  /** До чого рисунок: навчальний приклад бота чи вправа учня. */
  figureSource: 'example' | 'student' | null;
}

/** Рисунок, який показується прямо під відповіддю в чаті. */
export interface ReplyFigure {
  task: GeometryTask;
  /** full — усі кроки з обчисленнями; figure — лише побудова (вправа учня до спроби). */
  stage: 'full' | 'figure';
}

export interface HelperResponse {
  ok: true;
  reply: string;
  meta: ReplyMeta;
  verification: VerificationItem[];
  drawingCheck: DrawingCheckResult | null;
  figure: ReplyFigure | null;
  truncated: boolean;
}

export interface HelperError {
  ok: false;
  error: string;
  retryable: boolean;
}

export function emptyExercise(): ExerciseState {
  return {
    id: '',
    text: '',
    source: 'none',
    confirmed: false,
    attemptMade: false,
    lastAttempt: '',
    hintLevel: 0,
    simplerCount: 0,
    answerOnlyRequests: 0,
  };
}

export const MAX_IMAGE_BASE64 = 3_000_000; // ≈2,2 МБ після стиснення в браузері
export const MAX_MESSAGE = 2000;
export const MAX_HISTORY = 8;
export const MAX_HISTORY_ITEM = 2500;
