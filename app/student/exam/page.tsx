'use client';

import { Suspense, useEffect, useMemo, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { works } from '@/data/works';
import { StudentSession } from '@/types';
import { formatSeconds } from '@/lib/utils';
import Calculator from '@/components/calculator';
import NoSleep from 'nosleep.js';

function ExamContent() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get('sessionId');

  const [session, setSession] = useState<StudentSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [calcOpen, setCalcOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [secondsBlocked, setSecondsBlocked] = useState(0);

  const noSleepRef = useRef<any>(null);
  const focusLostCountRef = useRef(0);
  const exitTimerRef = useRef<any>(null);

  // Заборона перезавантаження
  useEffect(() => {
    function preventReload(e: any) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', preventReload);
    return () => window.removeEventListener('beforeunload', preventReload);
  }, []);

  // Заборона копіювання
  useEffect(() => {
    function disableCopy(e: any) { e.preventDefault(); }
    document.addEventListener('copy', disableCopy);
    document.addEventListener('cut', disableCopy);
    document.addEventListener('paste', disableCopy);
    document.addEventListener('contextmenu', disableCopy);
    return () => {
      document.removeEventListener('copy', disableCopy);
      document.removeEventListener('cut', disableCopy);
      document.removeEventListener('paste', disableCopy);
      document.removeEventListener('contextmenu', disableCopy);
    };
  }, []);


  // Не гасити екран
  useEffect(() => {
    noSleepRef.current = new NoSleep();
    noSleepRef.current.enable();
    return () => noSleepRef.current?.disable();
  }, []);

  // Завантаження сесії
  useEffect(() => {
    async function loadSession() {
      if (!sessionId) return;
      const response = await fetch(`/api/get-session?sessionId=${sessionId}`);
      const data = await response.json();
      if (data.ok) setSession(data.session);
      setLoading(false);
    }
    loadSession();
  }, [sessionId]);

  // Блокування кнопки назад
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const onPopState = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Таймер блокування
  useEffect(() => {
    if (!session || session.status !== 'blocked' || !session.blocked_at) return;
    const updateTimer = () => {
      const diff = Math.floor((Date.now() - new Date(session.blocked_at as string).getTime()) / 1000);
      setSecondsBlocked(diff > 0 ? diff : 0);
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [session]);

  // Система блокування: макс 3 виходи, кожен не довше 7 секунд
  useEffect(() => {
    if (!sessionId || !session || session.status === 'blocked') return;

    let alreadyBlocked = false;

    async function sendBlock(reason: string) {
      if (alreadyBlocked) return;
      alreadyBlocked = true;
      clearTimeout(exitTimerRef.current);

      const blockedAt = new Date().toISOString();
      setSession((prev) =>
        prev ? { ...prev, status: 'blocked', block_reason: reason, blocked_at: blockedAt } : prev
      );

      const response = await fetch('/api/block-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, reason }),
      });
      const data = await response.json();
      if (data.ok) setSession(data.session);
    }

    function onHide() {
      if (!document.hidden) return;

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
      if (document.hidden) return;
      clearTimeout(exitTimerRef.current);
    }

    function onVisibilityChange() {
      if (document.hidden) onHide();
      else onShow();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(exitTimerRef.current);
    };
  }, [sessionId, session]);

  const work = useMemo(() => {
    if (!session) return null;
    return works[session.class_id][session.variant];
  }, [session]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="mx-auto max-w-3xl text-center text-slate-600">
          Завантаження...
        </div>
      </div>
    );
  }

  if (!session || !work) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="mx-auto max-w-3xl text-center text-slate-600">
          Сесію не знайдено.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-8">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-4 shadow-xl md:rounded-[2rem] md:p-10">

        {/* Шапка */}
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between md:pb-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 md:text-sm">
              {work.workType}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 md:mt-3 md:text-4xl">
              {work.title}
            </h1>
            <p className="mt-2 text-sm text-slate-600 md:mt-3 md:text-base">
              Відповіді записуй тільки на паперовому аркуші.
            </p>
          </div>

          <div className="flex gap-2">
            <div className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 md:rounded-2xl md:px-5 md:py-3 md:text-sm">
              Варіант {session.variant}
            </div>
            <div className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 md:rounded-2xl md:px-5 md:py-3 md:text-sm">
              {session.class_id} клас
            </div>
          </div>
        </div>

        {/* Завдання */}
        <div className="mt-4 space-y-4 md:mt-8 md:space-y-5">
          {work.tasks.map((task, index) => (
            <div
              key={task}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:rounded-3xl md:p-6"
            >
              <div className="space-y-3 md:space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-base font-bold text-white md:h-12 md:w-12 md:rounded-2xl md:text-lg">
                  {index + 1}
                </div>

                <div>
                  <div className="w-full rounded-xl bg-slate-50 px-4 py-3 text-slate-900 md:rounded-2xl md:px-5 md:py-4">
                    <div className="whitespace-pre-line font-serif text-lg leading-8 md:text-[1.45rem] md:leading-10">
                      {task}
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500 md:rounded-2xl md:p-4 md:text-sm">
                    Відповідь виконується на паперовому аркуші.
                  </div>
                </div>
              </div>
            </div>
          ))}
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
            </div>

            <div className="mx-auto mt-6 max-w-md md:mt-8">
              <label className="mb-2 block text-sm font-medium">
                Пароль розблокування
              </label>

              <input
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Введіть пароль вчителя"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
              />

              {unlockError && (
                <p className="mt-2 text-sm text-red-600">{unlockError}</p>
              )}

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
          <div className="mx-auto max-w-3xl text-center text-slate-600">
            Завантаження...
          </div>
        </div>
      }
    >
      <ExamContent />
    </Suspense>
  );
}
