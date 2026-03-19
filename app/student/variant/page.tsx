'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, PageContainer, Title } from '@/components/ui';
import { StudentSessionGuard } from '@/components/student-session-guard';

function VariantContent() {
  const router = useRouter();
  const params = useSearchParams();

  const classId = params.get('classId');
  const fullName = params.get('fullName');
  const studentId = params.get('studentId');

  const [examActive, setExamActive] = useState<boolean | null>(null);

  const checkStatus = useCallback(async () => {
    if (!classId) return;
    const res = await fetch(`/api/exam-status?classId=${classId}`);
    const data = await res.json();
    setExamActive(data.active ?? false);
  }, [classId]);

  useEffect(() => {
    async function checkExistingSession() {
      const sessionId = localStorage.getItem('studentSessionId');
      if (!sessionId) return;

      const response = await fetch(`/api/get-session?sessionId=${sessionId}`);
      const data = await response.json();

      if (data.ok && data.session && ['writing', 'blocked'].includes(data.session.status)) {
        router.replace(`/student/exam?sessionId=${data.session.id}`);
      } else {
        localStorage.removeItem('studentSessionId');
        localStorage.removeItem('studentFullName');
        localStorage.removeItem('studentClassId');
      }
    }

    checkExistingSession();
  }, [router]);

  // Перевірка статусу + автооновлення кожні 5 секунд
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  async function chooseVariant(variant: 1 | 2) {
    const el = document.documentElement as any;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }

    const response = await fetch('/api/start-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classId: Number(classId),
        studentId,
        fullName,
        variant,
      }),
    });

    const data = await response.json();
    if (!data.ok) return;

    localStorage.setItem('studentSessionId', data.session.id);
    localStorage.setItem('studentFullName', fullName ?? '');
    localStorage.setItem('studentClassId', String(classId ?? ''));

    router.push(`/student/exam?sessionId=${data.session.id}`);
  }

  // Очікування поки вчитель не дозволить
  if (examActive === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 text-4xl">
            ⏳
          </div>
          <h1 className="text-2xl font-bold">Очікуйте на дозвіл</h1>
          <p className="mt-4 text-slate-400">
            Вчитель ще не розпочав роботу для {classId} класу.
            <br />
            Сторінка оновлюється автоматично.
          </p>
          <div className="mt-8 text-sm text-slate-600">
            {fullName}
          </div>
        </div>
      </div>
    );
  }

  if (examActive === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-slate-400">Завантаження...</div>
      </div>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl">
        <Card>
          <Title>Оберіть свій варіант</Title>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-slate-700">
            Учень: <strong>{fullName}</strong> · Клас: <strong>{classId}</strong>
          </div>

          <div className="mt-6 grid gap-4 grid-cols-2">
            <button
              type="button"
              className="rounded-3xl bg-slate-950 px-6 py-6 text-2xl font-semibold text-white transition hover:bg-slate-800"
              onClick={() => chooseVariant(1)}
            >
              Варіант 1
            </button>

            <button
              type="button"
              className="rounded-3xl border-2 border-slate-300 bg-white px-6 py-6 text-2xl font-semibold text-slate-900 transition hover:border-slate-500 hover:bg-slate-50"
              onClick={() => chooseVariant(2)}
            >
              Варіант 2
            </button>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

export default function StudentVariantPage() {
  return (
    <>
      <StudentSessionGuard />
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-slate-950">
            <div className="text-slate-400">Завантаження...</div>
          </div>
        }
      >
        <VariantContent />
      </Suspense>
    </>
  );
}
