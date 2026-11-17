'use client';

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { BOARD_H, BOARD_W, LIMITS, type Drawing, type GPoint } from '@/lib/geometry/types';
import type { Highlight } from '@/lib/geometry/tasks';

export type Tool = 'point' | 'segment' | 'ray' | 'angle' | 'label' | 'erase';

export const TOOLS: { id: Tool; title: string; icon: string }[] = [
  { id: 'point', title: 'Точка', icon: '•' },
  { id: 'segment', title: 'Відрізок', icon: '—' },
  { id: 'ray', title: 'Промінь', icon: '→' },
  { id: 'angle', title: 'Позначити кут', icon: '∠' },
  { id: 'label', title: 'Підпис', icon: 'Aa' },
  { id: 'erase', title: 'Стерти', icon: '⌫' },
];

const AUTO_LABELS = ['A', 'B', 'C', 'D', 'O', 'E', 'F', 'K', 'M', 'N', 'P', 'Q', 'R', 'S', 'T'];
const HIT_R = 16;

let idSeq = 0;
const newId = (p: string) => `${p}${Date.now().toString(36).slice(-4)}${(idSeq++).toString(36)}`;

function nextLabel(d: Drawing): string {
  const used = new Set(d.points.map((p) => p.label.toUpperCase()));
  return AUTO_LABELS.find((l) => !used.has(l)) ?? '';
}

function rayEnd(a: GPoint, b: GPoint): { x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const ts: number[] = [];
  if (dx > 0) ts.push((BOARD_W + 40 - a.x) / dx);
  if (dx < 0) ts.push((-40 - a.x) / dx);
  if (dy > 0) ts.push((BOARD_H + 40 - a.y) / dy);
  if (dy < 0) ts.push((-40 - a.y) / dy);
  const t = Math.max(1, Math.min(...ts.filter((x) => x > 0)));
  return { x: a.x + dx * t, y: a.y + dy * t };
}

function distToSeg(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }, ray: boolean) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2;
  t = ray ? Math.max(0, t) : Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Дуга кута. Підпис ставимо всередині кута, але не на іншому промені з тієї ж вершини
 * (`avoid` — напрямки ліній від вершини в радіанах), щоб текст не накладався на бісектрису.
 */
function arcPath(v: GPoint, a: GPoint, b: GPoint, r: number, avoid: number[] = []): { d: string; mid: { x: number; y: number } } {
  const ta = Math.atan2(a.y - v.y, a.x - v.x);
  const tb = Math.atan2(b.y - v.y, b.x - v.x);
  let diff = tb - ta;
  while (diff <= -Math.PI) diff += 2 * Math.PI;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  const sweep = diff > 0 ? 1 : 0;
  const p1 = { x: v.x + r * Math.cos(ta), y: v.y + r * Math.sin(ta) };
  const p2 = { x: v.x + r * Math.cos(ta + diff), y: v.y + r * Math.sin(ta + diff) };
  const near = (t: number) =>
    avoid.some((u) => {
      let d = Math.abs(t - u) % (2 * Math.PI);
      if (d > Math.PI) d = 2 * Math.PI - d;
      return d < 0.2;
    });
  const frac = [0.5, 0.3, 0.7, 0.22, 0.78].find((f) => !near(ta + diff * f)) ?? 0.5;
  const tm = ta + diff * frac;
  const lr = r + 15;
  return {
    d: `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 ${sweep} ${p2.x} ${p2.y}`,
    mid: { x: v.x + lr * Math.cos(tm), y: v.y + lr * Math.sin(tm) },
  };
}

/** Чи перекриваються (менші за 180°) кути з однією вершиною v, крім спільної сторони. */
function anglesOverlap(v: GPoint, a1?: GPoint, b1?: GPoint, a2?: GPoint, b2?: GPoint): boolean {
  if (!a1 || !b1 || !a2 || !b2) return false;
  const interval = (a: GPoint, b: GPoint): [number, number] => {
    const ta = Math.atan2(a.y - v.y, a.x - v.x);
    let d = Math.atan2(b.y - v.y, b.x - v.x) - ta;
    while (d <= -Math.PI) d += 2 * Math.PI;
    while (d > Math.PI) d -= 2 * Math.PI;
    return d >= 0 ? [ta, ta + d] : [ta + d, ta];
  };
  const [s1, e1] = interval(a1, b1);
  const [s2, e2] = interval(a2, b2);
  const eps = 0.02;
  for (const k of [-2, 0, 2]) {
    const sh = k * Math.PI;
    if (s1 + sh < e2 - eps && s2 < e1 + sh - eps) return true;
  }
  return false;
}

export interface EditTarget {
  type: 'point' | 'angle';
  id: string;
}

interface Props {
  drawing: Drawing;
  /** Без onChange полотно лише показує рисунок. */
  onChange?: (next: Drawing, opts?: { pushUndo?: boolean }) => void;
  tool?: Tool;
  highlight?: Highlight;
  onEdit?: (t: EditTarget) => void;
  onHint?: (text: string) => void;
  testId?: string;
}

/**
 * Полотно для креслення. Усе редагування — локально в браузері, без запитів до API.
 * Працює мишею й пальцем (Pointer Events), точки можна перетягувати.
 */
export function GeometryBoard({ drawing, onChange, tool = 'point', highlight, onEdit, onHint, testId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pending, setPending] = useState<string[]>([]);
  const drag = useRef<{ id: string; startX: number; startY: number; moved: boolean; created: boolean } | null>(null);
  const readOnly = !onChange;
  const byId = new Map(drawing.points.map((p) => [p.id, p]));
  const hl = {
    points: new Set(highlight?.points ?? []),
    segments: new Set(highlight?.segments ?? []),
    rays: new Set(highlight?.rays ?? []),
    angles: new Set(highlight?.angles ?? []),
  };
  // напрямки ліній від кожної точки — для розміщення підписів
  const dirs = new Map<string, number[]>();
  const addDir = (from: string, to: string, both: boolean) => {
    const a = byId.get(from);
    const b = byId.get(to);
    if (!a || !b) return;
    const t = Math.atan2(b.y - a.y, b.x - a.x);
    dirs.set(from, [...(dirs.get(from) || []), t]);
    if (both) dirs.set(to, [...(dirs.get(to) || []), t + Math.PI]);
  };
  for (const sgm of drawing.segments) addDir(sgm.a, sgm.b, true);
  for (const r of drawing.rays) {
    addDir(r.from, r.through, false);
    // точка «через» лежить на промені: лінія йде в обидва боки від неї
    const a = byId.get(r.from);
    const b = byId.get(r.through);
    if (a && b) {
      const t = Math.atan2(b.y - a.y, b.x - a.x);
      dirs.set(r.through, [...(dirs.get(r.through) || []), t, t + Math.PI]);
    }
  }
  /** Підпис точки — у найширшому вільному секторі між лініями. */
  const labelPos = (p: GPoint) => {
    const ds = (dirs.get(p.id) || []).map((t) => ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).sort((x, y) => x - y);
    let best = -Math.PI / 4;
    if (ds.length) {
      let gap = -1;
      for (let i = 0; i < ds.length; i++) {
        const s0 = ds[i];
        const s1 = i + 1 < ds.length ? ds[i + 1] : ds[0] + 2 * Math.PI;
        if (s1 - s0 > gap) {
          gap = s1 - s0;
          best = (s0 + s1) / 2;
        }
      }
    }
    return { x: p.x + 15 * Math.cos(best), y: p.y + 15 * Math.sin(best) };
  };
  const anyHl = !!highlight && (hl.points.size + hl.segments.size + hl.rays.size + hl.angles.size > 0);

  function toBoard(e: ReactPointerEvent) {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    const r = m ? pt.matrixTransform(m.inverse()) : pt;
    return { x: Math.max(4, Math.min(BOARD_W - 4, r.x)), y: Math.max(4, Math.min(BOARD_H - 4, r.y)) };
  }

  function hitPoint(p: { x: number; y: number }): GPoint | null {
    let best: GPoint | null = null;
    let bd = HIT_R;
    for (const q of drawing.points) {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  }

  function addPoint(d: Drawing, p: { x: number; y: number }): [Drawing, string] {
    if (d.points.length >= LIMITS.points) {
      onHint?.('Забагато точок на рисунку.');
      return [d, ''];
    }
    const id = newId('p');
    return [{ ...d, points: [...d.points, { id, label: nextLabel(d), x: Math.round(p.x), y: Math.round(p.y) }] }, id];
  }

  function erase(p: { x: number; y: number }) {
    const pointHit = hitPoint(p);
    if (pointHit) {
      const id = pointHit.id;
      onChange!(
        {
          points: drawing.points.filter((q) => q.id !== id),
          segments: drawing.segments.filter((s) => s.a !== id && s.b !== id),
          rays: drawing.rays.filter((r) => r.from !== id && r.through !== id),
          angles: drawing.angles.filter((a) => a.vertex !== id && a.a !== id && a.b !== id),
        },
        { pushUndo: true },
      );
      return;
    }
    const ang = drawing.angles.find((a) => {
      const v = byId.get(a.vertex)!;
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      return d < 40;
    });
    if (ang) {
      onChange!({ ...drawing, angles: drawing.angles.filter((a) => a.id !== ang.id) }, { pushUndo: true });
      return;
    }
    const seg = drawing.segments.find((s) => distToSeg(p, byId.get(s.a)!, byId.get(s.b)!, false) < 10);
    if (seg) {
      onChange!({ ...drawing, segments: drawing.segments.filter((s) => s.id !== seg.id) }, { pushUndo: true });
      return;
    }
    const ray = drawing.rays.find((r) => distToSeg(p, byId.get(r.from)!, byId.get(r.through)!, true) < 10);
    if (ray) onChange!({ ...drawing, rays: drawing.rays.filter((r) => r.id !== ray.id) }, { pushUndo: true });
  }

  function clickAt(p: { x: number; y: number }, hit: GPoint | null) {
    if (tool === 'erase') return erase(p);
    if (tool === 'label') {
      if (hit) return onEdit?.({ type: 'point', id: hit.id });
      const ang = drawing.angles.find((a) => {
        const v = byId.get(a.vertex)!;
        return Math.hypot(v.x - p.x, v.y - p.y) < 44;
      });
      if (ang) return onEdit?.({ type: 'angle', id: ang.id });
      return onHint?.('Торкнися точки або позначки кута, щоб змінити підпис.');
    }
    if (tool === 'point') return; // точку створено на pointerdown
    if (tool === 'segment' || tool === 'ray') {
      let d = drawing;
      let id = hit?.id ?? '';
      if (!id) {
        [d, id] = addPoint(d, p);
        if (!id) return;
      }
      if (pending.length === 0) {
        setPending([id]);
        if (d !== drawing) onChange!(d, { pushUndo: true });
        onHint?.(tool === 'ray' ? 'Тепер торкнися точки, через яку проходить промінь.' : 'Тепер торкнися другого кінця відрізка.');
        return;
      }
      const start = pending[0];
      setPending([]);
      if (start === id) return;
      if (tool === 'segment') {
        if (d.segments.length >= LIMITS.segments) return onHint?.('Забагато відрізків.');
        d = { ...d, segments: [...d.segments, { id: newId('s'), a: start, b: id }] };
      } else {
        if (d.rays.length >= LIMITS.rays) return onHint?.('Забагато променів.');
        d = { ...d, rays: [...d.rays, { id: newId('r'), from: start, through: id }] };
      }
      onChange!(d, { pushUndo: true });
      onHint?.('');
      return;
    }
    if (tool === 'angle') {
      if (!hit) return onHint?.('Для кута торкнися трьох точок: точка на стороні, вершина, точка на другій стороні.');
      const next = [...pending, hit.id];
      if (next.length < 3) {
        setPending(next);
        onHint?.(next.length === 1 ? 'Тепер торкнися вершини кута.' : 'Тепер — точки на другій стороні.');
        return;
      }
      setPending([]);
      const [a, v, b] = next;
      if (a === v || b === v || a === b) return onHint?.('Потрібні три різні точки.');
      if (drawing.angles.length >= LIMITS.angles) return onHint?.('Забагато позначок кутів.');
      const id = newId('a');
      onChange!({ ...drawing, angles: [...drawing.angles, { id, vertex: v, a, b, arcs: 1 }] }, { pushUndo: true });
      onHint?.('');
      onEdit?.({ type: 'angle', id });
    }
  }

  function onDown(e: ReactPointerEvent) {
    if (readOnly) return;
    const p = toBoard(e);
    const hit = hitPoint(p);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (hit && tool !== 'erase' && tool !== 'label') {
      drag.current = { id: hit.id, startX: p.x, startY: p.y, moved: false, created: false };
      return;
    }
    if (!hit && tool === 'point') {
      const [d, id] = addPoint(drawing, p);
      if (!id) return;
      onChange!(d, { pushUndo: true });
      drag.current = { id, startX: p.x, startY: p.y, moved: true, created: true };
      return;
    }
    clickAt(p, hit);
  }

  function onMove(e: ReactPointerEvent) {
    const dr = drag.current;
    if (!dr || readOnly) return;
    const p = toBoard(e);
    if (!dr.moved && Math.hypot(p.x - dr.startX, p.y - dr.startY) < 6) return;
    const first = !dr.moved;
    dr.moved = true;
    onChange!(
      { ...drawing, points: drawing.points.map((q) => (q.id === dr.id ? { ...q, x: Math.round(p.x), y: Math.round(p.y) } : q)) },
      { pushUndo: first && !dr.created },
    );
  }

  function onUp(e: ReactPointerEvent) {
    const dr = drag.current;
    drag.current = null;
    if (!dr || readOnly) return;
    if (!dr.moved) clickAt(toBoard(e), byId.get(dr.id) ?? null);
  }

  const lineColor = (on: boolean) => (on ? '#f59e0b' : anyHl ? '#64748b' : '#e2e8f0');

  return (
    <svg
      ref={svgRef}
      data-testid={testId}
      viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
      className="w-full select-none rounded-2xl bg-slate-900 ring-1 ring-slate-700"
      style={{ touchAction: 'none', aspectRatio: `${BOARD_W} / ${BOARD_H}` }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => (drag.current = null)}
    >
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={BOARD_W} height={BOARD_H} fill="url(#grid)" />

      {drawing.angles.map((a, idx) => {
        const v = byId.get(a.vertex);
        const pa = byId.get(a.a);
        const pb = byId.get(a.b);
        if (!v || !pa || !pb) return null;
        const on = hl.angles.has(a.id);
        const arcs = Math.max(1, a.arcs ?? 1);
        const color = on ? '#f59e0b' : '#a5b4fc';
        // Кути з однією вершиною, що перекриваються, — на різних радіусах: менші ближче до вершини,
        // більший (напр. весь кут навколо бісектриси) — зовнішньою дугою. Сусідні рівні кути — на одному радіусі.
        const size = (x: { a: string; b: string }) => {
          const p1 = byId.get(x.a);
          const p2 = byId.get(x.b);
          return p1 && p2 ? Math.abs(Math.atan2(p1.y - v.y, p1.x - v.x) - Math.atan2(p2.y - v.y, p2.x - v.x)) : 0;
        };
        const norm = (r: number) => (r > Math.PI ? 2 * Math.PI - r : r);
        const mine = norm(size(a));
        const order = drawing.angles.filter(
          (x, j) =>
            j !== idx &&
            x.vertex === a.vertex &&
            anglesOverlap(v, byId.get(x.a), byId.get(x.b), pa, pb) &&
            (norm(size(x)) < mine - 0.01 || (Math.abs(norm(size(x)) - mine) <= 0.01 && j < idx)),
        ).length;
        const base = 26 + order * 20;
        const main = arcPath(v, pa, pb, base + (arcs - 1) * 5, dirs.get(v.id) ?? []);
        return (
          <g key={a.id}>
            {Array.from({ length: arcs }, (_, i) => (
              <path key={i} d={arcPath(v, pa, pb, base + i * 5).d} fill="none" stroke={color} strokeWidth={on ? 3 : 2} />
            ))}
            {a.text && (
              <text x={main.mid.x} y={main.mid.y} fill={color} fontSize="14" fontWeight={on ? 700 : 500} textAnchor="middle" dominantBaseline="middle">
                {a.text}
              </text>
            )}
          </g>
        );
      })}

      {drawing.segments.map((s) => {
        const a = byId.get(s.a);
        const b = byId.get(s.b);
        if (!a || !b) return null;
        const on = hl.segments.has(s.id);
        return <line key={s.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={lineColor(on)} strokeWidth={on ? 4 : 2.5} strokeLinecap="round" />;
      })}

      {drawing.rays.map((r) => {
        const a = byId.get(r.from);
        const b = byId.get(r.through);
        if (!a || !b) return null;
        const end = rayEnd(a, b);
        const on = hl.rays.has(r.id);
        return <line key={r.id} x1={a.x} y1={a.y} x2={end.x} y2={end.y} stroke={lineColor(on)} strokeWidth={on ? 4 : 2.5} strokeLinecap="round" />;
      })}

      {drawing.points.map((p) => {
        const on = hl.points.has(p.id) || pending.includes(p.id);
        return (
          <g key={p.id} data-point={p.label}>
            <circle cx={p.x} cy={p.y} r={on ? 7 : 5.5} fill={on ? '#f59e0b' : '#f8fafc'} stroke="#0f172a" strokeWidth="1.5" />
            {!readOnly && <circle cx={p.x} cy={p.y} r={HIT_R} fill="transparent" />}
            {p.label && (
              <text
                {...(() => {
                  const lp = labelPos(p);
                  return { x: lp.x, y: lp.y };
                })()}
                fill={on ? '#fbbf24' : '#f8fafc'}
                fontSize="17"
                fontWeight="700"
                fontStyle="italic"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {p.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
