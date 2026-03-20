import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');

  let query = supabaseAdmin
    .from('student_sessions')
    .select('*')
    .eq('status', 'finished')
    .order('started_at', { ascending: false });

  if (classId) {
    query = query.eq('class_id', Number(classId));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sessions: data || [] });
}
