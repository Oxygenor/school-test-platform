import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTeacher } from '@/lib/teacher-auth';

export async function POST(req: Request) {
  const teacher = await requireTeacher(req);
  if (!teacher) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId, message } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'Не вказано sessionId' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('student_sessions')
    .update({ teacher_message: message || null })
    .eq('id', sessionId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
