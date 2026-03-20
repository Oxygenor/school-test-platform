import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { classId, studentId, fullName, variant, subject } = await req.json();

    if (![1, 2].includes(Number(variant))) {
      return NextResponse.json({ ok: false, error: 'Некоректний варіант' }, { status: 400 });
    }

    if (!studentId) {
      return NextResponse.json({ ok: false, error: 'Не вказано учня' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('student_sessions')
      .select('*')
      .eq('student_id', studentId)
      .in('status', ['writing', 'blocked'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ ok: true, session: existing });
    }

    const { data, error } = await supabaseAdmin
      .from('student_sessions')
      .insert({
        class_id: Number(classId),
        student_id: studentId,
        full_name: String(fullName || '').trim(),
        variant: Number(variant),
        subject: subject ? String(subject).trim() : null,
        work_type: 'Самостійна робота',
        status: 'writing',
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await supabaseAdmin.from('session_events').insert({
      session_id: data.id,
      event_type: 'started',
      event_payload: { classId, variant, fullName, studentId },
    });

    return NextResponse.json({ ok: true, session: data });
  } catch {
    return NextResponse.json({ ok: false, error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}