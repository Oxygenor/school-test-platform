import { BOARD_H, BOARD_W, type Drawing, type GAngle, type GPoint } from './types';

/** Підтримувані в першій версії типи задач: кути, бісектриси, продовження сторін, трикутники. */
export type GeometryTaskKind = 'angle_bisector' | 'bisector_adjacent' | 'adjacent' | 'triangle_sum' | 'triangle_exterior';

export interface GeometryTask {
  kind: GeometryTaskKind;
  /** Підписи точок за ролями: A, O, B, C, D (для трикутників — A, B, C, D). */
  labels: Record<string, string>;
  /** alpha — ∠AOB або ∠A трикутника; beta — ∠B трикутника. */
  alpha: number;
  beta?: number;
  /** true — потрібна точна побудова (транспортир), false — ескіз. */
  exact: boolean;
  /** preset — навчальний зразок, який підібрав бот; student — вправа учня. */
  source: 'preset' | 'student';
}

const ROLES: Record<GeometryTaskKind, string[]> = {
  angle_bisector: ['A', 'O', 'B', 'C'],
  bisector_adjacent: ['A', 'O', 'B', 'C', 'D'],
  adjacent: ['A', 'O', 'B', 'D'],
  triangle_sum: ['A', 'B', 'C'],
  triangle_exterior: ['A', 'B', 'C', 'D'],
};

export const TASK_KIND_TITLES: Record<GeometryTaskKind, string> = {
  angle_bisector: 'Кут і бісектриса',
  bisector_adjacent: 'Бісектриса і суміжний кут',
  adjacent: 'Продовження сторони кута',
  triangle_sum: 'Сума кутів трикутника',
  triangle_exterior: 'Зовнішній кут трикутника',
};

export function defaultLabels(kind: GeometryTaskKind): Record<string, string> {
  return Object.fromEntries(ROLES[kind].map((r) => [r, r]));
}

export const PRESET_TASKS: GeometryTask[] = [
  { kind: 'bisector_adjacent', labels: defaultLabels('bisector_adjacent'), alpha: 136, exact: false, source: 'preset' },
  { kind: 'angle_bisector', labels: defaultLabels('angle_bisector'), alpha: 80, exact: false, source: 'preset' },
  { kind: 'adjacent', labels: defaultLabels('adjacent'), alpha: 50, exact: false, source: 'preset' },
  { kind: 'triangle_sum', labels: defaultLabels('triangle_sum'), alpha: 50, beta: 70, exact: false, source: 'preset' },
  { kind: 'triangle_exterior', labels: defaultLabels('triangle_exterior'), alpha: 45, beta: 65, exact: false, source: 'preset' },
];

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace('.', ','));

export function L(task: GeometryTask, role: string): string {
  return task.labels[role] ?? role;
}

function ang(task: GeometryTask, a: string, v: string, b: string) {
  return `∠${L(task, a)}${L(task, v)}${L(task, b)}`;
}

export function statement(task: GeometryTask): string {
  const a = fmt(task.alpha);
  switch (task.kind) {
    case 'angle_bisector':
      return `${ang(task, 'A', 'O', 'B')} = ${a}°, ${L(task, 'O')}${L(task, 'C')} — бісектриса цього кута. Знайдіть ${ang(task, 'A', 'O', 'C')}.`;
    case 'bisector_adjacent':
      return `${ang(task, 'A', 'O', 'B')} = ${a}°, ${L(task, 'O')}${L(task, 'C')} — бісектриса цього кута, ${L(task, 'O')}${L(task, 'D')} — промінь, протилежний до променя ${L(task, 'O')}${L(task, 'A')}. Знайдіть ${ang(task, 'C', 'O', 'D')}.`;
    case 'adjacent':
      return `${ang(task, 'A', 'O', 'B')} = ${a}°. Сторону ${L(task, 'O')}${L(task, 'A')} продовжено за точку ${L(task, 'O')}: ${L(task, 'O')}${L(task, 'D')} — промінь, протилежний до ${L(task, 'O')}${L(task, 'A')}. Знайдіть ${ang(task, 'B', 'O', 'D')}.`;
    case 'triangle_sum':
      return `У трикутнику ${L(task, 'A')}${L(task, 'B')}${L(task, 'C')} ∠${L(task, 'A')} = ${a}°, ∠${L(task, 'B')} = ${fmt(task.beta ?? 0)}°. Знайдіть ∠${L(task, 'C')}.`;
    case 'triangle_exterior':
      return `У трикутнику ${L(task, 'A')}${L(task, 'B')}${L(task, 'C')} ∠${L(task, 'A')} = ${a}°, ∠${L(task, 'B')} = ${fmt(task.beta ?? 0)}°. Сторону ${L(task, 'A')}${L(task, 'C')} продовжено за точку ${L(task, 'C')} до точки ${L(task, 'D')}. Знайдіть ${ang(task, 'B', 'C', 'D')}.`;
  }
}

/** Відповідь, обчислена кодом. */
export function solve(task: GeometryTask): { name: string; value: number } {
  const a = task.alpha;
  const b = task.beta ?? 0;
  switch (task.kind) {
    case 'angle_bisector':
      return { name: ang(task, 'A', 'O', 'C'), value: a / 2 };
    case 'bisector_adjacent':
      return { name: ang(task, 'C', 'O', 'D'), value: 180 - a / 2 };
    case 'adjacent':
      return { name: ang(task, 'B', 'O', 'D'), value: 180 - a };
    case 'triangle_sum':
      return { name: `∠${L(task, 'C')}`, value: 180 - a - b };
    case 'triangle_exterior':
      return { name: ang(task, 'B', 'C', 'D'), value: a + b };
  }
}

const LABEL_RE = /^[A-Z]$/;

/** Валідація задачі з моделі чи браузера. */
export function validateTask(raw: unknown): GeometryTask | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind as GeometryTaskKind;
  if (!ROLES[kind]) return null;
  const alpha = Number(r.alpha);
  const beta = r.beta === undefined || r.beta === null ? undefined : Number(r.beta);
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 180) return null;
  if (kind.startsWith('triangle')) {
    if (beta === undefined || !Number.isFinite(beta) || beta <= 0 || alpha + beta >= 180) return null;
  }
  const labels: Record<string, string> = {};
  const rawLabels = (r.labels && typeof r.labels === 'object' ? r.labels : {}) as Record<string, unknown>;
  for (const role of ROLES[kind]) {
    const l = typeof rawLabels[role] === 'string' ? (rawLabels[role] as string).trim().toUpperCase() : role;
    if (!LABEL_RE.test(l)) return null;
    labels[role] = l;
  }
  if (new Set(Object.values(labels)).size !== ROLES[kind].length) return null;
  return {
    kind,
    labels,
    alpha,
    beta: kind.startsWith('triangle') ? beta : undefined,
    exact: r.exact === true,
    source: r.source === 'preset' ? 'preset' : 'student',
  };
}

// --------------------------------------------------------------------------
// Розбір тексту задачі (без моделі). Повертає null, якщо задача поза набором.
// --------------------------------------------------------------------------

const CYR: Record<string, string> = { А: 'A', В: 'B', С: 'C', Д: 'D', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', Т: 'T', Х: 'X' };
const latin = (s: string) => Array.from(s).map((c) => CYR[c] ?? c).join('');
const NUM = '(\\d+(?:[.,]\\d+)?)';
const P = '([A-Z])';
const W = "[а-яіїєґ’']*";
const ANG = `(?:∠\\s*|[Кк]ут${W}\\s+)`;
const EQ = '\\s*(?:=|дорівнює)\\s*';

/** Великі кириличні позначення точок (АОВ) переводимо в латиницю (AOB). */
function normalizePointNames(text: string): string {
  // без lookbehind — для старих версій Safari на iPhone
  return text.replace(/(^|[^А-Яа-яІіЇїЄєҐґA-Za-z])([А-ЯІA-Z]{1,3})(?![А-Яа-яІіЇїЄєҐґA-Za-z])/g, (_, pre: string, name: string) => pre + latin(name));
}

const num = (s: string) => parseFloat(s.replace(',', '.'));

/** «Продовжимо сторону AC за точку C» або «Сторону AC продовжено за точку C». */
function findExtension(t: string): RegExpExecArray | null {
  return (
    new RegExp(`[Пп]родовж${W}[^.]*?${P}${P}(?![A-Z])[^.]*?за\\s+(?:точку|вершину)\\s+${P}`).exec(t) ??
    new RegExp(`${P}${P}(?![A-Z])[^.]*?продовж${W}[^.]*?за\\s+(?:точку|вершину)\\s+${P}`).exec(t)
  );
}

export function parseGeometryProblem(text: string, source: 'preset' | 'student' = 'student'): GeometryTask | null {
  const t = normalizePointNames(text.replace(/\s+/g, ' '));
  const exact = /транспортир|точн\S* побуд|[Пп]обудуйте кут/.test(t);
  const tri = new RegExp(`[Тт]рикутник${W}\\s+${P}${P}${P}(?![A-Z])`).exec(t);

  if (tri) {
    const [A, B, C] = [tri[1], tri[2], tri[3]];
    const v = (lbl: string) => {
      const m = new RegExp(`${ANG}${lbl}(?![A-Z])${EQ}${NUM}`).exec(t);
      return m ? num(m[1]) : null;
    };
    const known = new Map<string, number>();
    for (const l of [A, B, C]) {
      const x = v(l);
      if (x !== null) known.set(l, x);
    }
    if (known.size < 2) return null;
    const ext = findExtension(t);
    if (ext) {
      const [s1, s2, beyond] = [ext[1], ext[2], ext[3]];
      if (![s1, s2].includes(beyond)) return null;
      const other = s1 === beyond ? s2 : s1;
      const third = [A, B, C].find((l) => l !== beyond && l !== other);
      if (!third || ![A, B, C].includes(other) || ![A, B, C].includes(beyond)) return null;
      const rest = t.slice(ext.index + ext[0].length);
      const dm = new RegExp(`(?:точк${W}|промін${W}\\s+${beyond})\\s*${P}(?![A-Z])`).exec(rest);
      const D = dm ? dm[1] : 'D';
      const va = known.get(other);
      const vb = known.get(third);
      if (va === undefined || vb === undefined) return null;
      return validateTask({ kind: 'triangle_exterior', labels: { A: other, B: third, C: beyond, D }, alpha: va, beta: vb, exact, source });
    }
    const unknown = [A, B, C].find((l) => !known.has(l));
    if (!unknown) return null;
    const [k1, k2] = [A, B, C].filter((l) => known.has(l));
    return validateTask({ kind: 'triangle_sum', labels: { A: k1, B: k2, C: unknown }, alpha: known.get(k1)!, beta: known.get(k2)!, exact, source });
  }

  const am = new RegExp(`${ANG}${P}${P}${P}(?![A-Z])${EQ}${NUM}`).exec(t);
  if (!am) return null;
  const [A, O, B] = [am[1], am[2], am[3]];
  const alpha = num(am[4]);
  const other = (x: string, y: string) => (x === O ? y : y === O ? x : null);

  const bis = new RegExp(`${P}${P}(?![A-Z])\\s*(?:[—–-]\\s*)?(?:є\\s+)?бісектрис`).exec(t);
  let C: string | null = null;
  if (bis) {
    C = other(bis[1], bis[2]);
    if (!C) return null;
  }

  let D: string | null = null;
  let extendsSide: string | null = null;
  const opp = new RegExp(`${P}${P}(?![A-Z])\\s*(?:[—–-]\\s*)?(?:є\\s+)?(?:промін${W}\\s*,?\\s*)?(?:протилежн|доповняльн)`).exec(t);
  const extend = findExtension(t);
  if (opp) {
    D = other(opp[1], opp[2]);
    if (!D) return null;
    const toSide = new RegExp(`(?:протилежн|доповняльн)${W}\\s+(?:до\\s+)?(?:промен${W}\\s+|промін${W}\\s+)?${P}${P}(?![A-Z])`).exec(t);
    extendsSide = toSide ? other(toSide[1], toSide[2]) : A;
  } else if (extend && extend[3] === O) {
    extendsSide = other(extend[1], extend[2]);
    const rest = t.slice(extend.index + extend[0].length);
    const dm = new RegExp(`(?:промін${W}\\s+${O}${P}|точк${W}\\s+${P})(?![A-Z])`).exec(rest);
    D = dm ? dm[1] ?? dm[2] : 'D';
  }
  if (D && extendsSide !== A && extendsSide !== B) return null;

  // Нормалізуємо так, щоб продовжувалась сторона з роллю «A».
  const sideA = D ? (extendsSide as string) : A;
  const sideB = sideA === A ? B : A;

  if (C && D) return validateTask({ kind: 'bisector_adjacent', labels: { A: sideA, O, B: sideB, C, D }, alpha, exact, source });
  if (C) return validateTask({ kind: 'angle_bisector', labels: { A, O, B, C }, alpha, exact, source });
  if (D) return validateTask({ kind: 'adjacent', labels: { A: sideA, O, B: sideB, D }, alpha, exact, source });
  return null;
}

// --------------------------------------------------------------------------
// Покрокова побудова (для «Покажи побудову»)
// --------------------------------------------------------------------------

export interface Highlight {
  points?: string[];
  segments?: string[];
  rays?: string[];
  angles?: string[];
}

export interface ConstructionStep {
  title: string;
  text: string;
  drawing: Drawing;
  highlight: Highlight;
  /** figure — побудова рисунка; solution — міркування й обчислення. */
  stage: 'figure' | 'solution';
}

const rad = (d: number) => (d * Math.PI) / 180;

function polar(o: { x: number; y: number }, r: number, deg: number) {
  return { x: o.x + r * Math.cos(rad(deg)), y: o.y - r * Math.sin(rad(deg)) };
}

function fit(points: GPoint[]): GPoint[] {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const m = 36;
  const s = Math.min((BOARD_W - 2 * m) / Math.max(1, maxX - minX), (BOARD_H - 2 * m) / Math.max(1, maxY - minY), 1.6);
  const ox = (BOARD_W - s * (maxX - minX)) / 2;
  const oy = (BOARD_H - s * (maxY - minY)) / 2;
  return points.map((p) => ({ ...p, x: Math.round((ox + (p.x - minX) * s) * 10) / 10, y: Math.round((oy + (p.y - minY) * s) * 10) / 10 }));
}

class Builder {
  steps: ConstructionStep[] = [];
  private d: Drawing = { points: [], segments: [], rays: [], angles: [] };
  constructor(private pts: GPoint[]) {}
  private ensure(ids: string[]) {
    for (const id of ids) {
      if (!this.d.points.some((p) => p.id === id)) this.d.points.push(this.pts.find((p) => p.id === id)!);
    }
  }
  ray(from: string, through: string) {
    this.ensure([from, through]);
    const id = `r_${from}${through}`;
    if (!this.d.rays.some((r) => r.id === id)) this.d.rays.push({ id, from, through });
    return id;
  }
  seg(a: string, b: string) {
    this.ensure([a, b]);
    const id = `s_${a}${b}`;
    if (!this.d.segments.some((s) => s.id === id)) this.d.segments.push({ id, a, b });
    return id;
  }
  angle(a: string, v: string, b: string, patch: Partial<GAngle> = {}) {
    this.ensure([a, v, b]);
    const id = `a_${a}${v}${b}`;
    const existing = this.d.angles.find((x) => x.id === id);
    if (existing) Object.assign(existing, patch);
    else this.d.angles.push({ id, vertex: v, a, b, ...patch });
    return id;
  }
  step(stage: 'figure' | 'solution', title: string, text: string, highlight: Highlight) {
    this.steps.push({ stage, title, text, highlight, drawing: JSON.parse(JSON.stringify(this.d)) });
  }
}

function pt(id: string, label: string, p: { x: number; y: number }): GPoint {
  return { id, label, x: p.x, y: p.y };
}

export function construction(task: GeometryTask): ConstructionStep[] {
  const a = task.alpha;
  const lab = (r: string) => L(task, r);
  const angTxt = (x: string, v: string, y: string) => `∠${lab(x)}${lab(v)}${lab(y)}`;

  if (task.kind === 'triangle_sum' || task.kind === 'triangle_exterior') {
    const b = task.beta ?? 0;
    const c = 180 - a - b;
    const A0 = { x: 0, y: 0 };
    const C0 = { x: 240, y: 0 };
    // B — перетин променів з A під кутом a та з C під кутом 180−c
    const da = { x: Math.cos(rad(a)), y: -Math.sin(rad(a)) };
    const dc = { x: -Math.cos(rad(c)), y: -Math.sin(rad(c)) };
    const det = da.x * -dc.y - da.y * -dc.x;
    const t = ((C0.x - A0.x) * -dc.y - (C0.y - A0.y) * -dc.x) / det;
    const B0 = { x: A0.x + da.x * t, y: A0.y + da.y * t };
    const raw = [pt('A', lab('A'), A0), pt('B', lab('B'), B0), pt('C', lab('C'), C0)];
    if (task.kind === 'triangle_exterior') raw.push(pt('D', lab('D'), { x: C0.x + 110, y: 0 }));
    const b_ = new Builder(fit(raw));
    b_.seg('A', 'B');
    b_.seg('B', 'C');
    b_.seg('A', 'C');
    b_.angle('C', 'A', 'B', { text: `${fmt(a)}°` });
    b_.angle('A', 'B', 'C', { text: `${fmt(b)}°`, arcs: 2 });
    b_.step('figure', `Будуємо трикутник ${lab('A')}${lab('B')}${lab('C')}`, `Позначаємо дані з умови: ∠${lab('A')} = ${fmt(a)}°, ∠${lab('B')} = ${fmt(b)}°.`, {
      segments: ['s_AB', 's_BC', 's_AC'],
      angles: ['a_CAB', 'a_ABC'],
    });
    if (task.kind === 'triangle_sum') {
      b_.angle('B', 'C', 'A', { arcs: 3 });
      b_.step('solution', 'Згадуємо теорему', `Сума кутів трикутника дорівнює 180°: ∠${lab('A')} + ∠${lab('B')} + ∠${lab('C')} = 180°.`, {
        angles: ['a_CAB', 'a_ABC', 'a_BCA'],
      });
      b_.angle('B', 'C', 'A', { text: `${fmt(c)}°`, arcs: 3 });
      b_.step('solution', 'Обчислюємо', `∠${lab('C')} = 180° − ${fmt(a)}° − ${fmt(b)}° = ${fmt(c)}°.`, { angles: ['a_BCA'] });
      return b_.steps;
    }
    const rCD = b_.ray('C', 'D');
    b_.step('figure', `Продовжуємо сторону ${lab('A')}${lab('C')} за точку ${lab('C')}`, `Проводимо промінь ${lab('C')}${lab('D')}, протилежний до ${lab('C')}${lab('A')}: точки ${lab('A')}, ${lab('C')}, ${lab('D')} лежать на одній прямій.`, {
      rays: [rCD],
      points: ['A', 'C', 'D'],
    });
    b_.angle('B', 'C', 'D', { arcs: 1 });
    b_.step('figure', `Позначаємо зовнішній кут ${angTxt('B', 'C', 'D')}`, `Кут ${angTxt('B', 'C', 'D')} утворений стороною ${lab('C')}${lab('B')} і продовженням сторони ${lab('A')}${lab('C')}. Це зовнішній кут трикутника при вершині ${lab('C')}.`, {
      angles: ['a_BCD'],
    });
    b_.angle('B', 'C', 'A', { text: `${fmt(c)}°`, arcs: 3 });
    b_.step('solution', `Знаходимо ∠${lab('C')} трикутника`, `За теоремою про суму кутів: ${angTxt('A', 'C', 'B')} = 180° − ${fmt(a)}° − ${fmt(b)}° = ${fmt(c)}°.`, {
      angles: ['a_BCA'],
    });
    b_.angle('B', 'C', 'D', { text: `${fmt(a + b)}°`, arcs: 1 });
    b_.step('solution', 'Суміжні кути', `${angTxt('A', 'C', 'B')} і ${angTxt('B', 'C', 'D')} суміжні, їх сума 180°: ${angTxt('B', 'C', 'D')} = 180° − ${fmt(c)}° = ${fmt(a + b)}°. Це те саме, що ∠${lab('A')} + ∠${lab('B')} = ${fmt(a)}° + ${fmt(b)}° (теорема про зовнішній кут).`, {
      angles: ['a_BCA', 'a_BCD'],
    });
    return b_.steps;
  }

  const O0 = { x: 0, y: 0 };
  const R = 150;
  const raw = [pt('O', lab('O'), O0), pt('A', lab('A'), polar(O0, R, 0)), pt('B', lab('B'), polar(O0, R, a))];
  if (task.kind !== 'adjacent') raw.push(pt('C', lab('C'), polar(O0, R, a / 2)));
  if (task.kind !== 'angle_bisector') raw.push(pt('D', lab('D'), polar(O0, R, 180)));
  // щоб рисунок не був надто плоским, додаємо рамку з центром O
  const framed = fit([...raw, pt('_t', '', { x: 0, y: -R * 0.35 }), pt('_b', '', { x: 0, y: R * 0.15 })]).filter((p) => !p.id.startsWith('_'));
  const b_ = new Builder(framed);

  const rOA = b_.ray('O', 'A');
  const rOB = b_.ray('O', 'B');
  b_.angle('A', 'O', 'B', { text: `${fmt(a)}°` });
  b_.step('figure', `Будуємо ${angTxt('A', 'O', 'B')} = ${fmt(a)}°`, `З точки ${lab('O')} проводимо промені ${lab('O')}${lab('A')} і ${lab('O')}${lab('B')}. Позначаємо величину з умови: ${fmt(a)}°.`, {
    rays: [rOA, rOB],
    angles: ['a_AOB'],
    points: ['O'],
  });

  if (task.kind === 'angle_bisector' || task.kind === 'bisector_adjacent') {
    const rOC = b_.ray('O', 'C');
    b_.angle('A', 'O', 'C', { arcs: 1 });
    b_.angle('C', 'O', 'B', { arcs: 1 });
    b_.step('figure', `Проводимо бісектрису ${lab('O')}${lab('C')}`, `Бісектриса ділить кут навпіл, тому ${angTxt('A', 'O', 'C')} = ${angTxt('C', 'O', 'B')}. Позначаємо їх однаковими дугами — це дано в умові, а не виміряно.`, {
      rays: [rOC],
      angles: ['a_AOC', 'a_COB'],
    });
  }

  if (task.kind === 'bisector_adjacent' || task.kind === 'adjacent') {
    const rOD = b_.ray('O', 'D');
    b_.step('figure', `Продовжуємо сторону ${lab('O')}${lab('A')} за точку ${lab('O')}`, `Промінь ${lab('O')}${lab('D')} протилежний до ${lab('O')}${lab('A')}: разом вони утворюють розгорнутий кут ${angTxt('A', 'O', 'D')} = 180°.`, {
      rays: [rOA, rOD],
      points: ['A', 'O', 'D'],
    });
  }

  if (task.kind === 'angle_bisector' || task.kind === 'bisector_adjacent') {
    b_.angle('A', 'O', 'C', { arcs: 1, text: `${fmt(a / 2)}°` });
    b_.angle('C', 'O', 'B', { arcs: 1, text: `${fmt(a / 2)}°` });
    b_.step(
      'solution',
      `Знаходимо ${angTxt('A', 'O', 'C')} і ${angTxt('C', 'O', 'B')}`,
      `${angTxt('A', 'O', 'C')} = ${angTxt('C', 'O', 'B')} = ${fmt(a)}° : 2 = ${fmt(a / 2)}°.`,
      { angles: ['a_AOC', 'a_COB'] },
    );
  }

  if (task.kind === 'bisector_adjacent') {
    b_.angle('C', 'O', 'D', { arcs: 2 });
    b_.step('solution', `${angTxt('C', 'O', 'D')} суміжний з ${angTxt('A', 'O', 'C')}`, `Сторона ${lab('O')}${lab('C')} у них спільна, а ${lab('O')}${lab('A')} і ${lab('O')}${lab('D')} — доповняльні промені. Сума суміжних кутів 180°.`, {
      angles: ['a_AOC', 'a_COD'],
    });
    b_.angle('C', 'O', 'D', { arcs: 2, text: `${fmt(180 - a / 2)}°` });
    b_.step('solution', 'Відповідь', `${angTxt('C', 'O', 'D')} = 180° − ${fmt(a / 2)}° = ${fmt(180 - a / 2)}°.`, { angles: ['a_COD'] });
  }

  if (task.kind === 'adjacent') {
    b_.angle('B', 'O', 'D', { arcs: 2 });
    b_.step('solution', `${angTxt('B', 'O', 'D')} суміжний з ${angTxt('A', 'O', 'B')}`, `Сторона ${lab('O')}${lab('B')} спільна, ${lab('O')}${lab('A')} і ${lab('O')}${lab('D')} — доповняльні промені, тому сума кутів 180°.`, {
      angles: ['a_AOB', 'a_BOD'],
    });
    b_.angle('B', 'O', 'D', { arcs: 2, text: `${fmt(180 - a)}°` });
    b_.step('solution', 'Відповідь', `${angTxt('B', 'O', 'D')} = 180° − ${fmt(a)}° = ${fmt(180 - a)}°.`, { angles: ['a_BOD'] });
  }
  return b_.steps;
}
