import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const CHOICE_LABELS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

export async function POST(req: Request) {
  const { sessionId, answers, classId, variant, subject } = await req.json();

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'Не вказано sessionId' }, { status: 400 });
  }

  const finishedAt = new Date().toISOString();
  let score: number | null = null;
  let results: any[] = [];

  // Розраховуємо оцінку якщо є відповіді
  if (answers && classId && variant) {
    const workQuery = supabaseAdmin
      .from('works')
      .select('*')
      .eq('class_id', classId)
      .eq('variant', variant)
      .eq('online_mode', true);

    if (subject) workQuery.eq('subject', subject);

    const { data: work } = await workQuery.single();

    if (work) {
      let correct = 0;
      let total = 0;

      results = (work.tasks || []).map((task: any, i: number) => {
        if (typeof task === 'string' || task.correctChoice === undefined || task.correctChoice === null) {
          return { taskIndex: i, answer: answers[i] ?? null, correctAnswer: null, isCorrect: null };
        }
        total++;
        const correctLabel = CHOICE_LABELS[task.correctChoice];
        const isCorrect = answers[i] === correctLabel;
        if (isCorrect) correct++;
        return { taskIndex: i, answer: answers[i] ?? null, correctAnswer: correctLabel, isCorrect };
      });

      score = total > 0 ? Math.round((correct / total) * 100) : null;
    }
  }

  const updateData: any = { status: 'finished', updated_at: finishedAt };
  if (answers) updateData.answers = answers;
  if (score !== null) updateData.score = score;

  const { error } = await supabaseAdmin
    .from('student_sessions')
    .update(updateData)
    .eq('id', sessionId)
    .in('status', ['writing', 'blocked']);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, score, results });
}
