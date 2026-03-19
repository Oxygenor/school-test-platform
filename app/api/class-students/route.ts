import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const classId = Number(searchParams.get('classId'));

  if (![6, 7, 10].includes(classId)) {
    return NextResponse.json({ ok: false, error: 'Некоректний клас' }, { status: 400 });
  }

  const { data: students, error } = await supabaseAdmin
    .from('student_sessions')
    .select('*')
    .eq('class_id', classId)
    .order('started_at', { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const sessionIds = (students || []).map((s) => s.id);

  const { data: exitEvents } = sessionIds.length
    ? await supabaseAdmin
        .from('session_events')
        .select('session_id')
        .eq('event_type', 'exit')
        .in('session_id', sessionIds)
    : { data: [] };

  const exitCountMap: Record<string, number> = {};
  for (const event of exitEvents || []) {
    exitCountMap[event.session_id] = (exitCountMap[event.session_id] || 0) + 1;
  }

  return NextResponse.json({ ok: true, students: students || [], exitCountMap });
}
