'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, PageContainer, Title } from '@/components/ui';
import TicTacToe from '@/components/tictactoe';

interface StudentItem {
  id: string;
  class_id: number;
  full_name: string;
}

export default function StudentRegisterPage() {
  const router = useRouter();

  const [mode, setMode] = useState<'exam' | 'prep'>('exam');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);

  const [classId, setClassId] = useState<number | null>(null);
  const [className, setClassName] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [prepOnly, setPrepOnly] = useState(false);

  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Перевіряємо існуючу сесію
  useEffect(() => {
    async function checkExistingSession() {
      const sessionId = localStorage.getItem('studentSessionId');
      if (!sessionId) return;
      const res = await fetch(`/api/get-session?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.ok && data.session && ['writing', 'blocked'].includes(data.session.status)) {
        router.replace(`/student/exam?sessionId=${data.session.id}`);
      } else {
        localStorage.removeItem('studentSessionId');
        localStorage.removeItem('studentFullName');
        localStorage.removeItem('studentClassId');
      }
    }
    checkExistingSession();
  }, [router]);

  function resetCode() {
    setClassId(null);
    setClassName('');
    setCode('');
    setStudents([]);
    setSelectedStudentId('');
    setPrepOnly(false);
    setCodeError('');
  }

  async function verifyCode() {
    const trimmed = code.trim();
    if (trimmed.length !== 6) { setCodeError('Код має бути 6 цифр'); return; }
    setVerifyingCode(true);
    setCodeError('');

    const endpoint = mode === 'prep' ? `/api/prep-code?code=${trimmed}` : `/api/session-code?code=${trimmed}`;
    const res = await fetch(endpoint);
    const data = await res.json();
    setVerifyingCode(false);

    if (!data.ok) { setCodeError(data.error || 'Невірний код'); return; }

    setClassId(data.classId);
    setClassName(data.className ?? String(data.classId));
    setTeacherId(data.teacherId);
    setTeacherName(data.teacherName);
    setPrepOnly(data.prepOnly ?? false);

    setLoadingStudents(true);
    const r = await fetch(`/api/students?classId=${data.classId}`);
    const d = await r.json();
    setStudents(d.ok ? d.students : []);
    setLoadingStudents(false);
  }

  function nextStep() {
    const student = students.find((s) => s.id === selectedStudentId);
    if (!classId || !student) return;

    if (prepOnly) {
      // Одразу на підготовку
      const params = new URLSearchParams({
        classId: String(classId),
        subject: '', // завантажиться на сторінці підготовки
        teacherId,
        fullName: student.full_name,
      });
      // Переходимо на variant — там покажемо тільки підготовку
      const variantParams = new URLSearchParams({
        classId: String(classId),
        studentId: student.id,
        fullName: student.full_name,
        teacherId,
        teacherName,
      });
      router.push(`/student/variant?${variantParams.toString()}`);
    } else {
      const params = new URLSearchParams({
        classId: String(classId),
        studentId: student.id,
        fullName: student.full_name,
        teacherId,
        teacherName,
      });
      router.push(`/student/variant?${params.toString()}`);
    }
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-md">
        <Card>
          <Title>Вхід учня</Title>

          {!classId ? (
            <div className="mt-6 space-y-4">
              {/* Перемикач режиму */}
              <div className="flex rounded-2xl bg-slate-100 p-1">
                <button
                  onClick={() => { setMode('exam'); setCode(''); setCodeError(''); }}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${mode === 'exam' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                >
                  Іспит
                </button>
                <button
                  onClick={() => { setMode('prep'); setCode(''); setCodeError(''); }}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${mode === 'prep' ? 'bg-indigo-600 shadow text-white' : 'text-slate-500'}`}
                >
                  🤖 Підготовка
                </button>
              </div>

              <p className="text-slate-500 text-sm">
                {mode === 'exam'
                  ? 'Введіть 6-значний код який дав вчитель'
                  : 'Введіть код підготовки від вчителя'}
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setCodeError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
                placeholder="000000"
                className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-center text-3xl font-bold tracking-[0.3em] outline-none focus:border-slate-700"
              />
              {codeError && <p className="text-sm text-red-600 text-center">{codeError}</p>}
              <Button onClick={verifyCode} disabled={code.length !== 6 || verifyingCode} className="w-full">
                {verifyingCode ? 'Перевірка...' : 'Підтвердити'}
              </Button>
              <Button className="w-full bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={() => router.push('/')}>
                Назад
              </Button>
            </div>
          ) : (
            // Крок 2: Вибір імені
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <div>Клас: <strong>{className}</strong></div>
                <div>Вчитель: <strong>{teacherName}</strong></div>
                {prepOnly && <div className="mt-1 text-indigo-600 font-medium">🤖 Режим підготовки</div>}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Оберіть себе зі списку</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
                  disabled={loadingStudents}
                >
                  <option value="">{loadingStudents ? 'Завантаження...' : 'Оберіть учня'}</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
              <Button onClick={nextStep} disabled={!selectedStudentId} className="w-full">
                Далі
              </Button>
              <Button
                className="w-full bg-slate-200 text-slate-900 hover:bg-slate-300"
                onClick={resetCode}
              >
                Змінити код
              </Button>
            </div>
          )}
        </Card>
        <TicTacToe />
      </div>
    </PageContainer>
  );
}
