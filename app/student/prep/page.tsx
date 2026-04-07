'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none text-slate-100
      prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0
      prose-headings:text-white prose-strong:text-white
      prose-code:text-indigo-300 prose-code:bg-slate-700 prose-code:px-1 prose-code:rounded">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {content}
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
        content: `Привіт${fullName ? `, ${fullName}` : ''}! 👋 Я допоможу тобі підготуватись до роботи з предмету **${subject}**.\n\nМожу:\n- Дати тобі практичні завдання\n- Пояснити як вирішувати подібні приклади\n- Відповісти на питання по темі\n\nЗ чого почнемо? Напиши **"дай завдання"** або постав своє питання.`,
      }]);
    }
  }, [tasks, fullName, subject, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    setError('');

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);

    const history = newMessages.slice(1, -1).slice(-10);

    try {
      const res = await fetch('/api/ai-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks, subject, message: text, history }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
      } else {
        setError('Помилка ШІ. Спробуй ще раз.');
        setMessages(newMessages);
      }
    } catch {
      setError('Помилка з\'єднання. Спробуй ще раз.');
      setMessages(newMessages);
    }
    setSending(false);
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

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      {/* Шапка */}
      <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-lg">🤖</div>
        <div>
          <div className="font-semibold text-sm">AI-підготовка</div>
          <div className="text-xs text-slate-400">{subject}</div>
        </div>
      </div>

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
        {sending && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-slate-400">
              ШІ думає...
            </div>
          </div>
        )}
        {error && (
          <div className="text-center text-sm text-red-400">{error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Поле вводу */}
      <div className="border-t border-slate-800 px-4 py-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Напиши питання або 'дай завдання'..."
          className="flex-1 rounded-2xl bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={sending}
        />
        <button
          onClick={send}
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
