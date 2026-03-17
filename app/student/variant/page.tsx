'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button, Card, PageContainer, Title } from '@/components/ui';

function VariantContent() {
  const router = useRouter();
  const params = useSearchParams();

  const classId = params.get('classId');
  const fullName = params.get('fullName');

  async function chooseVariant(variant: 1 | 2) {
    const response = await fetch('/api/start-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classId: Number(classId),
        fullName,
        variant,
      }),
    });

    const data = await response.json();
    if (!data.ok) return;

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
            <Button className="py-6 text-2xl" onClick={() => chooseVariant(1)}>
              Варіант 1
            </Button>

            <Button
              className="bg-white py-6 text-2xl text-slate-900 hover:bg-slate-100"
              onClick={() => chooseVariant(2)}
            >
              Варіант 2
            </Button>
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