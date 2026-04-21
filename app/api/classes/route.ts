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
    .select('class_id, prep_code')
    .eq('teacher_id', teacher.id)
    .order('class_id');

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const classes = data.map((c) => ({ classId: c.class_id, prepCode: c.prep_code ?? null }));

  return NextResponse.json({ ok: true, classes });
}

export async function POST(req: Request) {
  const teacher = await requireTeacher(req);
  if (!teacher) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { classId } = await req.json();
  const id = Number(classId);
  const isSimple = id >= 1 && id <= 12;
  const isLettered = id >= 101 && Math.floor(id / 100) >= 1 && Math.floor(id / 100) <= 12 && (id % 100) >= 1 && (id % 100) <= 34;
  if (!id || (!isSimple && !isLettered)) {
    return NextResponse.json({ ok: false, error: 'Введіть номер від 1 до 12' }, { status: 400 });
  }

  // Перевіряємо конфлікт предметів
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

  // Якщо клас вже існує — просто додаємо зв'язок, інакше створюємо
  const { data: existingClass } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', id)
    .single();

  if (!existingClass) {
    await supabaseAdmin.from('classes').insert({ id });
  }

  const prepCode = String(Math.floor(100000 + Math.random() * 900000));
  const { error } = await supabaseAdmin
    .from('teacher_classes')
    .upsert(
      { teacher_id: teacher.id, class_id: id, prep_code: prepCode },
      { onConflict: 'teacher_id,class_id', ignoreDuplicates: true }
    );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

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
