'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';

interface StudentStat { name: string; count: number; }
interface TopWord { word: string; count: number; }
interface RecentLog { studentName: string; message: string; createdAt: string; }

interface Stats {
  totalQuestions: number;
  uniqueStudents: number;
  perStudent: StudentStat[];
  topWords: TopWord[];
  activityByDay: Record<string, number>;
  recentLogs: RecentLog[];
}

export default function PrepStatsPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');

  useEffect(() => {
    const t = sessionStorage.getItem('teacherToken') || '';
    setToken(t);
    fetch(`/api/prep-stats?classId=${classId}`, { headers: { 'x-teacher-token': t } })
      .then((r) => r.json())
      .then((data) => { if (data.ok) setStats(data); })
      .finally(() => setLoading(false));
  }, [classId]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center gap-3">
          <Link href={`/teacher/dashboard/${classId}`} className="text-slate-500 hover:text-slate-700 text-sm">← Назад</Link>
          <h1 className="text-xl font-bold">📊 Статистика підготовки</h1>
        </div>

        {loading && <p className="text-slate-400">Завантаження...</p>}

        {!loading && (!stats || stats.totalQuestions === 0) && (
          <div className="rounded-2xl bg-white p-6 text-center text-slate-400 shadow-sm">
            Ще немає даних. Учні ще не користувались підготовкою.
          </div>
        )}

        {stats && stats.totalQuestions > 0 && (
          <>
            {/* Загальна статистика */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-4 shadow-sm text-center">
                <div className="text-3xl font-bold text-indigo-600">{stats.totalQuestions}</div>
                <div className="text-xs text-slate-500 mt-1">Всього питань</div>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm text-center">
                <div className="text-3xl font-bold text-indigo-600">{stats.uniqueStudents}</div>
                <div className="text-xs text-slate-500 mt-1">Учнів займались</div>
              </div>
            </div>

            {/* Активність по учнях */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold mb-3">Активність учнів</h2>
              <div className="space-y-2">
                {stats.perStudent.map((s) => (
                  <div key={s.name} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">{s.name || 'Невідомий'}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-indigo-200" style={{ width: `${Math.min(s.count * 8, 120)}px` }}>
                        <div className="h-2 rounded-full bg-indigo-500" style={{ width: '100%' }} />
                      </div>
                      <span className="text-xs text-slate-500 w-8 text-right">{s.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Популярні теми */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold mb-3">Популярні теми / слова</h2>
              <div className="flex flex-wrap gap-2">
                {stats.topWords.map((w) => (
                  <span key={w.word} className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs text-indigo-700">
                    {w.word} <span className="text-indigo-400">×{w.count}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Останні питання */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold mb-3">Останні питання учнів</h2>
              <div className="space-y-2">
                {stats.recentLogs.map((l, i) => (
                  <div key={i} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium text-slate-700">{l.studentName || 'Невідомий'}</span>
                      <span className="text-xs text-slate-400">{formatDate(l.createdAt)}</span>
                    </div>
                    <p className="text-slate-600 text-xs truncate">{l.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
