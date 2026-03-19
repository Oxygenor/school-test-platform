import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const classId = Number(searchParams.get('classId'));

  if (![6, 7, 10].includes(classId)) {
    return NextResponse.json({ ok: false, error: 'Некоректний клас' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('class_settings')
    .select('exam_active')
    .eq('class_id', classId)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, active: data.exam_active });
}

export async function POST(req: Request) {
  const { classId, active, teacherPassword } = await req.json();

  if (teacherPassword !== process.env.TEACHER_UNLOCK_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'Невірний пароль' }, { status: 401 });
  }

  if (![6, 7, 10].includes(Number(classId))) {
    return NextResponse.json({ ok: false, error: 'Некоректний клас' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('class_settings')
    .update({ exam_active: active, updated_at: new Date().toISOString() })
    .eq('class_id', classId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, active });
}
