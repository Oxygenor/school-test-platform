import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTeacher } from '@/lib/teacher-auth';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const classId = Number(searchParams.get('classId'));
  const teacherIdParam = searchParams.get('teacherId');

  // Якщо є токен вчителя в заголовку — показуємо статус тільки цього вчителя
  const token = req.headers.get('x-teacher-token');
  if (token) {
    const teacher = await requireTeacher(req);
    if (teacher) {
      const { data } = await supabaseAdmin
        .from('teacher_exam_status')
        .select('exam_active, session_code')
        .eq('class_id', classId)
        .eq('teacher_id', teacher.id)
        .single();
      return NextResponse.json({
        ok: true,
        active: data?.exam_active ?? false,
        session_code: data?.session_code ?? null,
      });
    }
  }

  // Учень перевіряє статус свого конкретного вчителя по teacherId
  if (teacherIdParam) {
    const { data } = await supabaseAdmin
      .from('teacher_exam_status')
      .select('exam_active')
      .eq('class_id', classId)
      .eq('teacher_id', teacherIdParam)
      .single();
    return NextResponse.json({ ok: true, active: data?.exam_active ?? false });
  }

  // Загальна перевірка (для учня): чи є хоч один активний іспит для класу
  const { data } = await supabaseAdmin
    .from('teacher_exam_status')
    .select('exam_active, teacher_id')
    .eq('class_id', classId)
    .eq('exam_active', true);

  return NextResponse.json({ ok: true, active: (data?.length ?? 0) > 0 });
}

export async function POST(req: Request) {
  const teacher = await requireTeacher(req);
  if (!teacher) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { classId, active } = await req.json();

  // При активації генеруємо новий 6-значний код, при деактивації — очищаємо
  const session_code = active
    ? String(Math.floor(100000 + Math.random() * 900000))
    : null;

  const { error } = await supabaseAdmin
    .from('teacher_exam_status')
    .upsert(
      { teacher_id: teacher.id, class_id: Number(classId), exam_active: active, session_code },
      { onConflict: 'teacher_id,class_id' }
    );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, active, session_code });
}
