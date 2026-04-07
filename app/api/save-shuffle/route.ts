import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { sessionId, shuffleOrder } = await req.json();
    if (!sessionId || !shuffleOrder) {
      return NextResponse.json({ ok: false, error: 'Відсутні параметри' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('student_sessions')
      .update({ shuffle_order: shuffleOrder })
      .eq('id', sessionId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}
