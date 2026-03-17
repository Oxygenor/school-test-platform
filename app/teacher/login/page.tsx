'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Input, PageContainer, Title } from '@/components/ui';

export default function TeacherLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function login() {
    const response = await fetch('/api/teacher-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await response.json();
    if (!data.ok) {
      setError('Неправильний пароль');
      return;
    }

    router.push('/teacher/dashboard');
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-xl">
        <Card>
          <Title>Вхід для вчителя</Title>
          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium">Пароль</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Введіть пароль" />
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          </div>
          <div className="mt-6 flex gap-3">
            <Button onClick={login}>Увійти</Button>
            <Button className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={() => router.push('/')}>Назад</Button>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}