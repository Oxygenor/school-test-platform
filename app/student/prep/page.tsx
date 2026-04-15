'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

type Mode = 'chat' | 'quiz' | 'stepbystep' | 'hint' | 'simpler';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function fixMath(content: string): string {
  return content
    .replace(/`(\$\$[\s\S]+?\$\$)`/g, '$1')
    .replace(/`(\$[^`\n]+?\$)`/g, '$1')
    // Переконуємось що $$ завжди на окремому рядку — інакше remark-math читає як два $
    .replace(/([^\n])\$\$/g, '$1\n$$')
    .replace(/\$\$([^\n])/g, '$$\n$1');
}

function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none text-slate-100
      prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0
      prose-headings:text-white prose-strong:text-white
      prose-code:text-indigo-300 prose-code:bg-slate-700 prose-code:px-1 prose-code:rounded">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {fixMath(content)}
      </ReactMarkdown>
    </div>
  );
}

function PrepContent() {
  const params = useSearchParams();
  const classId = params.get('classId');
  const subject = params.get('subject');
  const teacherId = params.get('teacherId');
  const fullName = params.get('fullName');

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<Mode>('chat');
  const [hintLevel, setHintLevel] = useState(1);
  const [lastAssistantMsg, setLastAssistantMsg] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadWork() {
      if (!classId || !subject || !teacherId) { setLoading(false); return; }
      const res = await fetch(`/api/works?classId=${classId}`, {
        headers: { 'x-teacher-id-filter': teacherId },
      });
      const data = await res.json();
      if (data.ok) {
        const work = (data.works || []).find((w: any) => w.subject === subject && w.prep_enabled);
        if (work) setTasks(work.tasks || []);
      }
      setLoading(false);
    }
    loadWork();
  }, [classId, subject, teacherId]);

  useEffect(() => {
    if (messages.length === 0 && tasks.length > 0) {
      setMessages([{
        role: 'assistant',
        content: `Привіт${fullName ? `, ${fullName}` : ''}! 👋 Я твій помічник з **${subject}**.\n\nМожу допомогти:\n- Пояснити будь-яку тему з предмету\n- Дати практичні завдання\n- Перевірити чи ти готовий до роботи\n\nОберіть режим нижче або просто напиши своє питання.`,
      }]);
    }
  }, [tasks, fullName, subject, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function send(overrideMessage?: string, overrideMode?: Mode, overrideHintLevel?: number) {
    const text = (overrideMessage ?? input).trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    setError('');

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);

    const history = newMessages.slice(1, -1).slice(-10);
    const activeMode = overrideMode ?? (mode === 'chat' ? undefined : mode);
    const activeHintLevel = overrideHintLevel ?? hintLevel;

    try {
      const res = await fetch('/api/ai-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks,
          subject,
          message: text,
          history,
          mode: activeMode,
          hintLevel: activeHintLevel,
          classId,
          teacherId,
          studentName: fullName,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
        setLastAssistantMsg(data.reply);
        // Скидаємо рівень підказки після отримання відповіді
        if (activeMode === 'hint') setHintLevel(activeHintLevel < 3 ? activeHintLevel + 1 : 3);
      } else {
        setError('Помилка ШІ. Спробуй ще раз.');
        setMessages(newMessages);
      }
    } catch {
      setError("Помилка з'єднання. Спробуй ще раз.");
      setMessages(newMessages);
    }
    setSending(false);
  }

  function startQuiz() {
    setMode('quiz');
    send('Починаємо режим перевірки. Задай мені перше запитання.', 'quiz');
  }

  function startStepByStep() {
    setMode('stepbystep');
    send('Дай мені завдання і допоможи вирішити його покроково.', 'stepbystep');
  }

  function askHint() {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    send(`Підказка до: ${lastUserMsg.content}`, 'hint', hintLevel);
  }

  function askSimpler() {
    send('Поясни це простіше з конкретним прикладом.', 'simpler');
  }

  function resetMode() {
    setMode('chat');
    setHintLevel(1);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-slate-400">Завантаження...</div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <h1 className="text-xl font-bold">Підготовка недоступна</h1>
          <p className="mt-2 text-slate-400">Вчитель ще не відкрив доступ до підготовки з {subject}.</p>
        </div>
      </div>
    );
  }

  const hintLabels = ['💡 Підказка 1', '💡💡 Підказка 2', '💡💡💡 Повна підказка'];

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      {/* Шапка */}
      <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-lg">🤖</div>
        <div className="flex-1">
          <div className="font-semibold text-sm">AI-підготовка</div>
          <div className="text-xs text-slate-400">{subject}</div>
        </div>
        {mode !== 'chat' && (
          <button onClick={resetMode} className="text-xs text-slate-400 border border-slate-700 rounded-xl px-3 py-1 hover:bg-slate-800">
            ✕ {mode === 'quiz' ? 'Перевірка' : 'Покроково'}
          </button>
        )}
      </div>

      {/* Кнопки режимів (тільки в звичайному режимі) */}
      {mode === 'chat' && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          <button
            onClick={startQuiz}
            className="rounded-2xl bg-violet-700 px-4 py-2 text-xs font-semibold hover:bg-violet-600 transition"
          >
            🎯 Перевір мене
          </button>
          <button
            onClick={startStepByStep}
            className="rounded-2xl bg-blue-700 px-4 py-2 text-xs font-semibold hover:bg-blue-600 transition"
          >
            🪜 Покроково
          </button>
        </div>
      )}

      {/* Повідомлення */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-sm'
                : 'bg-slate-800 text-slate-100 rounded-bl-sm'
            }`}>
              {msg.role === 'user'
                ? <span className="whitespace-pre-wrap">{msg.content}</span>
                : <AssistantMessage content={msg.content} />
              }
            </div>
          </div>
        ))}

        {/* Кнопки після відповіді ШІ */}
        {!sending && lastAssistantMsg && messages.length > 1 && messages[messages.length - 1].role === 'assistant' && (
          <div className="flex flex-wrap gap-2 pl-1">
            <button
              onClick={askSimpler}
              className="rounded-2xl border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 transition"
            >
              🔄 Поясни простіше
            </button>
            <button
              onClick={askHint}
              className="rounded-2xl border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 transition"
            >
              {hintLabels[Math.min(hintLevel - 1, 2)]}
            </button>
          </div>
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-slate-400">
              ШІ думає...
            </div>
          </div>
        )}
        {error && <div className="text-center text-sm text-red-400">{error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Поле вводу */}
      <div className="border-t border-slate-800 px-4 py-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={mode === 'quiz' ? 'Введи відповідь...' : mode === 'stepbystep' ? 'Введи крок...' : "Напиши питання або 'дай завдання'..."}
          className="flex-1 rounded-2xl bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={sending}
        />
        <button
          onClick={() => send()}
          disabled={sending || !input.trim()}
          className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold disabled:opacity-40 hover:bg-indigo-500 transition"
        >
          →
        </button>
      </div>
    </div>
  );
}

export default function PrepPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Завантаження...</div>}>
      <PrepContent />
    </Suspense>
  );
}
