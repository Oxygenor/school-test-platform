import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Повертає список активних іспитів для класу (з іменами вчителів)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const classId = Number(searchParams.get('classId'));

  if (!classId) {
    return NextResponse.json({ ok: false, error: 'Некоректний клас' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('teacher_exam_status')
    .select('teacher_id, teachers!inner(name)')
    .eq('class_id', classId)
    .eq('exam_active', true);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const exams = (data || []).map((row) => ({
    teacherId: row.teacher_id,
    teacherName: (row.teachers as any)?.name ?? '',
  }));

  return NextResponse.json({ ok: true, exams });
}
