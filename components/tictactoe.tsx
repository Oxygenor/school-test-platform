'use client';

import { useState, useCallback } from 'react';

type Cell = 'X' | 'O' | null;

function checkWinner(board: Cell[]): Cell | 'draw' | null {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(Boolean)) return 'draw';
  return null;
}

function getWinningLine(board: Cell[]): number[] | null {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];
  for (const line of lines) {
    const [a,b,c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

function minimax(board: Cell[], isMaximizing: boolean, depth: number): number {
  const winner = checkWinner(board);
  if (winner === 'O') return 10 - depth;
  if (winner === 'X') return depth - 10;
  if (winner === 'draw') return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = 'O';
        best = Math.max(best, minimax(board, false, depth + 1));
        board[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = 'X';
        best = Math.min(best, minimax(board, true, depth + 1));
        board[i] = null;
      }
    }
    return best;
  }
}

function getAiMove(board: Cell[]): number {
  let bestScore = -Infinity;
  let bestMove = -1;
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = 'O';
      const score = minimax(board, false, 0);
      board[i] = null;
      if (score > bestScore) { bestScore = score; bestMove = i; }
    }
  }
  return bestMove;
}

export default function TicTacToe() {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [scores, setScores] = useState({ player: 0, ai: 0, draw: 0 });
  const [thinking, setThinking] = useState(false);

  const winner = checkWinner(board);
  const winLine = getWinningLine(board);

  const reset = useCallback(() => {
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(true);
    setThinking(false);
  }, []);

  function handleClick(i: number) {
    if (board[i] || winner || !isPlayerTurn || thinking) return;

    const newBoard = [...board];
    newBoard[i] = 'X';
    setBoard(newBoard);

    const result = checkWinner(newBoard);
    if (result) {
      if (result === 'X') setScores(s => ({ ...s, player: s.player + 1 }));
      else if (result === 'draw') setScores(s => ({ ...s, draw: s.draw + 1 }));
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
      if (aiResult === 'O') setScores(s => ({ ...s, ai: s.ai + 1 }));
      else if (aiResult === 'draw') setScores(s => ({ ...s, draw: s.draw + 1 }));
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
      <div className="rounded-3xl bg-slate-800 px-8 py-6 w-full max-w-xs">
        <div className="mb-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Поки чекаєш — зіграй</p>
          <h3 className="text-lg font-bold text-white">Виграй штучний інтелект</h3>
          <p className="text-xs text-slate-500 mt-0.5">Ти — X, ШІ — O</p>
        </div>

        {/* Рахунок */}
        <div className="mb-4 flex justify-center gap-4 text-sm">
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

        {/* Поле */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {board.map((cell, i) => {
            const isWinCell = winLine?.includes(i);
            return (
              <button
                key={i}
                onClick={() => handleClick(i)}
                className={`h-20 rounded-2xl text-3xl font-bold transition-all
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

        {/* Статус */}
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
