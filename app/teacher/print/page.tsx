'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface PrintData {
  fullName: string;
  className: number;
  variant: number;
  subject: string | null;
  workTitle: string;
  workType: string;
  tasks: string[];
}

function PrintContent() {
  const params = useSearchParams();
  const sessionId = params.get('sessionId');
  const [data, setData] = useState<PrintData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    async function load() {
      const [sessionRes, ] = await Promise.all([
        fetch(`/api/get-session?sessionId=${sessionId}`),
      ]);
      const sessionData = await sessionRes.json();
      if (!sessionData.ok) { setError('Сесію не знайдено'); return; }

      const s = sessionData.session;
      const worksRes = await fetch(`/api/works?classId=${s.class_id}`);
      const worksData = await worksRes.json();

      const work = (worksData.works || []).find(
        (w: any) => w.variant === s.variant && w.subject === s.subject
      );

      setData({
        fullName: s.full_name,
        className: s.class_id,
        variant: s.variant,
        subject: s.subject,
        workTitle: work?.title ?? '—',
        workType: work?.work_type ?? '—',
        tasks: work?.tasks ?? [],
      });
    }
    load();
  }, [sessionId]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return <div className="p-8 text-slate-500">Завантаження...</div>;

  return (
    <div className="min-h-screen bg-white p-8 print:p-4">
      {/* Кнопка друку — не відображається при друці */}
      <div className="mb-6 flex gap-3 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-xl bg-slate-900 px-6 py-3 text-white font-semibold hover:bg-slate-700"
        >
          Друкувати
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-xl border border-slate-300 px-6 py-3 text-slate-700 hover:bg-slate-50"
        >
          Закрити
        </button>
      </div>

      {/* Шапка */}
      <div className="border-b-2 border-slate-900 pb-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">{data.workType}</div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{data.workTitle}</h1>
          </div>
          <div className="text-right text-sm text-slate-600">
            <div className="font-bold text-base text-slate-900">{data.fullName}</div>
            <div>{data.className} клас · Варіант {data.variant}</div>
            {data.subject && <div>{data.subject}</div>}
          </div>
        </div>
      </div>

      {/* Завдання */}
      <div className="space-y-5">
        {data.tasks.map((task, i) => (
          <div key={i} className="border border-slate-200 rounded-xl p-4">
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
                {i + 1}
              </div>
              <div className="text-slate-900 text-base leading-relaxed pt-1">{task}</div>
            </div>
            <div className="mt-3 h-16 border-b border-dashed border-slate-300" />
          </div>
        ))}
      </div>

      <div className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-400 print:block hidden">
        Роздруковано з платформи шкільних робіт
      </div>
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Завантаження...</div>}>
      <PrintContent />
    </Suspense>
  );
}
