import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');

  const id = Number(classId);
  const isSimple = id >= 1 && id <= 12;
  const isLettered = id >= 101 && Math.floor(id / 100) >= 1 && Math.floor(id / 100) <= 12 && (id % 100) >= 1 && (id % 100) <= 34;
  if (!classId || (!isSimple && !isLettered)) {
    return NextResponse.json({ ok: false, error: 'Некоректний клас' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('students')
    .select('*')
    .eq('class_id', id)
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, students: data });
}