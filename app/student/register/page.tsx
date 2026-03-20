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
  const [allClasses, setAllClasses] = useState<number[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Перевіряємо існуючу сесію
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

  // Завантажуємо список класів
  useEffect(() => {
    async function loadClasses() {
      setLoadingClasses(true);
      const res = await fetch('/api/student-classes');
      const data = await res.json();
      if (data.ok) setAllClasses(data.classes);
      setLoadingClasses(false);
    }
    loadClasses();
  }, []);

  // Завантажуємо учнів при виборі класу
  useEffect(() => {
    if (!classId) {
      setStudents([]);
      setSelectedStudentId('');
      return;
    }
    async function loadStudents() {
      setLoadingStudents(true);
      setSelectedStudentId('');
      const res = await fetch(`/api/students?classId=${classId}`);
      const data = await res.json();
      setStudents(data.ok ? data.students : []);
      setLoadingStudents(false);
    }
    loadStudents();
  }, [classId]);

  function nextStep() {
    const selectedStudent = students.find((s) => s.id === selectedStudentId);
    if (!classId || !selectedStudent) return;

    const params = new URLSearchParams({
      classId: String(classId),
      studentId: selectedStudent.id,
      fullName: selectedStudent.full_name,
    });

    router.push(`/student/variant?${params.toString()}`);
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl">
        <Card>
          <Title>Вхід учня</Title>
          <p className="mt-2 text-slate-600">Оберіть свій клас і знайдіть себе у списку.</p>

          {/* Вибір класу */}
          <div className="mt-6">
            <label className="mb-3 block text-sm font-medium text-slate-700">Ваш клас</label>
            {loadingClasses ? (
              <div className="text-sm text-slate-400">Завантаження...</div>
            ) : allClasses.length === 0 ? (
              <div className="text-sm text-slate-400">Жоден клас ще не доданий вчителем.</div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {allClasses.map((c) => (
                  <button
                    key={c}
                    onClick={() => setClassId(c)}
                    className={`rounded-3xl border px-6 py-4 text-xl font-semibold transition ${
                      classId === c
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'
                    }`}
                  >
                    {c} клас
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Вибір учня */}
          {classId && (
            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-slate-700">Оберіть себе зі списку</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
                disabled={loadingStudents}
              >
                <option value="">
                  {loadingStudents ? 'Завантаження учнів...' : 'Оберіть учня'}
                </option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button onClick={nextStep} disabled={!classId || !selectedStudentId}>
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
