'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Card, PageContainer, Title } from '@/components/ui';
import { MathText } from '@/components/math-text';

const WORK_TYPES = [
  'Самостійна робота',
  'Контрольна робота',
  'Діагностувальна контрольна робота',
  'Тематична контрольна робота',
];

interface DbWork {
  id: string;
  class_id: number;
  variant: number;
  work_type: string;
  title: string;
  duration_minutes: number;
  tasks: string[];
}

interface FormState {
  workType: string;
  title: string;
  durationMinutes: number;
  tasks: string[];
}

const emptyForm = (): FormState => ({
  workType: 'Самостійна робота',
  title: '',
  durationMinutes: 40,
  tasks: [''],
});

export default function WorksPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const numericClassId = Number(classId);

  const [works, setWorks] = useState<DbWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [editingVariant, setEditingVariant] = useState<1 | 2 | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchWorks();
  }, [classId]);

  async function fetchWorks() {
    setLoading(true);
    const res = await fetch(`/api/works?classId=${numericClassId}`);
    const data = await res.json();
    if (data.ok) setWorks(data.works);
    setLoading(false);
  }

  function openEdit(variant: 1 | 2) {
    const existing = works.find((w) => w.variant === variant);
    if (existing) {
      setForm({
        workType: existing.work_type,
        title: existing.title,
        durationMinutes: existing.duration_minutes,
        tasks: existing.tasks.length > 0 ? existing.tasks : [''],
      });
    } else {
      setForm(emptyForm());
    }
    setEditingVariant(variant);
    setSaveError('');
    setSaveSuccess(false);
  }

  function closeEdit() {
    setEditingVariant(null);
    setSaveError('');
    setSaveSuccess(false);
  }

  async function saveWork() {
    if (!editingVariant) return;
    if (!passwordSaved) { setSaveError('Спочатку підтвердіть пароль'); return; }
    if (!form.title.trim()) { setSaveError('Введіть назву роботи'); return; }
    const filteredTasks = form.tasks.filter((t) => t.trim());
    if (filteredTasks.length === 0) { setSaveError('Додайте хоча б одне завдання'); return; }

    setSaving(true);
    setSaveError('');

    const res = await fetch('/api/works', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherPassword: password,
        classId: numericClassId,
        variant: editingVariant,
        workType: form.workType,
        title: form.title,
        durationMinutes: form.durationMinutes,
        tasks: filteredTasks,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!data.ok) {
      setSaveError(data.error || 'Помилка збереження');
      return;
    }

    setSaveSuccess(true);
    await fetchWorks();
    setTimeout(() => { closeEdit(); }, 1000);
  }

  async function deleteWork(variant: number) {
    if (!passwordSaved) return;
    const res = await fetch(
      `/api/works?classId=${numericClassId}&variant=${variant}&teacherPassword=${encodeURIComponent(password)}`,
      { method: 'DELETE' }
    );
    const data = await res.json();
    if (data.ok) fetchWorks();
  }

  function updateTask(index: number, value: string) {
    setForm((prev) => {
      const tasks = [...prev.tasks];
      tasks[index] = value;
      return { ...prev, tasks };
    });
  }

  function addTask() {
    setForm((prev) => ({ ...prev, tasks: [...prev.tasks, ''] }));
  }

  function removeTask(index: number) {
    setForm((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index),
    }));
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Заголовок */}
        <div className="flex items-center justify-between">
          <div>
            <Title>{numericClassId} клас — Роботи</Title>
            <p className="mt-1 text-slate-500 text-sm">
              Для математики використовуйте синтаксис: <code className="bg-slate-100 px-1 rounded">$\frac{'{2}'}{'{3}'}$</code> → отримаєте дріб
            </p>
          </div>
          <Link
            href={`/teacher/dashboard/${classId}`}
            className="rounded-2xl bg-slate-200 px-4 py-3 text-sm text-slate-900 hover:bg-slate-300"
          >
            Назад
          </Link>
        </div>

        {/* Пароль */}
        <Card>
          <p className="mb-3 text-sm text-slate-600">Введіть пароль вчителя щоб редагувати роботи.</p>
          <div className="flex gap-3">
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

        {/* Варіанти */}
        {loading ? (
          <div className="text-center text-slate-500 py-8">Завантаження...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {([1, 2] as const).map((variant) => {
              const work = works.find((w) => w.variant === variant);
              return (
                <Card key={variant}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                        Варіант {variant}
                      </div>
                      {work ? (
                        <>
                          <div className="mt-1 font-bold text-slate-900">{work.title}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {work.work_type} · {work.duration_minutes} хв · {work.tasks.length} завдань
                          </div>
                        </>
                      ) : (
                        <div className="mt-1 text-sm text-slate-400">Роботу не додано</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(variant)}
                        disabled={!passwordSaved}
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white disabled:opacity-40"
                      >
                        {work ? 'Редагувати' : 'Додати'}
                      </button>
                      {work && (
                        <button
                          onClick={() => deleteWork(variant)}
                          disabled={!passwordSaved}
                          className="rounded-xl bg-red-500 px-3 py-2 text-xs text-white disabled:opacity-40"
                        >
                          Видалити
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Список завдань */}
                  {work && (
                    <div className="mt-4 space-y-2">
                      {work.tasks.map((task, i) => (
                        <div
                          key={i}
                          className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700"
                        >
                          <span className="font-semibold text-slate-400 mr-2">{i + 1}.</span>
                          <MathText text={task} />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Форма редагування */}
        {editingVariant !== null && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 pt-8">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  Варіант {editingVariant} — {numericClassId} клас
                </h2>
                <button onClick={closeEdit} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
              </div>

              <div className="space-y-4">

                {/* Тип роботи */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Тип роботи</label>
                  <select
                    value={form.workType}
                    onChange={(e) => setForm((p) => ({ ...p, workType: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
                  >
                    {WORK_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Назва */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Назва</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Наприклад: Похідна функції"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
                  />
                </div>

                {/* Тривалість */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Тривалість (хвилини)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={form.durationMinutes}
                    onChange={(e) => setForm((p) => ({ ...p, durationMinutes: Number(e.target.value) }))}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
                  />
                </div>

                {/* Завдання */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Завдання
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      (для дробів: $\frac{'{2}'}{'{3}'}$, для кореня: $\sqrt{'{x}'}$)
                    </span>
                  </label>
                  <div className="space-y-3">
                    {form.tasks.map((task, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex gap-2">
                          <span className="mt-3 text-sm font-semibold text-slate-400 w-5 shrink-0">{i + 1}.</span>
                          <textarea
                            value={task}
                            onChange={(e) => updateTask(i, e.target.value)}
                            rows={2}
                            placeholder="Текст завдання..."
                            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700 resize-none"
                          />
                          {form.tasks.length > 1 && (
                            <button
                              onClick={() => removeTask(i)}
                              className="mt-1 text-red-400 hover:text-red-600 text-lg leading-none"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        {/* Прев'ю */}
                        {task.trim() && (
                          <div className="ml-7 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            <span className="text-xs text-slate-400 mr-1">Прев'ю:</span>
                            <MathText text={task} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addTask}
                    className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-slate-500 hover:text-slate-700 w-full"
                  >
                    + Додати завдання
                  </button>
                </div>

              </div>

              {saveError && <p className="mt-4 text-sm text-red-600">{saveError}</p>}
              {saveSuccess && <p className="mt-4 text-sm text-green-600">Збережено ✓</p>}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={saveWork}
                  disabled={saving}
                  className="flex-1 rounded-2xl bg-slate-900 py-3 text-white font-semibold disabled:opacity-50"
                >
                  {saving ? 'Збереження...' : 'Зберегти'}
                </button>
                <button
                  onClick={closeEdit}
                  className="rounded-2xl border border-slate-300 px-6 py-3 text-slate-700"
                >
                  Скасувати
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PageContainer>
  );
}
