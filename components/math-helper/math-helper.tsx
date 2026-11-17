'use client';

import { useEffect, useRef, useState } from 'react';
import { MathMarkdown } from './markdown';
import { GeometryPanel } from './geometry-panel';
import { ConstructionView } from './construction-view';
import { prepareImage, type HelperApi, type PreparedImage } from '@/lib/math-helper/client';
import { emptyExercise, type ExerciseState, type HelperAction, type HelperResponse, type PhotoMeta, type ReplyFigure } from '@/lib/math-helper/types';
import type { VerificationItem } from '@/lib/math-helper/verify';
import { subjectKind } from '@/lib/math-helper/topics';
import { construction, solve, statement, type GeometryTask } from '@/lib/geometry/tasks';
import { EMPTY_DRAWING, type Drawing } from '@/lib/geometry/types';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  photo?: string;
  verification?: VerificationItem[];
  figure?: ReplyFigure;
}

const fmtDeg = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace('.', ','));

/** Справжнє креслення під відповіддю: дані з тієї самої відповіді API, без окремого запиту. */
function ChatFigure({ figure }: { figure: ReplyFigure }) {
  const all = construction(figure.task);
  const gated = figure.stage === 'figure';
  const steps = gated ? all.filter((s) => s.stage === 'figure') : all;
  const ans = solve(figure.task);
  return (
    <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-2.5">
      <ConstructionView
        title={gated ? 'Рисунок до твоєї вправи' : statement(figure.task)}
        steps={steps}
        gated={gated}
        answer={`${ans.name} = ${fmtDeg(ans.value)}°`}
        initialStep={steps.length - 1}
        testId="chat-figure"
      />
    </div>
  );
}

interface QuizUi {
  active: boolean;
  question: number;
  score: number;
  finished: boolean;
}

interface SendOpts {
  action: HelperAction;
  text?: string;
  image?: PreparedImage | null;
  imagePurpose?: 'new' | 'recheck';
  drawing?: Drawing;
  geometryTask?: GeometryTask | null;
  /** Текст, який буде показано в чаті замість службового. */
  display?: string;
  /** Учень виправив розпізнану з фото умову. */
  correctsReadback?: boolean;
  /** Явний стан вправи (коли його щойно змінено в цьому ж обробнику). */
  exercise?: ExerciseState;
}

export interface MathHelperProps {
  api: HelperApi;
  subject: string;
  grade: number;
  className: string;
  topics: string[];
  studentFirstName?: string;
}

const ANSWER_ONLY_RE = /(просто|тільки|лише)\s+(дай|скажи|напиши)?\s*(мені\s+)?відповід|дай\s+(мені\s+)?відповід|розв.?яжи\s+(мені|за\s+мене)|відповіді\s+до\s+вс/i;

let seq = 0;
const uid = (p = 'm') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

const ACTIONS: { action: HelperAction | 'draw' | 'show' | 'new'; label: string; geometryOnly?: boolean }[] = [
  { action: 'draw', label: '✏️ Побудуй рисунок', geometryOnly: true },
  { action: 'explain', label: '📘 Поясни тему' },
  { action: 'solve_together', label: '🤝 Розв’яжімо разом' },
  { action: 'check', label: '🔍 Перевір мій розв’язок' },
  { action: 'hint', label: '💡 Дай підказку' },
  { action: 'simpler', label: '🍕 Поясни простіше' },
  { action: 'full', label: '📝 Поясни повністю' },
  { action: 'quiz', label: '🎯 Перевір себе' },
  { action: 'show', label: '📐 Покажи побудову', geometryOnly: true },
  { action: 'new', label: '🆕 Нова вправа' },
];

export function MathHelper({ api, subject, grade, className, topics, studentFirstName }: MathHelperProps) {
  const isGeometry = subjectKind(subject) !== 'algebra';
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'hello',
      role: 'assistant',
      content: `Привіт${studentFirstName ? `, ${studentFirstName}` : ''}! 👋 Я — **Математичний помічник** (${subject}, ${className} клас).\n\nОбери тему або надішли свою вправу — текстом чи фото. Я допоможу зрозуміти, з чого почати, перевірю твій розв’язок або влаштую мінітест.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [topic, setTopic] = useState('');
  const [customTopic, setCustomTopic] = useState(topics.length === 0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ text: string; retry: (() => void) | null } | null>(null);
  const [exercise, setExercise] = useState<ExerciseState>(emptyExercise());
  const [quiz, setQuiz] = useState<QuizUi>({ active: false, question: 1, score: 0, finished: false });
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [lastPhoto, setLastPhoto] = useState<PreparedImage | null>(null);
  const [photoReview, setPhotoReview] = useState<PhotoMeta | null>(null);
  const [correctingReadback, setCorrectingReadback] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [drawing, setDrawing] = useState<Drawing>(EMPTY_DRAWING);
  const [undoStack, setUndoStack] = useState<Drawing[]>([]);
  const [geoTask, setGeoTask] = useState<GeometryTask | null>(null);
  const [constructionRequest, setConstructionRequest] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending, error]);

  function history() {
    return messages
      .filter((m) => m.id !== 'hello')
      .slice(-8)
      .map((m) => ({ role: m.role, content: (m.photo ? '[фото] ' : '') + m.content }));
  }

  async function send(opts: SendOpts): Promise<HelperResponse | null> {
    if (sending) return null;
    const text = (opts.text ?? input).trim();
    const image = opts.image === undefined ? photo : opts.image;
    const purpose = opts.imagePurpose ?? 'new';
    if (!text && !image && opts.action !== 'quiz' && opts.action !== 'drawing') return null;

    // Стан вправи для цього запиту (застосовується лише після успішної відповіді).
    let ex: ExerciseState = opts.exercise ?? exercise;
    if (image && purpose === 'new') ex = { ...emptyExercise(), id: uid('e'), source: 'student' };
    if (opts.correctsReadback && text) ex = { ...ex, text, confirmed: true, source: 'student' };
    if (opts.action === 'hint') ex = { ...ex, hintLevel: Math.min(3, ex.hintLevel + 1) };
    if (opts.action === 'simpler') ex = { ...ex, simplerCount: ex.simplerCount + 1 };
    if (opts.action === 'check' && text) ex = { ...ex, attemptMade: true, lastAttempt: text.slice(0, 500) };
    if (ex.text && !ex.attemptMade && ANSWER_ONLY_RE.test(text)) ex = { ...ex, answerOnlyRequests: ex.answerOnlyRequests + 1 };

    const quizPayload =
      opts.action === 'quiz'
        ? quiz.active && !quiz.finished && opts.text === undefined
          ? { question: quiz.question, score: quiz.score, phase: 'answer' as const }
          : { question: 1, score: 0, phase: 'start' as const }
        : null;

    const userMsg: ChatMsg = { id: uid(), role: 'user', content: opts.display ?? (text || (image ? 'Допоможи розібрати задачу.' : '')), photo: image?.dataUrl };
    const showUser = !!userMsg.content || !!userMsg.photo;
    const prevInput = input;
    setSending(true);
    setError(null);
    if (showUser) setMessages((m) => [...m, userMsg]);
    if (opts.text === undefined) setInput('');
    if (image && opts.image === undefined) setPhoto(null);

    const body = {
      subject,
      action: opts.action,
      message: text,
      topic: topic.trim(),
      exercise: ex,
      history: history(),
      quiz: quizPayload,
      image: image ? { mediaType: image.mediaType, data: image.base64 } : null,
      imagePurpose: purpose,
      drawing: opts.drawing ?? null,
      geometryTask: opts.geometryTask ?? null,
    };

    const res = await api.ask(body);
    setSending(false);

    if (!res.ok) {
      // Нічого не втрачаємо: повертаємо текст і фото для повторної спроби.
      if (showUser) setMessages((m) => m.filter((x) => x.id !== userMsg.id));
      if (opts.text === undefined) setInput(prevInput || text);
      if (image && opts.image === undefined) setPhoto(image);
      setError({ text: res.error, retry: res.retryable ? () => void send(opts) : null });
      return null;
    }

    // У режимі «Покажи побудову» рисунок показує панель креслення, тож тут його не дублюємо.
    const figure = opts.action !== 'construction' && res.figure ? res.figure : undefined;
    setMessages((m) => [...m, { id: uid(), role: 'assistant', content: res.reply, verification: res.verification, figure }]);
    applyMeta(res, opts, text, ex, image, purpose);
    return res;
  }

  function applyMeta(res: HelperResponse, opts: SendOpts, text: string, exReq: ExerciseState, image: PreparedImage | null, purpose: string) {
    const meta = res.meta;
    const botSource = opts.action === 'explain' || opts.action === 'quiz' || (opts.action === 'solve_together' && !exReq.text && !text);
    let ex = exReq;
    if (meta.newExercise && meta.exercise) {
      ex = { ...emptyExercise(), id: uid('e'), text: meta.exercise, source: botSource ? 'bot' : 'student' };
      setGeoTask(null);
    } else if (meta.exercise && !ex.text) {
      ex = { ...ex, id: ex.id || uid('e'), text: meta.exercise, source: ex.source !== 'none' ? ex.source : botSource ? 'bot' : 'student' };
    }
    if (meta.attempt && text && opts.action !== 'quiz') ex = { ...ex, attemptMade: true, lastAttempt: text.slice(0, 500) };

    if (image && purpose === 'new') {
      setLastPhoto(image);
      if (meta.photo) {
        if (meta.photo.kind === 'attempt') ex = { ...ex, attemptMade: true };
        if (meta.photo.readback && meta.photo.kind !== 'several') ex = { ...ex, text: meta.photo.readback, source: 'student', confirmed: false };
        setPhotoReview(meta.photo);
      }
    }
    setExercise(ex);

    if (opts.action === 'quiz') {
      if (!quiz.active || quiz.finished || opts.text !== undefined) {
        setQuiz({ active: true, question: 1, score: 0, finished: false });
      } else {
        const score = quiz.score + (meta.quizCorrect === true ? 1 : 0);
        if (quiz.question >= 5) setQuiz({ active: true, question: 5, score, finished: true });
        else setQuiz({ active: true, question: quiz.question + 1, score, finished: false });
      }
    }
  }

  function newExercise() {
    setExercise(emptyExercise());
    setPhotoReview(null);
    setLastPhoto(null);
    setGeoTask(null);
    setMessages((m) => [...m, { id: uid(), role: 'assistant', content: 'Гаразд, починаємо нову вправу. Надішли умову текстом або фото.' }]);
  }

  function onAction(a: (typeof ACTIONS)[number]['action']) {
    setError(null);
    switch (a) {
      case 'draw':
        setShowBoard((s) => !s);
        return;
      case 'show':
        setShowBoard(true);
        setConstructionRequest((n) => n + 1);
        return;
      case 'new':
        newExercise();
        return;
      case 'quiz':
        void send({ action: 'quiz', text: `Перевір мене: мінітест${topic ? ` з теми «${topic}»` : ''}.`, image: null });
        return;
      case 'explain': {
        const t = input.trim() || (topic ? `Поясни тему «${topic}».` : '');
        if (!t) {
          setError({ text: 'Обери тему зверху або напиши, яку тему пояснити.', retry: null });
          return;
        }
        void send({ action: 'explain', text: t, image: null });
        if (input.trim()) setInput('');
        return;
      }
      case 'check': {
        if (!input.trim() && !photo) {
          setError({ text: 'Напиши свій розв’язок або відповідь у полі нижче (чи прикріпи фото), а потім натисни «Перевір мій розв’язок».', retry: null });
          return;
        }
        void send({ action: 'check' });
        return;
      }
      case 'hint':
      case 'simpler':
      case 'full':
      case 'solve_together': {
        const dflt: Record<string, string> = {
          hint: 'Дай підказку до наступного кроку.',
          simpler: 'Поясни простіше.',
          full: 'Поясни повністю.',
          solve_together: exercise.text ? 'Розв’яжімо разом цю вправу.' : 'Розв’яжімо разом вправу з цієї теми.',
        };
        if ((a === 'hint' || a === 'full') && !exercise.text && !input.trim() && !photo) {
          setError({ text: 'Спочатку надішли вправу (текстом чи фото) — тоді допоможу саме з нею.', retry: null });
          return;
        }
        if (input.trim() || photo) void send({ action: a });
        else void send({ action: a, text: dflt[a], image: null });
        return;
      }
      default:
        void send({ action: a });
    }
  }

  function submitInput() {
    if (sending) return;
    if (quiz.active && !quiz.finished) {
      if (!input.trim()) return;
      void send({ action: 'quiz' });
      return;
    }
    if (correctingReadback) {
      setCorrectingReadback(false);
      setPhotoReview(null);
      void send({ action: 'chat', correctsReadback: true });
      return;
    }
    void send({ action: 'chat' });
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    setError(null);
    try {
      setPhoto(await prepareImage(file));
    } catch (err) {
      setError({ text: (err as Error).message, retry: null });
    }
    setPhotoBusy(false);
  }

  function drawingChange(next: Drawing, opts?: { pushUndo?: boolean }) {
    if (opts?.pushUndo) setUndoStack((s) => [...s.slice(-49), drawing]);
    setDrawing(next);
  }

  const lastIsAssistant = messages[messages.length - 1]?.role === 'assistant';

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-950 text-white">
      {/* Шапка */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-lg">🧮</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Математичний помічник</div>
          <div className="truncate text-xs text-slate-400">
            {subject} · {className} клас
          </div>
        </div>
      </div>

      {/* Тема */}
      <div className="flex gap-2 border-b border-slate-900 px-4 py-2">
        {!customTopic ? (
          <select
            value={topic}
            onChange={(e) => (e.target.value === '__own' ? (setCustomTopic(true), setTopic('')) : setTopic(e.target.value))}
            className="min-w-0 flex-1 rounded-xl bg-slate-800 px-3 py-2 text-sm outline-none"
            aria-label="Тема"
          >
            <option value="">Тема: обери зі списку</option>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="__own">✍️ Своя тема…</option>
          </select>
        ) : (
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value.slice(0, 120))}
            placeholder="Тема, напр. «Дроби» або «Бісектриса кута»"
            className="min-w-0 flex-1 rounded-xl bg-slate-800 px-3 py-2 text-sm outline-none placeholder:text-slate-500"
            aria-label="Тема"
          />
        )}
        {customTopic && topics.length > 0 && (
          <button onClick={() => setCustomTopic(false)} className="rounded-xl px-2 text-xs text-slate-400">
            Список
          </button>
        )}
      </div>

      {/* Повідомлення */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4" data-testid="chat">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm sm:max-w-[85%] ${
                msg.role === 'user' ? 'rounded-br-sm bg-indigo-600 text-white' : 'rounded-bl-sm bg-slate-800 text-slate-100'
              }`}
              data-role={msg.role}
            >
              {msg.photo && <img src={msg.photo} alt="Фото задачі" className="mb-2 max-h-48 rounded-xl" />}
              {msg.role === 'user' ? <span className="whitespace-pre-wrap">{msg.content}</span> : <MathMarkdown content={msg.content} />}
              {msg.figure && <ChatFigure figure={msg.figure} />}
              {msg.verification?.filter((v) => v.status === 'confirmed').map((v, i) => (
                <div key={i} className="mt-2 rounded-xl bg-emerald-950/70 px-2 py-1 text-xs text-emerald-200" data-testid="verified">
                  ✓ Перевірено кодом: {v.text}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Розпізнана умова з фото */}
        {photoReview && !sending && lastIsAssistant && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3 text-sm" data-testid="photo-review">
            {photoReview.kind === 'several' && photoReview.exercises.length > 0 ? (
              <>
                <div className="mb-2 text-slate-300">Обери одну вправу:</div>
                <div className="flex flex-wrap gap-2">
                  {photoReview.exercises.map((x, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const chosen: ExerciseState = { ...emptyExercise(), id: uid('e'), text: x, source: 'student', confirmed: true };
                        setExercise(chosen);
                        setPhotoReview(null);
                        void send({ action: 'chat', text: `Обираю: ${x}`, image: null, exercise: chosen });
                      }}
                      className="rounded-xl bg-slate-800 px-3 py-1.5 text-left text-xs hover:bg-slate-700"
                    >
                      {x}
                    </button>
                  ))}
                </div>
              </>
            ) : photoReview.readback ? (
              <>
                <div className="text-slate-400">Чи правильно я прочитав умову?</div>
                {photoReview.unclear.length > 0 && <div className="mt-1 text-amber-300">Нечітко: {photoReview.unclear.join('; ')}</div>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setExercise((e) => ({ ...e, text: photoReview.readback, confirmed: true }));
                      setPhotoReview(null);
                    }}
                    className="rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold"
                  >
                    ✓ Так, правильно
                  </button>
                  <button
                    onClick={() => {
                      setInput(photoReview.readback);
                      setCorrectingReadback(true);
                    }}
                    className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs font-semibold"
                  >
                    ✏️ Виправити умову
                  </button>
                  {lastPhoto && (
                    <button
                      onClick={() =>
                        void send({
                          action: 'chat',
                          text: input.trim() || 'Подивись ще раз на фото: перевір числа, знаки й позначення в умові.',
                          image: lastPhoto,
                          imagePurpose: 'recheck',
                        })
                      }
                      className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs font-semibold"
                    >
                      🔍 Подивись на фото ще раз
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}

        {quiz.active && quiz.finished && !sending && (
          <div className="rounded-2xl border border-violet-700 bg-violet-950/60 p-3 text-sm" data-testid="quiz-summary">
            <div className="font-semibold">🎯 Мінітест завершено: {quiz.score} з 5</div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => onAction('quiz')} className="rounded-xl bg-violet-700 px-3 py-1.5 text-xs font-semibold">
                Пройти ще раз
              </button>
              <button onClick={() => setQuiz({ active: false, question: 1, score: 0, finished: false })} className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs">
                Закрити
              </button>
            </div>
          </div>
        )}

        {showBoard && (
          <GeometryPanel
            exercise={exercise}
            drawing={drawing}
            onDrawingChange={drawingChange}
            onUndo={() => {
              setUndoStack((s) => {
                if (!s.length) return s;
                setDrawing(s[s.length - 1]);
                return s.slice(0, -1);
              });
            }}
            canUndo={undoStack.length > 0}
            task={geoTask}
            onTaskChange={setGeoTask}
            constructionRequest={constructionRequest}
            busy={sending}
            onExplain={(d, t) =>
              void send({
                action: 'drawing',
                text: input.trim() || (t ? 'Поясни, що не так із моїм рисунком і що виправити.' : 'Перевір мій рисунок до цієї вправи.'),
                drawing: d,
                geometryTask: t,
                image: null,
                display: '✏️ Перевір мій рисунок',
              })
            }
            onConstructionFallback={async () => {
              const r = await send({ action: 'construction', text: `Покажи побудову до вправи: ${exercise.text}`, image: null, display: '📐 Покажи побудову' });
              const t = r?.meta.construction ?? null;
              return t ? { ...t, source: exercise.source === 'bot' ? 'preset' : 'student' } : null;
            }}
            onClose={() => setShowBoard(false)}
          />
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-slate-800 px-4 py-3 text-sm text-slate-400" data-testid="thinking">
              Помічник думає…
            </div>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center gap-2 text-center text-sm text-rose-300" data-testid="error">
            <span>{error.text}</span>
            {error.retry && (
              <button onClick={error.retry} className="rounded-xl border border-rose-400 px-3 py-1 text-xs" data-testid="retry">
                ↻ Спробувати ще раз
              </button>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Стан вправи / мінітесту */}
      {(quiz.active && !quiz.finished) || exercise.text ? (
        <div className="flex items-center gap-2 border-t border-slate-900 px-4 py-1.5 text-xs text-slate-400">
          {quiz.active && !quiz.finished ? (
            <>
              <span data-testid="quiz-progress">
                🎯 Мінітест · питання {quiz.question}/5 · правильних {quiz.score}
              </span>
              <button onClick={() => setQuiz({ active: false, question: 1, score: 0, finished: false })} className="ml-auto rounded-lg border border-slate-700 px-2 py-0.5">
                Завершити
              </button>
            </>
          ) : (
            <span className="truncate" data-testid="exercise-bar">
              📌 {exercise.text}
              {exercise.hintLevel > 0 && ` · підказок: ${exercise.hintLevel}`}
            </span>
          )}
        </div>
      ) : null}

      {/* Дії */}
      <div className="flex gap-2 overflow-x-auto px-3 pt-2 pb-1 [scrollbar-width:none]" data-testid="actions">
        {ACTIONS.filter((a) => !a.geometryOnly || isGeometry).map((a) => (
          <button
            key={a.action}
            onClick={() => onAction(a.action)}
            disabled={sending}
            className={`shrink-0 rounded-2xl px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ${
              a.action === 'draw' ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'border border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
            data-action={a.action}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Фото до надсилання */}
      {photo && (
        <div className="flex items-center gap-2 px-4 pt-2" data-testid="photo-preview">
          <img src={photo.dataUrl} alt="Прикріплене фото" className="h-14 w-14 rounded-lg object-cover" />
          <span className="text-xs text-slate-400">Фото готове. Можна надіслати без тексту.</span>
          <button onClick={() => setPhoto(null)} className="ml-auto rounded-lg border border-slate-700 px-2 py-1 text-xs" aria-label="Прибрати фото">
            ✕ Прибрати
          </button>
        </div>
      )}

      {/* Поле вводу */}
      <div className="flex items-end gap-2 border-t border-slate-800 px-3 py-3">
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickFile} data-testid="camera-input" />
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} data-testid="gallery-input" />
        <button
          onClick={() => cameraRef.current?.click()}
          disabled={sending || photoBusy}
          className="rounded-2xl bg-slate-800 px-3 py-3 text-base disabled:opacity-40"
          title="Сфотографувати задачу"
          aria-label="Сфотографувати задачу"
        >
          📷
        </button>
        <button
          onClick={() => galleryRef.current?.click()}
          disabled={sending || photoBusy}
          className="rounded-2xl bg-slate-800 px-3 py-3 text-base disabled:opacity-40"
          title="Прикріпити фото з галереї"
          aria-label="Прикріпити фото"
        >
          🖼️
        </button>
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submitInput();
            }
          }}
          placeholder={
            quiz.active && !quiz.finished
              ? 'Твоя відповідь…'
              : correctingReadback
                ? 'Виправ умову і надішли'
                : photoBusy
                  ? 'Готую фото…'
                  : 'Вправа чи питання…'
          }
          className="max-h-32 min-h-[44px] min-w-0 flex-1 resize-none rounded-2xl bg-slate-800 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500"
          disabled={sending}
          data-testid="input"
        />
        <button
          onClick={submitInput}
          disabled={sending || (!input.trim() && !photo)}
          className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold transition hover:bg-indigo-500 disabled:opacity-40"
          aria-label="Надіслати"
          data-testid="send"
        >
          →
        </button>
      </div>
    </div>
  );
}
