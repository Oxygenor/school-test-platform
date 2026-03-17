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
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);

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
      if (!classId) {
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
  }, [classId]);

  function nextStep() {
    const selectedStudent = students.find((item) => item.id === selectedStudentId);
    if (!classId || !selectedStudent) return;

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
          <p className="mt-2 text-slate-600">Оберіть клас і знайдіть себе у списку.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {['6', '7', '10'].map((item) => (
              <button
                key={item}
                className={`rounded-3xl border p-5 text-xl font-semibold ${
                  classId === item
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-900'
                }`}
                onClick={() => setClassId(item as '6' | '7' | '10')}
              >
                {item} клас
              </button>
            ))}
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium">Оберіть себе зі списку</label>

            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
              disabled={!classId || loadingStudents}
            >
              <option value="">
                {!classId
                  ? 'Спочатку оберіть клас'
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
            <Button onClick={nextStep} disabled={!classId || !selectedStudentId}>
              Далі
            </Button>
            <Button className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={() => router.push('/')}>
              Назад
            </Button>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}