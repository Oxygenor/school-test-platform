'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, PageContainer, Title } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

interface ExitLog {
  exitedAt: string;
  durationSeconds: number;
}

interface StudentSession {
  id: string;
  full_name: string;
  variant: number;
  subject: string | null;
  status: string;
  started_at: string;
  blocked_at: string | null;
  block_reason: string | null;
  score: number | null;
  answers: Record<number, string> | null;
  extra_minutes: number;
}

interface DbWork {
  variant: number;
  subject: string;
  title: string;
  work_type: string;
  duration_minutes: number;
  tasks: string[];
}

function formatSeconds(s: number) {
  if (s < 60) return `${s} сек`;
  return `${Math.floor(s / 60)} хв ${s % 60} сек`;
}

function minutesSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

export default function TeacherClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const router = useRouter();
  const numericClassId = Number(classId);

  const [students, setStudents] = useState<StudentSession[]>([]);
  const [exitCountMap, setExitCountMap] = useState<Record<string, number>>({});
  const [exitLogMap, setExitLogMap] = useState<Record<string, ExitLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState<string | null>(null);

  const [journalStudent, setJournalStudent] = useState<StudentSession | null>(null);
  const [tasksStudent, setTasksStudent] = useState<StudentSession | null>(null);
  const [answersStudent, setAnswersStudent] = useState<StudentSession | null>(null);
  const [works, setWorks] = useState<DbWork[]>([]);

  // Повідомлення учню
  const [msgStudent, setMsgStudent] = useState<StudentSession | null>(null);
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);

  // Додати час
  const [extendStudent, setExtendStudent] = useState<StudentSession | null>(null);
  const [extendMinutes, setExtendMinutes] = useState('5');
  const [extendSending, setExtendSending] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('teacherPassword');
    if (!saved) { router.replace('/teacher/login'); return; }
    fetchStudents();
    const interval = setInterval(fetchStudents, 5000);
    return () => clearInterval(interval);
  }, [classId]);

  useEffect(() => {
    fetch(`/api/works?classId=${numericClassId}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setWorks(d.works); });
  }, [classId]);

  async function fetchStudents() {
    const res = await fetch(`/api/class-students?classId=${numericClassId}`);
    const data = await res.json();
    if (data.ok) {
      setStudents(data.students);
      setExitCountMap(data.exitCountMap);
      setExitLogMap(data.exitLogMap);
    }
    setLoading(false);
  }

  async function unlockStudent(sessionId: string) {
    const password = sessionStorage.getItem('teacherPassword');
    if (!password) return;
    setUnlocking(sessionId);
    await fetch('/api/unlock-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, unlockPassword: password }),
    });
    setUnlocking(null);
    fetchStudents();
  }

  async function finishStudent(sessionId: string) {
    await fetch('/api/finish-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    fetchStudents();
  }

  async function sendMessage() {
    if (!msgStudent || !msgText.trim()) return;
    const password = sessionStorage.getItem('teacherPassword');
    setMsgSending(true);
    await fetch('/api/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-teacher-password': password || '' },
      body: JSON.stringify({ sessionId: msgStudent.id, message: msgText.trim() }),
    });
    setMsgSending(false);
    setMsgStudent(null);
    setMsgText('');
  }

  async function extendTime() {
    if (!extendStudent) return;
    const password = sessionStorage.getItem('teacherPassword');
    setExtendSending(true);
    await fetch('/api/extend-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-teacher-password': password || '' },
      body: JSON.stringify({ sessionId: extendStudent.id, minutes: Number(extendMinutes) }),
    });
    setExtendSending(false);
    setExtendStudent(null);
    fetchStudents();
  }

  function isSuspicious(studentId: string): boolean {
    const exits = exitCountMap[studentId] || 0;
    const logs = exitLogMap[studentId] || [];
    return exits > 2 || logs.some(l => l.durationSeconds >= 7);
  }

  const writingCount = students.filter((s) => s.status === 'writing').length;
  const blockedCount = students.filter((s) => s.status === 'blocked').length;
  const finishedCount = students.filter((s) => s.status === 'finished').length;
  const suspiciousCount = students.filter((s) => isSuspicious(s.id)).length;

  function getStudentWork(s: StudentSession) {
    return works.find((w) => w.variant === s.variant && w.subject === s.subject) ?? null;
  }

  function getMaxScore(work: DbWork | null): number {
    if (!work) return 0;
    return work.tasks.reduce((sum: number, t: any) => sum + (typeof t === 'string' ? 1 : (t.points ?? 1)), 0);
  }

  function statusLabel(status: string) {
    if (status === 'writing') return { label: 'Пише', cls: 'bg-blue-100 text-blue-700' };
    if (status === 'blocked') return { label: 'Заблоковано', cls: 'bg-red-100 text-red-700' };
    return { label: 'Завершив', cls: 'bg-green-100 text-green-700' };
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-6xl">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <Title>{numericClassId} клас</Title>
            <p className="mt-1 text-sm text-slate-500">Оновлюється кожні 5 сек</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/teacher/dashboard/${classId}/works`} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
              Роботи
            </Link>
            <Link href="/teacher/dashboard" className="rounded-2xl bg-slate-200 px-4 py-3 text-sm text-slate-900">
              Назад
            </Link>
          </div>
        </div>

        {/* Статистика */}
        <div className="mb-6 grid gap-4 grid-cols-2 md:grid-cols-5">
          <Card>
            <div className="text-sm text-slate-500">Усього</div>
            <div className="mt-2 text-3xl font-bold">{students.length}</div>
          </Card>
          <Card>
            <div className="text-sm text-slate-500">Пишуть</div>
            <div className="mt-2 text-3xl font-bold text-blue-600">{writingCount}</div>
          </Card>
          <Card>
            <div className="text-sm text-slate-500">Заблоковано</div>
            <div className="mt-2 text-3xl font-bold text-red-600">{blockedCount}</div>
          </Card>
          <Card>
            <div className="text-sm text-slate-500">Завершили</div>
            <div className="mt-2 text-3xl font-bold text-green-600">{finishedCount}</div>
          </Card>
          <Card>
            <div className="text-sm text-slate-500">Підозрілих</div>
            <div className="mt-2 text-3xl font-bold text-orange-500">{suspiciousCount}</div>
          </Card>
        </div>

        {/* Таблиця */}
        <Card>
          {loading ? (
            <div className="py-8 text-center text-slate-500">Завантаження...</div>
          ) : students.length === 0 ? (
            <div className="py-8 text-center text-slate-500">Жоден учень ще не розпочав роботу.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-3">ПІБ</th>
                    <th className="px-3 py-3">Предмет</th>
                    <th className="px-3 py-3">Варіант</th>
                    <th className="px-3 py-3">Статус</th>
                    <th className="px-3 py-3">Оцінка</th>
                    <th className="px-3 py-3">Початок</th>
                    <th className="px-3 py-3">Виходи</th>
                    <th className="px-3 py-3">Причина</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const exits = exitCountMap[student.id] || 0;
                    const suspicious = isSuspicious(student.id);
                    const { label, cls } = statusLabel(student.status);
                    const blockedMins = student.blocked_at ? minutesSince(student.blocked_at) : 0;

                    return (
                      <tr key={student.id} className={`border-b border-slate-100 hover:bg-slate-50 ${suspicious && student.status === 'writing' ? 'bg-orange-50/40' : ''}`}>
                        <td className="px-3 py-3 font-medium">
                          <div className="flex items-center gap-1.5">
                            {student.full_name}
                            {suspicious && (
                              <span title="Підозріла активність" className="text-orange-500 text-base">⚠️</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{student.subject || '—'}</td>
                        <td className="px-3 py-3">{student.variant}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
                            {student.status === 'blocked' && blockedMins >= 5 && (
                              <span className="text-xs text-red-500">заблок. {blockedMins} хв</span>
                            )}
                            {student.extra_minutes > 0 && (
                              <span className="text-xs text-blue-500">+{student.extra_minutes} хв</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {student.score !== null && student.score !== undefined ? (() => {
                            const max = getMaxScore(getStudentWork(student));
                            const pct = max > 0 ? student.score / max : 0;
                            return (
                              <span className={`font-bold ${pct >= 0.9 ? 'text-green-600' : pct >= 0.6 ? 'text-orange-500' : 'text-red-600'}`}>
                                {student.score}{max > 0 ? `/${max}` : ''}
                              </span>
                            );
                          })() : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-500">{formatDateTime(student.started_at)}</td>
                        <td className="px-3 py-3">
                          {exits > 0 ? (
                            <button
                              onClick={() => setJournalStudent(student)}
                              className={`font-semibold underline underline-offset-2 ${suspicious ? 'text-orange-500' : 'text-red-600'}`}
                            >
                              {exits} раз
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-500 max-w-[160px] truncate">
                          {student.block_reason || '—'}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {/* Повідомлення + додати час — тільки для тих хто пише */}
                            {student.status === 'writing' && (
                              <>
                                <button
                                  onClick={() => { setMsgStudent(student); setMsgText(''); }}
                                  className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                                >
                                  Повідом.
                                </button>
                                <button
                                  onClick={() => { setExtendStudent(student); setExtendMinutes('5'); }}
                                  className="rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100"
                                >
                                  +Час
                                </button>
                              </>
                            )}
                            {student.subject && (
                              <>
                                <button
                                  onClick={() => setTasksStudent(student)}
                                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                                >
                                  Завдання
                                </button>
                                {student.answers && (
                                  <button
                                    onClick={() => setAnswersStudent(student)}
                                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                                  >
                                    Відповіді
                                  </button>
                                )}
                              </>
                            )}
                            {student.status === 'blocked' && (
                              <button
                                onClick={() => unlockStudent(student.id)}
                                disabled={unlocking === student.id}
                                className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
                              >
                                {unlocking === student.id ? '...' : 'Розблок.'}
                              </button>
                            )}
                            {student.status === 'blocked' && blockedMins >= 10 && (
                              <button
                                onClick={() => finishStudent(student.id)}
                                className="rounded-lg bg-red-500 px-2 py-1 text-xs text-white"
                              >
                                Завершити
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Модаль: Надіслати повідомлення */}
      {msgStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setMsgStudent(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Повідомлення для {msgStudent.full_name}</h2>
              <button onClick={() => setMsgStudent(null)} className="text-2xl leading-none text-slate-400 hover:text-slate-700">×</button>
            </div>
            <textarea
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder="Введіть повідомлення..."
              rows={4}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700 resize-none"
            />
            <button
              onClick={sendMessage}
              disabled={msgSending || !msgText.trim()}
              className="mt-3 w-full rounded-xl bg-slate-900 py-2.5 text-sm text-white font-semibold disabled:opacity-50"
            >
              {msgSending ? 'Надсилання...' : 'Надіслати'}
            </button>
          </div>
        </div>
      )}

      {/* Модаль: Додати час */}
      {extendStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setExtendStudent(null)}>
          <div className="w-full max-w-xs rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Додати час</h2>
              <button onClick={() => setExtendStudent(null)} className="text-2xl leading-none text-slate-400 hover:text-slate-700">×</button>
            </div>
            <p className="mb-3 text-sm text-slate-600">{extendStudent.full_name}</p>
            <div className="flex gap-2 mb-3">
              {[5, 10, 15].map((m) => (
                <button
                  key={m}
                  onClick={() => setExtendMinutes(String(m))}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold border transition ${extendMinutes === String(m) ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                >
                  {m} хв
                </button>
              ))}
            </div>
            <input
              type="number"
              value={extendMinutes}
              onChange={(e) => setExtendMinutes(e.target.value)}
              min={1}
              max={60}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
            />
            <button
              onClick={extendTime}
              disabled={extendSending}
              className="mt-3 w-full rounded-xl bg-green-600 py-2.5 text-sm text-white font-semibold disabled:opacity-50 hover:bg-green-700"
            >
              {extendSending ? '...' : `Додати ${extendMinutes} хв`}
            </button>
          </div>
        </div>
      )}

      {/* Модаль: Журнал виходів */}
      {journalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setJournalStudent(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Журнал виходів — {journalStudent.full_name}</h2>
              <button onClick={() => setJournalStudent(null)} className="text-2xl leading-none text-slate-400 hover:text-slate-700">×</button>
            </div>
            {(exitLogMap[journalStudent.id] || []).length === 0 ? (
              <p className="text-slate-400">Немає даних</p>
            ) : (
              <div className="space-y-2">
                {(exitLogMap[journalStudent.id] || []).map((log, i) => (
                  <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${log.durationSeconds >= 7 ? 'bg-red-50' : 'bg-slate-50'}`}>
                    <span className="font-medium text-slate-700">Вихід {i + 1}</span>
                    <span className="text-slate-500">{formatDateTime(log.exitedAt)}</span>
                    <span className={`font-semibold ${log.durationSeconds >= 7 ? 'text-red-600' : 'text-orange-500'}`}>
                      {formatSeconds(log.durationSeconds)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модаль: Відповіді учня */}
      {answersStudent && (() => {
        const work = getStudentWork(answersStudent);
        const CHOICE_LABELS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
        const maxScore = getMaxScore(work);
        const pct = maxScore > 0 && answersStudent.score !== null ? answersStudent.score / maxScore : 0;
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 pt-8" onClick={() => setAnswersStudent(null)}>
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Відповіді — {answersStudent.full_name}</h2>
                <button onClick={() => setAnswersStudent(null)} className="text-2xl leading-none text-slate-400 hover:text-slate-700">×</button>
              </div>
              <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span>{answersStudent.subject} · Варіант {answersStudent.variant}</span>
                {answersStudent.score !== null && answersStudent.score !== undefined && (
                  <span className={`font-bold text-base ${pct >= 0.9 ? 'text-green-600' : pct >= 0.6 ? 'text-orange-500' : 'text-red-600'}`}>
                    {answersStudent.score}{maxScore > 0 ? `/${maxScore} балів` : ' балів'}
                  </span>
                )}
              </div>
              {!work ? (
                <p className="text-slate-400">Роботу не знайдено в базі.</p>
              ) : (
                <div className="space-y-2">
                  {work.tasks.map((task, i) => {
                    const taskObj = typeof task === 'string' ? null : task as { text: string; choices?: string[]; correctChoice?: number; points?: number };
                    const correctLabel = taskObj?.correctChoice !== undefined && taskObj?.choices
                      ? CHOICE_LABELS[taskObj.correctChoice] ?? null
                      : null;
                    const taskPoints = taskObj?.points ?? 1;
                    const studentAnswer = (answersStudent.answers ?? {})[i];
                    const isCorrect = correctLabel !== null && studentAnswer === correctLabel;
                    const isWrong = correctLabel !== null && studentAnswer && studentAnswer !== correctLabel;
                    return (
                      <div key={i} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${isCorrect ? 'bg-green-50' : isWrong ? 'bg-red-50' : 'bg-slate-50'}`}>
                        <span className="font-semibold text-slate-400 mr-2">{i + 1}.</span>
                        <span className="flex-1 text-slate-700 truncate">{typeof task === 'string' ? task : (task as { text: string }).text}</span>
                        <div className="ml-3 flex items-center gap-2 shrink-0">
                          {correctLabel && <span className="text-xs text-slate-400">{taskPoints} б</span>}
                          {studentAnswer ? (
                            <span className={`font-bold ${isCorrect ? 'text-green-600' : isWrong ? 'text-red-600' : 'text-slate-600'}`}>{studentAnswer}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                          {correctLabel && (
                            <>
                              {isCorrect ? (
                                <span className="text-green-600">✓</span>
                              ) : (
                                <span className="text-slate-400 text-xs">({correctLabel})</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Модаль: Завдання учня */}
      {tasksStudent && (() => {
        const work = getStudentWork(tasksStudent);
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 pt-8" onClick={() => setTasksStudent(null)}>
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">{tasksStudent.full_name}</h2>
                <button onClick={() => setTasksStudent(null)} className="text-2xl leading-none text-slate-400 hover:text-slate-700">×</button>
              </div>
              <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {tasksStudent.subject} · Варіант {tasksStudent.variant}
              </div>
              {!work ? (
                <p className="text-slate-400">Роботу не знайдено в базі.</p>
              ) : (
                <>
                  <div className="mb-3 font-semibold">{work.title} <span className="font-normal text-slate-400">· {work.work_type}</span></div>
                  <div className="space-y-2">
                    {work.tasks.map((task, i) => (
                      <div key={i} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-400 mr-2">{i + 1}.</span>{typeof task === 'string' ? task : (task as any).text}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </PageContainer>
  );
}
