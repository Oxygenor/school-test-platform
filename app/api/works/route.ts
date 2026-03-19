import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const classId = Number(searchParams.get('classId'));

  if (![6, 7, 10].includes(classId)) {
    return NextResponse.json({ ok: false, error: 'Некоректний клас' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('works')
    .select('*')
    .eq('class_id', classId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, works: data || [] });
}

export async function POST(req: Request) {
  const { teacherPassword, classId, variant, workType, title, durationMinutes, tasks } =
    await req.json();

  if (teacherPassword !== process.env.TEACHER_LOGIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'Невірний пароль' }, { status: 401 });
  }

  if (![6, 7, 10].includes(Number(classId))) {
    return NextResponse.json({ ok: false, error: 'Некоректний клас' }, { status: 400 });
  }

  if (![1, 2].includes(Number(variant))) {
    return NextResponse.json({ ok: false, error: 'Некоректний варіант' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('works')
    .upsert(
      {
        class_id: Number(classId),
        variant: Number(variant),
        work_type: workType,
        title,
        duration_minutes: Number(durationMinutes),
        tasks,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'class_id,variant' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, work: data });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const classId = Number(searchParams.get('classId'));
  const variant = Number(searchParams.get('variant'));
  const teacherPassword = searchParams.get('teacherPassword');

  if (teacherPassword !== process.env.TEACHER_LOGIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'Невірний пароль' }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from('works')
    .delete()
    .eq('class_id', classId)
    .eq('variant', variant);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
