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

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);

  const [classId, setClassId] = useState<number | null>(null);
  const [teacherId, setTeacherId] = useState('');
  const [teacherName, setTeacherName] = useState('');

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

  async function verifyCode() {
    const trimmed = code.trim();
    if (trimmed.length !== 6) { setCodeError('Код має бути 6 цифр'); return; }
    setVerifyingCode(true);
    setCodeError('');
    const res = await fetch(`/api/session-code?code=${trimmed}`);
    const data = await res.json();
    setVerifyingCode(false);
    if (!data.ok) { setCodeError(data.error || 'Невірний код'); return; }

    setClassId(data.classId);
    setTeacherId(data.teacherId);
    setTeacherName(data.teacherName);

    setLoadingStudents(true);
    const r = await fetch(`/api/students?classId=${data.classId}`);
    const d = await r.json();
    setStudents(d.ok ? d.students : []);
    setLoadingStudents(false);
  }

  function nextStep() {
    const student = students.find((s) => s.id === selectedStudentId);
    if (!classId || !student) return;
    const params = new URLSearchParams({
      classId: String(classId),
      studentId: student.id,
      fullName: student.full_name,
      teacherId,
      teacherName,
    });
    router.push(`/student/variant?${params.toString()}`);
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-md">
        <Card>
          <Title>Вхід учня</Title>

          {!classId ? (
            // Крок 1: Введення коду
            <div className="mt-6 space-y-4">
              <p className="text-slate-500 text-sm">Введіть 6-значний код який дав вчитель</p>
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
                <div>Клас: <strong>{classId}</strong></div>
                <div>Вчитель: <strong>{teacherName}</strong></div>
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
                onClick={() => { setClassId(null); setCode(''); setStudents([]); setSelectedStudentId(''); }}
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
