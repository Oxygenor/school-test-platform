'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Card, PageContainer, Title } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

interface StudentSession {
  id: string;
  full_name: string;
  variant: number;
  status: string;
  started_at: string;
  blocked_at: string | null;
  block_reason: string | null;
}

export default function TeacherClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  const numericClassId = Number(classId);

  const [students, setStudents] = useState<StudentSession[]>([]);
  const [exitCountMap, setExitCountMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState<string | null>(null);

  async function fetchStudents() {
    const res = await fetch(`/api/class-students?classId=${numericClassId}`);
    const data = await res.json();
    if (data.ok) {
      setStudents(data.students);
      setExitCountMap(data.exitCountMap);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchStudents();
    const interval = setInterval(fetchStudents, 10000);
    return () => clearInterval(interval);
  }, [classId]);

  async function unlockStudent(sessionId: string) {
    const password = sessionStorage.getItem('teacherPassword');
    if (!password) return;
    setUnlocking(sessionId);
    await fetch('/api/unlock-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, unlockPassword: password }),
    });
    setUnlocking(null);
    fetchStudents();
  }

  const writingCount = students.filter((s) => s.status === 'writing').length;
  const blockedCount = students.filter((s) => s.status === 'blocked').length;
  const finishedCount = students.filter((s) => s.status === 'finished').length;

  return (
    <PageContainer>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Title>{numericClassId} клас</Title>
            <p className="mt-2 text-slate-600">Список учнів, які почали роботу.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/teacher/dashboard/${classId}/works`}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
            >
              Роботи
            </Link>
            <Link href="/teacher/dashboard" className="rounded-2xl bg-slate-200 px-4 py-3 text-sm text-slate-900">
              Назад
            </Link>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card>
            <div className="text-sm text-slate-500">Усього</div>
            <div className="mt-2 text-3xl font-bold">{students.length}</div>
          </Card>
          <Card>
            <div className="text-sm text-slate-500">Пишуть</div>
            <div className="mt-2 text-3xl font-bold text-blue-600">{writingCount}</div>
          </Card>
          <Card>
            <div className="text-sm text-slate-500">У блокуванні</div>
            <div className="mt-2 text-3xl font-bold text-red-600">{blockedCount}</div>
          </Card>
          <Card>
            <div className="text-sm text-slate-500">Завершили</div>
            <div className="mt-2 text-3xl font-bold text-green-600">{finishedCount}</div>
          </Card>
        </div>

        <Card>
          {loading ? (
            <div className="py-8 text-center text-slate-500">Завантаження...</div>
          ) : students.length === 0 ? (
            <div className="py-8 text-center text-slate-500">Жоден учень ще не розпочав роботу.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-sm text-slate-500">
                    <th className="px-3 py-3">ПІБ</th>
                    <th className="px-3 py-3">Варіант</th>
                    <th className="px-3 py-3">Статус</th>
                    <th className="px-3 py-3">Початок</th>
                    <th className="px-3 py-3">Виходи</th>
                    <th className="px-3 py-3">Причина блокування</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const exits = exitCountMap[student.id] || 0;
                    return (
                      <tr key={student.id} className="border-b border-slate-100">
                        <td className="px-3 py-4 font-medium">{student.full_name}</td>
                        <td className="px-3 py-4">{student.variant}</td>
                        <td className="px-3 py-4">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            student.status === 'writing'
                              ? 'bg-blue-100 text-blue-700'
                              : student.status === 'blocked'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {student.status === 'writing' ? 'Пише' : student.status === 'blocked' ? 'Заблоковано' : 'Завершив'}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-sm">{formatDateTime(student.started_at)}</td>
                        <td className="px-3 py-4">
                          <span className={`font-semibold ${exits > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            {exits > 0 ? `${exits} раз` : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-sm text-slate-500">
                          {student.block_reason || '—'}
                        </td>
                        <td className="px-3 py-4">
                          {student.status === 'blocked' && (
                            <button
                              onClick={() => unlockStudent(student.id)}
                              disabled={unlocking === student.id}
                              className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                            >
                              {unlocking === student.id ? '...' : 'Розблокувати'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
