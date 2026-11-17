'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MathHelper } from '@/components/math-helper/math-helper';
import { createFetchApi } from '@/lib/math-helper/client';

interface PrepInfo {
  className: string;
  grade: number;
  subject: string;
  topics: string[];
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem('prepToken');
  } catch {
    return null;
  }
}

function PrepContent() {
  const params = useSearchParams();
  const subject = params.get('subject') ?? '';
  const [info, setInfo] = useState<PrepInfo | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const api = useMemo(() => createFetchApi(readToken), []);

  useEffect(() => {
    try {
      setName(sessionStorage.getItem('prepStudentName') ?? '');
    } catch {}
    const token = readToken();
    if (!token) {
      setError('Сесія підготовки завершилась. Увійди ще раз за кодом від учителя.');
      return;
    }
    // Сторінка не завантажує контрольних: лише клас, предмет і список тем.
    fetch(`/api/prep-session?subject=${encodeURIComponent(subject)}`, { headers: { 'x-prep-token': token } })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setInfo({ className: d.className, grade: d.grade, subject: d.subject, topics: d.topics ?? [] });
        else setError(d.error || 'Підготовка недоступна.');
      })
      .catch(() => setError("Помилка з'єднання. Онови сторінку."));
  }, [subject]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <h1 className="text-xl font-bold">Помічник недоступний</h1>
          <p className="mt-2 text-slate-400">{error}</p>
          <a href="/student/register" className="mt-6 inline-block rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold">
            Увійти за кодом
          </a>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-slate-400">Завантаження...</div>
      </div>
    );
  }

  return <MathHelper api={api} subject={info.subject} grade={info.grade} className={info.className} topics={info.topics} studentFirstName={name} />;
}

export default function PrepPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Завантаження...</div>}>
      <PrepContent />
    </Suspense>
  );
}
