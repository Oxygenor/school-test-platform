import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  const { classId, classKey } = await req.json();

  if (!classId || !classKey?.trim()) {
    return NextResponse.json({ ok: false, error: 'Некоректні дані' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('classes')
    .select('class_key')
    .eq('id', Number(classId))
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'Клас не знайдено' }, { status: 404 });
  }

  if (!data.class_key || data.class_key.trim() !== classKey.trim()) {
    return NextResponse.json({ ok: false, error: 'Неправильний ключ класу' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
