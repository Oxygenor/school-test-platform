'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const CHOICE_LABELS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

interface DbWork {
  variant: number;
  subject: string;
  title: string;
  work_type: string;
  duration_minutes: number;
  tasks: any[];
}

function PrintWorkContent() {
  const params = useSearchParams();
  const classId = params.get('classId');
  const variant = params.get('variant');
  const subject = params.get('subject');

  const [work, setWork] = useState<DbWork | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;
    fetch(`/api/works?classId=${classId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          const found = d.works.find(
            (w: DbWork) =>
              String(w.variant) === variant &&
              (!subject || w.subject === subject)
          );
          setWork(found ?? null);
        }
        setLoading(false);
      });
  }, [classId, variant, subject]);

  useEffect(() => {
    if (!loading && work) {
      setTimeout(() => window.print(), 300);
    }
  }, [loading, work]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Завантаження...</div>;
  }

  if (!work) {
    return <div className="p-8 text-center text-slate-500">Роботу не знайдено.</div>;
  }

  return (
    <div className="print-page">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .print-page { padding: 20mm 20mm 20mm 20mm; }
        }
        @media screen {
          .print-page { max-width: 800px; margin: 0 auto; padding: 40px 32px; font-family: serif; }
        }
      `}</style>

      <div className="no-print mb-6 flex gap-3">
        <button
          onClick={() => window.print()}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm text-white hover:bg-slate-700"
        >
          Друкувати
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-xl border border-slate-300 px-5 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Закрити
        </button>
      </div>

      {/* Заголовок */}
      <div className="mb-8 border-b-2 border-black pb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              {work.work_type}
            </div>
            <h1 className="mt-1 text-2xl font-bold">{work.title}</h1>
            <div className="mt-1 text-sm text-slate-600">
              {work.subject} · Варіант {work.variant} · {work.duration_minutes} хв
            </div>
          </div>
          <div className="text-right text-sm text-slate-600">
            <div>Прізвище, ім'я: ____________________________</div>
            <div className="mt-2">Клас: _________ Дата: _____________</div>
          </div>
        </div>
      </div>

      {/* Завдання */}
      <div className="space-y-6">
        {(() => {
          let taskNum = 0;
          return work.tasks.map((task: any, i: number) => {
            const taskType = typeof task === 'string' ? 'task' : (task.type ?? 'task');
            const text = typeof task === 'string' ? task : task.text;

            if (taskType === 'header') {
              return (
                <div key={i} className="break-inside-avoid pt-4 pb-1 text-center font-bold text-base border-b border-black">
                  {text}
                </div>
              );
            }
            if (taskType === 'description') {
              return (
                <div key={i} className="break-inside-avoid text-sm italic text-slate-700 leading-relaxed">
                  {text}
                </div>
              );
            }

            taskNum++;
            const choices: string[] = typeof task === 'string' ? [] : (task.choices || []);
            const pts: number = typeof task === 'string' ? 1 : (task.points ?? 1);
            return (
              <div key={i} className="break-inside-avoid">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 font-bold">{taskNum}.</span>
                  <div className="flex-1">
                    <div className="leading-relaxed">{text}</div>
                    {choices.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                        {choices.map((c, ci) => (
                          <div key={ci} className="flex items-center gap-2 text-sm">
                            <span className="font-bold">{CHOICE_LABELS[ci] ?? String.fromCharCode(65 + ci)})</span>
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {choices.length === 0 && (
                      <div className="mt-3 border-b border-dashed border-slate-400 pb-6" />
                    )}
                  </div>
                  <div className="shrink-0 text-xs text-slate-400 no-print">{pts} б</div>
                </div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

export default function PrintWorkPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Завантаження...</div>}>
      <PrintWorkContent />
    </Suspense>
  );
}
