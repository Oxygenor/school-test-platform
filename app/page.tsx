'use client';

import { useRouter } from 'next/navigation';
import { StudentSessionGuard } from '@/components/student-session-guard';

export default function HomePage() {
  const router = useRouter();

  function start() {
    const el = document.documentElement as any;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
    router.push('/student/register');
  }

  return (
    <>
      <StudentSessionGuard />
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white">

        <div className="w-full max-w-sm text-center">
          <div className="mb-6 inline-block rounded-2xl bg-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Школа
          </div>

          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            Платформа контрольних робіт
          </h1>

          <p className="mt-5 text-base leading-7 text-slate-400">
            Учень отримує завдання на екрані і записує відповіді на папері.
          </p>

          <button
            onClick={start}
            className="mt-10 w-full rounded-2xl bg-white py-4 text-lg font-semibold text-slate-950 transition active:scale-95"
          >
            Почати
          </button>
        </div>

        <a
          href="/teacher/login"
          className="absolute bottom-8 text-sm text-slate-600 hover:text-slate-400"
        >
          Вхід для вчителя
        </a>
      </div>
    </>
  );
}
