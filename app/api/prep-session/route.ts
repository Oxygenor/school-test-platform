import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { supabasePrepDb } from '@/lib/math-helper/access-db';
import { checkPrepAccess } from '@/lib/math-helper/access';
import { issuePrepToken, isUuid } from '@/lib/math-helper/prep-token';
import { isMathSubject, topicsFor } from '@/lib/math-helper/topics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST: учень увійшов за кодом і вибрав себе зі списку.
 * Перевіряємо код (підготовки або іспиту), належність учня до класу й видаємо
 * короткоживучий підписаний токен підготовки, прив’язаний до класу, вчителя й учня.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Некоректний запит' }, { status: 400 });
  }
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const kind = body.kind === 'exam' ? 'exam' : 'prep';
  const studentId = body.studentId;
  if (!/^\d{6}$/.test(code) || !isUuid(studentId)) {
    return NextResponse.json({ ok: false, error: 'Некоректний код або учень' }, { status: 400 });
  }

  let classId: number | null = null;
  let teacherId: string | null = null;
  if (kind === 'prep') {
    const { data } = await supabaseAdmin.from('teacher_classes').select('class_id, teacher_id').eq('prep_code', code).maybeSingle();
    if (data) {
      classId = data.class_id;
      teacherId = data.teacher_id;
    }
  } else {
    const { data } = await supabaseAdmin
      .from('teacher_exam_status')
      .select('class_id, teacher_id')
      .eq('session_code', code)
      .eq('exam_active', true)
      .maybeSingle();
    if (data) {
      classId = data.class_id;
      teacherId = data.teacher_id;
    }
  }
  if (!classId || !teacherId) {
    return NextResponse.json({ ok: false, error: 'Невірний код' }, { status: 404 });
  }

  const student = await supabasePrepDb.findStudent(studentId, classId);
  if (!student) {
    return NextResponse.json({ ok: false, error: 'Учня не знайдено в цьому класі' }, { status: 403 });
  }

  const subjects = (await supabasePrepDb.listPrepSubjects(classId, teacherId)).filter(isMathSubject);
  if (subjects.length === 0) {
    // Іспит без підготовки — токен не потрібен.
    return NextResponse.json({ ok: true, prepToken: null, subjects: [] });
  }

  const { token, expiresAt } = issuePrepToken({ classId, teacherId, studentId });
  return NextResponse.json({ ok: true, prepToken: token, expiresAt, subjects });
}

/** GET: контекст сторінки помічника для чинного токена (клас, теми). Без виклику моделі. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const subject = searchParams.get('subject');
  const access = await checkPrepAccess(req.headers.get('x-prep-token'), subject, supabasePrepDb);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  const { ctx } = access;
  return NextResponse.json({
    ok: true,
    className: ctx.className,
    grade: ctx.grade,
    subject: ctx.subject,
    subjects: ctx.subjects,
    topics: subject ? topicsFor(ctx.grade, subject) : [],
  });
}
