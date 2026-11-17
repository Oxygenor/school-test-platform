import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getTeacherFromToken, requireTeacher } from '@/lib/teacher-auth';
import { resolveWorks, type SessionRow, type WorkRow } from '@/lib/works-access';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  try {
    const result = await resolveWorks(
      {
        token: req.headers.get('x-teacher-token'),
        classId: searchParams.get('classId'),
        sessionId: searchParams.get('sessionId'),
        variant: searchParams.get('variant'),
        subject: searchParams.get('subject'),
      },
      {
        getTeacher: getTeacherFromToken,
        async getSession(sessionId) {
          const { data } = await supabaseAdmin
            .from('student_sessions')
            .select('id, class_id, teacher_id, variant, subject, status')
            .eq('id', sessionId)
            .maybeSingle();
          return (data as SessionRow) ?? null;
        },
        async listWorks({ classId, teacherId, variant, subject }) {
          let query = supabaseAdmin.from('works').select('*').eq('class_id', classId).order('subject').order('variant');
          if (teacherId) query = query.eq('teacher_id', teacherId);
          if (variant) query = query.eq('variant', variant);
          if (subject) query = query.eq('subject', subject);
          const { data, error } = await query;
          if (error) throw error;
          return (data || []) as WorkRow[];
        },
      },
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ ok: false, error: 'Помилка сервера' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const teacher = await requireTeacher(req);
  if (!teacher) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { classId, variant, subject, workType, title, durationMinutes, tasks, onlineMode, calculatorEnabled, draftEnabled } =
    await req.json();

  if (!classId) {
    return NextResponse.json({ ok: false, error: 'Некоректний клас' }, { status: 400 });
  }
  if (![1, 2].includes(Number(variant))) {
    return NextResponse.json({ ok: false, error: 'Некоректний варіант' }, { status: 400 });
  }
  if (!subject?.trim()) {
    return NextResponse.json({ ok: false, error: 'Вкажіть предмет' }, { status: 400 });
  }

  // Перевіряємо що вчитель має цей клас
  const { data: cls } = await supabaseAdmin
    .from('teacher_classes')
    .select('class_id')
    .eq('teacher_id', teacher.id)
    .eq('class_id', Number(classId))
    .maybeSingle();

  if (!cls) {
    return NextResponse.json({ ok: false, error: 'Немає доступу до цього класу' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('works')
    .upsert(
      {
        class_id: Number(classId),
        variant: Number(variant),
        subject: subject.trim(),
        work_type: workType,
        title,
        duration_minutes: Number(durationMinutes),
        tasks,
        online_mode: onlineMode ?? false,
        calculator_enabled: calculatorEnabled ?? true,
        draft_enabled: draftEnabled ?? true,
        teacher_id: teacher.id,
      },
      { onConflict: 'class_id,variant,subject,teacher_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, work: data });
}

export async function DELETE(req: Request) {
  const teacher = await requireTeacher(req);
  if (!teacher) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = Number(searchParams.get('classId'));
  const variant = Number(searchParams.get('variant'));
  const subject = searchParams.get('subject') || '';

  const query = supabaseAdmin
    .from('works')
    .delete()
    .eq('class_id', classId)
    .eq('variant', variant)
    .eq('teacher_id', teacher.id);

  if (subject) query.eq('subject', subject);

  const { error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
