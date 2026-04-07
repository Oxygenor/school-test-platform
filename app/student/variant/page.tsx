'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, PageContainer, Title } from '@/components/ui';
import { StudentSessionGuard } from '@/components/student-session-guard';
import TicTacToe from '@/components/tictactoe';

interface SubjectOption {
  subject: string;
  teacherId: string;
  teacherName: string;
  examActive: boolean;
  prepEnabled: boolean;
}

function VariantContent() {
  const router = useRouter();
  const params = useSearchParams();

  const classId = params.get('classId');
  const fullName = params.get('fullName');
  const studentId = params.get('studentId');
  const teacherIdParam = params.get('teacherId');

  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<SubjectOption | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Перевіряємо існуючу сесію
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

  const loadSubjects = useCallback(async () => {
    if (!classId || !teacherIdParam) return;
    const res = await fetch(`/api/student-subjects?classId=${classId}`);
    const data = await res.json();
    if (data.ok) {
      const filtered = data.subjects.filter((s: SubjectOption) => s.teacherId === teacherIdParam);
      setSubjects(filtered);
    }
    setLoaded(true);
  }, [classId, teacherIdParam]);

  useEffect(() => {
    loadSubjects();
    const interval = setInterval(loadSubjects, 5000);
    return () => clearInterval(interval);
  }, [loadSubjects]);

  async function chooseVariant(variant: 1 | 2) {
    if (!selectedOption) return;

    const el = document.documentElement as any;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();

    const response = await fetch('/api/start-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classId: Number(classId),
        studentId,
        fullName,
        variant,
        subject: selectedOption.subject,
        teacherId: selectedOption.teacherId,
      }),
    });

    const data = await response.json();
    if (!data.ok) return;

    localStorage.setItem('studentSessionId', data.session.id);
    localStorage.setItem('studentFullName', fullName ?? '');
    localStorage.setItem('studentClassId', String(classId ?? ''));

    router.push(`/student/exam?sessionId=${data.session.id}`);
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-slate-400">Завантаження...</div>
      </div>
    );
  }

  const hasAnything = subjects.length > 0;
  const hasExam = subjects.some((s) => s.examActive);
  const hasPrep = subjects.some((s) => s.prepEnabled);

  // Немає ні іспиту ні підготовки
  if (!hasAnything) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 text-4xl">⏳</div>
          <h1 className="text-2xl font-bold">Очікуйте на дозвіл</h1>
          <p className="mt-4 text-slate-400">
            Вчитель ще не розпочав роботу для {classId} класу.
            <br />Сторінка оновлюється автоматично.
          </p>
          <div className="mt-2 text-sm text-slate-600">{fullName}</div>
          <TicTacToe />
        </div>
      </div>
    );
  }

  // Є тільки підготовка (іспит ще не відкритий)
  if (!hasExam && hasPrep) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-900 text-4xl">🤖</div>
          <h1 className="text-2xl font-bold">Підготовка до роботи</h1>
          <p className="mt-3 text-slate-400">
            Іспит ще не розпочато. Поки що можеш попрактикуватись з AI-помічником.
          </p>
          <div className="mt-6 grid gap-3">
            {subjects.filter((s) => s.prepEnabled).map((opt) => (
              <a
                key={`${opt.subject}__${opt.teacherId}`}
                href={`/student/prep?classId=${classId}&subject=${encodeURIComponent(opt.subject)}&teacherId=${opt.teacherId}&fullName=${encodeURIComponent(fullName ?? '')}`}
                className="flex items-center gap-4 rounded-3xl bg-indigo-600 px-6 py-5 text-left transition hover:bg-indigo-500"
              >
                <span className="text-3xl">🤖</span>
                <div>
                  <div className="text-lg font-semibold">{opt.subject}</div>
                  <div className="text-sm text-indigo-200">{opt.teacherName} · Підготовка</div>
                </div>
              </a>
            ))}
          </div>
          <div className="mt-4 text-sm text-slate-600">{fullName}</div>
        </div>
      </div>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl space-y-4">

        {!selectedOption ? (
          // Крок 1: Вибір предмету
          <Card>
            <Title>Оберіть предмет</Title>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-slate-700">
              Учень: <strong>{fullName}</strong> · Клас: <strong>{classId}</strong>
            </div>
            <div className="mt-6 grid gap-3">
              {subjects.map((opt) => (
                <div key={`${opt.subject}__${opt.teacherId}`} className="flex gap-2">
                  {opt.examActive ? (
                    <button
                      onClick={() => setSelectedOption(opt)}
                      className="flex-1 rounded-3xl bg-slate-950 px-6 py-5 text-left transition hover:bg-slate-800"
                    >
                      <div className="text-xl font-semibold text-white">{opt.subject}</div>
                      <div className="mt-1 text-sm text-slate-400">{opt.teacherName}</div>
                    </button>
                  ) : (
                    <div className="flex-1 rounded-3xl bg-slate-800 px-6 py-5 opacity-50 cursor-not-allowed">
                      <div className="text-xl font-semibold text-white">{opt.subject}</div>
                      <div className="mt-1 text-sm text-slate-400">{opt.teacherName} · Іспит не розпочато</div>
                    </div>
                  )}
                  {opt.prepEnabled && (
                    <a
                      href={`/student/prep?classId=${classId}&subject=${encodeURIComponent(opt.subject)}&teacherId=${opt.teacherId}&fullName=${encodeURIComponent(fullName ?? '')}`}
                      className="flex flex-col items-center justify-center rounded-3xl bg-indigo-600 px-4 py-3 text-white transition hover:bg-indigo-500"
                      title="AI-підготовка до роботи"
                    >
                      <span className="text-2xl">🤖</span>
                      <span className="text-xs mt-1">Підготовка</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ) : (
          // Крок 2: Вибір варіанту
          <Card>
            <Title>Оберіть свій варіант</Title>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-slate-700">
              Учень: <strong>{fullName}</strong> · Клас: <strong>{classId}</strong>
              · Предмет: <strong>{selectedOption.subject}</strong>
              · <strong>{selectedOption.teacherName}</strong>
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
            <button
              onClick={() => setSelectedOption(null)}
              className="mt-4 w-full rounded-2xl border border-slate-200 py-3 text-sm text-slate-500 hover:bg-slate-50"
            >
              ← Змінити предмет
            </button>
          </Card>
        )}

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
