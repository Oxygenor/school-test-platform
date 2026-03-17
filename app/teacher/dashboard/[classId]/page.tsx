import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { Card, PageContainer, Title } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

export default async function TeacherClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const numericClassId = Number(classId);

  if (![6, 7, 10].includes(numericClassId)) {
    notFound();
  }

  const { data: students, error } = await supabaseAdmin
    .from('student_sessions')
    .select('*')
    .eq('class_id', numericClassId)
    .order('started_at', { ascending: false });

  if (error) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-5xl text-red-600">Не вдалося завантажити список учнів.</div>
      </PageContainer>
    );
  }

  const writingCount = (students || []).filter((item) => item.status === 'writing').length;
  const blockedCount = (students || []).filter((item) => item.status === 'blocked').length;

  return (
    <PageContainer>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Title>{numericClassId} клас</Title>
            <p className="mt-2 text-slate-600">Список учнів, які почали роботу.</p>
          </div>
          <Link href="/teacher/dashboard" className="rounded-2xl bg-slate-200 px-4 py-3 text-slate-900">
            Назад
          </Link>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card><div className="text-sm text-slate-500">Усього</div><div className="mt-2 text-3xl font-bold">{students?.length || 0}</div></Card>
          <Card><div className="text-sm text-slate-500">Пишуть</div><div className="mt-2 text-3xl font-bold">{writingCount}</div></Card>
          <Card><div className="text-sm text-slate-500">У блокуванні</div><div className="mt-2 text-3xl font-bold">{blockedCount}</div></Card>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 text-sm text-slate-500">
                  <th className="px-3 py-3">ПІБ</th>
                  <th className="px-3 py-3">Варіант</th>
                  <th className="px-3 py-3">Статус</th>
                  <th className="px-3 py-3">Початок</th>
                  <th className="px-3 py-3">Блокування</th>
                  <th className="px-3 py-3">Причина</th>
                </tr>
              </thead>
              <tbody>
                {(students || []).map((student) => (
                  <tr key={student.id} className="border-b border-slate-100">
                    <td className="px-3 py-4 font-medium">{student.full_name}</td>
                    <td className="px-3 py-4">{student.variant}</td>
                    <td className="px-3 py-4">
                      {student.status === 'writing' ? 'Пише' : student.status === 'blocked' ? 'У блокуванні' : 'Завершив'}
                    </td>
                    <td className="px-3 py-4">{formatDateTime(student.started_at)}</td>
                    <td className="px-3 py-4">{formatDateTime(student.blocked_at)}</td>
                    <td className="px-3 py-4">{student.block_reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PageContainer>
    );
}