import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { sessionId, reason } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: 'Не вказано sessionId' }, { status: 400 });
    }

    const blockedAt = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('student_sessions')
      .update({
        status: 'blocked',
        block_reason: reason || 'Зафіксовано порушення',
        blocked_at: blockedAt,
      })
      .eq('id', sessionId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, session: data });
  } catch {
    return NextResponse.json({ ok: false, error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}