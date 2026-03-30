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
        if (task.type === 'fill_blank') {
          const pts = task.points ?? 1;
          const correctAnswers: string[] = task.answers || [];
          maxPoints += pts * correctAnswers.length;
          let studentAnswers: string[] = [];
          try { studentAnswers = JSON.parse(answers[i] ?? '[]'); } catch {}
          let earned = 0;
          correctAnswers.forEach((correct: string, bi: number) => {
            if ((studentAnswers[bi] ?? '').trim().toLowerCase() === correct.trim().toLowerCase()) earned += pts;
          });
          earnedPoints += earned;
          return { taskIndex: i, answer: studentAnswers, correctAnswer: correctAnswers, isCorrect: earned === pts * correctAnswers.length, points: pts * correctAnswers.length, earnedPoints: earned };
        }
        if (task.type === 'subtasks') {
          const pts = task.points ?? 1;
          const items: any[] = task.items || [];
          const scorableItems = items.filter((it: any) => typeof it === 'object' && it.correctChoice !== undefined && it.correctChoice !== null && (it.choices?.length ?? 0) > 0);
          if (scorableItems.length === 0) return { taskIndex: i, answer: null, correctAnswer: null, isCorrect: null, points: null };
          maxPoints += pts * scorableItems.length;
          let studentMapping: Record<string, string> = {};
          try { studentMapping = JSON.parse(answers[i] ?? '{}'); } catch {}
          let earned = 0;
          items.forEach((it: any, ii: number) => {
            if (typeof it !== 'object' || it.correctChoice === undefined || it.correctChoice === null) return;
            const correctLabel = CHOICE_LABELS[it.correctChoice];
            if (studentMapping[String(ii)] === correctLabel) earned += pts;
          });
          earnedPoints += earned;
          const correctAnswer = Object.fromEntries(items.map((it: any, ii: number) => [String(ii), typeof it === 'object' && it.correctChoice != null ? CHOICE_LABELS[it.correctChoice] : null]).filter(([, v]) => v));
          return { taskIndex: i, answer: studentMapping, correctAnswer, isCorrect: earned === pts * scorableItems.length, points: pts * scorableItems.length, earnedPoints: earned };
        }
        if (task.type === 'matching') {
          const pts = task.points ?? 1;
          const pairCount = (task.pairs || []).length;
          maxPoints += pts * pairCount;
          let studentMapping: Record<string, string> = {};
          try { studentMapping = JSON.parse(answers[i] ?? '{}'); } catch {}
          let earned = 0;
          (task.pairs as any[] || []).forEach((_: any, pi: number) => {
            if (studentMapping[String(pi)] === String(pi)) earned += pts;
          });
          earnedPoints += earned;
          return { taskIndex: i, answer: studentMapping, correctAnswer: Object.fromEntries((task.pairs as any[]).map((_: any, pi: number) => [String(pi), String(pi)])), isCorrect: earned === pts * pairCount, points: pts * pairCount, earnedPoints: earned };
        }
        if (typeof task === 'string' || task.correctChoice === undefined || task.correctChoice === null) {
          return { taskIndex: i, answer: answers[i + 1] ?? null, correctAnswer: null, isCorrect: null, points: null };
        }
        const pts = task.points ?? 1;
        maxPoints += pts;
        const correctLabel = CHOICE_LABELS[task.correctChoice];
        const isCorrect = answers[i] === correctLabel;
        if (isCorrect) earnedPoints += pts;
        return { taskIndex: i, answer: answers[i] ?? null, correctAnswer: correctLabel, isCorrect, points: pts };
      });

      if (maxPoints > 0) {
        score = earnedPoints;
        maxScore = maxPoints;
      }
    }
  }

  const updateData: any = { status: 'finished', finished_at: finishedAt };
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
