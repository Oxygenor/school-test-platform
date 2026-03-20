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

interface DbWork {
  id: string;
  class_id: number;
  variant: number;
  subject: string;
  work_type: string;
  title: string;
  duration_minutes: number;
  tasks: string[];
}

interface FormState {
  subject: string;
  variant: 1 | 2;
  workType: string;
  title: string;
  durationMinutes: number;
  tasks: string[];
}

const emptyForm = (): FormState => ({
  subject: '',
  variant: 1,
  workType: 'Самостійна робота',
  title: '',
  durationMinutes: 40,
  tasks: [''],
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
      tasks: work.tasks.length > 0 ? work.tasks : [''],
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
        variant: form.variant,
        subject: form.subject,
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

  function updateTask(index: number, value: string) {
    setForm((prev) => {
      const tasks = [...prev.tasks];
      tasks[index] = value;
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
                        {work.tasks.map((task, i) => (
                          <div key={i} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-400 mr-2">{i + 1}.</span>
                            <MathText text={task} />
                          </div>
                        ))}
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

                {/* Завдання */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Завдання
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      (дроби: $\frac{'{2}'}{'{3}'}$, корінь: $\sqrt{'{x}'}$)
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
                              onClick={() => setForm((p) => ({ ...p, tasks: p.tasks.filter((_, idx) => idx !== i) }))}
                              className="mt-1 text-red-400 hover:text-red-600 text-lg leading-none"
                            >
                              ×
                            </button>
                          )}
                        </div>
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
                    onClick={() => setForm((p) => ({ ...p, tasks: [...p.tasks, ''] }))}
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
