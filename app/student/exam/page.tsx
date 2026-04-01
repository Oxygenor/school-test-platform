'use client';

import { Suspense, useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { works } from '@/data/works';
import { StudentSession } from '@/types';
import { formatSeconds } from '@/lib/utils';
import Calculator from '@/components/calculator';
import { MathText } from '@/components/math-text';
import NoSleep from 'nosleep.js';

const CHOICE_LABELS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ExamContent() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get('sessionId');

  const [showSignReminder, setShowSignReminder] = useState(true);
  const [session, setSession] = useState<StudentSession | null>(null);
  const [dbWork, setDbWork] = useState<{ work_type: string; title: string; duration_minutes: number; tasks: any[]; online_mode: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [calcOpen, setCalcOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [secondsBlocked, setSecondsBlocked] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [examEnded, setExamEnded] = useState(false);
  const [finishConfirm, setFinishConfirm] = useState(false);
  const [skippedWarning, setSkippedWarning] = useState<number[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [fontSize, setFontSize] = useState<'md' | 'lg' | 'xl'>('md');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [scoreResults, setScoreResults] = useState<{ score: number; maxScore: number; results: any[] } | null>(null);
  const [teacherMessage, setTeacherMessage] = useState<string | null>(null);

  // Shuffle order: shuffleOrderRef[taskIndex] = [origIdx0, origIdx1, ...]
  const shuffleOrderRef = useRef<Record<number, number[]>>({});

  // Matching state
  const [matchingVersion, setMatchingVersion] = useState(0);
  const matchingPendingRef = useRef<Record<number, number | null>>({});
  const matchingShuffleRef = useRef<Record<number, { left: number[]; right: number[] }>>({});
  const matchingLeftRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const matchingRightRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const matchingSvgRefs = useRef<Record<number, SVGSVGElement | null>>({});
  const matchingContainerRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const noSleepRef = useRef<any>(null);
  const focusLostCountRef = useRef(0);
  const exitTimerRef = useRef<any>(null);
  const exitStartRef = useRef<number | null>(null);

  // Налаштування з localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('examTheme') as 'light' | 'dark' | null;
    const savedFontSize = localStorage.getItem('examFontSize') as 'md' | 'lg' | 'xl' | null;
    if (savedTheme) setTheme(savedTheme);
    if (savedFontSize) setFontSize(savedFontSize);
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('examTheme', next);
      return next;
    });
  }

  function changeFontSize(size: 'md' | 'lg' | 'xl') {
    setFontSize(size);
    localStorage.setItem('examFontSize', size);
  }

  // Заборона перезавантаження
  useEffect(() => {
    function preventReload(e: any) { e.preventDefault(); e.returnValue = ''; }
    window.addEventListener('beforeunload', preventReload);
    return () => window.removeEventListener('beforeunload', preventReload);
  }, []);

  // Заборона копіювання, вставки та клавіатурних скорочень
  useEffect(() => {
    function disableCopy(e: any) { e.preventDefault(); }
    function blockShortcuts(e: KeyboardEvent) {
      const blocked = ['c', 'v', 'x', 'a', 'u', 's'];
      if ((e.ctrlKey || e.metaKey) && blocked.includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      if (e.key === 'PrintScreen') e.preventDefault();
    }
    document.addEventListener('copy', disableCopy);
    document.addEventListener('cut', disableCopy);
    document.addEventListener('paste', disableCopy);
    document.addEventListener('contextmenu', disableCopy);
    document.addEventListener('keydown', blockShortcuts);
    return () => {
      document.removeEventListener('copy', disableCopy);
      document.removeEventListener('cut', disableCopy);
      document.removeEventListener('paste', disableCopy);
      document.removeEventListener('contextmenu', disableCopy);
      document.removeEventListener('keydown', blockShortcuts);
    };
  }, []);

  // Не гасити екран
  useEffect(() => {
    noSleepRef.current = new NoSleep();
    noSleepRef.current.enable();
    return () => noSleepRef.current?.disable();
  }, []);

  // Завантаження сесії та роботи з БД
  useEffect(() => {
    async function loadSession() {
      if (!sessionId) return;
      const response = await fetch(`/api/get-session?sessionId=${sessionId}`);
      const data = await response.json();
      if (data.ok) {
        setSession(data.session);
        const worksRes = await fetch(`/api/works?classId=${data.session.class_id}`, {
          headers: data.session.teacher_id
            ? { 'x-teacher-id-filter': data.session.teacher_id }
            : {},
        });
        const worksData = await worksRes.json();
        if (worksData.ok && worksData.works.length > 0) {
          const found = worksData.works.find(
            (w: { variant: number; subject?: string }) =>
              w.variant === data.session.variant &&
              (!data.session.subject || w.subject === data.session.subject)
          );
          if (found) setDbWork(found);
        }
      }
      setLoading(false);
    }
    loadSession();
  }, [sessionId]);

  // Генеруємо порядок перемішування варіантів відповідей
  useEffect(() => {
    if (!dbWork) return;
    const order: Record<number, number[]> = {};
    dbWork.tasks.forEach((task: any, i: number) => {
      const choices: string[] = typeof task === 'string' ? [] : (task.choices || []);
      if (choices.length > 1) {
        order[i] = shuffleArray(choices.map((_: any, ci: number) => ci));
      }
      if (task.type === 'matching' && task.pairs?.length > 0) {
        const n = task.pairs.length;
        matchingShuffleRef.current[i] = {
          left: shuffleArray(Array.from({ length: n }, (_, k) => k)),
          right: shuffleArray(Array.from({ length: n }, (_, k) => k)),
        };
      }
    });
    shuffleOrderRef.current = order;
  }, [dbWork]);

  // Блокування кнопки назад
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const onPopState = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Таймер блокування + авто-завершення через 15 хв
  useEffect(() => {
    if (!session || session.status !== 'blocked' || !session.blocked_at) return;
    let autoFinished = false;
    const updateTimer = () => {
      const diff = Math.floor((Date.now() - new Date(session.blocked_at as string).getTime()) / 1000);
      setSecondsBlocked(diff > 0 ? diff : 0);
      if (diff >= 15 * 60 && !autoFinished) {
        autoFinished = true;
        fetch('/api/finish-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        }).then(() => {
          localStorage.removeItem('studentSessionId');
          setExamEnded(true);
        });
      }
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [session]);

  // Polling: якщо заблоковано — перевіряємо розблокування
  useEffect(() => {
    if (!sessionId || !session || session.status !== 'blocked') return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/get-session?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.ok && data.session.status !== 'blocked') {
        setSession(data.session);
        setSecondsBlocked(0);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [sessionId, session?.status]);

  // Polling під час написання: повідомлення від вчителя + extra_minutes
  const sessionRef = useRef<StudentSession | null>(null);
  useEffect(() => { sessionRef.current = session; }, [session]);

  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      const current = sessionRef.current;
      if (!current || current.status !== 'writing') return;
      const res = await fetch(`/api/get-session?sessionId=${sessionId}`);
      const data = await res.json();
      if (!data.ok) return;
      const s: StudentSession = data.session;
      // Вчитель заблокував вручну
      if (s.status === 'blocked') {
        setSession(s);
        return;
      }
      // Вчитель завершив роботу для всіх
      if (s.status === 'finished') {
        setExamEnded(true);
        return;
      }
      // Повідомлення від вчителя
      if (s.teacher_message) {
        setTeacherMessage(s.teacher_message);
        fetch('/api/clear-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      }
      // Додатковий час
      if (s.extra_minutes !== current.extra_minutes) {
        setSession((prev) => prev ? { ...prev, extra_minutes: s.extra_minutes } : prev);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Polling: вчитель завершив роботу для всіх
  useEffect(() => {
    if (!session || session.status !== 'writing') return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/exam-status?classId=${session.class_id}`);
      const data = await res.json();
      if (data.ok && !data.active) setExamEnded(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [session?.status, session?.class_id]);

  // Таймер роботи
  const work = useMemo(() => {
    if (!session) return null;
    if (dbWork) return {
      workType: dbWork.work_type,
      title: dbWork.title,
      durationMinutes: dbWork.duration_minutes,
      tasks: dbWork.tasks,
    };
    return works[session.class_id][session.variant];
  }, [session, dbWork]);

  useEffect(() => {
    if (!session || !work) return;
    const extraMs = (session.extra_minutes ?? 0) * 60 * 1000;
    const endTime = new Date(session.started_at).getTime() + work.durationMinutes * 60 * 1000 + extraMs;
    let finished = false;
    const update = () => {
      const left = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0 && !finished) {
        finished = true;
        setExamEnded(true);
        fetch('/api/finish-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [session, work, session?.extra_minutes]);

  // Система блокування: макс 3 виходи, кожен не довше 7 секунд
  useEffect(() => {
    if (!sessionId || !session || session.status === 'blocked') return;

    let alreadyBlocked = false;

    async function sendBlock(reason: string) {
      if (alreadyBlocked) return;
      alreadyBlocked = true;
      clearTimeout(exitTimerRef.current);
      const response = await fetch('/api/block-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, reason }),
      });
      const data = await response.json();
      // Оновлюємо стан тільки після підтвердження від сервера
      if (data.ok) setSession(data.session);
    }

    // Сторінка "активна" тільки якщо вона видима І у фокусі
    function isPageActive() {
      return !document.hidden && document.hasFocus();
    }

    function onHide() {
      if (exitStartRef.current !== null) return; // вже відстежується вихід
      exitStartRef.current = Date.now();
      focusLostCountRef.current += 1;
      if (focusLostCountRef.current > 3) {
        sendBlock('Перевищено кількість виходів зі сторінки');
        return;
      }
      exitTimerRef.current = setTimeout(() => {
        sendBlock('Учень був відсутній більше 7 секунд');
      }, 7000);
    }

    function onShow() {
      if (exitStartRef.current === null) return; // нічого не відстежується
      clearTimeout(exitTimerRef.current);
      const durationSeconds = Math.floor((Date.now() - exitStartRef.current) / 1000);
      exitStartRef.current = null;
      fetch('/api/log-exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, durationSeconds, exitCount: focusLostCountRef.current }),
      });
      // iOS заморожує таймери у фоні — перевіряємо тривалість при поверненні
      if (durationSeconds >= 7) {
        sendBlock('Учень був відсутній більше 7 секунд');
      }
    }

    function onVisibilityChange() {
      if (document.hidden) onHide(); else if (isPageActive()) onShow();
    }
    function onWindowBlur() {
      // Спрацьовує і при overlay (Gemini) — не перевіряємо document.hidden
      onHide();
    }
    function onWindowFocus() {
      if (isPageActive()) onShow();
    }

    // Поллінг кожну секунду — для випадків де blur не спрацьовує (деякі Android браузери)
    const focusPoller = setInterval(() => {
      if (!isPageActive() && exitStartRef.current === null) {
        onHide();
      } else if (isPageActive() && exitStartRef.current !== null) {
        onShow();
      }
    }, 1000);

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      clearInterval(focusPoller);
      clearTimeout(exitTimerRef.current);
    };
  }, [sessionId, session]);

  function handleMatchingLeftClick(taskIndex: number, origLeftIdx: number) {
    if (!dbWork?.online_mode) return;
    const current = matchingPendingRef.current[taskIndex];
    if (current === origLeftIdx) {
      matchingPendingRef.current[taskIndex] = null;
    } else {
      setAnswers(prev => {
        const m: Record<string, string> = (() => { try { return JSON.parse(prev[taskIndex] ?? '{}'); } catch { return {}; } })();
        const updated = { ...m };
        delete updated[String(origLeftIdx)];
        return { ...prev, [taskIndex]: JSON.stringify(updated) };
      });
      matchingPendingRef.current[taskIndex] = origLeftIdx;
    }
    setMatchingVersion(v => v + 1);
  }

  function handleMatchingRightClick(taskIndex: number, origRightIdx: number) {
    if (!dbWork?.online_mode) return;
    const pendingLeft = matchingPendingRef.current[taskIndex];
    if (pendingLeft === null || pendingLeft === undefined) return;
    setAnswers(prev => {
      const m: Record<string, string> = (() => { try { return JSON.parse(prev[taskIndex] ?? '{}'); } catch { return {}; } })();
      const updated = { ...m };
      Object.keys(updated).forEach(k => { if (updated[k] === String(origRightIdx)) delete updated[k]; });
      updated[String(pendingLeft)] = String(origRightIdx);
      return { ...prev, [taskIndex]: JSON.stringify(updated) };
    });
    matchingPendingRef.current[taskIndex] = null;
    setMatchingVersion(v => v + 1);
  }

  function redrawMatchingLines(taskIndex: number, currentAnswers: Record<number, string>) {
    const svg = matchingSvgRefs.current[taskIndex];
    const container = matchingContainerRefs.current[taskIndex];
    if (!svg || !container) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const containerRect = container.getBoundingClientRect();
    const mapping: Record<string, string> = (() => { try { return JSON.parse(currentAnswers[taskIndex] ?? '{}'); } catch { return {}; } })();
    Object.entries(mapping).forEach(([leftIdx, rightIdx]) => {
      const leftEl = matchingLeftRefs.current[`${taskIndex}-${leftIdx}`];
      const rightEl = matchingRightRefs.current[`${taskIndex}-${rightIdx}`];
      if (!leftEl || !rightEl) return;
      const lRect = leftEl.getBoundingClientRect();
      const rRect = rightEl.getBoundingClientRect();
      const x1 = lRect.right - containerRect.left;
      const y1 = lRect.top + lRect.height / 2 - containerRect.top;
      const x2 = rRect.left - containerRect.left;
      const y2 = rRect.top + rRect.height / 2 - containerRect.top;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', '#22c55e');
      line.setAttribute('stroke-width', '2.5');
      line.setAttribute('stroke-linecap', 'round');
      svg.appendChild(line);
    });
  }

  useLayoutEffect(() => {
    if (!dbWork) return;
    dbWork.tasks.forEach((task: any, i: number) => {
      if ((task as any).type === 'matching') redrawMatchingLines(i, answers);
    });
  }, [answers, matchingVersion, dbWork]);

  useEffect(() => {
    if (!dbWork) return;
    const observers: ResizeObserver[] = [];
    dbWork.tasks.forEach((task: any, i: number) => {
      if ((task as any).type !== 'matching') return;
      const container = matchingContainerRefs.current[i];
      if (!container) return;
      const ro = new ResizeObserver(() => redrawMatchingLines(i, answers));
      ro.observe(container);
      observers.push(ro);
    });
    return () => observers.forEach(ro => ro.disconnect());
  }, [dbWork, answers]);

  async function unlock() {
    if (!sessionId) return;
    const response = await fetch('/api/unlock-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, unlockPassword }),
    });
    const data = await response.json();
    if (!data.ok) {
      setUnlockError(data.error || 'Не вдалося розблокувати');
      return;
    }
    setUnlockPassword('');
    setUnlockError('');
    setSecondsBlocked(0);
    setSession(data.session);
  }

  function handleFinishClick() {
    if (!work || !dbWork?.online_mode) { setFinishConfirm(true); return; }
    // Перевіряємо пропущені завдання з варіантами відповідей
    const skipped: number[] = [];
    let taskNum = 0;
    work.tasks.forEach((task: any, i: number) => {
      const taskType = typeof task === 'string' ? 'task' : (task.type ?? 'task');
      if (taskType === 'header' || taskType === 'description') return;
      if (taskType === 'subtasks') {
        taskNum++;
        const items: any[] = task.items || [];
        const scorableCount = items.filter((it: any) => typeof it === 'object' && (it.choices?.length ?? 0) > 0).length;
        if (scorableCount > 0) {
          const m: Record<string, string> = (() => { try { return JSON.parse(answers[i] ?? '{}'); } catch { return {}; } })();
          if (Object.keys(m).length < scorableCount) skipped.push(taskNum);
        }
        return;
      }
      taskNum++;
      if (taskType === 'fill_blank') {
        const blankCount = ((task.template as string || '').match(/\[___\]/g) || []).length;
        const arr: string[] = (() => { try { return JSON.parse(answers[i] ?? '[]'); } catch { return []; } })();
        if (arr.filter((s: string) => s.trim()).length < blankCount) skipped.push(taskNum);
        return;
      }
      if (taskType === 'matching') {
        const pairCount = (task.pairs as any[])?.length ?? 0;
        const m: Record<string, string> = (() => { try { return JSON.parse(answers[i] ?? '{}'); } catch { return {}; } })();
        if (Object.keys(m).length < pairCount) skipped.push(taskNum);
        return;
      }
      const choices: string[] = typeof task === 'string' ? [] : (task.choices || []);
      if (choices.length > 0 && !answers[i]) skipped.push(taskNum);
    });
    if (skipped.length > 0) {
      setSkippedWarning(skipped);
    } else {
      setFinishConfirm(true);
    }
  }

  async function finishWork() {
    if (!sessionId || finishing) return;
    setFinishing(true);
    const res = await fetch('/api/finish-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        answers: Object.keys(answers).length > 0 ? answers : undefined,
        classId: session?.class_id,
        variant: session?.variant,
        subject: session?.subject,
      }),
    });
    const data = await res.json();
    if (data.score !== null && data.score !== undefined) {
      setScoreResults({ score: data.score, maxScore: data.maxScore ?? data.score, results: data.results || [] });
      setFinishConfirm(false);
    } else {
      localStorage.removeItem('studentSessionId');
      router.push('/');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="mx-auto max-w-3xl text-center text-slate-600">Завантаження...</div>
      </div>
    );
  }

  if (!session || !work) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="mx-auto max-w-3xl text-center text-slate-600">Сесію не знайдено.</div>
      </div>
    );
  }

  const UA_LETTERS = 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя';
  function idToClassName(id: number): string {
    if (id >= 1 && id <= 12) return String(id);
    const num = Math.floor(id / 100);
    const li = (id % 100) - 1;
    return li >= 0 && li < UA_LETTERS.length ? `${num}${UA_LETTERS[li]}` : String(id);
  }

  if (showSignReminder) {
    const subjectGenitive: Record<string, string> = {
      'алгебра': 'алгебри',
      'геометрія': 'геометрії',
      'математика': 'математики',
      'фізика': 'фізики',
      'хімія': 'хімії',
      'біологія': 'біології',
      'географія': 'географії',
      'інформатика': 'інформатики',
      'історія': 'історії',
      'правознавство': 'правознавства',
      'природознавство': 'природознавства',
      'українська мова': 'української мови',
      'українська література': 'української літератури',
      'зарубіжна література': 'зарубіжної літератури',
      'англійська мова': 'англійської мови',
      'німецька мова': 'німецької мови',
      'французька мова': 'французької мови',
      'фізична культура': 'фізичної культури',
      'музичне мистецтво': 'музичного мистецтва',
      'образотворче мистецтво': 'образотворчого мистецтва',
      'трудове навчання': 'трудового навчання',
      'основи здоров\'я': 'основ здоров\'я',
      'економіка': 'економіки',
      'астрономія': 'астрономії',
    };
    const subjectKey = (session.subject || '').toLowerCase().trim();
    const subjectLower = subjectGenitive[subjectKey] ?? (subjectKey || 'предмету');
    const className = idToClassName(session.class_id);
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <p className="text-white text-xl font-semibold mb-2">✏️ Перш ніж почати</p>
        <p className="text-slate-400 text-sm mb-6">Підпишіть листочок як показано нижче</p>

        {/* Імітація листочка зошита в клітинку */}
        <div className="relative w-full max-w-sm shadow-2xl rounded-sm overflow-hidden" style={{ minHeight: '320px' }}>
          {/* Клітинковий фон через SVG */}
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#bfdbfe" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="white" />
            <rect width="100%" height="100%" fill="url(#grid)" />
            {/* Червоне поле справа */}
            <line x1="calc(100% - 48px)" y1="0" x2="calc(100% - 48px)" y2="100%" stroke="#f87171" strokeWidth="1" />
          </svg>

          {/* Червоне поле справа (через div, бо SVG calc не підтримує) */}
          <div className="absolute top-0 bottom-0 right-12 w-px bg-red-400" />

          {/* Текст підпису по центру */}
          <div className="absolute inset-0 flex items-center justify-center pr-14">
            <div className="text-center text-slate-800 leading-8 text-[15px]">
              <div>{work.workType}</div>
              <div>з {subjectLower}</div>
              <div>учня/учениці {className} класу</div>
              <div className="font-semibold mt-1">{session.full_name}</div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowSignReminder(false)}
          className="mt-8 w-full max-w-sm rounded-2xl bg-green-500 py-4 text-white font-bold text-lg hover:bg-green-600 transition-colors"
        >
          Підписав(ла) — починаємо ✓
        </button>
      </div>
    );
  }

  const dark = theme === 'dark';
  const timerColor = timeLeft !== null && timeLeft < 300 ? 'text-red-500' : dark ? 'text-slate-300' : 'text-slate-700';
  const fontSizeClass = fontSize === 'xl' ? 'text-2xl leading-10 md:text-3xl md:leading-[3rem]'
    : fontSize === 'lg' ? 'text-xl leading-9 md:text-2xl md:leading-[2.6rem]'
    : 'text-lg leading-8 md:text-[1.45rem] md:leading-10';

  return (
    <div className={`min-h-screen p-3 md:p-8 transition-colors ${dark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className={`mx-auto max-w-5xl rounded-2xl p-4 shadow-xl md:rounded-[2rem] md:p-10 transition-colors ${dark ? 'bg-slate-900' : 'bg-white'}`}>

        {/* Шапка */}
        <div className={`flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between md:pb-6 ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div>
            <div className={`text-xs font-semibold uppercase tracking-[0.2em] md:text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              {work.workType}
            </div>
            <h1 className={`mt-2 text-2xl font-bold md:mt-3 md:text-4xl ${dark ? 'text-white' : 'text-slate-950'}`}>
              {work.title}
            </h1>
            <p className={`mt-2 text-sm md:mt-3 md:text-base ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
              Відповіді записуй тільки на паперовому аркуші.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(['md', 'lg', 'xl'] as const).map((s, i) => (
              <button
                key={s}
                onClick={() => changeFontSize(s)}
                className={`rounded-xl px-3 py-2 text-xs font-bold md:rounded-2xl md:px-4 md:py-3 transition ${
                  fontSize === s
                    ? dark ? 'bg-slate-600 text-white' : 'bg-slate-900 text-white'
                    : dark ? 'border border-slate-600 text-slate-300' : 'border border-slate-300 text-slate-600'
                }`}
              >
                {['A', 'A+', 'A++'][i]}
              </button>
            ))}
            <button
              onClick={toggleTheme}
              className={`rounded-xl px-3 py-2 text-xs font-bold md:rounded-2xl md:px-4 md:py-3 border transition ${dark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600'}`}
            >
              {dark ? '☀️' : '🌙'}
            </button>
            <div className={`rounded-xl border px-3 py-2 text-xs font-medium md:rounded-2xl md:px-5 md:py-3 md:text-sm ${dark ? 'border-slate-600 bg-slate-800 text-slate-300' : 'border-slate-300 bg-slate-50 text-slate-700'}`}>
              Варіант {session.variant}
            </div>
            <div className={`rounded-xl border px-3 py-2 text-xs font-medium md:rounded-2xl md:px-5 md:py-3 md:text-sm ${dark ? 'border-slate-600 bg-slate-800 text-slate-300' : 'border-slate-300 bg-slate-50 text-slate-700'}`}>
              {session.class_id} клас
            </div>
            {timeLeft !== null && (
              <div className={`rounded-xl border px-3 py-2 text-xs font-bold md:rounded-2xl md:px-5 md:py-3 md:text-sm ${dark ? 'border-slate-600 bg-slate-800' : 'border-slate-300 bg-slate-50'} ${timerColor}`}>
                ⏱ {formatSeconds(timeLeft)}
              </div>
            )}
          </div>
        </div>

        {/* Завдання (select-none щоб не можна було виділити і скопіювати текст) */}
        <div className="mt-4 space-y-4 md:mt-8 md:space-y-5 select-none" onContextMenu={(e) => e.preventDefault()}>
          {(() => {
            let taskNum = 0;
            return work.tasks.map((task: any, index: number) => {
              const taskType = typeof task === 'string' ? 'task' : (task.type ?? 'task');
              const taskText = typeof task === 'string' ? task : task.text;

              if (taskType === 'header') {
                return (
                  <div key={index} className={`px-2 pt-4 pb-1 ${dark ? 'text-slate-200' : 'text-slate-900'}`}>
                    <div className={`text-center font-bold text-lg border-b pb-2 ${dark ? 'border-slate-700' : 'border-slate-300'}`}>
                      <MathText text={taskText} />
                    </div>
                  </div>
                );
              }

              if (taskType === 'description') {
                return (
                  <div key={index} className={`px-4 py-3 rounded-2xl text-sm italic ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                    <MathText text={taskText} />
                  </div>
                );
              }

              if (taskType === 'fill_blank') {
                taskNum++;
                const segments = (task.template as string || '').split('[___]');
                const currentFillAnswers: string[] = (() => { try { return JSON.parse(answers[index] ?? '[]'); } catch { return []; } })();
                return (
                  <div key={index} className={`rounded-2xl border p-4 shadow-sm md:rounded-3xl md:p-6 transition-colors ${dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                    <div className="space-y-3 md:space-y-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-white md:h-12 md:w-12 md:rounded-2xl md:text-lg ${dark ? 'bg-slate-600' : 'bg-slate-900'}`}>
                        {taskNum}
                      </div>
                      {taskText && (
                        <div className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                          <MathText text={taskText} />
                        </div>
                      )}
                      {task.image_url && (
                        <img src={task.image_url} alt="" className="max-h-56 w-auto rounded-xl object-contain" draggable={false} />
                      )}
                      <div className={`w-full rounded-xl px-4 py-3 md:rounded-2xl md:px-5 md:py-4 ${dark ? 'bg-slate-700 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
                        <div className={`font-serif ${fontSizeClass} leading-loose`}>
                          {segments.map((seg: string, si: number) => (
                            <span key={si}>
                              <MathText text={seg} />
                              {si < segments.length - 1 && (
                                <input
                                  type="text"
                                  value={currentFillAnswers[si] ?? ''}
                                  onChange={e => {
                                    if (!dbWork?.online_mode) return;
                                    const arr = [...currentFillAnswers];
                                    arr[si] = e.target.value;
                                    setAnswers(prev => ({ ...prev, [index]: JSON.stringify(arr) }));
                                  }}
                                  readOnly={!dbWork?.online_mode}
                                  className={`mx-1 inline-block w-28 border-b-2 bg-transparent px-1 text-center outline-none focus:border-blue-500 ${dark ? 'border-slate-400 text-white' : 'border-slate-500 text-slate-900'}`}
                                />
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                      {!dbWork?.online_mode && (
                        <div className={`mt-3 rounded-xl border border-dashed p-3 text-xs md:rounded-2xl md:p-4 md:text-sm ${dark ? 'border-slate-600 bg-slate-800 text-slate-500' : 'border-slate-300 bg-white text-slate-500'}`}>
                          Відповідь записуйте на паперовому аркуші.
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              if (taskType === 'subtasks') {
                taskNum++;
                const items: any[] = task.items || [];
                const hasAnyChoices = items.some((it: any) => typeof it === 'object' && (it.choices?.length ?? 0) > 0);
                const isOnline = dbWork?.online_mode;
                const currentSubAnswers: Record<string, string> = (() => { try { return JSON.parse(answers[index] ?? '{}'); } catch { return {}; } })();
                return (
                  <div key={index} className={`rounded-2xl border p-4 shadow-sm md:rounded-3xl md:p-6 transition-colors ${dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                    <div className="space-y-3 md:space-y-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-white md:h-12 md:w-12 md:rounded-2xl md:text-lg ${dark ? 'bg-slate-600' : 'bg-slate-900'}`}>
                        {taskNum}
                      </div>
                      <div className={`w-full rounded-xl px-4 py-3 md:rounded-2xl md:px-5 md:py-4 ${dark ? 'bg-slate-700 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
                        {taskText && (
                          <div className={`font-serif mb-3 ${fontSizeClass}`}>
                            <MathText text={taskText} />
                          </div>
                        )}
                        {task.image_url && (
                          <img src={task.image_url} alt="" className="mb-3 max-h-64 w-auto rounded-xl object-contain" draggable={false} />
                        )}
                        <div className="space-y-3">
                          {items.map((item: any, ii: number) => {
                            const itemText = typeof item === 'string' ? item : item.text;
                            const choices: string[] = typeof item === 'object' ? (item.choices || []) : [];
                            const selectedLabel = currentSubAnswers[String(ii)];
                            return (
                              <div key={ii}>
                                <div className={`flex items-start gap-2 font-serif ${fontSizeClass}`}>
                                  <span className={`font-bold shrink-0 ${dark ? 'text-orange-400' : 'text-orange-600'}`}>{String.fromCharCode(0x430 + ii)})</span>
                                  <MathText text={itemText} />
                                </div>
                                {choices.length > 0 && (
                                  <div className="mt-1.5 ml-5 grid grid-cols-2 gap-2 md:grid-cols-4">
                                    {choices.map((c: string, ci: number) => {
                                      const label = CHOICE_LABELS[ci] ?? String.fromCharCode(65 + ci);
                                      const isSelected = selectedLabel === label;
                                      return (
                                        <div
                                          key={ci}
                                          onClick={() => isOnline ? setAnswers(prev => {
                                            const m: Record<string, string> = (() => { try { return JSON.parse(prev[index] ?? '{}'); } catch { return {}; } })();
                                            const updated = { ...m };
                                            if (isSelected) delete updated[String(ii)]; else updated[String(ii)] = label;
                                            return { ...prev, [index]: JSON.stringify(updated) };
                                          }) : undefined}
                                          className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${isOnline ? 'cursor-pointer' : ''} ${
                                            isSelected
                                              ? 'border-blue-500 bg-blue-500 text-white'
                                              : dark
                                                ? 'border-slate-500 bg-slate-600 text-slate-200 hover:bg-slate-500'
                                                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                                          }`}
                                        >
                                          <span className="font-bold mr-1">{label})</span><MathText text={c} />
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {(!isOnline || !hasAnyChoices) && (
                        <div className={`rounded-xl border border-dashed p-3 text-xs md:rounded-2xl md:p-4 md:text-sm ${dark ? 'border-slate-600 bg-slate-800 text-slate-500' : 'border-slate-300 bg-white text-slate-500'}`}>
                          Відповідь записуйте на паперовому аркуші.
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              if (taskType === 'matching') {
                taskNum++;
                const shuffle = matchingShuffleRef.current[index] ?? {
                  left: (task.pairs as any[]).map((_: any, k: number) => k),
                  right: (task.pairs as any[]).map((_: any, k: number) => k),
                };
                const currentMapping: Record<string, string> = (() => { try { return JSON.parse(answers[index] ?? '{}'); } catch { return {}; } })();
                const pendingLeft = matchingPendingRef.current[index];
                return (
                  <div key={index} className={`rounded-2xl border p-4 shadow-sm md:rounded-3xl md:p-6 transition-colors ${dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                    <div className="space-y-3 md:space-y-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-white md:h-12 md:w-12 md:rounded-2xl md:text-lg ${dark ? 'bg-slate-600' : 'bg-slate-900'}`}>
                        {taskNum}
                      </div>
                      {taskText && (
                        <div className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                          <MathText text={taskText} />
                        </div>
                      )}
                      {task.image_url && (
                        <img src={task.image_url} alt="" className="max-h-56 w-auto rounded-xl object-contain" draggable={false} />
                      )}
                      {dbWork?.online_mode && (
                        <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                          Натисніть елемент з лівої колонки, потім елемент з правої — щоб встановити відповідність.
                        </p>
                      )}
                      <div
                        ref={el => { matchingContainerRefs.current[index] = el; }}
                        className="relative"
                      >
                        <svg
                          ref={el => { matchingSvgRefs.current[index] = el; }}
                          className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
                        />
                        <div className="flex gap-4 md:gap-8">
                          <div className="flex-1 space-y-2">
                            {shuffle.left.map((origIdx: number) => {
                              const pair = (task.pairs as any[])[origIdx];
                              const isSelected = pendingLeft === origIdx;
                              const isConnected = currentMapping[String(origIdx)] !== undefined;
                              return (
                                <div
                                  key={origIdx}
                                  ref={el => { matchingLeftRefs.current[`${index}-${origIdx}`] = el; }}
                                  onClick={() => handleMatchingLeftClick(index, origIdx)}
                                  className={`cursor-pointer rounded-xl border-2 px-3 py-2 text-sm transition select-none ${
                                    isSelected
                                      ? (dark ? 'border-blue-400 bg-blue-900/30 text-blue-200' : 'border-blue-500 bg-blue-50 text-blue-900')
                                      : isConnected
                                        ? (dark ? 'border-green-500 bg-green-900/30 text-green-200' : 'border-green-500 bg-green-50 text-green-900')
                                        : (dark ? 'border-slate-600 bg-slate-700 text-slate-200 hover:border-slate-400' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-400')
                                  }`}
                                >
                                  <MathText text={pair.left} />
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex-1 space-y-2">
                            {shuffle.right.map((origRightIdx: number) => {
                              const pair = (task.pairs as any[])[origRightIdx];
                              const isTarget = Object.values(currentMapping).includes(String(origRightIdx));
                              return (
                                <div
                                  key={origRightIdx}
                                  ref={el => { matchingRightRefs.current[`${index}-${origRightIdx}`] = el; }}
                                  onClick={() => handleMatchingRightClick(index, origRightIdx)}
                                  className={`cursor-pointer rounded-xl border-2 px-3 py-2 text-sm transition select-none ${
                                    isTarget
                                      ? (dark ? 'border-green-500 bg-green-900/30 text-green-200' : 'border-green-500 bg-green-50 text-green-900')
                                      : pendingLeft !== null && pendingLeft !== undefined
                                        ? (dark ? 'border-slate-500 bg-slate-700 text-slate-200 hover:border-blue-400 hover:bg-blue-900/20' : 'border-slate-300 bg-white text-slate-900 hover:border-blue-400 hover:bg-blue-50')
                                        : (dark ? 'border-slate-600 bg-slate-700 text-slate-200' : 'border-slate-300 bg-white text-slate-900')
                                  }`}
                                >
                                  <MathText text={pair.right} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      {!dbWork?.online_mode && (
                        <div className={`mt-3 rounded-xl border border-dashed p-3 text-xs md:rounded-2xl md:p-4 md:text-sm ${dark ? 'border-slate-600 bg-slate-800 text-slate-500' : 'border-slate-300 bg-white text-slate-500'}`}>
                          Відповідь записуйте на паперовому аркуші.
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              taskNum++;
              const choices: string[] = typeof task === 'string' ? [] : (task.choices || []);
              const shuffledIndices = shuffleOrderRef.current[index] ?? choices.map((_: any, ci: number) => ci);
              return (
                <div
                  key={index}
                  className={`rounded-2xl border p-4 shadow-sm md:rounded-3xl md:p-6 transition-colors ${dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}
                >
                  <div className="space-y-3 md:space-y-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-white md:h-12 md:w-12 md:rounded-2xl md:text-lg ${dark ? 'bg-slate-600' : 'bg-slate-900'}`}>
                      {taskNum}
                    </div>
                    <div>
                      {task.image_url && (
                        <img src={task.image_url} alt="" className="mt-3 max-h-64 w-auto rounded-xl object-contain" draggable={false} />
                      )}
                      <div className={`w-full rounded-xl px-4 py-3 md:rounded-2xl md:px-5 md:py-4 ${dark ? 'bg-slate-700 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
                        <div className={`font-serif ${fontSizeClass}`}>
                          <MathText text={taskText} />
                        </div>
                        {choices.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                            {shuffledIndices.map((origIdx: number, displayPos: number) => {
                              const displayLabel = CHOICE_LABELS[displayPos] ?? String.fromCharCode(65 + displayPos);
                              const origLabel = CHOICE_LABELS[origIdx] ?? String.fromCharCode(65 + origIdx);
                              const isSelected = answers[index] === origLabel;
                              const isOnline = dbWork?.online_mode;
                              return (
                                <div
                                  key={displayPos}
                                  onClick={() => isOnline ? setAnswers((prev) => ({ ...prev, [index]: isSelected ? '' : origLabel })) : undefined}
                                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${isOnline ? 'cursor-pointer' : ''} ${
                                    isSelected
                                      ? 'border-blue-500 bg-blue-500 text-white'
                                      : dark
                                        ? 'border-slate-500 bg-slate-600 text-slate-200 hover:bg-slate-500'
                                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                                  }`}
                                >
                                  <span className="font-bold mr-1">{displayLabel})</span><MathText text={choices[origIdx]} />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className={`mt-3 rounded-xl border border-dashed p-3 text-xs md:rounded-2xl md:p-4 md:text-sm ${dark ? 'border-slate-600 bg-slate-800 text-slate-500' : 'border-slate-300 bg-white text-slate-500'}`}>
                        Відповідь виконується на паперовому аркуші.
                      </div>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* Кнопка завершення */}
        <div className="mt-8 text-center">
          <button
            onClick={handleFinishClick}
            className="rounded-2xl border-2 border-slate-300 px-6 py-3 text-sm font-semibold text-slate-600 hover:border-slate-500 hover:text-slate-900"
          >
            Завершити роботу
          </button>
        </div>

        <div className="mt-20" />
      </div>

      {/* Калькулятор */}
      {calcOpen && <Calculator onClose={() => setCalcOpen(false)} />}
      <button
        onClick={() => setCalcOpen(prev => !prev)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl text-2xl"
        aria-label="Калькулятор"
      >
        🧮
      </button>

      {/* Чернетка */}
      {draftOpen && (
        <div className="fixed bottom-24 right-6 z-40 w-72 rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900">
            <span className="text-sm font-semibold text-white">✏️ Чернетка</span>
            <button onClick={() => setDraftOpen(false)} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
          </div>
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Тут можна записувати чорновики, розрахунки..."
            className="flex-1 resize-none p-3 text-sm text-slate-800 outline-none"
            style={{ minHeight: '220px' }}
          />
          <div className="px-3 py-2 border-t border-slate-100">
            <button
              onClick={() => setDraftText('')}
              className="text-xs text-slate-400 hover:text-red-500"
            >
              Очистити
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setDraftOpen(prev => !prev)}
        className="fixed bottom-22 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-xl text-2xl"
        aria-label="Чернетка"
        style={{ bottom: '5.5rem' }}
      >
        ✏️
      </button>

      {/* Попередження: пропущені завдання */}
      {skippedWarning.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <div className="text-xl font-bold">Є пропущені завдання</div>
            <p className="mt-2 text-sm text-slate-600">
              Ти не відповів на завдання:{' '}
              <span className="font-semibold text-slate-900">{skippedWarning.join(', ')}</span>
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setSkippedWarning([])}
                className="flex-1 rounded-2xl border border-slate-300 py-3 text-slate-700"
              >
                Повернутись
              </button>
              <button
                onClick={() => { setSkippedWarning([]); setFinishConfirm(true); }}
                className="flex-1 rounded-2xl bg-slate-900 py-3 text-white font-semibold"
              >
                Все одно здати
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Підтвердження завершення */}
      {finishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
            <div className="text-xl font-bold">Завершити роботу?</div>
            <p className="mt-2 text-sm text-slate-600">
              Після завершення повернутись до роботи буде неможливо.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setFinishConfirm(false)}
                className="flex-1 rounded-2xl border border-slate-300 py-3 text-slate-700"
              >
                Скасувати
              </button>
              <button
                onClick={finishWork}
                disabled={finishing}
                className="flex-1 rounded-2xl bg-slate-900 py-3 text-white font-semibold disabled:opacity-50"
              >
                {finishing ? 'Завершення...' : 'Так, здати'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Результати після здачі */}
      {scoreResults && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/90 p-4 pt-8">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">{scoreResults.score >= scoreResults.maxScore * 0.9 ? '🏆' : scoreResults.score >= scoreResults.maxScore * 0.6 ? '👍' : '📝'}</div>
              <div className="text-3xl font-bold">{scoreResults.score} <span className="text-xl font-normal text-slate-500">з {scoreResults.maxScore} балів</span></div>
              <p className="mt-2 text-slate-500">
                {scoreResults.results.filter((r: any) => r.isCorrect).length} з {scoreResults.results.filter((r: any) => r.correctAnswer !== null).length} правильних відповідей
              </p>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {scoreResults.results.map((r: any, i: number) => {
                if (r.correctAnswer === null) return null;
                return (
                  <div key={i} className={`rounded-xl p-3 text-sm flex items-center justify-between ${r.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <span className="font-medium text-slate-700">Завдання {r.taskIndex + 1}</span>
                    <div className="flex items-center gap-3 text-xs">
                      {r.points && <span className={`font-bold ${r.isCorrect ? 'text-green-600' : 'text-slate-400'}`}>{r.isCorrect ? `+${r.points}` : '0'} б</span>}
                      <span className="text-slate-500">Ваша: <strong>{r.answer || '—'}</strong></span>
                      {!r.isCorrect && <span className="text-green-700">Правильна: <strong>{r.correctAnswer}</strong></span>}
                      <span className={r.isCorrect ? 'text-green-600 text-base' : 'text-red-500 text-base'}>{r.isCorrect ? '✓' : '✗'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => { localStorage.removeItem('studentSessionId'); router.replace('/'); }}
              className="mt-6 w-full rounded-2xl bg-slate-900 py-3 text-white font-semibold hover:bg-slate-700"
            >
              Вийти
            </button>
          </div>
        </div>
      )}

      {/* Вчитель завершив роботу для всіх */}
      {examEnded && !scoreResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl text-center">
            <div className="text-4xl mb-4">✋</div>
            <div className="text-2xl font-bold md:text-3xl">Роботу завершено</div>
            <p className="mt-4 text-lg text-slate-600">Здаємо листочки вчителю.</p>
            <button
              onClick={() => { localStorage.removeItem('studentSessionId'); router.replace('/'); }}
              className="mt-6 w-full rounded-2xl bg-slate-900 py-3 text-white font-semibold hover:bg-slate-700"
            >
              Вийти
            </button>
          </div>
        </div>
      )}

      {/* Повідомлення від вчителя */}
      {teacherMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
            <div className="text-3xl mb-3">📩</div>
            <div className="text-lg font-bold mb-2">Повідомлення від вчителя</div>
            <p className="text-slate-800 text-base leading-relaxed">{teacherMessage}</p>
            <button
              onClick={() => setTeacherMessage(null)}
              className="mt-6 w-full rounded-2xl bg-slate-900 py-3 text-white font-semibold"
            >
              Зрозумів
            </button>
          </div>
        </div>
      )}

      {/* Блокування */}
      {session.status === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl md:rounded-[2rem] md:p-8">
            <div className="text-center">
              <div className="text-2xl font-bold md:text-3xl">Роботу заблоковано</div>
              <p className="mt-3 text-sm text-slate-600 md:text-base">
                Причина: {session.block_reason || 'Зафіксовано порушення'}
              </p>
              <div className="mt-6 text-xs uppercase tracking-[0.3em] text-slate-500 md:mt-8">
                Час у блокуванні
              </div>
              <div className="mt-2 text-5xl font-bold md:text-6xl">
                {formatSeconds(secondsBlocked)}
              </div>
              <p className="mt-4 text-sm text-slate-500">
                Зверніться до вчителя для розблокування.
              </p>
            </div>
            <div className="mx-auto mt-6 max-w-md md:mt-8">
              <label className="mb-2 block text-sm font-medium">Пароль розблокування</label>
              <input
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Введіть пароль вчителя"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
              />
              {unlockError && <p className="mt-2 text-sm text-red-600">{unlockError}</p>}
              <button
                onClick={unlock}
                className="mt-4 w-full rounded-2xl bg-slate-900 px-5 py-3 text-white"
              >
                Розблокувати
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentExamPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 p-4">
          <div className="mx-auto max-w-3xl text-center text-slate-600">Завантаження...</div>
        </div>
      }
    >
      <ExamContent />
    </Suspense>
  );
}
