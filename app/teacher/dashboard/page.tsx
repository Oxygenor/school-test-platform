import Link from 'next/link';
import { Card, PageContainer, Title } from '@/components/ui';

export default function TeacherDashboardPage() {
  return (
    <PageContainer>
      <div className="mx-auto max-w-5xl">
        <Card>
          <Title>Класи</Title>
          <p className="mt-2 text-slate-600">Оберіть клас, щоб подивитися учнів, які вже почали роботу.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[6, 7, 10].map((classId) => (
              <Link
                key={classId}
                href={`/teacher/dashboard/${classId}`}
                className="rounded-3xl border border-slate-300 bg-white p-6 text-center text-2xl font-bold text-slate-900"
              >
                {classId} клас
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}