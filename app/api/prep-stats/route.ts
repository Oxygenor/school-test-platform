import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTeacher } from '@/lib/teacher-auth';

export async function GET(req: Request) {
  const teacher = await requireTeacher(req);
  if (!teacher) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = Number(searchParams.get('classId'));

  if (!classId) {
    return NextResponse.json({ ok: false, error: 'Некоректний клас' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('prep_logs')
    .select('student_name, subject, message, created_at')
    .eq('class_id', classId)
    .eq('teacher_id', teacher.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const logs = data || [];

  // Унікальні учні
  const studentsSet = new Set(logs.map((l) => l.student_name).filter(Boolean));

  // Кількість питань по учню
  const perStudent: Record<string, number> = {};
  for (const l of logs) {
    if (l.student_name) {
      perStudent[l.student_name] = (perStudent[l.student_name] || 0) + 1;
    }
  }

  // Топ питань — прості слова які зустрічаються найчастіше (без стоп-слів)
  const stopWords = new Set(['як', 'що', 'це', 'мені', 'мене', 'я', 'не', 'і', 'в', 'на', 'з', 'до', 'по', 'а', 'але', 'або', 'чому', 'коли', 'де', 'дай', 'завдання', 'задай', 'допоможи', 'поясни', 'можеш', 'розкажи', 'хочу', 'треба', 'потрібно']);
  const wordCount: Record<string, number> = {};
  for (const l of logs) {
    const words = l.message.toLowerCase().split(/\s+/);
    for (const w of words) {
      const clean = w.replace(/[^а-яіїєґa-z0-9]/gi, '');
      if (clean.length > 3 && !stopWords.has(clean)) {
        wordCount[clean] = (wordCount[clean] || 0) + 1;
      }
    }
  }
  const topWords = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  // Активність по днях (останні 7 днів)
  const activityByDay: Record<string, number> = {};
  for (const l of logs) {
    const day = l.created_at.slice(0, 10);
    activityByDay[day] = (activityByDay[day] || 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    totalQuestions: logs.length,
    uniqueStudents: studentsSet.size,
    perStudent: Object.entries(perStudent)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
    topWords,
    activityByDay,
    recentLogs: logs.slice(0, 20).map((l) => ({
      studentName: l.student_name,
      message: l.message,
      createdAt: l.created_at,
    })),
  });
}
