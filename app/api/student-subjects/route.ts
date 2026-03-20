import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Повертає предмети з іменем вчителя для класу (тільки активні іспити)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const classId = Number(searchParams.get('classId'));

  if (!classId) {
    return NextResponse.json({ ok: false, error: 'Некоректний клас' }, { status: 400 });
  }

  // Знаходимо вчителів з активним іспитом для цього класу
  const { data: activeTeachers, error: e1 } = await supabaseAdmin
    .from('teacher_exam_status')
    .select('teacher_id, teachers!inner(name)')
    .eq('class_id', classId)
    .eq('exam_active', true);

  if (e1) {
    return NextResponse.json({ ok: false, error: e1.message }, { status: 500 });
  }

  if (!activeTeachers || activeTeachers.length === 0) {
    return NextResponse.json({ ok: true, subjects: [] });
  }

  const teacherIds = activeTeachers.map((t) => t.teacher_id);
  const teacherNameMap: Record<string, string> = {};
  for (const t of activeTeachers) {
    teacherNameMap[t.teacher_id] = (t.teachers as any)?.name ?? '';
  }

  // Отримуємо унікальні предмети для кожного активного вчителя
  const { data: works, error: e2 } = await supabaseAdmin
    .from('works')
    .select('subject, teacher_id')
    .eq('class_id', classId)
    .in('teacher_id', teacherIds);

  if (e2) {
    return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });
  }

  // Дедуплікуємо по subject+teacher_id
  const seen = new Set<string>();
  const subjects: { subject: string; teacherId: string; teacherName: string }[] = [];

  for (const w of works || []) {
    const key = `${w.subject}__${w.teacher_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      subjects.push({
        subject: w.subject,
        teacherId: w.teacher_id,
        teacherName: teacherNameMap[w.teacher_id] ?? '',
      });
    }
  }

  subjects.sort((a, b) => a.subject.localeCompare(b.subject));

  return NextResponse.json({ ok: true, subjects });
}
