import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTeacher } from '@/lib/teacher-auth';

export async function POST(req: Request) {
  const teacher = await requireTeacher(req);
  if (!teacher) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { workId, enabled } = await req.json();
  if (!workId) {
    return NextResponse.json({ ok: false, error: 'Відсутній workId' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('works')
    .update({ prep_enabled: enabled })
    .eq('id', workId)
    .eq('teacher_id', teacher.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
