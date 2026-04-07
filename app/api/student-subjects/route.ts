import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const classId = Number(searchParams.get('classId'));

  if (!classId) {
    return NextResponse.json({ ok: false, error: 'Некоректний клас' }, { status: 400 });
  }

  // Знаходимо вчителів з активним іспитом
  const { data: activeTeachers, error: e1 } = await supabaseAdmin
    .from('teacher_exam_status')
    .select('teacher_id, teachers!inner(name)')
    .eq('class_id', classId)
    .eq('exam_active', true);

  if (e1) {
    return NextResponse.json({ ok: false, error: e1.message }, { status: 500 });
  }

  const activeTeacherIds = new Set((activeTeachers || []).map((t) => t.teacher_id));

  // Знаходимо всіх вчителів які мають роботи з prep_enabled для цього класу
  const { data: allWorks, error: e2 } = await supabaseAdmin
    .from('works')
    .select('subject, teacher_id, prep_enabled, teachers!inner(name)')
    .eq('class_id', classId);

  if (e2) {
    return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });
  }

  // Збираємо унікальні subject+teacher комбінації
  const seen = new Map<string, {
    subject: string;
    teacherId: string;
    teacherName: string;
    examActive: boolean;
    prepEnabled: boolean;
  }>();

  for (const w of allWorks || []) {
    const key = `${w.subject}__${w.teacher_id}`;
    const isExamActive = activeTeacherIds.has(w.teacher_id);
    const isPrepEnabled = w.prep_enabled ?? false;

    // Показуємо тільки якщо іспит активний АБО підготовка увімкнена
    if (!isExamActive && !isPrepEnabled) continue;

    if (!seen.has(key)) {
      seen.set(key, {
        subject: w.subject,
        teacherId: w.teacher_id,
        teacherName: (w.teachers as any)?.name ?? '',
        examActive: isExamActive,
        prepEnabled: isPrepEnabled,
      });
    } else {
      const entry = seen.get(key)!;
      if (isPrepEnabled) entry.prepEnabled = true;
      if (isExamActive) entry.examActive = true;
    }
  }

  const subjects = Array.from(seen.values());
  subjects.sort((a, b) => a.subject.localeCompare(b.subject));

  return NextResponse.json({ ok: true, subjects });
}
