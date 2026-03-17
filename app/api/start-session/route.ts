import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { classId, fullName, variant } = await req.json();

    if (![6, 7, 10].includes(Number(classId))) {
      return NextResponse.json({ ok: false, error: 'Некоректний клас' }, { status: 400 });
    }

    if (![1, 2].includes(Number(variant))) {
      return NextResponse.json({ ok: false, error: 'Некоректний варіант' }, { status: 400 });
    }

    const cleanName = String(fullName || '').trim();
    if (!cleanName) {
      return NextResponse.json({ ok: false, error: 'Не вказано ПІБ' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('student_sessions')
      .select('*')
      .eq('class_id', Number(classId))
      .ilike('full_name', cleanName)
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

    const workType = Number(classId) === 6 ? 'Самостійна робота' : 'Контрольна робота';

    const { data, error } = await supabaseAdmin
      .from('student_sessions')
      .insert({
        class_id: Number(classId),
        full_name: cleanName,
        variant: Number(variant),
        work_type: workType,
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
      event_payload: { classId, variant, fullName: cleanName },
    });

    return NextResponse.json({ ok: true, session: data });
  } catch {
    return NextResponse.json({ ok: false, error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}