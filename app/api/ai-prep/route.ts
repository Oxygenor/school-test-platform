import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  try {
    const { tasks, subject, message, history, mode, hintLevel, classId, teacherId, studentName } = await req.json();

    if (!tasks || !message) {
      return NextResponse.json({ ok: false, error: 'Відсутні параметри' }, { status: 400 });
    }

    const taskList = tasks
      .map((t: any, i: number) => {
        const text = typeof t === 'string' ? t : t.text;
        if (!text || t.type === 'header' || t.type === 'description') return null;
        return `${i + 1}. ${text}`;
      })
      .filter(Boolean)
      .join('\n');

    // Різні інструкції залежно від режиму
    let modeInstructions = '';
    if (mode === 'quiz') {
      modeInstructions = `
РЕЖИМ "ПЕРЕВІР МЕНЕ":
- Задай учню рівно 5 коротких запитань по темі, одне за одним
- Після кожної відповіді учня — оціни її (правильно/неправильно) і пояснюй якщо помилився
- Після 5-ї відповіді підведи підсумок: скільки правильно з 5 і коротка оцінка готовності
- Починай одразу з першого запитання`;
    } else if (mode === 'stepbystep') {
      modeInstructions = `
ПОКРОКОВИЙ РЕЖИМ:
- Розбий вирішення завдання на окремі кроки
- Показуй ТІЛЬКИ ОДИН крок за раз
- Чекай відповіді учня перед тим як показати наступний крок
- Якщо учень помилився на кроці — поясни помилку і дай спробувати ще раз`;
    } else if (mode === 'hint') {
      const level = hintLevel ?? 1;
      if (level === 1) {
        modeInstructions = `
ПІДКАЗКА РІВЕНЬ 1 (мінімальна):
- Дай лише маленьку підказку — назви тему або формулу яку треба використати, БЕЗ пояснення як`;
      } else if (level === 2) {
        modeInstructions = `
ПІДКАЗКА РІВЕНЬ 2 (середня):
- Поясни перший крок вирішення, але не давай повного розв'язку`;
      } else {
        modeInstructions = `
ПІДКАЗКА РІВЕНЬ 3 (повна):
- Поясни повністю як вирішити це завдання крок за кроком`;
      }
    } else if (mode === 'simpler') {
      modeInstructions = `
РЕЖИМ "ПОЯСНИ ПРОСТІШЕ":
- Поясни те саме що пояснював раніше, але:
  - Використовуй максимально прості слова
  - Додай конкретний числовий приклад з життя
  - Уникай складних термінів`;
    }

    const systemPrompt = `Ти — AI-помічник з предмету "${subject || 'навчання'}" для школярів.

Ось завдання з майбутньої контрольної/самостійної роботи (для контексту теми):
${taskList}

Твоя роль:
- Допомагати учню з будь-якими питаннями з предмету "${subject}" — як з поточної теми, так і з попередніх
- Генерувати НОВІ схожі завдання для практики по темі роботи (не ті самі що у роботі)
- Пояснювати матеріал крок за кроком, зрозумілою мовою для школяра
- Якщо учень забув щось з попередніх тем — пояснити це теж
- Відповідати ТІЛЬКИ на питання з предмету "${subject}". Якщо питають про інший предмет або щось не стосується навчання — ввічливо відмовляй
${modeInstructions}

Відповідай українською мовою. Будь доброзичливим і терплячим.
Коли генеруєш нові завдання — НЕ давай одразу відповіді, дай учню самостійно спробувати.

ВАЖЛИВО — правила форматування формул:
- Вбудовані формули: $f(x) = x^2$ (одинарні долари, БЕЗ зворотніх лапок)
- Блочні формули: $$f(x) = x^2$$ (подвійні долари, БЕЗ зворотніх лапок)
- НІКОЛИ не використовуй зворотні лапки навколо формул`;

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

    // Логуємо питання учня для статистики
    if (classId && teacherId && subject) {
      await supabaseAdmin.from('prep_logs').insert({
        class_id: Number(classId),
        teacher_id: teacherId,
        student_name: studentName || null,
        subject,
        message,
      });
    }

    return NextResponse.json({ ok: true, reply });
  } catch (e: any) {
    console.error('ai-prep error:', e);
    return NextResponse.json({ ok: false, error: e.message || 'Помилка AI' }, { status: 500 });
  }
}
