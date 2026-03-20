'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Input, PageContainer, Title } from '@/components/ui';

export default function TeacherRegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function register() {
    if (!name.trim() || !password.trim()) { setError("Введіть ім'я та пароль"); return; }
    if (password !== password2) { setError('Паролі не співпадають'); return; }
    if (password.length < 4) { setError('Пароль мінімум 4 символи'); return; }
    setLoading(true);
    setError('');
    const res = await fetch('/api/teacher-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!data.ok) { setError(data.error || 'Помилка реєстрації'); return; }
    sessionStorage.setItem('teacherToken', data.token);
    sessionStorage.setItem('teacherName', data.name);
    router.push('/teacher/dashboard');
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-xl">
        <Card>
          <Title>Реєстрація вчителя</Title>
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Ім'я (буде видно учням при розблокуванні)</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Наприклад: Іванова Марія Петрівна"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Пароль</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Мінімум 4 символи"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Повторіть пароль</label>
              <Input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Повторіть пароль"
                onKeyDown={(e) => e.key === 'Enter' && register()}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <div className="mt-6 flex gap-3">
            <Button onClick={register} disabled={loading}>{loading ? '...' : 'Зареєструватись'}</Button>
            <Button className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={() => router.push('/')}>Назад</Button>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Вже є акаунт?{' '}
            <Link href="/teacher/login" className="text-slate-900 underline underline-offset-2">
              Увійти
            </Link>
          </p>
        </Card>
      </div>
    </PageContainer>
  );
}
