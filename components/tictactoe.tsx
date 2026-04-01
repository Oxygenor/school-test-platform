'use client';

import { useState, useCallback, useMemo } from 'react';

type Cell = 'X' | 'O' | null;

const SIZE = 5;
const WIN = 4;
const TOTAL = SIZE * SIZE;

function generateLines(): number[][] {
  const lines: number[][] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c <= SIZE - WIN; c++)
      lines.push(Array.from({ length: WIN }, (_, k) => r * SIZE + c + k));
  for (let c = 0; c < SIZE; c++)
    for (let r = 0; r <= SIZE - WIN; r++)
      lines.push(Array.from({ length: WIN }, (_, k) => (r + k) * SIZE + c));
  for (let r = 0; r <= SIZE - WIN; r++)
    for (let c = 0; c <= SIZE - WIN; c++)
      lines.push(Array.from({ length: WIN }, (_, k) => (r + k) * SIZE + c + k));
  for (let r = WIN - 1; r < SIZE; r++)
    for (let c = 0; c <= SIZE - WIN; c++)
      lines.push(Array.from({ length: WIN }, (_, k) => (r - k) * SIZE + c + k));
  return lines;
}

const LINES = generateLines();

function checkWinner(board: Cell[]): { winner: Cell | 'draw'; line: number[] | null } {
  for (const line of LINES) {
    const [a] = line;
    if (board[a] && line.every(i => board[i] === board[a])) {
      return { winner: board[a], line };
    }
  }
  if (board.every(Boolean)) return { winner: 'draw', line: null };
  return { winner: null, line: null };
}

// Оцінка позиції (без термінального стану)
function evaluate(board: Cell[]): number {
  let score = 0;
  const mid = Math.floor(SIZE / 2);
  for (const line of LINES) {
    const os = line.filter(j => board[j] === 'O').length;
    const xs = line.filter(j => board[j] === 'X').length;
    if (os > 0 && xs > 0) continue;
    if (os === 3) score += 10000;
    else if (os === 2) score += 200;
    else if (os === 1) score += 10;
    if (xs === 3) score -= 10000;
    else if (xs === 2) score -= 200;
    else if (xs === 1) score -= 10;
  }
  // Бонус за центр поля
  for (let i = 0; i < TOTAL; i++) {
    if (!board[i]) continue;
    const r = Math.floor(i / SIZE), c = i % SIZE;
    const bonus = (mid - Math.abs(r - mid)) + (mid - Math.abs(c - mid));
    score += board[i] === 'O' ? bonus : -bonus;
  }
  return score;
}

// Кандидати — клітинки поруч із зайнятими (в радіусі 2), відсортовані за евристикою
function getCandidates(board: Cell[]): number[] {
  const occupied = new Set<number>();
  board.forEach((c, i) => { if (c) occupied.add(i); });
  if (occupied.size === 0) return [Math.floor(TOTAL / 2)];

  const cands = new Set<number>();
  for (const idx of occupied) {
    const r = Math.floor(idx / SIZE), c = idx % SIZE;
    for (let dr = -2; dr <= 2; dr++)
      for (let dc = -2; dc <= 2; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !board[nr * SIZE + nc])
          cands.add(nr * SIZE + nc);
      }
  }
  // Сортуємо за евристикою і беремо топ-12 для швидкості
  return [...cands]
    .sort((a, b) => {
      let sa = 0, sb = 0;
      const mid = Math.floor(SIZE / 2);
      sa += (mid - Math.abs(Math.floor(a / SIZE) - mid)) + (mid - Math.abs(a % SIZE - mid));
      sb += (mid - Math.abs(Math.floor(b / SIZE) - mid)) + (mid - Math.abs(b % SIZE - mid));
      for (const line of LINES) {
        if (line.includes(a)) {
          const os = line.filter(j => board[j] === 'O').length;
          const xs = line.filter(j => board[j] === 'X').length;
          if (os === 0 || xs === 0) sa += os === 3 ? 500 : os === 2 ? 50 : xs === 3 ? 300 : xs === 2 ? 30 : 0;
        }
        if (line.includes(b)) {
          const os = line.filter(j => board[j] === 'O').length;
          const xs = line.filter(j => board[j] === 'X').length;
          if (os === 0 || xs === 0) sb += os === 3 ? 500 : os === 2 ? 50 : xs === 3 ? 300 : xs === 2 ? 30 : 0;
        }
      }
      return sb - sa;
    })
    .slice(0, 12);
}

// Minimax з alpha-beta pruning
function minimax(board: Cell[], depth: number, alpha: number, beta: number, isMax: boolean): number {
  const { winner } = checkWinner(board);
  if (winner === 'O') return 100000 + depth * 10; // виграш швидше — краще
  if (winner === 'X') return -100000 - depth * 10;
  if (winner === 'draw' || depth === 0) return evaluate(board);

  const cands = getCandidates(board);
  if (cands.length === 0) return evaluate(board);

  let best = isMax ? -Infinity : Infinity;
  for (const i of cands) {
    board[i] = isMax ? 'O' : 'X';
    const val = minimax(board, depth - 1, alpha, beta, !isMax);
    board[i] = null;
    if (isMax) { if (val > best) best = val; if (best > alpha) alpha = best; }
    else        { if (val < best) best = val; if (best < beta)  beta  = best; }
    if (alpha >= beta) break; // відсікання
  }
  return best;
}

function getAiMove(board: Cell[]): number {
  const b = [...board];
  const empty = b.reduce<number[]>((a, c, i) => (c ? a : [...a, i]), []);

  // 1. Виграти негайно
  for (const i of empty) {
    b[i] = 'O'; if (checkWinner(b).winner === 'O') { b[i] = null; return i; } b[i] = null;
  }
  // 2. Заблокувати переможний хід гравця
  for (const i of empty) {
    b[i] = 'X'; if (checkWinner(b).winner === 'X') { b[i] = null; return i; } b[i] = null;
  }

  // 3. Minimax глибина 5 — бачить складні форки на 2-3 ходи вперед
  const cands = getCandidates(b);
  let best = -Infinity, bestMove = cands[0];
  for (const i of cands) {
    b[i] = 'O';
    const score = minimax(b, 4, -Infinity, Infinity, false);
    b[i] = null;
    if (score > best) { best = score; bestMove = i; }
  }
  return bestMove;
}

export default function TicTacToe() {
  const [board, setBoard] = useState<Cell[]>(Array(TOTAL).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [scores, setScores] = useState({ player: 0, ai: 0, draw: 0 });
  const [thinking, setThinking] = useState(false);

  const { winner, line: winLine } = useMemo(() => checkWinner(board), [board]);

  const reset = useCallback(() => {
    setBoard(Array(TOTAL).fill(null));
    setIsPlayerTurn(true);
    setThinking(false);
  }, []);

  function handleClick(i: number) {
    if (board[i] || winner || !isPlayerTurn || thinking) return;

    const newBoard = [...board];
    newBoard[i] = 'X';
    setBoard(newBoard);

    const result = checkWinner(newBoard);
    if (result.winner) {
      if (result.winner === 'X') setScores(s => ({ ...s, player: s.player + 1 }));
      else if (result.winner === 'draw') setScores(s => ({ ...s, draw: s.draw + 1 }));
      return;
    }

    setIsPlayerTurn(false);
    setThinking(true);

    setTimeout(() => {
      const aiMove = getAiMove([...newBoard]);
      const afterAi = [...newBoard];
      afterAi[aiMove] = 'O';
      setBoard(afterAi);
      setThinking(false);
      setIsPlayerTurn(true);

      const aiResult = checkWinner(afterAi);
      if (aiResult.winner === 'O') setScores(s => ({ ...s, ai: s.ai + 1 }));
      else if (aiResult.winner === 'draw') setScores(s => ({ ...s, draw: s.draw + 1 }));
    }, 400);
  }

  const statusText = winner
    ? winner === 'draw' ? '🤝 Нічия!'
      : winner === 'X' ? '🎉 Ти переміг!'
      : '🤖 ШІ переміг!'
    : thinking ? '🤖 ШІ думає...'
    : '✏️ Твій хід';

  const statusColor = winner === 'X' ? 'text-green-400'
    : winner === 'O' ? 'text-red-400'
    : winner === 'draw' ? 'text-yellow-400'
    : 'text-slate-400';

  return (
    <div className="mt-8 flex flex-col items-center">
      <div className="rounded-3xl bg-slate-800 px-6 py-6 w-full max-w-sm">
        <div className="mb-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Поки чекаєш — зіграй</p>
          <h3 className="text-lg font-bold text-white">Виграй штучний інтелект 1 раз та отримай "відмінно"</h3>
          <p className="text-xs text-slate-500 mt-0.5">Ти — X, ШІ — O · Зроби 4 поспіль</p>
        </div>

        {/* Рахунок */}
        <div className="mb-4 flex justify-center gap-6 text-sm">
          <div className="text-center">
            <div className="text-xl font-bold text-green-400">{scores.player}</div>
            <div className="text-xs text-slate-500">Ти</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-slate-500">{scores.draw}</div>
            <div className="text-xs text-slate-500">Нічия</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-red-400">{scores.ai}</div>
            <div className="text-xs text-slate-500">ШІ</div>
          </div>
        </div>

        {/* Поле 5×5 */}
        <div className="grid gap-1.5 mb-4" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
          {board.map((cell, i) => {
            const isWinCell = winLine?.includes(i);
            return (
              <button
                key={i}
                onClick={() => handleClick(i)}
                className={`aspect-square rounded-xl text-lg font-bold transition-all
                  ${cell ? 'cursor-default' : 'cursor-pointer hover:bg-slate-600'}
                  ${isWinCell ? 'bg-slate-600 scale-105' : 'bg-slate-700'}
                  ${cell === 'X' ? 'text-green-400' : 'text-red-400'}
                `}
              >
                {cell}
              </button>
            );
          })}
        </div>

        <p className={`text-center text-sm font-semibold mb-3 ${statusColor}`}>
          {statusText}
        </p>

        {winner && (
          <button
            onClick={reset}
            className="w-full rounded-2xl bg-slate-700 py-2.5 text-sm font-semibold text-white hover:bg-slate-600 transition"
          >
            Грати ще раз
          </button>
        )}
      </div>
    </div>
  );
}
