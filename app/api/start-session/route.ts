import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { classId, studentId, fullName, variant, subject, teacherId } = await req.json();

    if (![1, 2].includes(Number(variant))) {
      return NextResponse.json({ ok: false, error: 'Некоректний варіант' }, { status: 400 });
    }

    if (!studentId) {
      return NextResponse.json({ ok: false, error: 'Не вказано учня' }, { status: 400 });
    }

    // Знаходимо активний іспит для цього класу + вчителя
    let resolvedTeacherId = teacherId || null;

    if (!resolvedTeacherId) {
      // Автоматично знаходимо вчителя з активним іспитом
      const { data: activeExams } = await supabaseAdmin
        .from('teacher_exam_status')
        .select('teacher_id')
        .eq('class_id', Number(classId))
        .eq('exam_active', true)
        .limit(1);

      if (activeExams && activeExams.length > 0) {
        resolvedTeacherId = activeExams[0].teacher_id;
      }
    }

    const { data: existing } = await supabaseAdmin
      .from('student_sessions')
      .select('*')
      .eq('student_id', studentId)
      .in('status', ['writing', 'blocked'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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
        status: 'writing',
        teacher_id: resolvedTeacherId,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, session: data });
  } catch {
    return NextResponse.json({ ok: false, error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}
