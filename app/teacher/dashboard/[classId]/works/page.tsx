'use client';

import { useEffect, useState, use, useRef } from 'react';
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

type StoredTask = string
  | { text: string; choices?: string[]; correctChoice?: number; points?: number; image_url?: string }
  | { type: 'header'; text: string }
  | { type: 'description'; text: string }
  | { type: 'fill_blank'; text: string; template: string; answers: string[]; points?: number; image_url?: string }
  | { type: 'matching'; text: string; pairs: Array<{ left: string; right: string }>; points?: number; image_url?: string }
  | { type: 'subtasks'; text: string; items: string[]; points?: number; image_url?: string };

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
  type: 'task' | 'header' | 'description' | 'fill_blank' | 'matching' | 'subtasks';
  text: string;
  hasChoices: boolean;
  choices: string[];
  correctChoice: number | null;
  points: number;
  image_url: string | null;
  fillTemplate: string;
  fillAnswers: string[];
  matchingPairs: Array<{ left: string; right: string }>;
  subtaskItems: string[];
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
  const base = { hasChoices: false, choices: ['', '', '', ''], correctChoice: null as null, points: 1, image_url: null as null, fillTemplate: '', fillAnswers: [] as string[], matchingPairs: [] as Array<{ left: string; right: string }>, subtaskItems: [] as string[] };
  if (typeof t === 'string') return { ...base, type: 'task', text: t };
  const a = t as any;
  if (a.type === 'header') return { ...base, type: 'header', text: a.text };
  if (a.type === 'description') return { ...base, type: 'description', text: a.text };
  if (a.type === 'fill_blank') return { ...base, type: 'fill_blank', text: a.text || '', points: a.points ?? 1, image_url: a.image_url ?? null, fillTemplate: a.template ?? '', fillAnswers: a.answers ?? [] };
  if (a.type === 'matching') return { ...base, type: 'matching', text: a.text || '', points: a.points ?? 1, image_url: a.image_url ?? null, matchingPairs: a.pairs ?? [] };
  if (a.type === 'subtasks') return { ...base, type: 'subtasks', text: a.text || '', points: a.points ?? 1, image_url: a.image_url ?? null, subtaskItems: a.items ?? ['', ''] };
  const choices = [...(a.choices || [])];
  while (choices.length < 4) choices.push('');
  return { ...base, type: 'task', text: a.text, hasChoices: (a.choices?.length ?? 0) > 0, choices, correctChoice: a.correctChoice ?? null, points: a.points ?? 1, image_url: a.image_url ?? null };
}

function formToTask(t: TaskForm): StoredTask {
  if (t.type === 'header') return { type: 'header', text: t.text } as any;
  if (t.type === 'description') return { type: 'description', text: t.text } as any;
  if (t.type === 'subtasks') {
    const obj: any = { type: 'subtasks', text: t.text, items: t.subtaskItems.filter(s => s.trim()), points: t.points };
    if (t.image_url) obj.image_url = t.image_url;
    return obj;
  }
  if (t.type === 'fill_blank') {
    const obj: any = { type: 'fill_blank', text: t.text, template: t.fillTemplate, answers: t.fillAnswers.slice(0, (t.fillTemplate.match(/\[___\]/g) || []).length), points: t.points };
    if (t.image_url) obj.image_url = t.image_url;
    return obj;
  }
  if (t.type === 'matching') {
    const obj: any = { type: 'matching', text: t.text, pairs: t.matchingPairs.filter(p => p.left.trim() || p.right.trim()), points: t.points };
    if (t.image_url) obj.image_url = t.image_url;
    return obj;
  }
  const filtered = t.choices.filter((c) => c.trim());
  const obj: any = filtered.length > 0 && t.hasChoices
    ? { text: t.text, choices: filtered, points: t.points, ...(t.correctChoice !== null ? { correctChoice: t.correctChoice } : {}) }
    : t.points !== 1 ? { text: t.text, choices: [], points: t.points } : t.text;
  if (t.image_url && typeof obj === 'object') obj.image_url = t.image_url;
  return obj;
}

function parseTask(t: StoredTask): { text: string; choices: string[]; type?: string } {
  if (typeof t === 'string') return { text: t, choices: [] };
  const a = t as any;
  return { text: a.text, choices: a.choices || [], type: a.type };
}

const EMPTY_TASK = (): TaskForm => ({ type: 'task', text: '', hasChoices: false, choices: ['', '', '', ''], correctChoice: null, points: 1, image_url: null, fillTemplate: '', fillAnswers: [], matchingPairs: [], subtaskItems: [] });

const emptyForm = (): FormState => ({
  subject: '',
  variant: 1,
  workType: 'Самостійна робота',
  title: '',
  durationMinutes: 40,
  tasks: [EMPTY_TASK()],
  onlineMode: false,
});

const UA_LETTERS = 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя';
function idToClassName(id: number): string {
  if (id >= 1 && id <= 12) return String(id);
  const num = Math.floor(id / 100);
  const letterIdx = (id % 100) - 1;
  if (letterIdx >= 0 && letterIdx < UA_LETTERS.length) return `${num}${UA_LETTERS[letterIdx]}`;
  return String(id);
}

export default function WorksPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const router = useRouter();
  const numericClassId = Number(classId);
  const displayClassName = idToClassName(numericClassId);

  const [works, setWorks] = useState<DbWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [allClasses, setAllClasses] = useState<number[]>([]);

  // Копіювання
  const [copyingWork, setCopyingWork] = useState<DbWork | null>(null);
  const [copyTargetClass, setCopyTargetClass] = useState('');
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [copySuccess, setCopySuccess] = useState('');

  const taskRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const fillTemplateRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const [editingWork, setEditingWork] = useState<DbWork | null | 'new'>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('teacherToken');
    if (!saved) {
      router.replace('/teacher/login');
      return;
    }
    setToken(saved);
    fetchWorks(saved);
    fetch('/api/classes', { headers: { 'x-teacher-token': saved } })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAllClasses(d.classes.filter((c: number) => c !== numericClassId));
      });
  }, []);

  async function fetchWorks(authToken?: string) {
    setLoading(true);
    const t = authToken ?? token;
    const res = await fetch(`/api/works?classId=${numericClassId}`, {
      headers: { 'x-teacher-token': t },
    });
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
      tasks: work.tasks.length > 0 ? work.tasks.map(taskToForm) : [EMPTY_TASK()],
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
      .filter((t) => t.text.trim() || t.type === 'fill_blank' && t.fillTemplate.trim() || t.type === 'matching' && t.matchingPairs.some(p => p.left.trim() || p.right.trim()))
      .map(formToTask);
    if (filteredTasks.length === 0) { setSaveError('Додайте хоча б одне завдання'); return; }

    setSaving(true);
    setSaveError('');

    const res = await fetch('/api/works', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-teacher-token': token },
      body: JSON.stringify({
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
      headers: { 'Content-Type': 'application/json', 'x-teacher-token': token },
      body: JSON.stringify({
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
      `/api/works?classId=${numericClassId}&variant=${work.variant}&subject=${encodeURIComponent(work.subject)}`,
      { method: 'DELETE', headers: { 'x-teacher-token': token } }
    );
    const data = await res.json();
    if (data.ok) fetchWorks();
  }

  const MATH_BUTTONS = [
    { label: '$…$', title: 'Обгорнути у $', snippet: '$WRAP$', cursor: 0 },
    { label: 'a/b', title: 'Дріб \\frac{}{}', snippet: '\\frac{}{}', cursor: 6 },
    { label: '√x', title: 'Корінь \\sqrt{}', snippet: '\\sqrt{}', cursor: 6 },
    { label: 'xⁿ', title: 'Степінь ^{}', snippet: '^{}', cursor: 2 },
    { label: '·', title: 'Крапка множення', snippet: '\\cdot ', cursor: 6 },
    { label: '≤', title: 'Менше або рівне', snippet: '\\leq ', cursor: 5 },
    { label: '≥', title: 'Більше або рівне', snippet: '\\geq ', cursor: 5 },
    { label: '±', title: 'Плюс-мінус', snippet: '\\pm ', cursor: 4 },
    { label: 'π', title: 'Пі', snippet: '\\pi ', cursor: 4 },
    { label: '∞', title: 'Нескінченність', snippet: '\\infty ', cursor: 7 },
  ];

  function insertMath(taskIndex: number, snippet: string, cursorOffset: number) {
    const textarea = taskRefs.current[taskIndex];
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const before = textarea.value.slice(0, start);
    const selected = textarea.value.slice(start, end);
    const after = textarea.value.slice(end);
    let newText: string;
    let cursorPos: number;
    if (snippet === '$WRAP$') {
      newText = selected
        ? before + '$' + selected + '$' + after
        : before + '$$' + after;
      cursorPos = selected ? end + 2 : start + 1;
    } else {
      newText = before + snippet + after;
      cursorPos = start + cursorOffset;
    }
    setForm((prev) => {
      const tasks = [...prev.tasks];
      tasks[taskIndex] = { ...tasks[taskIndex], text: newText };
      return { ...prev, tasks };
    });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
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
            <Title>{displayClassName} клас — Роботи</Title>
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
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 mr-auto">
                        Варіант {work.variant}
                      </span>
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
                    <div className="font-bold text-slate-900">{work.title}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {work.work_type} · {work.duration_minutes} хв · {work.tasks.length} завдань
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
                  <option key={c} value={c}>{idToClassName(Number(c))} клас</option>
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
                    {(() => {
                      let taskNum = 0;
                      return form.tasks.map((task, i) => {
                        const isHeader = task.type === 'header';
                        const isDesc = task.type === 'description';
                        if (!isHeader && !isDesc) taskNum++;
                        const num = taskNum;
                        return (
                      <div key={i} className={`rounded-xl border p-3 space-y-2 ${isHeader ? 'border-blue-200 bg-blue-50' : isDesc ? 'border-amber-200 bg-amber-50' : task.type === 'fill_blank' ? 'border-green-200 bg-green-50' : task.type === 'matching' ? 'border-purple-200 bg-purple-50' : task.type === 'subtasks' ? 'border-orange-200 bg-orange-50' : 'border-slate-200'}`}>
                        <div className="flex gap-2 items-start">
                          <span className={`mt-2 text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${isHeader ? 'bg-blue-200 text-blue-700' : isDesc ? 'bg-amber-200 text-amber-700' : task.type === 'fill_blank' ? 'bg-green-200 text-green-700' : task.type === 'matching' ? 'bg-purple-200 text-purple-700' : task.type === 'subtasks' ? 'bg-orange-200 text-orange-700' : 'text-slate-400'}`}>
                            {isHeader ? 'Заг.' : isDesc ? 'Опис' : task.type === 'fill_blank' ? 'Проп.' : task.type === 'matching' ? 'Відп.' : task.type === 'subtasks' ? `${num}.` : `${num}.`}
                          </span>
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {MATH_BUTTONS.map((btn) => (
                                <button
                                  key={btn.label}
                                  type="button"
                                  title={btn.title}
                                  onMouseDown={(e) => { e.preventDefault(); insertMath(i, btn.snippet, btn.cursor); }}
                                  className="rounded px-2 py-0.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                                >
                                  {btn.label}
                                </button>
                              ))}
                            </div>
                            <textarea
                              ref={(el) => { taskRefs.current[i] = el; }}
                              value={task.text}
                              onChange={(e) => updateTaskText(i, e.target.value)}
                              rows={isHeader ? 1 : 2}
                              placeholder={isHeader ? 'Текст заголовку...' : isDesc ? 'Текст інструкції/опису...' : task.type === 'subtasks' ? 'Загальний текст завдання (необов\'язково)...' : 'Текст завдання...'}
                              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none ${isHeader ? 'border-blue-300 focus:border-blue-500 font-bold' : isDesc ? 'border-amber-300 focus:border-amber-500 italic' : task.type === 'subtasks' ? 'border-orange-300 focus:border-orange-500' : 'border-slate-300 focus:border-slate-700'}`}
                            />
                          </div>
                          {!isHeader && !isDesc && (
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
                          )}
                          <button
                            onClick={() => setForm((p) => ({ ...p, tasks: p.tasks.filter((_, idx) => idx !== i) }))}
                            className="mt-1 text-red-400 hover:text-red-600 text-lg leading-none shrink-0"
                          >
                            ×
                          </button>
                        </div>

                        {/* Прев'ю */}
                        {task.text.trim() && (
                          <div className="ml-7 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            <span className="text-xs text-slate-400 mr-1">Прев'ю:</span>
                            <MathText text={task.text} />
                          </div>
                        )}

                        {/* Зображення — для task/fill_blank/matching */}
                        {!isHeader && !isDesc && (
                          <div className="ml-7">
                            {task.image_url ? (
                              <div className="flex items-center gap-2">
                                <img src={task.image_url} alt="" className="h-16 w-auto rounded-lg object-contain border border-slate-200" />
                                <button
                                  type="button"
                                  onClick={() => setForm(p => { const tasks = [...p.tasks]; tasks[i] = { ...tasks[i], image_url: null }; return { ...p, tasks }; })}
                                  className="text-xs text-red-500 hover:text-red-700"
                                >
                                  Видалити фото
                                </button>
                              </div>
                            ) : (
                              <label className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                                <span>📎 Додати зображення</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const tok = sessionStorage.getItem('teacherToken') || '';
                                    const fd = new FormData();
                                    fd.append('file', file);
                                    const res = await fetch('/api/upload-task-image', { method: 'POST', headers: { 'x-teacher-token': tok }, body: fd });
                                    const d = await res.json();
                                    if (d.ok) setForm(p => { const tasks = [...p.tasks]; tasks[i] = { ...tasks[i], image_url: d.url }; return { ...p, tasks }; });
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        )}

                        {/* Варіанти відповідей — тільки для звичайних завдань */}
                        {task.type === 'task' && (
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
                        )}

                        {/* Заповни пропуск */}
                        {task.type === 'fill_blank' && (
                          <div className="ml-7 space-y-2">
                            <div>
                              <label className="text-xs font-medium text-slate-600">Шаблон (використовуйте [___] для пропусків):</label>
                              <div className="mt-1 flex gap-2">
                                <textarea
                                  ref={(el) => { fillTemplateRefs.current[i] = el; }}
                                  value={task.fillTemplate}
                                  onChange={e => setForm(p => { const tasks = [...p.tasks]; tasks[i] = { ...tasks[i], fillTemplate: e.target.value }; return { ...p, tasks }; })}
                                  rows={2}
                                  placeholder="Наприклад: Столиця України — [___], а столиця Польщі — [___]"
                                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700 resize-none"
                                />
                                <button
                                  type="button"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    const ta = fillTemplateRefs.current[i];
                                    if (ta) {
                                      const start = ta.selectionStart || 0;
                                      const end = ta.selectionEnd || 0;
                                      const newVal = task.fillTemplate.slice(0, start) + '[___]' + task.fillTemplate.slice(end);
                                      setForm(p => { const tasks = [...p.tasks]; tasks[i] = { ...tasks[i], fillTemplate: newVal }; return { ...p, tasks }; });
                                      setTimeout(() => { ta.focus(); ta.setSelectionRange(start + 5, start + 5); }, 0);
                                    }
                                  }}
                                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 shrink-0"
                                >
                                  + [___]
                                </button>
                              </div>
                            </div>
                            {(task.fillTemplate.match(/\[___\]/g) || []).map((_, bi) => (
                              <div key={bi} className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 shrink-0">Пропуск {bi + 1}:</span>
                                <input
                                  type="text"
                                  value={task.fillAnswers[bi] || ''}
                                  onChange={e => setForm(p => { const tasks = [...p.tasks]; const ans = [...(tasks[i].fillAnswers || [])]; ans[bi] = e.target.value; tasks[i] = { ...tasks[i], fillAnswers: ans }; return { ...p, tasks }; })}
                                  placeholder="Правильна відповідь..."
                                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-700"
                                />
                              </div>
                            ))}
                            {task.fillTemplate && (
                              <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                <span className="text-xs text-slate-400 mr-1">Прев&apos;ю: </span>
                                {task.fillTemplate.split('[___]').map((seg, si, arr) => (
                                  <span key={si}>
                                    <MathText text={seg} />
                                    {si < arr.length - 1 && <span className="inline-block w-24 border-b border-slate-400 mx-1 align-bottom" />}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Підзавдання а)б)в) */}
                        {task.type === 'subtasks' && (
                          <div className="ml-7 space-y-2">
                            <label className="text-xs font-medium text-slate-600">Пункти завдання:</label>
                            {task.subtaskItems.map((item, si) => (
                              <div key={si} className="flex items-center gap-2">
                                <span className="text-xs font-bold text-orange-600 shrink-0 w-5">{String.fromCharCode(0x430 + si)})</span>
                                <input
                                  type="text"
                                  value={item}
                                  onChange={e => setForm(p => { const tasks = [...p.tasks]; const items = [...tasks[i].subtaskItems]; items[si] = e.target.value; tasks[i] = { ...tasks[i], subtaskItems: items }; return { ...p, tasks }; })}
                                  placeholder={`Пункт ${String.fromCharCode(0x430 + si)}...`}
                                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-orange-400"
                                />
                                {task.subtaskItems.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setForm(p => { const tasks = [...p.tasks]; tasks[i] = { ...tasks[i], subtaskItems: tasks[i].subtaskItems.filter((_, idx) => idx !== si) }; return { ...p, tasks }; })}
                                    className="text-red-400 hover:text-red-600"
                                  >×</button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => setForm(p => { const tasks = [...p.tasks]; tasks[i] = { ...tasks[i], subtaskItems: [...tasks[i].subtaskItems, ''] }; return { ...p, tasks }; })}
                              className="text-xs text-slate-400 hover:text-slate-600 underline"
                            >
                              + Додати пункт
                            </button>
                          </div>
                        )}

                        {/* Відповідність */}
                        {task.type === 'matching' && (
                          <div className="ml-7 space-y-2">
                            <label className="text-xs font-medium text-slate-600">Пари для відповідності:</label>
                            {task.matchingPairs.map((pair, pi) => (
                              <div key={pi} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={pair.left}
                                  onChange={e => setForm(p => { const tasks = [...p.tasks]; const pairs = [...tasks[i].matchingPairs]; pairs[pi] = { ...pairs[pi], left: e.target.value }; tasks[i] = { ...tasks[i], matchingPairs: pairs }; return { ...p, tasks }; })}
                                  placeholder="Ліва колонка..."
                                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-700"
                                />
                                <span className="text-slate-400 shrink-0">↔</span>
                                <input
                                  type="text"
                                  value={pair.right}
                                  onChange={e => setForm(p => { const tasks = [...p.tasks]; const pairs = [...tasks[i].matchingPairs]; pairs[pi] = { ...pairs[pi], right: e.target.value }; tasks[i] = { ...tasks[i], matchingPairs: pairs }; return { ...p, tasks }; })}
                                  placeholder="Права колонка..."
                                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-700"
                                />
                                {task.matchingPairs.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => setForm(p => { const tasks = [...p.tasks]; tasks[i] = { ...tasks[i], matchingPairs: tasks[i].matchingPairs.filter((_, idx) => idx !== pi) }; return { ...p, tasks }; })}
                                    className="text-red-400 hover:text-red-600"
                                  >×</button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => setForm(p => { const tasks = [...p.tasks]; tasks[i] = { ...tasks[i], matchingPairs: [...tasks[i].matchingPairs, { left: '', right: '' }] }; return { ...p, tasks }; })}
                              className="text-xs text-slate-400 hover:text-slate-600 underline"
                            >
                              + Додати пару
                            </button>
                          </div>
                        )}
                      </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button
                      onClick={() => setForm((p) => ({ ...p, tasks: [...p.tasks, EMPTY_TASK()] }))}
                      className="flex-1 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-slate-500 hover:text-slate-700"
                    >
                      + Завдання
                    </button>
                    <button
                      onClick={() => setForm((p) => ({ ...p, tasks: [...p.tasks, { type: 'subtasks' as const, text: '', hasChoices: false, choices: [], correctChoice: null, points: 1, image_url: null, fillTemplate: '', fillAnswers: [], matchingPairs: [], subtaskItems: ['', ''] }] }))}
                      className="rounded-xl border border-dashed border-orange-300 px-4 py-2 text-sm text-orange-600 hover:border-orange-500 hover:text-orange-700"
                    >
                      + Підзавдання а)б)в)
                    </button>
                    <button
                      onClick={() => setForm((p) => ({ ...p, tasks: [...p.tasks, { type: 'header' as const, text: '', hasChoices: false, choices: [], correctChoice: null, points: 1, image_url: null, fillTemplate: '', fillAnswers: [], matchingPairs: [], subtaskItems: [] }] }))}
                      className="rounded-xl border border-dashed border-blue-300 px-4 py-2 text-sm text-blue-500 hover:border-blue-500 hover:text-blue-700"
                    >
                      + Заголовок
                    </button>
                    <button
                      onClick={() => setForm((p) => ({ ...p, tasks: [...p.tasks, { type: 'description' as const, text: '', hasChoices: false, choices: [], correctChoice: null, points: 1, image_url: null, fillTemplate: '', fillAnswers: [], matchingPairs: [], subtaskItems: [] }] }))}
                      className="rounded-xl border border-dashed border-amber-300 px-4 py-2 text-sm text-amber-600 hover:border-amber-500 hover:text-amber-700"
                    >
                      + Опис/Інструкція
                    </button>
                    <button
                      onClick={() => setForm((p) => ({ ...p, tasks: [...p.tasks, { type: 'fill_blank' as const, text: '', hasChoices: false, choices: [], correctChoice: null, points: 1, image_url: null, fillTemplate: '', fillAnswers: [], matchingPairs: [], subtaskItems: [] }] }))}
                      className="rounded-xl border border-dashed border-green-300 px-4 py-2 text-sm text-green-600 hover:border-green-500 hover:text-green-700"
                    >
                      + Заповни пропуск
                    </button>
                    <button
                      onClick={() => setForm((p) => ({ ...p, tasks: [...p.tasks, { type: 'matching' as const, text: '', hasChoices: false, choices: [], correctChoice: null, points: 1, image_url: null, fillTemplate: '', fillAnswers: [], matchingPairs: [{ left: '', right: '' }, { left: '', right: '' }], subtaskItems: [] }] }))}
                      className="rounded-xl border border-dashed border-purple-300 px-4 py-2 text-sm text-purple-600 hover:border-purple-500 hover:text-purple-700"
                    >
                      + Відповідність
                    </button>
                  </div>
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
