/** Структуровані дані рисунка. Координати — у системі полотна (y вниз). */
export interface GPoint {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface GSegment {
  id: string;
  a: string;
  b: string;
}

/** Промінь із початком `from`, що проходить через `through`. */
export interface GRay {
  id: string;
  from: string;
  through: string;
}

/** Позначка кута a–vertex–b. `arcs` — кількість дуг (однакові дуги = рівні кути). */
export interface GAngle {
  id: string;
  vertex: string;
  a: string;
  b: string;
  text?: string;
  arcs?: number;
}

export interface Drawing {
  points: GPoint[];
  segments: GSegment[];
  rays: GRay[];
  angles: GAngle[];
}

export const BOARD_W = 400;
export const BOARD_H = 320;

export const EMPTY_DRAWING: Drawing = { points: [], segments: [], rays: [], angles: [] };

export const LIMITS = { points: 40, segments: 60, rays: 60, angles: 30 };

const ID_RE = /^[a-z0-9_-]{1,16}$/i;

function finite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > -200 && n < 1200;
}

/** Серверна валідація рисунка з браузера. Повертає копію без зайвих полів або null. */
export function validateDrawing(raw: unknown): Drawing | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const arr = (v: unknown, max: number) => (Array.isArray(v) && v.length <= max ? v : null);
  const pts = arr(r.points, LIMITS.points);
  const segs = arr(r.segments ?? [], LIMITS.segments);
  const rays = arr(r.rays ?? [], LIMITS.rays);
  const angs = arr(r.angles ?? [], LIMITS.angles);
  if (!pts || !segs || !rays || !angs) return null;

  const points: GPoint[] = [];
  const ids = new Set<string>();
  for (const p of pts as Record<string, unknown>[]) {
    if (!p || typeof p.id !== 'string' || !ID_RE.test(p.id) || ids.has(p.id)) return null;
    if (!finite(p.x) || !finite(p.y)) return null;
    const label = typeof p.label === 'string' ? p.label.trim().slice(0, 4) : '';
    ids.add(p.id);
    points.push({ id: p.id, label, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
  }
  const ref = (v: unknown): v is string => typeof v === 'string' && ids.has(v);
  const segments: GSegment[] = [];
  for (const s of segs as Record<string, unknown>[]) {
    if (!s || typeof s.id !== 'string' || !ID_RE.test(s.id) || !ref(s.a) || !ref(s.b) || s.a === s.b) return null;
    segments.push({ id: s.id, a: s.a, b: s.b });
  }
  const outRays: GRay[] = [];
  for (const s of rays as Record<string, unknown>[]) {
    if (!s || typeof s.id !== 'string' || !ID_RE.test(s.id) || !ref(s.from) || !ref(s.through) || s.from === s.through)
      return null;
    outRays.push({ id: s.id, from: s.from, through: s.through });
  }
  const angles: GAngle[] = [];
  for (const a of angs as Record<string, unknown>[]) {
    if (!a || typeof a.id !== 'string' || !ID_RE.test(a.id) || !ref(a.vertex) || !ref(a.a) || !ref(a.b)) return null;
    if (a.a === a.vertex || a.b === a.vertex || a.a === a.b) return null;
    const text = typeof a.text === 'string' ? a.text.trim().slice(0, 12) : undefined;
    const arcs = typeof a.arcs === 'number' && Number.isInteger(a.arcs) && a.arcs >= 0 && a.arcs <= 3 ? a.arcs : undefined;
    angles.push({ id: a.id, vertex: a.vertex, a: a.a, b: a.b, text, arcs });
  }
  return { points, segments, rays: outRays, angles };
}
