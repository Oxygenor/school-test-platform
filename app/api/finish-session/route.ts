import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  const { sessionId } = await req.json();

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'Не вказано sessionId' }, { status: 400 });
  }

  const finishedAt = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from('student_sessions')
    .update({ status: 'finished', updated_at: finishedAt })
    .eq('id', sessionId)
    .in('status', ['writing', 'blocked']);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
