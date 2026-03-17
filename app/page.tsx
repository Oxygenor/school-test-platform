import Link from 'next/link';
import { Card, PageContainer, Title } from '@/components/ui';
import { StudentSessionGuard } from '@/components/student-session-guard';

export default function HomePage() {
  return (
    <>
    <StudentSessionGuard />
    <PageContainer>
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
        <Card>
          <div className="mb-3 inline-block rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
            Платформа контролю самостійних і контрольних робіт
          </div>
          <Title>Оберіть роль</Title>
          <p className="mt-4 text-slate-600">
            Учень отримує завдання на екрані та пише відповіді на папері. Вчитель бачить списки учнів і статуси блокування.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Link href="/teacher/login" className="rounded-3xl bg-slate-900 p-6 text-center text-lg font-semibold text-white">
              Вчитель
            </Link>
            <Link href="/student/register" className="rounded-3xl border border-slate-300 bg-white p-6 text-center text-lg font-semibold text-slate-900">
              Учень
            </Link>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold">Що вже є в системі</h2>
          <div className="mt-4 space-y-3 text-slate-600">
            <div className="rounded-2xl bg-slate-50 p-4">Вибір класу 6 / 7 / 10</div>
            <div className="rounded-2xl bg-slate-50 p-4">Вибір варіанту 1 / 2</div>
            <div className="rounded-2xl bg-slate-50 p-4">Сторінка завдань без поля вводу</div>
            <div className="rounded-2xl bg-slate-50 p-4">Блокування при втраті фокусу</div>
            <div className="rounded-2xl bg-slate-50 p-4">Розблокування тільки по паролю вчителя</div>
            <div className="rounded-2xl bg-slate-50 p-4">Адмінка вчителя по класах</div>
          </div>
        </Card>
      </div>
      
    </PageContainer>
    </>
  );
}