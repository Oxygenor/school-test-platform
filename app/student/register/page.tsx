'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, PageContainer, Title } from '@/components/ui';

interface StudentItem {
  id: string;
  class_id: number;
  full_name: string;
}

export default function StudentRegisterPage() {
  const router = useRouter();
  const [classId, setClassId] = useState<'6' | '7' | '10' | ''>('');
  const [classKey, setClassKey] = useState('');
  const [classVerified, setClassVerified] = useState(false);
  const [classKeyError, setClassKeyError] = useState('');
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [verifyingKey, setVerifyingKey] = useState(false);

  useEffect(() => {
    async function checkExistingSession() {
      const sessionId = localStorage.getItem('studentSessionId');
      if (!sessionId) return;

      const response = await fetch(`/api/get-session?sessionId=${sessionId}`);
      const data = await response.json();

      if (data.ok && data.session && ['writing', 'blocked'].includes(data.session.status)) {
        router.replace(`/student/exam?sessionId=${data.session.id}`);
      } else {
        localStorage.removeItem('studentSessionId');
        localStorage.removeItem('studentId');
        localStorage.removeItem('studentFullName');
        localStorage.removeItem('studentClassId');
      }
    }

    checkExistingSession();
  }, [router]);

  useEffect(() => {
    async function loadStudents() {
      if (!classId || !classVerified) {
        setStudents([]);
        setSelectedStudentId('');
        return;
      }

      setLoadingStudents(true);

      const response = await fetch(`/api/students?classId=${classId}`);
      const data = await response.json();

      if (data.ok) {
        setStudents(data.students);
      } else {
        setStudents([]);
      }

      setSelectedStudentId('');
      setLoadingStudents(false);
    }

    loadStudents();
  }, [classId, classVerified]);

  async function verifyClassKey() {
    if (!classId || !classKey.trim()) return;

    setVerifyingKey(true);
    setClassKeyError('');

    const response = await fetch('/api/verify-class-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: Number(classId), classKey }),
    });

    const data = await response.json();

    if (!data.ok) {
      setClassVerified(false);
      setStudents([]);
      setSelectedStudentId('');
      setClassKeyError(data.error || 'Неправильний ключ');
      setVerifyingKey(false);
      return;
    }

    setClassVerified(true);
    setClassKeyError('');
    setVerifyingKey(false);
  }

  function chooseClass(value: '6' | '7' | '10') {
    setClassId(value);
    setClassKey('');
    setClassVerified(false);
    setClassKeyError('');
    setStudents([]);
    setSelectedStudentId('');
  }

  function nextStep() {
    const selectedStudent = students.find((item) => item.id === selectedStudentId);
    if (!classId || !selectedStudent || !classVerified) return;

    const params = new URLSearchParams({
      classId,
      studentId: selectedStudent.id,
      fullName: selectedStudent.full_name,
    });

    router.push(`/student/variant?${params.toString()}`);
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl">
        <Card>
          <Title>Реєстрація учня</Title>
          <p className="mt-2 text-slate-600">
            Оберіть клас, введіть ключ класу і знайдіть себе у списку.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {['6', '7', '10'].map((item) => (
              <button
                key={item}
                className={`rounded-3xl border p-5 text-xl font-semibold ${
                  classId === item
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-900'
                }`}
                onClick={() => chooseClass(item as '6' | '7' | '10')}
              >
                {item} клас
              </button>
            ))}
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium">Ключ класу</label>
            <div className="flex gap-3">
              <input
                type="password"
                value={classKey}
                onChange={(e) => setClassKey(e.target.value)}
                placeholder="Введіть ключ класу"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
                disabled={!classId || classVerified}
              />
              <Button
                onClick={verifyClassKey}
                disabled={!classId || !classKey.trim() || verifyingKey || classVerified}
              >
                {classVerified ? 'Підтверджено' : 'Підтвердити'}
              </Button>
            </div>

            {classKeyError ? (
              <p className="mt-2 text-sm text-red-600">{classKeyError}</p>
            ) : null}

            {classVerified ? (
              <p className="mt-2 text-sm text-green-600">Ключ класу підтверджено.</p>
            ) : null}
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium">Оберіть себе зі списку</label>

            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
              disabled={!classVerified || loadingStudents}
            >
              <option value="">
                {!classId
                  ? 'Спочатку оберіть клас'
                  : !classVerified
                  ? 'Спочатку підтвердьте ключ класу'
                  : loadingStudents
                  ? 'Завантаження учнів...'
                  : 'Оберіть учня'}
              </option>

              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 flex gap-3">
            <Button onClick={nextStep} disabled={!classId || !selectedStudentId || !classVerified}>
              Далі
            </Button>
            <Button
              className="bg-slate-200 text-slate-900 hover:bg-slate-300"
              onClick={() => router.push('/')}
            >
              Назад
            </Button>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}