import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTeacher } from '@/lib/teacher-auth';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const classId = Number(searchParams.get('classId'));

  if (!classId) {
    return NextResponse.json({ ok: false, error: 'Некоректний клас' }, { status: 400 });
  }

  const teacher = await requireTeacher(req);
  if (!teacher) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Повертаємо учнів лише цього вчителя для цього класу
  const { data: students, error } = await supabaseAdmin
    .from('student_sessions')
    .select('*')
    .eq('class_id', classId)
    .eq('teacher_id', teacher.id)
    .order('started_at', { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const sessionIds = (students || []).map((s) => s.id);

  const { data: exitEvents } = sessionIds.length
    ? await supabaseAdmin
        .from('session_events')
        .select('session_id, event_payload, created_at')
        .eq('event_type', 'exit')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: true })
    : { data: [] };

  const exitCountMap: Record<string, number> = {};
  const exitLogMap: Record<string, Array<{ exitedAt: string; durationSeconds: number }>> = {};

  for (const event of exitEvents || []) {
    exitCountMap[event.session_id] = (exitCountMap[event.session_id] || 0) + 1;
    if (!exitLogMap[event.session_id]) exitLogMap[event.session_id] = [];
    exitLogMap[event.session_id].push({
      exitedAt: event.event_payload?.exitedAt ?? event.created_at,
      durationSeconds: event.event_payload?.durationSeconds ?? 0,
    });
  }

  return NextResponse.json({ ok: true, students: students || [], exitCountMap, exitLogMap });
}
