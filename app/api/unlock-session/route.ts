import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { sessionId, unlockPassword } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: 'Не вказано sessionId' }, { status: 400 });
    }

    if (unlockPassword !== process.env.TEACHER_LOGIN_PASSWORD) {
      return NextResponse.json({ ok: false, error: 'Неправильний пароль розблокування' }, { status: 401 });
    }

    const unlockedAt = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('student_sessions')
      .update({
        status: 'writing',
        block_reason: null,
        blocked_at: null,
        unlocked_at: unlockedAt,
        updated_at: unlockedAt,
      })
      .eq('id', sessionId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await supabaseAdmin.from('session_events').insert({
      session_id: sessionId,
      event_type: 'unlocked',
      event_payload: { unlockedAt },
    });

    return NextResponse.json({ ok: true, session: data });
  } catch {
    return NextResponse.json({ ok: false, error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}