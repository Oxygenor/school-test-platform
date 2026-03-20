import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  const password = req.headers.get('x-teacher-password');
  if (password !== process.env.TEACHER_LOGIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId, message } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'Не вказано sessionId' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('student_sessions')
    .update({ teacher_message: message || null })
    .eq('id', sessionId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
