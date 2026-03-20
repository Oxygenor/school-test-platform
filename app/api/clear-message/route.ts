import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  const { sessionId } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'Не вказано sessionId' }, { status: 400 });
  }
  await supabaseAdmin
    .from('student_sessions')
    .update({ teacher_message: null })
    .eq('id', sessionId);
  return NextResponse.json({ ok: true });
}
