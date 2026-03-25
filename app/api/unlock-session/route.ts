import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, requireTeacher } from '@/lib/teacher-auth';

export async function POST(req: Request) {
  try {
    const { sessionId, unlockPassword } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: 'Не вказано sessionId' }, { status: 400 });
    }

    // Спочатку перевіряємо токен вчителя (розблокування з дашборду)
    const teacher = await requireTeacher(req);

    if (!teacher) {
      // Учень вводить пароль вчителя вручну
      if (!unlockPassword) {
        return NextResponse.json({ ok: false, error: 'Не вказано пароль' }, { status: 400 });
      }

      // Знаходимо клас цієї сесії та пароль власника класу
      const { data: session } = await supabaseAdmin
        .from('student_sessions')
        .select('class_id')
        .eq('id', sessionId)
        .single();

      if (!session) {
        return NextResponse.json({ ok: false, error: 'Сесію не знайдено' }, { status: 404 });
      }

      const { data: cls } = await supabaseAdmin
        .from('classes')
        .select('teacher_id, teachers!inner(password_hash)')
        .eq('id', session.class_id)
        .single();

      if (!cls) {
        return NextResponse.json({ ok: false, error: 'Клас не знайдено' }, { status: 404 });
      }

      const teacherPasswordHash = (cls.teachers as any)?.password_hash;
      const enteredHash = await hashPassword(unlockPassword);

      if (enteredHash !== teacherPasswordHash) {
        return NextResponse.json({ ok: false, error: 'Неправильний пароль розблокування' }, { status: 401 });
      }
    }

    const unlockedAt = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('student_sessions')
      .update({
        status: 'writing',
        block_reason: null,
        blocked_at: null,
      })
      .eq('id', sessionId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }


    return NextResponse.json({ ok: true, session: data });
  } catch {
    return NextResponse.json({ ok: false, error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}
