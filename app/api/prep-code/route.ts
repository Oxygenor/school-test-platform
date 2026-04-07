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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code')?.trim();

  if (!code || code.length !== 6) {
    return NextResponse.json({ ok: false, error: 'Введіть 6-значний код' }, { status: 400 });
  }

  // Шукаємо клас за кодом підготовки
  const { data, error } = await supabaseAdmin
    .from('teacher_classes')
    .select('class_id, teacher_id, teachers!inner(name)')
    .eq('prep_code', code)
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'Невірний код підготовки' }, { status: 404 });
  }

  // Перевіряємо чи є хоча б одна робота з prep_enabled
  const { data: works } = await supabaseAdmin
    .from('works')
    .select('id')
    .eq('class_id', data.class_id)
    .eq('teacher_id', data.teacher_id)
    .eq('prep_enabled', true)
    .limit(1);

  if (!works || works.length === 0) {
    return NextResponse.json({ ok: false, error: 'Вчитель ще не відкрив підготовку' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    classId: data.class_id,
    className: idToClassName(data.class_id),
    teacherId: data.teacher_id,
    teacherName: (data.teachers as any)?.name ?? '',
    prepOnly: true,
  });
}
