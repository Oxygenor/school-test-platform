import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'Не вказано sessionId' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('student_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'Сесію не знайдено' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, session: data });
}