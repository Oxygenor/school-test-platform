import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const UA_LETTERS = 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя';

function idToClassName(id: number): string {
  if (id >= 1 && id <= 12) return String(id);
  const num = Math.floor(id / 100);
  const letterIdx = (id % 100) - 1;
  if (letterIdx >= 0 && letterIdx < UA_LETTERS.length) {
    return `${num}${UA_LETTERS[letterIdx]}`;
  }
  return String(id);
}

// Учень перевіряє 6-значний код і отримує classId + teacherId
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code')?.trim();

  if (!code || code.length !== 6) {
    return NextResponse.json({ ok: false, error: 'Введіть 6-значний код' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('teacher_exam_status')
    .select('class_id, teacher_id, exam_active, teachers!inner(name)')
    .eq('session_code', code)
    .eq('exam_active', true)
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'Невірний код або іспит вже завершено' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    classId: data.class_id,
    className: idToClassName(data.class_id),
    teacherId: data.teacher_id,
    teacherName: (data.teachers as any)?.name ?? '',
  });
}
