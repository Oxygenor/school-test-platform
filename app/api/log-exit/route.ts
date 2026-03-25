import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { sessionId, durationSeconds } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: 'Не вказано sessionId' }, { status: 400 });
    }

    // Читаємо поточні логи
    const { data } = await supabaseAdmin
      .from('student_sessions')
      .select('exit_logs')
      .eq('id', sessionId)
      .single();

    const currentLogs: Array<{ exitedAt: string; durationSeconds: number }> =
      Array.isArray(data?.exit_logs) ? data.exit_logs : [];

    const newEntry = { exitedAt: new Date().toISOString(), durationSeconds: durationSeconds ?? 0 };

    await supabaseAdmin
      .from('student_sessions')
      .update({ exit_logs: [...currentLogs, newEntry] })
      .eq('id', sessionId);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}
