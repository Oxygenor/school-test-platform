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

// Оцінка позиції для minimax
function evaluate(board: Cell[]): number {
  let score = 0;
  for (const line of LINES) {
    const os = line.filter(j => board[j] === 'O').length;
    const xs = line.filter(j => board[j] === 'X').length;
    if (os > 0 && xs > 0) continue; // змішана лінія — не рахуємо
    if (os === 3) score += 10000;
    else if (os === 2) score += 100;
    else if (os === 1) score += 10;
    if (xs === 3) score -= 10000;
    else if (xs === 2) score -= 100;
    else if (xs === 1) score -= 10;
  }
  return score;
}

// Усі порожні клітинки поряд із зайнятими (радіус 1)
// НЕ обрізаємо список — щоб не пропустити жоден блок
function getCandidates(board: Cell[]): number[] {
  const occupied: number[] = [];
  board.forEach((c, i) => { if (c) occupied.push(i); });
  if (occupied.length === 0) return [Math.floor(TOTAL / 2)];

  const seen = new Uint8Array(TOTAL);
  const cands: number[] = [];
  for (const idx of occupied) {
    const r = Math.floor(idx / SIZE), c = idx % SIZE;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
          const pos = nr * SIZE + nc;
          if (!board[pos] && !seen[pos]) { seen[pos] = 1; cands.push(pos); }
        }
      }
  }
  return cands;
}

// Minimax з alpha-beta pruning (in-place, швидкий)
function minimax(board: Cell[], depth: number, alpha: number, beta: number, isMax: boolean): number {
  const { winner } = checkWinner(board);
  if (winner === 'O') return 100000 + depth;
  if (winner === 'X') return -100000 - depth;
  if (winner === 'draw' || depth === 0) return evaluate(board);

  const cands = getCandidates(board);
  if (cands.length === 0) return evaluate(board);

  let best = isMax ? -Infinity : Infinity;
  const mark: Cell = isMax ? 'O' : 'X';
  for (const i of cands) {
    board[i] = mark;
    const val = minimax(board, depth - 1, alpha, beta, !isMax);
    board[i] = null;
    if (isMax) { if (val > best) best = val; if (best > alpha) alpha = best; }
    else        { if (val < best) best = val; if (best < beta)  beta  = best; }
    if (alpha >= beta) break;
  }
  return best;
}

function getAiMove(board: Cell[]): number {
  const b = [...board] as Cell[];
  // Збираємо порожні клітинки
  const empty: number[] = [];
  for (let i = 0; i < TOTAL; i++) if (!b[i]) empty.push(i);

  // 1. Виграти негайно — перевіряємо ВСІ порожні
  for (const i of empty) {
    b[i] = 'O';
    const win = checkWinner(b).winner === 'O';
    b[i] = null;
    if (win) return i;
  }

  // 2. Заблокувати перемогу гравця — перевіряємо ВСІ порожні
  for (const i of empty) {
    b[i] = 'X';
    const win = checkWinner(b).winner === 'X';
    b[i] = null;
    if (win) return i;
  }

  // 3. Minimax глибина 5 по кандидатах (сусідні клітинки)
  const cands = getCandidates(b);
  if (cands.length === 0) return empty[0];

  let best = -Infinity, bestMove = cands[0];
  for (const i of cands) {
    b[i] = 'O';
    const score = minimax(b, 5, -Infinity, Infinity, false);
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
          <h3 className="text-lg font-bold text-white">Спробуй виграти штучний інтелект хоча би 1 раз</h3>
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
