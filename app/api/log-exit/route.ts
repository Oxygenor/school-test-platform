import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { sessionId, durationSeconds, exitCount } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: 'Не вказано sessionId' }, { status: 400 });
    }

    await supabaseAdmin.from('session_events').insert({
      session_id: sessionId,
      event_type: 'exit',
      event_payload: {
        durationSeconds,
        exitCount,
        exitedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}
