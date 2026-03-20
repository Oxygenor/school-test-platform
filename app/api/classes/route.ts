import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTeacher } from '@/lib/teacher-auth';

export async function GET(req: Request) {
  const teacher = await requireTeacher(req);
  if (!teacher) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('teacher_id', teacher.id)
    .order('id');

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, classes: data.map((c) => c.id) });
}

export async function POST(req: Request) {
  const teacher = await requireTeacher(req);
  if (!teacher) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { classId } = await req.json();
  const id = Number(classId);
  if (!id || id < 1 || id > 12) {
    return NextResponse.json({ ok: false, error: 'Введіть номер від 1 до 12' }, { status: 400 });
  }

  // Перевіряємо чи клас вже існує
  const { data: existing } = await supabaseAdmin
    .from('classes')
    .select('id, teacher_id, teachers(name)')
    .eq('id', id)
    .maybeSingle();

  if (existing) {
    if (existing.teacher_id === teacher.id) {
      return NextResponse.json({ ok: false, error: 'Цей клас вже є у вас' }, { status: 409 });
    }
    const ownerName = (existing.teachers as any)?.name ?? 'іншого вчителя';
    return NextResponse.json({ ok: false, error: `Клас ${id} вже використовує ${ownerName}` }, { status: 409 });
  }

  const { error: classError } = await supabaseAdmin
    .from('classes')
    .insert({ id, teacher_id: teacher.id });

  if (classError) {
    return NextResponse.json({ ok: false, error: 'Не вдалося створити клас' }, { status: 500 });
  }

  await supabaseAdmin
    .from('class_settings')
    .upsert({ class_id: id, exam_active: false }, { onConflict: 'class_id' });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const teacher = await requireTeacher(req);
  if (!teacher) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { classId } = await req.json();
  const id = Number(classId);

  // Перевіряємо що цей вчитель є власником класу
  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('teacher_id')
    .eq('id', id)
    .single();

  if (!cls || cls.teacher_id !== teacher.id) {
    return NextResponse.json({ ok: false, error: 'Немає доступу' }, { status: 403 });
  }

  await supabaseAdmin.from('classes').delete().eq('id', id);
  await supabaseAdmin.from('class_settings').delete().eq('class_id', id);

  return NextResponse.json({ ok: true });
}
