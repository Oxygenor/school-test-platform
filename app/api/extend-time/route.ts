import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTeacher } from '@/lib/teacher-auth';

export async function POST(req: Request) {
  const teacher = await requireTeacher(req);
  if (!teacher) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId, minutes } = await req.json();
  if (!sessionId || !minutes) {
    return NextResponse.json({ ok: false, error: 'Не вказано sessionId або minutes' }, { status: 400 });
  }

  const { data } = await supabaseAdmin
    .from('student_sessions')
    .select('extra_minutes')
    .eq('id', sessionId)
    .single();

  const current = (data?.extra_minutes as number) ?? 0;

  const { error } = await supabaseAdmin
    .from('student_sessions')
    .update({ extra_minutes: current + Number(minutes) })
    .eq('id', sessionId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, extra_minutes: current + Number(minutes) });
}
