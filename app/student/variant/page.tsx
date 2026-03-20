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
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  // teacherId — вчитель якого іспит приєднуємось
  const [teacherId, setTeacherId] = useState<string | null>(params.get('teacherId'));
  const [teacherName, setTeacherName] = useState<string | null>(params.get('teacherName'));

  // Якщо кілька активних вчителів — показуємо вибір
  const [activeExams, setActiveExams] = useState<{ teacherId: string; teacherName: string }[]>([]);
  const [showTeacherPicker, setShowTeacherPicker] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!classId) return;
    if (teacherId) {
      const res = await fetch(`/api/exam-status?classId=${classId}&teacherId=${teacherId}`);
      const data = await res.json();
      setExamActive(data.active ?? false);
    } else {
      // Немає обраного вчителя — знаходимо активні іспити
      const res = await fetch(`/api/active-exams?classId=${classId}`);
      const data = await res.json();
      const exams: { teacherId: string; teacherName: string }[] = data.exams || [];
      if (exams.length === 1) {
        setTeacherId(exams[0].teacherId);
        setTeacherName(exams[0].teacherName);
        setExamActive(true);
      } else if (exams.length > 1) {
        setActiveExams(exams);
        setShowTeacherPicker(true);
        setExamActive(true);
      } else {
        setExamActive(false);
      }
    }
  }, [classId, teacherId]);

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

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  // Завантажуємо предмети тільки цього вчителя
  useEffect(() => {
    if (!classId || !teacherId) return;
    async function loadSubjects() {
      const res = await fetch(`/api/works?classId=${classId}`, {
        headers: { 'x-teacher-id-filter': teacherId! },
      });
      const data = await res.json();
      if (data.ok && data.works.length > 0) {
        const unique = [...new Set<string>(data.works.map((w: { subject: string }) => w.subject))].sort();
        setSubjects(unique);
      }
    }
    loadSubjects();
  }, [classId, teacherId]);

  async function chooseVariant(variant: 1 | 2) {
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
        subject: selectedSubject,
        teacherId,
      }),
    });

    const data = await response.json();
    if (!data.ok) return;

    localStorage.setItem('studentSessionId', data.session.id);
    localStorage.setItem('studentFullName', fullName ?? '');
    localStorage.setItem('studentClassId', String(classId ?? ''));

    router.push(`/student/exam?sessionId=${data.session.id}`);
  }

  // Вибір вчителя (якщо кілька активних)
  if (showTeacherPicker && !teacherId) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-lg">
          <Card>
            <Title>Оберіть іспит</Title>
            <p className="mt-2 text-slate-500">Для {classId} класу доступно кілька іспитів:</p>
            <div className="mt-4 grid gap-3">
              {activeExams.map((exam) => (
                <button
                  key={exam.teacherId}
                  onClick={() => { setTeacherId(exam.teacherId); setTeacherName(exam.teacherName); setShowTeacherPicker(false); }}
                  className="w-full rounded-3xl bg-slate-950 px-6 py-5 text-lg font-semibold text-white hover:bg-slate-800"
                >
                  {exam.teacherName}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </PageContainer>
    );
  }

  if (examActive === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 text-4xl">⏳</div>
          <h1 className="text-2xl font-bold">Очікуйте на дозвіл</h1>
          <p className="mt-4 text-slate-400">
            Вчитель ще не розпочав роботу для {classId} класу.
            <br />Сторінка оновлюється автоматично.
          </p>
          {teacherName && <div className="mt-4 text-sm text-slate-500">{teacherName}</div>}
          <div className="mt-2 text-sm text-slate-600">{fullName}</div>
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
      <div className="mx-auto max-w-3xl space-y-4">

        {/* Вибір предмету */}
        {!selectedSubject ? (
          <Card>
            <Title>Оберіть предмет</Title>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-slate-700">
              Учень: <strong>{fullName}</strong> · Клас: <strong>{classId}</strong>
              {teacherName && <> · <strong>{teacherName}</strong></>}
            </div>
            {subjects.length === 0 ? (
              <p className="mt-6 text-center text-slate-400">Вчитель ще не додав роботи для цього класу.</p>
            ) : (
              <div className="mt-6 grid gap-3">
                {subjects.map((subject) => (
                  <button
                    key={subject}
                    onClick={() => setSelectedSubject(subject)}
                    className="w-full rounded-3xl bg-slate-950 px-6 py-5 text-xl font-semibold text-white transition hover:bg-slate-800"
                  >
                    {subject}
                  </button>
                ))}
              </div>
            )}
          </Card>
        ) : (
          <Card>
            <Title>Оберіть свій варіант</Title>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-slate-700">
              Учень: <strong>{fullName}</strong> · Клас: <strong>{classId}</strong> · Предмет: <strong>{selectedSubject}</strong>
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
              onClick={() => setSelectedSubject(null)}
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
