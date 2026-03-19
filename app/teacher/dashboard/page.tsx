'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, PageContainer, Title } from '@/components/ui';

const CLASS_IDS = [6, 7, 10];

interface ClassStatus {
  classId: number;
  active: boolean;
  loading: boolean;
}

export default function TeacherDashboardPage() {
  const [statuses, setStatuses] = useState<ClassStatus[]>(
    CLASS_IDS.map((id) => ({ classId: id, active: false, loading: true }))
  );
  const [password, setPassword] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    async function loadStatuses() {
      const results = await Promise.all(
        CLASS_IDS.map(async (classId) => {
          const res = await fetch(`/api/exam-status?classId=${classId}`);
          const data = await res.json();
          return { classId, active: data.active ?? false, loading: false };
        })
      );
      setStatuses(results);
    }
    loadStatuses();
  }, []);

  async function toggle(classId: number, newActive: boolean) {
    if (!passwordSaved) return;

    setStatuses((prev) =>
      prev.map((s) => (s.classId === classId ? { ...s, loading: true } : s))
    );

    const res = await fetch('/api/exam-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, active: newActive, teacherPassword: password }),
    });

    const data = await res.json();

    setStatuses((prev) =>
      prev.map((s) =>
        s.classId === classId
          ? { ...s, active: data.ok ? newActive : s.active, loading: false }
          : s
      )
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-5xl space-y-6">

        <Card>
          <Title>Панель вчителя</Title>
          <p className="mt-2 text-slate-600">
            Введіть пароль щоб керувати доступом учнів до робіт.
          </p>
          <div className="mt-4 flex gap-3">
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordSaved(false); }}
              placeholder="Пароль вчителя"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
            />
            <button
              onClick={() => setPasswordSaved(true)}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-white hover:bg-slate-700 whitespace-nowrap"
            >
              {passwordSaved ? 'Збережено ✓' : 'Підтвердити'}
            </button>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {statuses.map(({ classId, active, loading }) => (
            <Card key={classId}>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{classId} клас</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {active ? 'Активно' : 'Вимкнено'}
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={() => toggle(classId, !active)}
                  disabled={loading || !passwordSaved}
                  className={`w-full rounded-2xl py-3 text-sm font-semibold transition disabled:opacity-50 ${
                    active
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  {loading ? '...' : active ? 'Зупинити роботу' : 'Дозволити писати'}
                </button>

                <Link
                  href={`/teacher/dashboard/${classId}`}
                  className="w-full rounded-2xl border border-slate-300 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Переглянути учнів
                </Link>
                <Link
                  href={`/teacher/dashboard/${classId}/works`}
                  className="w-full rounded-2xl border border-slate-300 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Керувати роботами
                </Link>
              </div>
            </Card>
          ))}
        </div>

      </div>
    </PageContainer>
  );
}
