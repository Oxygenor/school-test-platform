'use client';

import { useEffect, useMemo, useState } from 'react';
import { GeometryBoard, TOOLS, type EditTarget, type Tool } from './geometry-board';
import { ConstructionView } from './construction-view';
import { checkDrawing, type DrawingCheckResult } from '@/lib/geometry/check';
import {
  construction,
  parseGeometryProblem,
  PRESET_TASKS,
  solve,
  statement,
  TASK_KIND_TITLES,
  type GeometryTask,
} from '@/lib/geometry/tasks';
import type { Drawing } from '@/lib/geometry/types';
import type { ExerciseState } from '@/lib/math-helper/types';

interface Props {
  exercise: ExerciseState;
  drawing: Drawing;
  onDrawingChange: (next: Drawing, opts?: { pushUndo?: boolean }) => void;
  onUndo: () => void;
  canUndo: boolean;
  task: GeometryTask | null;
  onTaskChange: (t: GeometryTask | null) => void;
  /** Збільшується, коли учень натиснув «Покажи побудову» в головному меню. */
  constructionRequest: number;
  busy: boolean;
  onExplain: (drawing: Drawing, task: GeometryTask | null) => void;
  onConstructionFallback: () => Promise<GeometryTask | null>;
  onClose: () => void;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace('.', ','));

export function GeometryPanel(props: Props) {
  const { exercise, drawing, onDrawingChange, task, onTaskChange, busy } = props;
  const [tool, setTool] = useState<Tool>('point');
  const [hint, setHint] = useState('Торкнися полотна, щоб поставити точку. Точки можна перетягувати.');
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [editText, setEditText] = useState('');
  const [editArcs, setEditArcs] = useState(1);
  const [result, setResult] = useState<DrawingCheckResult | null>(null);
  const [showSteps, setShowSteps] = useState<GeometryTask | null>(null);

  const ownTask = useMemo(
    () => (exercise.text ? parseGeometryProblem(exercise.text, exercise.source === 'bot' ? 'preset' : 'student') : null),
    [exercise.text, exercise.source],
  );

  // Новий рисунок або нова задача — стара перевірка вже не актуальна.
  useEffect(() => setResult(null), [drawing, task]);

  useEffect(() => {
    if (props.constructionRequest > 0) void showConstruction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.constructionRequest]);

  async function showConstruction() {
    let t = task ?? ownTask;
    if (!t && exercise.text) t = await props.onConstructionFallback();
    if (!t) {
      setHint('Обери задачу зі списку або надішли умову в чаті — тоді покажу побудову.');
      return;
    }
    if (!task) onTaskChange(t);
    setShowSteps(t);
  }

  function openEdit(t: EditTarget) {
    setEdit(t);
    if (t.type === 'point') setEditText(drawing.points.find((p) => p.id === t.id)?.label ?? '');
    else {
      const a = drawing.angles.find((x) => x.id === t.id);
      setEditText(a?.text ?? '');
      setEditArcs(a?.arcs ?? 1);
    }
  }

  function saveEdit() {
    if (!edit) return;
    if (edit.type === 'point') {
      const label = editText.trim().slice(0, 3);
      onDrawingChange({ ...drawing, points: drawing.points.map((p) => (p.id === edit.id ? { ...p, label } : p)) }, { pushUndo: true });
    } else {
      const text = editText.trim().slice(0, 8);
      const withDeg = /^\d+([.,]\d+)?$/.test(text) ? `${text}°` : text;
      onDrawingChange(
        { ...drawing, angles: drawing.angles.map((a) => (a.id === edit.id ? { ...a, text: withDeg || undefined, arcs: editArcs } : a)) },
        { pushUndo: true },
      );
    }
    setEdit(null);
  }

  function runCheck() {
    if (!task) {
      // Задача поза набором — пояснення моделі з даними рисунка.
      props.onExplain(drawing, null);
      return;
    }
    setResult(checkDrawing(task, drawing));
  }

  const sameTask = (a: GeometryTask, b: GeometryTask) =>
    a.kind === b.kind && a.alpha === b.alpha && a.beta === b.beta && a.source === b.source && JSON.stringify(a.labels) === JSON.stringify(b.labels);
  const presetIdx = task ? PRESET_TASKS.findIndex((p) => sameTask(p, task)) : -1;
  const taskValue = !task ? 'free' : presetIdx >= 0 ? `p${presetIdx}` : 'own';

  if (showSteps) {
    const gated = showSteps.source === 'student' && !exercise.attemptMade;
    const all = construction(showSteps);
    const steps = gated ? all.filter((s) => s.stage === 'figure') : all;
    const ans = solve(showSteps);
    return (
      <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-3">
        <ConstructionView
          title={statement(showSteps)}
          steps={steps}
          gated={gated}
          answer={`${ans.name} = ${fmt(ans.value)}°`}
          onBack={() => setShowSteps(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-3xl border border-slate-700 bg-slate-900/60 p-3" data-testid="geometry-panel">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">✏️ Побудуй рисунок</div>
        <button onClick={props.onClose} className="rounded-xl px-2 py-1 text-xs text-slate-400 hover:bg-slate-800">
          Згорнути ✕
        </button>
      </div>

      <select
        value={taskValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'free') onTaskChange(null);
          else if (v === 'own') onTaskChange(ownTask ?? task);
          else onTaskChange(PRESET_TASKS[Number(v.slice(1))]);
        }}
        className="w-full rounded-2xl bg-slate-800 px-3 py-2.5 text-sm text-white outline-none"
        data-testid="task-select"
      >
        <option value="free">Вільний рисунок</option>
        {(ownTask || taskValue === 'own') && (
          <option value="own">Моя вправа: {TASK_KIND_TITLES[(taskValue === 'own' && task ? task : ownTask)!.kind]}</option>
        )}
        {PRESET_TASKS.map((p, i) => (
          <option key={i} value={`p${i}`}>
            Зразок: {TASK_KIND_TITLES[p.kind]}
          </option>
        ))}
      </select>

      {task && (
        <div className="rounded-2xl bg-slate-800 p-3 text-sm text-slate-100">
          <div data-testid="task-statement">{statement(task)}</div>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={task.exact} onChange={(e) => onTaskChange({ ...task, exact: e.target.checked })} />
            Точна побудова (з транспортиром)
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Інструменти">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTool(t.id);
              setHint(
                t.id === 'point'
                  ? 'Торкнися полотна, щоб поставити точку. Точки можна перетягувати.'
                  : t.id === 'segment'
                    ? 'Торкнися двох точок (або порожнього місця) — кінців відрізка.'
                    : t.id === 'ray'
                      ? 'Спочатку — початок променя, потім — точка, через яку він проходить.'
                      : t.id === 'angle'
                        ? 'Торкнися: точка на стороні → вершина → точка на другій стороні.'
                        : t.id === 'label'
                          ? 'Торкнися точки або позначки кута, щоб підписати.'
                          : 'Торкнися елемента, щоб стерти його.',
              );
            }}
            className={`rounded-xl px-2.5 py-2 text-xs font-semibold transition ${tool === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}
            aria-pressed={tool === t.id}
            data-tool={t.id}
          >
            <span className="mr-1">{t.icon}</span>
            {t.title}
          </button>
        ))}
        <button onClick={props.onUndo} disabled={!props.canUndo} className="rounded-xl bg-slate-800 px-2.5 py-2 text-xs font-semibold text-slate-300 disabled:opacity-40" data-tool="undo">
          ↶ Скасувати
        </button>
      </div>

      <div className="min-h-[2.6em] text-xs leading-snug text-slate-400" data-testid="board-hint">
        {hint}
      </div>

      <GeometryBoard drawing={drawing} onChange={onDrawingChange} tool={tool} onEdit={openEdit} onHint={setHint} testId="student-board" />

      {edit && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-800 p-2" data-testid="label-editor">
          <input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
            placeholder={edit.type === 'point' ? 'Буква, напр. O' : 'Величина, напр. 136'}
            className="w-32 flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm text-white outline-none"
            maxLength={edit.type === 'point' ? 3 : 8}
          />
          {edit.type === 'angle' && (
            <div className="flex gap-1" aria-label="Кількість дуг">
              {[1, 2, 3].map((n) => (
                <button key={n} onClick={() => setEditArcs(n)} className={`rounded-lg px-2 py-1 text-xs ${editArcs === n ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                  {'◠'.repeat(n)}
                </button>
              ))}
            </div>
          )}
          <button onClick={saveEdit} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold">
            OK
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={runCheck} disabled={busy || drawing.points.length === 0} className="rounded-2xl bg-emerald-600 py-2.5 text-sm font-semibold disabled:opacity-40" data-testid="check-drawing">
          ✓ Перевір рисунок
        </button>
        <button onClick={() => void showConstruction()} disabled={busy} className="rounded-2xl bg-slate-700 py-2.5 text-sm font-semibold disabled:opacity-40" data-testid="show-construction">
          📐 Покажи побудову
        </button>
      </div>

      {result && (
        <div className="space-y-1.5 rounded-2xl bg-slate-800 p-3 text-sm" data-testid="check-result">
          {result.question ? (
            <div className="text-amber-200">❓ {result.question}</div>
          ) : (
            <>
              <div className={`font-semibold ${result.passed ? 'text-emerald-300' : 'text-rose-300'}`}>
                {result.passed ? 'Рисунок відповідає умові ✓' : 'Є що виправити'}
              </div>
              {result.items.map((it, i) => (
                <div key={i} className="flex gap-2" data-status={it.status}>
                  <span>{it.status === 'ok' ? '✅' : it.status === 'error' ? '❌' : it.status === 'warning' ? '⚠️' : 'ℹ️'}</span>
                  <span className="text-slate-200">{it.text}</span>
                </div>
              ))}
              <div className="pt-1 text-xs text-slate-500">Перевірено кодом, без ШІ.</div>
            </>
          )}
          <button onClick={() => props.onExplain(drawing, task)} disabled={busy} className="mt-1 rounded-xl border border-slate-600 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40">
            💬 Поясни детальніше
          </button>
        </div>
      )}
    </div>
  );
}
