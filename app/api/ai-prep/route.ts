import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  try {
    const { tasks, subject, message, history } = await req.json();

    if (!tasks || !message) {
      return NextResponse.json({ ok: false, error: 'Відсутні параметри' }, { status: 400 });
    }

    // Формуємо список завдань як текст для системного промпту
    const taskList = tasks
      .map((t: any, i: number) => {
        const text = typeof t === 'string' ? t : t.text;
        if (!text || t.type === 'header' || t.type === 'description') return null;
        return `${i + 1}. ${text}`;
      })
      .filter(Boolean)
      .join('\n');

    const systemPrompt = `Ти — AI-помічник для підготовки учнів до ${subject || 'роботи'}.

Ось завдання з майбутньої роботи:
${taskList}

Твоя роль:
- Генерувати НОВІ схожі завдання для практики (не ті самі що у роботі)
- Пояснювати як вирішувати подібні завдання крок за кроком
- Відповідати на питання учня виключно в рамках теми цих завдань
- Якщо учень питає про щось стороннє — ввічливо відмовляй і повертай до теми

Відповідай українською мовою. Будь доброзичливим і зрозумілим для школяра.
Коли генеруєш нові завдання — НЕ давай одразу відповіді, дай учню самостійно спробувати.

ВАЖЛИВО — правила форматування формул:
- Вбудовані формули: $f(x) = x^2$ (одинарні долари, БЕЗ зворотніх лапок)
- Блочні формули: $$f(x) = x^2$$ (подвійні долари, БЕЗ зворотніх лапок)
- НІКОЛИ не використовуй зворотні лапки навколо формул — не \`$формула$\`, а просто $формула$`;

    // Формуємо історію повідомлень
    const messages: Anthropic.MessageParam[] = [
      ...(history || []),
      { role: 'user', content: message },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({ ok: true, reply });
  } catch (e: any) {
    console.error('ai-prep error:', e);
    return NextResponse.json({ ok: false, error: e.message || 'Помилка AI' }, { status: 500 });
  }
}
