'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, PageContainer, Title } from '@/components/ui';

interface ClassStatus {
  classId: number;
  active: boolean;
  loading: boolean;
}

export default function TeacherDashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [statuses, setStatuses] = useState<ClassStatus[]>([]);
  const [newClassId, setNewClassId] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('teacherToken');
    const savedName = sessionStorage.getItem('teacherName');
    if (!saved) { router.replace('/teacher/login'); return; }
    setToken(saved);
    setTeacherName(savedName || '');
    loadClasses(saved);
  }, []);

  async function loadClasses(t: string) {
    const res = await fetch('/api/classes', { headers: { 'x-teacher-token': t } });
    const data = await res.json();
    if (!data.ok) return;

    const results = await Promise.all(
      data.classes.map(async (classId: number) => {
        const r = await fetch(`/api/exam-status?classId=${classId}`);
        const d = await r.json();
        return { classId, active: d.active ?? false, loading: false };
      })
    );
    setStatuses(results);
  }

  async function toggle(classId: number, newActive: boolean) {
    setStatuses((prev) => prev.map((s) => s.classId === classId ? { ...s, loading: true } : s));
    const res = await fetch('/api/exam-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-teacher-token': token },
      body: JSON.stringify({ classId, active: newActive }),
    });
    const data = await res.json();
    setStatuses((prev) => prev.map((s) =>
      s.classId === classId ? { ...s, active: data.ok ? newActive : s.active, loading: false } : s
    ));
  }

  async function addClass() {
    setAddError('');
    const id = Number(newClassId);
    if (!id || id < 1 || id > 12) { setAddError('Введіть номер від 1 до 12'); return; }
    if (statuses.some((s) => s.classId === id)) { setAddError('Цей клас вже є'); return; }
    setAddLoading(true);
    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-teacher-token': token },
      body: JSON.stringify({ classId: id }),
    });
    const data = await res.json();
    setAddLoading(false);
    if (!data.ok) { setAddError(data.error ?? 'Помилка'); return; }
    setNewClassId('');
    setStatuses((prev) => [...prev, { classId: id, active: false, loading: false }].sort((a, b) => a.classId - b.classId));
  }

  async function deleteClass(classId: number) {
    if (!confirm(`Видалити ${classId} клас? Всі дані будуть втрачені.`)) return;
    await fetch('/api/classes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-teacher-token': token },
      body: JSON.stringify({ classId }),
    });
    setStatuses((prev) => prev.filter((s) => s.classId !== classId));
  }

  async function logout() {
    await fetch('/api/teacher-logout', {
      method: 'POST',
      headers: { 'x-teacher-token': token },
    });
    sessionStorage.removeItem('teacherToken');
    sessionStorage.removeItem('teacherName');
    router.push('/teacher/login');
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-5xl space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <Title>Панель вчителя</Title>
            {teacherName && <p className="mt-1 text-sm text-slate-500">{teacherName}</p>}
          </div>
          <div className="flex gap-2">
            <Link href="/teacher/dashboard/archive" className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Архів робіт
            </Link>
            <button onClick={logout} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Вийти
            </button>
          </div>
        </div>

        {/* Додати клас */}
        <Card>
          <p className="mb-3 font-medium text-slate-700">Додати клас</p>
          <div className="flex gap-3">
            <input
              type="number" min={1} max={12} value={newClassId}
              onChange={(e) => { setNewClassId(e.target.value); setAddError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && addClass()}
              placeholder="Номер класу"
              className="w-40 rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
            />
            <button
              onClick={addClass} disabled={addLoading}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {addLoading ? '...' : 'Додати'}
            </button>
          </div>
          {addError && <p className="mt-2 text-sm text-red-600">{addError}</p>}
        </Card>

        {/* Класи */}
        <div className="grid gap-4 md:grid-cols-3">
          {statuses.map(({ classId, active, loading }) => (
            <Card key={classId}>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{classId} клас</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {active ? 'Активно' : 'Вимкнено'}
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={() => toggle(classId, !active)} disabled={loading}
                  className={`w-full rounded-2xl py-3 text-sm font-semibold transition disabled:opacity-50 ${active ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-green-500 text-white hover:bg-green-600'}`}
                >
                  {loading ? '...' : active ? 'Зупинити роботу' : 'Дозволити писати'}
                </button>
                <Link href={`/teacher/dashboard/${classId}`} className="w-full rounded-2xl border border-slate-300 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Переглянути учнів
                </Link>
                <Link href={`/teacher/dashboard/${classId}/works`} className="w-full rounded-2xl border border-slate-300 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Керувати роботами
                </Link>
                <button onClick={() => deleteClass(classId)} className="w-full rounded-2xl border border-red-200 py-3 text-center text-sm font-medium text-red-500 hover:bg-red-50">
                  Видалити клас
                </button>
              </div>
            </Card>
          ))}
        </div>

      </div>
    </PageContainer>
  );
}
