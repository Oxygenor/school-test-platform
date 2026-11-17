'use client';

import { useState } from 'react';
import { GeometryBoard } from './geometry-board';
import type { ConstructionStep } from '@/lib/geometry/tasks';

interface Props {
  title: string;
  steps: ConstructionStep[];
  /** Повний розбір чи лише побудова рисунка (до спроби учня). */
  gated: boolean;
  answer: string | null;
  /** Немає — показ у чаті (без кнопки повернення до полотна). */
  onBack?: () => void;
  /** Номер кроку на старті; у чаті — останній, щоб одразу видно було весь рисунок. */
  initialStep?: number;
  testId?: string;
}

/** Покрокове креслення з підсвічуванням елемента, про який іде мова на кроці. */
export function ConstructionView({ title, steps, gated, answer, onBack, initialStep = 0, testId = 'construction-view' }: Props) {
  const [i, setI] = useState(Math.min(Math.max(0, initialStep), steps.length - 1));
  const step = steps[i];
  const last = i === steps.length - 1;
  return (
    <div className="space-y-3" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-white">{title}</div>
        {onBack && (
          <button onClick={onBack} className="shrink-0 rounded-xl border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
            ← До мого рисунка
          </button>
        )}
      </div>
      <GeometryBoard drawing={step.drawing} highlight={step.highlight} testId={onBack ? 'construction-board' : 'figure-board'} />
      <div className="rounded-2xl bg-slate-800 p-3 text-sm text-slate-100">
        <div className="mb-1 text-xs text-slate-400">
          Крок {i + 1} з {steps.length}
        </div>
        <div className="font-semibold text-amber-300" data-testid="step-title">
          {step.title}
        </div>
        <div className="mt-1" data-testid="step-text">
          {step.text}
        </div>
        {last && gated && (
          <div className="mt-2 rounded-xl bg-indigo-950 p-2 text-indigo-100">
            Далі спробуй сам: запиши, що знаєш з умови, і перший крок обчислення. Після своєї спроби натисни «Покажи побудову» ще раз —
            покажу повний розбір.
          </div>
        )}
        {last && !gated && answer && (
          <div className="mt-2 rounded-xl bg-emerald-950 p-2 text-emerald-100" data-testid="construction-answer">
            ✓ Відповідь обчислено кодом: <strong>{answer}</strong>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setI((x) => Math.max(0, x - 1))}
          disabled={i === 0}
          className="flex-1 rounded-2xl border border-slate-600 py-2.5 text-sm text-slate-200 disabled:opacity-40"
        >
          ← Назад
        </button>
        <button
          onClick={() => setI((x) => Math.min(steps.length - 1, x + 1))}
          disabled={last}
          className="flex-1 rounded-2xl bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          data-testid="step-next"
        >
          Далі →
        </button>
      </div>
    </div>
  );
}
