import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('classes')
    .select('id')
    .order('id');

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, classes: data.map((c) => c.id) });
}

export async function POST(req: Request) {
  const { classId, teacherPassword } = await req.json();

  if (teacherPassword !== process.env.TEACHER_LOGIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'Невірний пароль' }, { status: 401 });
  }

  const id = Number(classId);
  if (!id || id < 1 || id > 12) {
    return NextResponse.json({ ok: false, error: 'Некоректний клас' }, { status: 400 });
  }

  const { error: classError } = await supabaseAdmin
    .from('classes')
    .insert({ id });

  if (classError) {
    return NextResponse.json({ ok: false, error: 'Клас вже існує' }, { status: 409 });
  }

  await supabaseAdmin
    .from('class_settings')
    .upsert({ class_id: id, exam_active: false }, { onConflict: 'class_id' });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { classId, teacherPassword } = await req.json();

  if (teacherPassword !== process.env.TEACHER_LOGIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'Невірний пароль' }, { status: 401 });
  }

  const id = Number(classId);

  await supabaseAdmin.from('classes').delete().eq('id', id);
  await supabaseAdmin.from('class_settings').delete().eq('class_id', id);

  return NextResponse.json({ ok: true });
}
