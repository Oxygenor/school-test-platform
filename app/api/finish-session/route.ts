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
  let maxScore: number | null = null;
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
      let earnedPoints = 0;
      let maxPoints = 0;

      results = (work.tasks || []).map((task: any, i: number) => {
        if (typeof task === 'string' || task.correctChoice === undefined || task.correctChoice === null) {
          return { taskIndex: i, answer: answers[i + 1] ?? null, correctAnswer: null, isCorrect: null, points: null };
        }
        const pts = task.points ?? 1;
        maxPoints += pts;
        const correctLabel = CHOICE_LABELS[task.correctChoice];
        const isCorrect = answers[i + 1] === correctLabel;
        if (isCorrect) earnedPoints += pts;
        return { taskIndex: i, answer: answers[i + 1] ?? null, correctAnswer: correctLabel, isCorrect, points: pts };
      });

      if (maxPoints > 0) {
        score = earnedPoints;
        maxScore = maxPoints;
      }
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

  return NextResponse.json({ ok: true, score, maxScore, results });
}
