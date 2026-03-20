'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, PageContainer, Title } from '@/components/ui';
import { MathText } from '@/components/math-text';

const WORK_TYPES = [
  'Самостійна робота',
  'Контрольна робота',
  'Діагностувальна контрольна робота',
  'Тематична контрольна робота',
];

type StoredTask = string | { text: string; choices: string[]; correctChoice?: number; points?: number };

interface DbWork {
  id: string;
  class_id: number;
  variant: number;
  subject: string;
  work_type: string;
  title: string;
  duration_minutes: number;
  tasks: StoredTask[];
  online_mode: boolean;
}

interface TaskForm {
  text: string;
  hasChoices: boolean;
  choices: string[];
  correctChoice: number | null;
  points: number;
}

interface FormState {
  subject: string;
  variant: 1 | 2;
  workType: string;
  title: string;
  durationMinutes: number;
  tasks: TaskForm[];
  onlineMode: boolean;
}

const CHOICE_LABELS = ['А', 'Б', 'В', 'Г', 'Д'];

function taskToForm(t: StoredTask): TaskForm {
  if (typeof t === 'string') return { text: t, hasChoices: false, choices: ['', '', '', ''], correctChoice: null, points: 1 };
  const choices = [...(t.choices || [])];
  while (choices.length < 4) choices.push('');
  return { text: t.text, hasChoices: true, choices, correctChoice: t.correctChoice ?? null, points: t.points ?? 1 };
}

function formToTask(t: TaskForm): StoredTask {
  const filtered = t.choices.filter((c) => c.trim());
  if (t.hasChoices && filtered.length > 0) {
    const obj: any = { text: t.text, choices: filtered, points: t.points };
    if (t.correctChoice !== null) obj.correctChoice = t.correctChoice;
    return obj;
  }
  if (t.points !== 1) {
    return { text: t.text, choices: [], points: t.points };
  }
  return t.text;
}

function parseTask(t: StoredTask): { text: string; choices: string[] } {
  if (typeof t === 'string') return { text: t, choices: [] };
  return { text: t.text, choices: t.choices || [] };
}

const emptyForm = (): FormState => ({
  subject: '',
  variant: 1,
  workType: 'Самостійна робота',
  title: '',
  durationMinutes: 40,
  tasks: [{ text: '', hasChoices: false, choices: ['', '', '', ''], correctChoice: null, points: 1 }],
  onlineMode: false,
});

export default function WorksPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const router = useRouter();
  const numericClassId = Number(classId);

  const [works, setWorks] = useState<DbWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [allClasses, setAllClasses] = useState<number[]>([]);

  // Копіювання
  const [copyingWork, setCopyingWork] = useState<DbWork | null>(null);
  const [copyTargetClass, setCopyTargetClass] = useState('');
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [copySuccess, setCopySuccess] = useState('');

  const [editingWork, setEditingWork] = useState<DbWork | null | 'new'>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('teacherPassword');
    if (!saved) {
      router.replace('/teacher/login');
      return;
    }
    setPassword(saved);
    fetchWorks();
    fetch('/api/classes').then((r) => r.json()).then((d) => {
      if (d.ok) setAllClasses(d.classes.filter((c: number) => c !== numericClassId));
    });
  }, []);

  async function fetchWorks() {
    setLoading(true);
    const res = await fetch(`/api/works?classId=${numericClassId}`);
    const data = await res.json();
    if (data.ok) setWorks(data.works);
    setLoading(false);
  }

  function openNew() {
    setForm(emptyForm());
    setEditingWork('new');
    setSaveError('');
    setSaveSuccess(false);
  }

  function openEdit(work: DbWork) {
    setForm({
      subject: work.subject,
      variant: work.variant as 1 | 2,
      workType: work.work_type,
      title: work.title,
      durationMinutes: work.duration_minutes,
      tasks: work.tasks.length > 0 ? work.tasks.map(taskToForm) : [{ text: '', hasChoices: false, choices: ['', '', '', ''], correctChoice: null, points: 1 }],
      onlineMode: work.online_mode ?? false,
    });
    setEditingWork(work);
    setSaveError('');
    setSaveSuccess(false);
  }

  function closeEdit() {
    setEditingWork(null);
    setSaveError('');
    setSaveSuccess(false);
  }

  async function saveWork() {
    if (!form.subject.trim()) { setSaveError('Вкажіть предмет'); return; }
    if (!form.title.trim()) { setSaveError('Введіть назву роботи'); return; }
    const filteredTasks = form.tasks
      .filter((t) => t.text.trim())
      .map(formToTask);
    if (filteredTasks.length === 0) { setSaveError('Додайте хоча б одне завдання'); return; }

    setSaving(true);
    setSaveError('');

    const res = await fetch('/api/works', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherPassword: password,
        classId: numericClassId,
        variant: form.variant,
        subject: form.subject,
        workType: form.workType,
        title: form.title,
        durationMinutes: form.durationMinutes,
        tasks: filteredTasks,
        onlineMode: form.onlineMode,
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
    setTimeout(() => { closeEdit(); }, 800);
  }

  async function copyWork() {
    if (!copyingWork || !copyTargetClass) return;
    setCopyLoading(true);
    setCopyError('');
    setCopySuccess('');
    const res = await fetch('/api/works', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherPassword: password,
        classId: Number(copyTargetClass),
        variant: copyingWork.variant,
        subject: copyingWork.subject,
        workType: copyingWork.work_type,
        title: copyingWork.title,
        durationMinutes: copyingWork.duration_minutes,
        tasks: copyingWork.tasks,
      }),
    });
    const data = await res.json();
    setCopyLoading(false);
    if (!data.ok) { setCopyError(data.error || 'Помилка'); return; }
    setCopySuccess(`Скопійовано в ${copyTargetClass} клас ✓`);
    setTimeout(() => { setCopyingWork(null); setCopySuccess(''); }, 1200);
  }

  async function deleteWork(work: DbWork) {
    if (!confirm(`Видалити роботу "${work.title}"?`)) return;
    const res = await fetch(
      `/api/works?classId=${numericClassId}&variant=${work.variant}&subject=${encodeURIComponent(work.subject)}&teacherPassword=${encodeURIComponent(password)}`,
      { method: 'DELETE' }
    );
    const data = await res.json();
    if (data.ok) fetchWorks();
  }

  function updateTaskText(index: number, value: string) {
    setForm((prev) => {
      const tasks = [...prev.tasks];
      tasks[index] = { ...tasks[index], text: value };
      return { ...prev, tasks };
    });
  }

  function toggleTaskChoices(index: number) {
    setForm((prev) => {
      const tasks = [...prev.tasks];
      tasks[index] = { ...tasks[index], hasChoices: !tasks[index].hasChoices };
      return { ...prev, tasks };
    });
  }

  function updateChoice(taskIndex: number, choiceIndex: number, value: string) {
    setForm((prev) => {
      const tasks = [...prev.tasks];
      const choices = [...tasks[taskIndex].choices];
      choices[choiceIndex] = value;
      tasks[taskIndex] = { ...tasks[taskIndex], choices };
      return { ...prev, tasks };
    });
  }

  function addChoice(taskIndex: number) {
    setForm((prev) => {
      const tasks = [...prev.tasks];
      tasks[taskIndex] = { ...tasks[taskIndex], choices: [...tasks[taskIndex].choices, ''] };
      return { ...prev, tasks };
    });
  }

  function removeChoice(taskIndex: number, choiceIndex: number) {
    setForm((prev) => {
      const tasks = [...prev.tasks];
      tasks[taskIndex] = { ...tasks[taskIndex], choices: tasks[taskIndex].choices.filter((_, i) => i !== choiceIndex) };
      return { ...prev, tasks };
    });
  }

  // Групуємо роботи по предметах
  const bySubject = works.reduce<Record<string, DbWork[]>>((acc, w) => {
    if (!acc[w.subject]) acc[w.subject] = [];
    acc[w.subject].push(w);
    return acc;
  }, {});

  return (
    <PageContainer>
      <div className="mx-auto max-w-4xl space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <Title>{numericClassId} клас — Роботи</Title>
            <p className="mt-1 text-slate-500 text-sm">
              Для дробів: <code className="bg-slate-100 px-1 rounded">$\frac{'{2}'}{'{3}'}$</code>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openNew}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
            >
              + Додати роботу
            </button>
            <Link
              href={`/teacher/dashboard`}
              className="rounded-2xl bg-slate-200 px-4 py-2 text-sm text-slate-900 hover:bg-slate-300"
            >
              Назад
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-slate-500 py-8">Завантаження...</div>
        ) : works.length === 0 ? (
          <Card>
            <p className="text-center text-slate-400 py-4">
              Немає жодної роботи. Натисніть "Додати роботу".
            </p>
          </Card>
        ) : (
          Object.entries(bySubject).sort(([a], [b]) => a.localeCompare(b)).map(([subject, subjectWorks]) => (
            <div key={subject}>
              <h2 className="mb-3 text-lg font-bold text-slate-700">{subject}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {subjectWorks.sort((a, b) => a.variant - b.variant).map((work) => (
                  <Card key={work.id}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                          Варіант {work.variant}
                        </div>
                        <div className="mt-1 font-bold text-slate-900">{work.title}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {work.work_type} · {work.duration_minutes} хв · {work.tasks.length} завдань
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => openEdit(work)}
                          className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white"
                        >
                          Редагувати
                        </button>
                        <button
                          onClick={() => window.open(`/teacher/print-work?classId=${numericClassId}&variant=${work.variant}&subject=${encodeURIComponent(work.subject)}`, '_blank')}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Друк
                        </button>
                        {allClasses.length > 0 && (
                          <button
                            onClick={() => { setCopyingWork(work); setCopyTargetClass(String(allClasses[0])); setCopyError(''); setCopySuccess(''); }}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            Копіювати
                          </button>
                        )}
                        <button
                          onClick={() => deleteWork(work)}
                          className="rounded-xl bg-red-500 px-3 py-2 text-xs text-white"
                        >
                          Видалити
                        </button>
                      </div>
                    </div>

                    {work.tasks.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {work.tasks.map((task, i) => {
                          const { text, choices } = parseTask(task);
                          return (
                            <div key={i} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                              <span className="font-semibold text-slate-400 mr-2">{i + 1}.</span>
                              <MathText text={text} />
                              {choices.length > 0 && (
                                <div className="mt-1 ml-5 flex flex-wrap gap-2">
                                  {choices.map((c, ci) => (
                                    <span key={ci} className="rounded-lg bg-white border border-slate-200 px-2 py-0.5 text-xs">
                                      {CHOICE_LABELS[ci]}) {c}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Модаль копіювання */}
        {copyingWork && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Копіювати роботу</h2>
                <button onClick={() => setCopyingWork(null)} className="text-2xl leading-none text-slate-400">×</button>
              </div>
              <p className="mb-4 text-sm text-slate-600">
                <strong>{copyingWork.subject}</strong> · Варіант {copyingWork.variant} · {copyingWork.title}
              </p>
              <label className="mb-1 block text-sm font-medium text-slate-700">Скопіювати в клас</label>
              <select
                value={copyTargetClass}
                onChange={(e) => setCopyTargetClass(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
              >
                {allClasses.map((c) => (
                  <option key={c} value={c}>{c} клас</option>
                ))}
              </select>
              {copyError && <p className="mt-2 text-sm text-red-600">{copyError}</p>}
              {copySuccess && <p className="mt-2 text-sm text-green-600">{copySuccess}</p>}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={copyWork}
                  disabled={copyLoading}
                  className="flex-1 rounded-2xl bg-slate-900 py-3 text-sm text-white font-semibold disabled:opacity-50"
                >
                  {copyLoading ? '...' : 'Скопіювати'}
                </button>
                <button onClick={() => setCopyingWork(null)} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700 text-sm">
                  Скасувати
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Форма */}
        {editingWork !== null && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 pt-8">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  {editingWork === 'new' ? 'Нова робота' : `Редагування — ${(editingWork as DbWork).subject}, Варіант ${(editingWork as DbWork).variant}`}
                </h2>
                <button onClick={closeEdit} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
              </div>

              <div className="space-y-4">

                {/* Предмет */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Предмет</label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="Наприклад: Математика, Фізика..."
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
                  />
                </div>

                {/* Варіант */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Варіант</label>
                  <div className="flex gap-3">
                    {([1, 2] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setForm((p) => ({ ...p, variant: v }))}
                        className={`flex-1 rounded-2xl border py-3 text-sm font-semibold transition ${
                          form.variant === v
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Варіант {v}
                      </button>
                    ))}
                  </div>
                </div>

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
                  <label className="mb-1 block text-sm font-medium text-slate-700">Тривалість (хвилини)</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={form.durationMinutes}
                    onChange={(e) => setForm((p) => ({ ...p, durationMinutes: Number(e.target.value) }))}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
                  />
                </div>

                {/* Онлайн режим */}
                <div className={`rounded-2xl border p-4 ${form.onlineMode ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.onlineMode}
                      onChange={(e) => setForm((p) => ({ ...p, onlineMode: e.target.checked }))}
                      className="h-4 w-4 rounded"
                    />
                    <div>
                      <div className="font-medium text-slate-800">Режим онлайн відповідей</div>
                      <div className="text-xs text-slate-500">Учні вибирають відповіді на платформі, система автоматично виставляє оцінку</div>
                    </div>
                  </label>
                </div>

                {/* Завдання */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Завдання
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      (дроби: $\frac{'{2}'}{'{3}'}$, корінь: $\sqrt{'{x}'}$)
                    </span>
                  </label>
                  <div className="space-y-4">
                    {form.tasks.map((task, i) => (
                      <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-2">
                        <div className="flex gap-2">
                          <span className="mt-3 text-sm font-semibold text-slate-400 w-5 shrink-0">{i + 1}.</span>
                          <textarea
                            value={task.text}
                            onChange={(e) => updateTaskText(i, e.target.value)}
                            rows={2}
                            placeholder="Текст завдання..."
                            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700 resize-none"
                          />
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            <label className="text-xs text-slate-400">балів</label>
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={task.points}
                              onChange={(e) => setForm((p) => {
                                const tasks = [...p.tasks];
                                tasks[i] = { ...tasks[i], points: Math.max(1, Number(e.target.value)) };
                                return { ...p, tasks };
                              })}
                              className="w-14 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm outline-none focus:border-slate-700"
                            />
                          </div>
                          {form.tasks.length > 1 && (
                            <button
                              onClick={() => setForm((p) => ({ ...p, tasks: p.tasks.filter((_, idx) => idx !== i) }))}
                              className="mt-1 text-red-400 hover:text-red-600 text-lg leading-none"
                            >
                              ×
                            </button>
                          )}
                        </div>

                        {/* Прев'ю */}
                        {task.text.trim() && (
                          <div className="ml-7 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            <span className="text-xs text-slate-400 mr-1">Прев'ю:</span>
                            <MathText text={task.text} />
                          </div>
                        )}

                        {/* Варіанти відповідей */}
                        <div className="ml-7">
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
                            <input
                              type="checkbox"
                              checked={task.hasChoices}
                              onChange={() => toggleTaskChoices(i)}
                              className="rounded"
                            />
                            Варіанти відповідей
                          </label>

                          {task.hasChoices && (
                            <div className="mt-2 space-y-2">
                              {task.choices.map((choice, ci) => (
                                <div key={ci} className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-500 w-6">{CHOICE_LABELS[ci] ?? String.fromCharCode(65 + ci)})</span>
                                  <input
                                    type="text"
                                    value={choice}
                                    onChange={(e) => updateChoice(i, ci, e.target.value)}
                                    placeholder={`Варіант ${ci + 1}...`}
                                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-700"
                                  />
                                  {task.choices.length > 2 && (
                                    <button onClick={() => removeChoice(i, ci)} className="text-red-400 hover:text-red-600 text-base">×</button>
                                  )}
                                </div>
                              ))}
                              {task.choices.length < 6 && (
                                <button
                                  onClick={() => addChoice(i)}
                                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                                >
                                  + Додати варіант
                                </button>
                              )}
                              {form.onlineMode && task.choices.filter(c => c.trim()).length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-200">
                                  <p className="text-xs font-medium text-slate-600 mb-1">Правильна відповідь:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {task.choices.map((c, ci) => c.trim() ? (
                                      <button
                                        key={ci}
                                        onClick={() => setForm((p) => {
                                          const tasks = [...p.tasks];
                                          tasks[i] = { ...tasks[i], correctChoice: task.correctChoice === ci ? null : ci };
                                          return { ...p, tasks };
                                        })}
                                        className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                                          task.correctChoice === ci
                                            ? 'bg-green-500 text-white'
                                            : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
                                        }`}
                                      >
                                        {CHOICE_LABELS[ci]}) {c}
                                      </button>
                                    ) : null)}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setForm((p) => ({ ...p, tasks: [...p.tasks, { text: '', hasChoices: false, choices: ['', '', '', ''], correctChoice: null, points: 1 }] }))}
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
