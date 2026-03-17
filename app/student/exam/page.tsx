'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { works } from '@/data/works';
import { StudentSession } from '@/types';
import { formatSeconds } from '@/lib/utils';

function ExamContent() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get('sessionId');

  const [session, setSession] = useState<StudentSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [secondsBlocked, setSecondsBlocked] = useState(0);

  useEffect(() => {
    async function loadSession() {
      if (!sessionId) return;

      const response = await fetch(`/api/get-session?sessionId=${sessionId}`);
      const data = await response.json();

      if (data.ok) {
        setSession(data.session);
      }

      setLoading(false);
    }

    loadSession();
  }, [sessionId]);

  useEffect(() => {
    window.history.pushState(null, '', window.location.href);

    const onPopState = () => {
      window.history.pushState(null, '', window.location.href);
    };

    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useEffect(() => {
    if (!session || session.status !== 'blocked' || !session.blocked_at) return;

    const updateTimer = () => {
      const diff = Math.floor(
        (Date.now() - new Date(session.blocked_at as string).getTime()) / 1000
      );
      setSecondsBlocked(diff > 0 ? diff : 0);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!sessionId || !session || session.status === 'blocked') return;

    let alreadyBlocked = false;

    async function sendBlock(reason: string) {
      if (alreadyBlocked) return;
      alreadyBlocked = true;

      const blockedAt = new Date().toISOString();

      setSession((prev) =>
        prev
          ? {
            ...prev,
            status: 'blocked',
            block_reason: reason,
            blocked_at: blockedAt,
          }
          : prev
      );

      const response = await fetch('/api/block-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, reason }),
      });

      const data = await response.json();

      if (data.ok) {
        setSession(data.session);
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        sendBlock('Вкладка стала неактивною або браузер згорнули');
      }
    }

    function onBlur() {
      sendBlock('Сторінка втратила фокус');
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
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
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-3xl text-center text-slate-600">
          Завантаження...
        </div>
      </div>
    );
  }

  if (!session || !work) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-3xl text-center text-slate-600">
          Сесію не знайдено.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-5xl rounded-[2rem] bg-white p-8 shadow-xl md:p-10">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
              {work.workType}
            </div>
            <h1 className="mt-3 text-3xl font-bold text-slate-950 md:text-4xl">
              {work.title}
            </h1>
            <p className="mt-3 text-base text-slate-600">
              Учень бачить завдання на екрані, а всі відповіді записує тільки на паперовому аркуші.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="rounded-2xl border border-slate-300 bg-slate-50 px-5 py-3 text-sm font-medium text-slate-700">
              Варіант {session.variant}
            </div>
            <div className="rounded-2xl border border-slate-300 bg-slate-50 px-5 py-3 text-sm font-medium text-slate-700">
              {session.class_id} клас
            </div>
          </div>
        </div>



        <div className="mt-8 space-y-5">
          {work.tasks.map((task, index) => (
            <div
              key={task}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-lg font-bold text-white">
                  {index + 1}
                </div>

                <div className="flex-1">
                  <div className="rounded-2xl bg-slate-50 px-5 py-4 text-slate-900">
                    <div className="whitespace-pre-line text-lg leading-9 md:text-[1.45rem] md:leading-10 font-serif">
                      {task}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                    Відповідь учень виконує на паперовому аркуші.
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">

        </div>
      </div>

      {session.status === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-6">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-8 shadow-2xl">
            <div className="text-center">
              <div className="text-3xl font-bold">Роботу заблоковано</div>
              <p className="mt-3 text-slate-600">
                Причина: {session.block_reason || 'Зафіксовано порушення'}
              </p>

              <div className="mt-8 text-sm uppercase tracking-[0.3em] text-slate-500">
                Час у блокуванні
              </div>
              <div className="mt-2 text-6xl font-bold">
                {formatSeconds(secondsBlocked)}
              </div>
            </div>

            <div className="mx-auto mt-8 max-w-md">
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

              {unlockError ? (
                <p className="mt-2 text-sm text-red-600">{unlockError}</p>
              ) : null}

              <button
                onClick={unlock}
                className="mt-4 w-full rounded-2xl bg-slate-900 px-5 py-3 text-white hover:bg-slate-700"
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
        <div className="min-h-screen bg-slate-50 p-8">
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