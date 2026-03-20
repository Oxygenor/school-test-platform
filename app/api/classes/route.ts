import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTeacher } from '@/lib/teacher-auth';

export async function GET(req: Request) {
  const teacher = await requireTeacher(req);
  if (!teacher) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('teacher_classes')
    .select('class_id')
    .eq('teacher_id', teacher.id)
    .order('class_id');

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, classes: data.map((c) => c.class_id) });
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

  // Переконуємось що клас існує в таблиці classes
  await supabaseAdmin
    .from('classes')
    .upsert({ id }, { onConflict: 'id', ignoreDuplicates: true });

  // Додаємо зв'язок вчитель-клас (ігноруємо дублікати)
  const { error } = await supabaseAdmin
    .from('teacher_classes')
    .upsert(
      { teacher_id: teacher.id, class_id: id },
      { onConflict: 'teacher_id,class_id', ignoreDuplicates: true }
    );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Створюємо статус іспиту для цього вчителя і класу
  await supabaseAdmin
    .from('teacher_exam_status')
    .upsert(
      { teacher_id: teacher.id, class_id: id, exam_active: false },
      { onConflict: 'teacher_id,class_id' }
    );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const teacher = await requireTeacher(req);
  if (!teacher) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { classId } = await req.json();
  const id = Number(classId);

  // Видаляємо лише зв'язок цього вчителя з класом
  await supabaseAdmin
    .from('teacher_classes')
    .delete()
    .eq('teacher_id', teacher.id)
    .eq('class_id', id);

  await supabaseAdmin
    .from('teacher_exam_status')
    .delete()
    .eq('teacher_id', teacher.id)
    .eq('class_id', id);

  return NextResponse.json({ ok: true });
}
