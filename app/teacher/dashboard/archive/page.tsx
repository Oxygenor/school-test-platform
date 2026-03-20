'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, PageContainer, Title } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

interface Session {
  id: string;
  full_name: string;
  class_id: number;
  variant: number;
  subject: string | null;
  work_type: string;
  started_at: string;
  updated_at: string;
}

function groupByDate(sessions: Session[]) {
  const map: Record<string, Session[]> = {};
  for (const s of sessions) {
    const date = new Date(s.started_at).toLocaleDateString('uk-UA', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    if (!map[date]) map[date] = [];
    map[date].push(s);
  }
  return map;
}

export default function ArchivePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('');
  const [classes, setClasses] = useState<number[]>([]);

  useEffect(() => {
    const saved = sessionStorage.getItem('teacherPassword');
    if (!saved) { router.replace('/teacher/login'); return; }
    fetch('/api/classes').then((r) => r.json()).then((d) => {
      if (d.ok) setClasses(d.classes);
    });
    loadArchive();
  }, []);

  async function loadArchive(classId?: string) {
    setLoading(true);
    const url = classId ? `/api/archive?classId=${classId}` : '/api/archive';
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok) setSessions(data.sessions);
    setLoading(false);
  }

  function handleClassFilter(val: string) {
    setClassFilter(val);
    loadArchive(val || undefined);
  }

  const grouped = groupByDate(sessions);

  return (
    <PageContainer>
      <div className="mx-auto max-w-5xl space-y-6">

        <div className="flex items-center justify-between">
          <Title>Архів робіт</Title>
          <Link href="/teacher/dashboard" className="rounded-2xl bg-slate-200 px-4 py-2 text-sm text-slate-900 hover:bg-slate-300">
            Назад
          </Link>
        </div>

        {/* Фільтр */}
        <Card>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Клас:</label>
            <select
              value={classFilter}
              onChange={(e) => handleClassFilter(e.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-700"
            >
              <option value="">Всі класи</option>
              {classes.map((c) => (
                <option key={c} value={c}>{c} клас</option>
              ))}
            </select>
            <span className="text-sm text-slate-500">{sessions.length} записів</span>
          </div>
        </Card>

        {loading ? (
          <div className="py-8 text-center text-slate-500">Завантаження...</div>
        ) : sessions.length === 0 ? (
          <Card>
            <p className="py-4 text-center text-slate-400">Завершених робіт ще немає.</p>
          </Card>
        ) : (
          Object.entries(grouped).map(([date, dateSessions]) => (
            <div key={date}>
              <h2 className="mb-3 text-base font-bold text-slate-500">{date}</h2>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 text-xs">
                        <th className="px-3 py-2">ПІБ</th>
                        <th className="px-3 py-2">Клас</th>
                        <th className="px-3 py-2">Предмет</th>
                        <th className="px-3 py-2">Варіант</th>
                        <th className="px-3 py-2">Початок</th>
                        <th className="px-3 py-2">Завершення</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dateSessions.map((s) => (
                        <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-3 font-medium">{s.full_name}</td>
                          <td className="px-3 py-3">{s.class_id}</td>
                          <td className="px-3 py-3 text-slate-600">{s.subject || '—'}</td>
                          <td className="px-3 py-3">{s.variant}</td>
                          <td className="px-3 py-3 text-slate-500">{formatDateTime(s.started_at)}</td>
                          <td className="px-3 py-3 text-slate-500">{formatDateTime(s.updated_at)}</td>
                          <td className="px-3 py-3">
                            <button
                              onClick={() => window.open(`/teacher/print?sessionId=${s.id}`, '_blank')}
                              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                            >
                              Друк
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ))
        )}
      </div>
    </PageContainer>
  );
}
