'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Input, PageContainer, Title } from '@/components/ui';

const ALL_SUBJECTS = [
  'Математика',
  'Алгебра',
  'Геометрія',
  'Фізика',
  'Хімія',
  'Біологія',
  'Географія',
  'Історія України',
  'Всесвітня історія',
  'Інформатика',
  'Українська мова',
  'Українська література',
  'Іноземна мова',
  'Правознавство',
  'Економіка',
  'Фізична культура',
  'Мистецтво',
  'Трудове навчання',
];

export default function TeacherRegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [registrationCode, setRegistrationCode] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function toggleSubject(subject: string) {
    setSelectedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
  }

  async function register() {
    if (!name.trim() || !password.trim()) { setError("Введіть ім'я та пароль"); return; }
    if (password !== password2) { setError('Паролі не співпадають'); return; }
    if (password.length < 4) { setError('Пароль мінімум 4 символи'); return; }
    if (selectedSubjects.length === 0) { setError('Оберіть хоча б один предмет який ви викладаєте'); return; }
    if (!registrationCode.trim()) { setError('Введіть код реєстрації'); return; }

    setLoading(true);
    setError('');
    const res = await fetch('/api/teacher-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), password, subjects: selectedSubjects, registrationCode: registrationCode.trim() }),
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
              <label className="mb-2 block text-sm font-medium">Ім'я (буде видно учням)</label>
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
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Код реєстрації</label>
              <Input
                type="password"
                value={registrationCode}
                onChange={(e) => setRegistrationCode(e.target.value)}
                placeholder="Секретний код від адміністратора сайту"
              />
              <p className="mt-1 text-xs text-slate-400">Код видає адміністратор сайту</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Предмети які ви викладаєте
                {selectedSubjects.length > 0 && (
                  <span className="ml-2 text-slate-500 font-normal">({selectedSubjects.length} обрано)</span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_SUBJECTS.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => toggleSubject(subject)}
                    className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                      selectedSubjects.includes(subject)
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 text-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {subject}
                  </button>
                ))}
              </div>
              {selectedSubjects.length === 0 && (
                <p className="mt-2 text-xs text-slate-400">Оберіть хоча б один предмет</p>
              )}
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
