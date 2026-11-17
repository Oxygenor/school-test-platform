import type { PrepDb } from './access';

/**
 * Обмеження частоти запитів до моделі для перевіреної сесії учня.
 * Основне джерело — лічильник у prep_logs (працює між інстансами serverless).
 * Якщо міграцію ще не застосовано, діє лише локальний лічильник інстансу.
 */
export const LIMITS = [
  { windowMs: 60_000, max: 6 },
  { windowMs: 60 * 60_000, max: 60 },
  { windowMs: 24 * 60 * 60_000, max: 150 },
];

const memory = new Map<string, number[]>();

export function resetRateLimitMemory() {
  memory.clear();
}

function memoryCheck(key: string, now: number): boolean {
  const longest = LIMITS[LIMITS.length - 1].windowMs;
  const hits = (memory.get(key) || []).filter((t) => now - t < longest);
  memory.set(key, hits);
  return LIMITS.every((l) => hits.filter((t) => now - t < l.windowMs).length < l.max);
}

export function recordHit(key: string, now = Date.now()) {
  const hits = memory.get(key) || [];
  hits.push(now);
  memory.set(key, hits);
  if (memory.size > 5000) {
    const first = memory.keys().next().value;
    if (first) memory.delete(first);
  }
}

export async function checkRateLimit(studentId: string, db: PrepDb, now = Date.now()): Promise<boolean> {
  if (!memoryCheck(studentId, now)) return false;
  for (const l of LIMITS) {
    const count = await db.countRecentRequests(studentId, new Date(now - l.windowMs).toISOString());
    if (count === null) break; // лічильник у БД недоступний
    if (count >= l.max) return false;
  }
  return true;
}
