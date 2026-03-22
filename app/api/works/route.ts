import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTeacher } from '@/lib/teacher-auth';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const classId = Number(searchParams.get('classId'));

  if (!classId) {
    return NextResponse.json({ ok: false, error: 'Некоректний клас' }, { status: 400 });
  }

  const teacher = await requireTeacher(req);
  // Альтернативний фільтр для сторінки учня (без авторизації)
  const teacherIdFilter = req.headers.get('x-teacher-id-filter');

  let query = supabaseAdmin
    .from('works')
    .select('*')
    .eq('class_id', classId)
    .order('subject')
    .order('variant');

  if (teacher) {
    query = query.eq('teacher_id', teacher.id);
  } else if (teacherIdFilter) {
    query = query.eq('teacher_id', teacherIdFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, works: data || [] });
}

export async function POST(req: Request) {
  const teacher = await requireTeacher(req);
  if (!teacher) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { classId, variant, subject, workType, title, durationMinutes, tasks, onlineMode } =
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
