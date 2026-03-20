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

  // Перевіряємо конфлікт предметів: чи є вже вчитель з таким же предметом у цьому класі
  const { data: myTeacher } = await supabaseAdmin
    .from('teachers')
    .select('subjects')
    .eq('id', teacher.id)
    .single();

  const mySubjects: string[] = myTeacher?.subjects || [];

  if (mySubjects.length > 0) {
    const { data: othersInClass } = await supabaseAdmin
      .from('teacher_classes')
      .select('teacher_id, teachers!inner(subjects)')
      .eq('class_id', id)
      .neq('teacher_id', teacher.id);

    for (const other of othersInClass || []) {
      const otherSubjects: string[] = (other.teachers as any)?.subjects || [];
      const conflict = mySubjects.find((s) => otherSubjects.includes(s));
      if (conflict) {
        return NextResponse.json(
          { ok: false, error: `Вчитель з предметом "${conflict}" вже веде цей клас` },
          { status: 409 }
        );
      }
    }
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
