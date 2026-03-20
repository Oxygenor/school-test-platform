import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  const password = req.headers.get('x-teacher-password');
  if (password !== process.env.TEACHER_LOGIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId, minutes } = await req.json();
  if (!sessionId || !minutes) {
    return NextResponse.json({ ok: false, error: 'Не вказано sessionId або minutes' }, { status: 400 });
  }

  const { data } = await supabaseAdmin
    .from('student_sessions')
    .select('extra_minutes')
    .eq('id', sessionId)
    .single();

  const current = data?.extra_minutes ?? 0;

  const { error } = await supabaseAdmin
    .from('student_sessions')
    .update({ extra_minutes: current + Number(minutes) })
    .eq('id', sessionId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, extra_minutes: current + Number(minutes) });
}
