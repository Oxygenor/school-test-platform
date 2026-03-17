'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button, Card, PageContainer, Title } from '@/components/ui';

function VariantContent() {
  const router = useRouter();

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

  const params = useSearchParams();

  const classId = params.get('classId');
  const fullName = params.get('fullName');
  const studentId = params.get('studentId');

  async function chooseVariant(variant: 1 | 2) {
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

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl">
        <Card>
          <Title>Оберіть свій варіант</Title>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-slate-700">
            Учень: <strong>{fullName}</strong> · Клас: <strong>{classId}</strong>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
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
    <Suspense
      fallback={
        <PageContainer>
          <div className="mx-auto max-w-3xl text-center text-slate-600">
            Завантаження...
          </div>
        </PageContainer>
      }
    >
      <VariantContent />
    </Suspense>
  );
}