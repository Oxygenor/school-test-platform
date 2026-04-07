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
    .select('subject, teacher_id, prep_enabled')
    .eq('class_id', classId)
    .in('teacher_id', teacherIds);

  if (e2) {
    return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });
  }

  // Дедуплікуємо по subject+teacher_id, prep_enabled=true якщо хоча б одна робота має
  const seen = new Map<string, { subject: string; teacherId: string; teacherName: string; prepEnabled: boolean }>();

  for (const w of works || []) {
    const key = `${w.subject}__${w.teacher_id}`;
    if (!seen.has(key)) {
      seen.set(key, {
        subject: w.subject,
        teacherId: w.teacher_id,
        teacherName: teacherNameMap[w.teacher_id] ?? '',
        prepEnabled: w.prep_enabled ?? false,
      });
    } else if (w.prep_enabled) {
      seen.get(key)!.prepEnabled = true;
    }
  }

  const subjects = Array.from(seen.values());

  subjects.sort((a, b) => a.subject.localeCompare(b.subject));

  return NextResponse.json({ ok: true, subjects });
}
