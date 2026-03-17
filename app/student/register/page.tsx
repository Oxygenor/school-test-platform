'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Input, PageContainer, Title } from '@/components/ui';

export default function StudentRegisterPage() {
  const router = useRouter();
  const [classId, setClassId] = useState<'6' | '7' | '10' | ''>('');
  const [surname, setSurname] = useState('');
  const [name, setName] = useState('');

  function nextStep() {
    if (!classId || !surname.trim() || !name.trim()) return;

    const params = new URLSearchParams({
      classId,
      fullName: `${surname.trim()} ${name.trim()}`,
    });

    router.push(`/student/variant?${params.toString()}`);
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl">
        <Card>
          <Title>Реєстрація учня</Title>
          <p className="mt-2 text-slate-600">Оберіть клас і введіть прізвище та ім’я.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {['6', '7', '10'].map((item) => (
              <button
                key={item}
                className={`rounded-3xl border p-5 text-xl font-semibold ${classId === item ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-900'}`}
                onClick={() => setClassId(item as '6' | '7' | '10')}
              >
                {item} клас
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Прізвище</label>
              <Input value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="Іваненко" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Ім’я</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Марія" />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button onClick={nextStep}>Далі</Button>
            <Button className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={() => router.push('/')}>Назад</Button>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}