import type { Drawing, GPoint } from './types';

export interface Vec {
  x: number;
  y: number;
}

export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const len = (v: Vec) => Math.hypot(v.x, v.y);
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;

/** Кут між векторами у градусах, [0, 180]. */
export function angleBetween(u: Vec, v: Vec): number {
  const lu = len(u);
  const lv = len(v);
  if (lu < 1e-9 || lv < 1e-9) return NaN;
  const c = Math.max(-1, Math.min(1, dot(u, v) / (lu * lv)));
  return (Math.acos(c) * 180) / Math.PI;
}

/** Величина кута a–v–b у градусах, [0, 180]. */
export function angleAt(v: Vec, a: Vec, b: Vec): number {
  return angleBetween(sub(a, v), sub(b, v));
}

/** Латинські відповідники кириличних літер, якими часто підписують точки. */
const LOOKALIKE: Record<string, string> = {
  А: 'A', В: 'B', С: 'C', Д: 'D', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', Т: 'T', Х: 'X', І: 'I', Ф: 'F', Г: 'G', Л: 'L',
};

export function normLabel(label: string): string {
  return Array.from(label.trim().toUpperCase())
    .map((ch) => LOOKALIKE[ch] ?? ch)
    .join('')
    .replace(/[’'`]/g, "'");
}

export function pointsByLabel(d: Drawing): Map<string, GPoint[]> {
  const m = new Map<string, GPoint[]>();
  for (const p of d.points) {
    const k = normLabel(p.label);
    if (!k) continue;
    m.set(k, [...(m.get(k) || []), p]);
  }
  return m;
}

export type Cover = 'ray' | 'segment' | 'reversed' | null;

const ON_TOL_DEG = 3;
const SAME_PT = 2;

function onDirection(s: Vec, dir: Vec, p: Vec): number | null {
  const sp = sub(p, s);
  const d = len(sp);
  if (d < SAME_PT) return 0;
  const ang = angleBetween(dir, sp);
  if (ang <= ON_TOL_DEG) return d;
  if (ang >= 180 - ON_TOL_DEG) return -d;
  return null;
}

/**
 * Як рисунок покриває спрямований шматок V→P:
 * 'ray' — є промінь, на якому V, а P далі за напрямком;
 * 'segment' — є відрізок (або промінь без напрямку для цього шматка), що містить V і P;
 * 'reversed' — є промінь через V і P, але напрямлений від P до V (неправильний початок).
 */
export function coverage(d: Drawing, V: GPoint, P: GPoint): Cover {
  const byId = new Map(d.points.map((p) => [p.id, p]));
  let best: Cover = null;
  for (const r of d.rays) {
    const S = byId.get(r.from)!;
    const T = byId.get(r.through)!;
    const dir = sub(T, S);
    const tv = onDirection(S, dir, V);
    const tp = onDirection(S, dir, P);
    if (tv === null || tp === null || tv < -SAME_PT || tp < -SAME_PT) continue;
    if (tp > tv + SAME_PT) return 'ray';
    if (tp < tv - SAME_PT) best = best ?? 'reversed';
  }
  for (const s of d.segments) {
    const A = byId.get(s.a)!;
    const B = byId.get(s.b)!;
    const dir = sub(B, A);
    const L = len(dir);
    const tv = onDirection(A, dir, V);
    const tp = onDirection(A, dir, P);
    if (tv === null || tp === null) continue;
    if (tv < -SAME_PT || tp < -SAME_PT || tv > L + SAME_PT || tp > L + SAME_PT) continue;
    if (Math.abs(tv - tp) > SAME_PT) best = 'segment';
  }
  return best;
}

/** Опис рисунка для моделі: виміряні кути, належність точок, підписи. */
export function describeDrawing(d: Drawing): string {
  const byId = new Map(d.points.map((p) => [p.id, p]));
  const name = (id: string) => byId.get(id)?.label || `т.${id}`;
  const lines: string[] = [];
  lines.push(`Точки: ${d.points.map((p) => `${p.label || '(без підпису)'}(${Math.round(p.x)}; ${Math.round(320 - p.y)})`).join(', ') || 'немає'}`);
  if (d.segments.length) lines.push(`Відрізки: ${d.segments.map((s) => name(s.a) + name(s.b)).join(', ')}`);
  if (d.rays.length) lines.push(`Промені (початок → через): ${d.rays.map((r) => `${name(r.from)}→${name(r.through)}`).join(', ')}`);
  if (d.angles.length) {
    lines.push(
      `Позначені кути: ${d.angles
        .map((a) => {
          const v = byId.get(a.vertex)!;
          const m = angleAt(v, byId.get(a.a)!, byId.get(a.b)!);
          return `∠${name(a.a)}${name(a.vertex)}${name(a.b)} (на рисунку ≈${Math.round(m)}°${a.text ? `, підпис учня «${a.text}»` : ''}${a.arcs ? `, дуг: ${a.arcs}` : ''})`;
        })
        .join('; ')}`,
    );
  }
  // кути між лініями з однією вершиною
  const measured: string[] = [];
  const dirsFrom = new Map<string, string[]>();
  const addDir = (v: string, p: string) => dirsFrom.set(v, Array.from(new Set([...(dirsFrom.get(v) || []), p])));
  for (const r of d.rays) addDir(r.from, r.through);
  for (const s of d.segments) {
    addDir(s.a, s.b);
    addDir(s.b, s.a);
  }
  for (const [v, ps] of dirsFrom) {
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        if (measured.length >= 24) break;
        const m = angleAt(byId.get(v)!, byId.get(ps[i])!, byId.get(ps[j])!);
        measured.push(`∠${name(ps[i])}${name(v)}${name(ps[j])} ≈ ${Math.round(m)}°`);
      }
  }
  if (measured.length) lines.push(`Виміряно на рисунку (не доказ): ${measured.join(', ')}`);
  return lines.join('\n');
}
