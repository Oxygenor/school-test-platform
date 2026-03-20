import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTeacher } from '@/lib/teacher-auth';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const classId = Number(searchParams.get('classId'));

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
  const teacher = await requireTeacher(req);
  if (!teacher) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { classId, active } = await req.json();

  // Перевіряємо що вчитель є власником класу
  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('teacher_id')
    .eq('id', Number(classId))
    .single();

  if (!cls || cls.teacher_id !== teacher.id) {
    return NextResponse.json({ ok: false, error: 'Немає доступу' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('class_settings')
    .update({ exam_active: active, updated_at: new Date().toISOString() })
    .eq('class_id', Number(classId));

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, active });
}
