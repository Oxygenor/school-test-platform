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

function scoreMove(board: Cell[], pos: number): number {
  let score = 0;
  const mid = Math.floor(SIZE / 2);
  const row = Math.floor(pos / SIZE), col = pos % SIZE;
  score += (mid - Math.abs(row - mid)) + (mid - Math.abs(col - mid));

  for (const line of LINES) {
    if (!line.includes(pos)) continue;
    const os = line.filter(j => board[j] === 'O').length;
    const xs = line.filter(j => board[j] === 'X').length;
    if (xs > 0 && os > 0) continue;
    if (os === 3) score += 500;
    else if (os === 2) score += 50;
    else if (os === 1) score += 5;
    if (xs === 3) score += 300;
    else if (xs === 2) score += 30;
    else if (xs === 1) score += 3;
  }
  return score;
}

function countThreats(board: Cell[], mark: Cell): Map<number, number> {
  const threats = new Map<number, number>();
  for (const line of LINES) {
    const ms = line.filter(j => board[j] === mark).length;
    const nulls = line.filter(j => board[j] === null);
    if (ms === WIN - 1 && nulls.length === 1) {
      const cell = nulls[0];
      threats.set(cell, (threats.get(cell) ?? 0) + 1);
    }
  }
  return threats;
}

function getAiMove(board: Cell[]): number {
  const empty = board.reduce<number[]>((a, c, i) => { if (!c) a.push(i); return a; }, []);

  // 1. Win immediately
  for (const i of empty) {
    const b = [...board]; b[i] = 'O';
    if (checkWinner(b).winner === 'O') return i;
  }

  // 2. Block player win
  for (const i of empty) {
    const b = [...board]; b[i] = 'X';
    if (checkWinner(b).winner === 'X') return i;
  }

  // 3. Block player fork (cell that would give player 2+ threats)
  for (const i of empty) {
    const b = [...board]; b[i] = 'X';
    const threats = countThreats(b, 'X');
    if ((threats.get(i) ?? 0) >= 2 || [...threats.values()].filter(v => v > 0).length >= 2) {
      return i;
    }
  }

  // 4. Create AI fork
  for (const i of empty) {
    const b = [...board]; b[i] = 'O';
    const threats = countThreats(b, 'O');
    if ([...threats.values()].filter(v => v > 0).length >= 2) return i;
  }

  // 5. Best heuristic score
  let best = -Infinity, bestMove = empty[0];
  for (const i of empty) {
    const s = scoreMove(board, i);
    if (s > best) { best = s; bestMove = i; }
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
