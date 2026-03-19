'use client';

import { useState } from 'react';

interface CalculatorProps {
  onClose: () => void;
}

const BUTTONS = [
  { label: 'AC', type: 'clear', wide: false },
  { label: '⌫', type: 'backspace', wide: false },
  { label: '√', type: 'func', wide: false },
  { label: '÷', type: 'op', value: '/', wide: false },

  { label: '7', type: 'num', wide: false },
  { label: '8', type: 'num', wide: false },
  { label: '9', type: 'num', wide: false },
  { label: '×', type: 'op', value: '*', wide: false },

  { label: '4', type: 'num', wide: false },
  { label: '5', type: 'num', wide: false },
  { label: '6', type: 'num', wide: false },
  { label: '−', type: 'op', value: '-', wide: false },

  { label: '1', type: 'num', wide: false },
  { label: '2', type: 'num', wide: false },
  { label: '3', type: 'num', wide: false },
  { label: '+', type: 'op', value: '+', wide: false },

  { label: '(', type: 'paren', wide: false },
  { label: '0', type: 'num', wide: false },
  { label: '.', type: 'num', wide: false },
  { label: '=', type: 'equals', wide: false },
] as const;

export default function Calculator({ onClose }: CalculatorProps) {
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [parenOpen, setParenOpen] = useState(0);

  function handleButton(btn: (typeof BUTTONS)[number]) {
    if (result === 'Помилка') {
      setExpr('');
      setResult(null);
    }

    if (btn.type === 'clear') {
      setExpr('');
      setResult(null);
      setParenOpen(0);
      return;
    }

    if (btn.type === 'backspace') {
      setExpr((prev) => {
        const trimmed = prev.trimEnd();
        if (trimmed.endsWith('Math.sqrt(')) {
          setParenOpen((p) => Math.max(0, p - 1));
          return prev.slice(0, -10);
        }
        const last = trimmed[trimmed.length - 1];
        if (last === '(') setParenOpen((p) => Math.max(0, p - 1));
        if (last === ')') setParenOpen((p) => p + 1);
        return trimmed.slice(0, -1);
      });
      setResult(null);
      return;
    }

    if (btn.type === 'func') {
      setExpr((prev) => prev + 'Math.sqrt(');
      setParenOpen((p) => p + 1);
      setResult(null);
      return;
    }

    if (btn.label === '(') {
      const next = parenOpen > 0 ? ')' : '(';
      if (next === ')') setParenOpen((p) => p - 1);
      else setParenOpen((p) => p + 1);
      setExpr((prev) => prev + next);
      setResult(null);
      return;
    }

    if (btn.type === 'equals') {
      try {
        const raw = expr + (parenOpen > 0 ? ')'.repeat(parenOpen) : '');
        const evaluated = Function('"use strict"; return (' + raw.replace(/\^/g, '**') + ')')();
        const rounded = parseFloat(evaluated.toFixed(10));
        setResult(String(rounded));
      } catch {
        setResult('Помилка');
      }
      return;
    }

    const val = 'value' in btn ? btn.value : btn.label;
    setExpr((prev) => prev + val);
    setResult(null);
  }

  const displayExpr = expr || '0';

  return (
    <div className="fixed bottom-24 right-4 z-50 w-64 overflow-hidden rounded-3xl bg-zinc-900 shadow-2xl ring-1 ring-white/10 md:w-72">

      {/* Заголовок */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Калькулятор
        </span>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-white text-sm"
        >
          ×
        </button>
      </div>

      {/* Дисплей */}
      <div className="min-h-[72px] px-4 pb-3 text-right">
        <div className="truncate text-sm text-zinc-500 min-h-[20px]">
          {displayExpr}
          {parenOpen > 0 && (
            <span className="text-zinc-600">{')'.repeat(parenOpen)}</span>
          )}
        </div>
        <div className={`mt-1 text-3xl font-light tracking-tight ${
          result === 'Помилка' ? 'text-red-400' : 'text-white'
        }`}>
          {result ?? ''}
        </div>
      </div>

      {/* Кнопки */}
      <div className="grid grid-cols-4 gap-px bg-zinc-800 p-px">
        {BUTTONS.map((btn, i) => {
          const isOp = btn.type === 'op';
          const isEquals = btn.type === 'equals';
          const isClear = btn.type === 'clear';
          const isBackspace = btn.type === 'backspace';
          const isSqrt = btn.type === 'func';

          return (
            <button
              key={i}
              onClick={() => handleButton(btn)}
              className={`
                flex h-14 items-center justify-center text-lg font-medium transition-all active:scale-95
                ${isEquals ? 'bg-amber-500 text-white hover:bg-amber-400' : ''}
                ${isOp ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : ''}
                ${isClear ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : ''}
                ${isBackspace ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600 text-base' : ''}
                ${isSqrt ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600' : ''}
                ${btn.type === 'num' || btn.type === 'paren' ? 'bg-zinc-800 text-white hover:bg-zinc-700' : ''}
              `}
            >
              {btn.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
