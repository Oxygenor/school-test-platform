/**
 * Перевірки, які можна виконати кодом надійно (без моделі):
 *  - числове значення виразу;
 *  - підстановка коренів у рівняння з однією змінною;
 *  - повнота множини коренів для рівнянь, що зводяться до лінійного/квадратного.
 * Нічого поза цим не позначається як «перевірено кодом».
 */

type Node =
  | { t: 'num'; v: number }
  | { t: 'var' }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { t: 'fn'; name: 'sqrt' | 'abs'; a: Node };

/** Перетворює поширений LaTeX/шкільний запис у простий інфіксний. */
export function normalizeExpr(src: string): string {
  let s = src
    .replace(/\$/g, '')
    .replace(/\^\s*\{?\s*\\circ\s*\}?/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\,|\\;|\\!|\\ /g, '');
  // \frac{a}{b} -> ((a)/(b)) (кілька проходів для вкладених)
  for (let i = 0; i < 6; i++) {
    const next = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))');
    if (next === s) break;
    s = next;
  }
  s = s
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)')
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*([0-9a-zA-Z.,]+)/g, 'sqrt($1)')
    .replace(/\\cdot|\\times|×|·|∙/g, '*')
    .replace(/\\div|:|÷/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/\^\s*\{([^{}]*)\}/g, '^($1)')
    .replace(/[{}]/g, (c) => (c === '{' ? '(' : ')'))
    .replace(/°|\\circ/g, '')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/(\d),(\d)/g, '$1.$2');
  return s.trim();
}

class Parser {
  private i = 0;
  private toks: string[];
  constructor(src: string, private variable: string) {
    this.toks = tokenize(src, variable);
  }
  parse(): Node {
    const n = this.expr();
    if (this.i !== this.toks.length) throw new Error('trailing');
    return n;
  }
  private peek() {
    return this.toks[this.i];
  }
  private next() {
    return this.toks[this.i++];
  }
  private expr(): Node {
    let n = this.term();
    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.next() as '+' | '-';
      n = { t: 'bin', op, a: n, b: this.term() };
    }
    return n;
  }
  private term(): Node {
    let n = this.unary();
    for (;;) {
      const p = this.peek();
      if (p === '*' || p === '/') {
        this.next();
        n = { t: 'bin', op: p, a: n, b: this.unary() };
      } else if (p !== undefined && (p === '(' || p === 'x' || p === 'sqrt' || p === 'abs' || /^[0-9.]/.test(p))) {
        // неявне множення: 2x, 2(x+1), (x+1)(x-1)
        n = { t: 'bin', op: '*', a: n, b: this.unary() };
      } else return n;
    }
  }
  private unary(): Node {
    if (this.peek() === '-') {
      this.next();
      return { t: 'neg', a: this.unary() };
    }
    if (this.peek() === '+') {
      this.next();
      return this.unary();
    }
    return this.power();
  }
  private power(): Node {
    const base = this.atom();
    if (this.peek() === '^') {
      this.next();
      return { t: 'bin', op: '^', a: base, b: this.unary() };
    }
    return base;
  }
  private atom(): Node {
    const tk = this.next();
    if (tk === undefined) throw new Error('eof');
    if (tk === '(') {
      const n = this.expr();
      if (this.next() !== ')') throw new Error('paren');
      return n;
    }
    if (tk === '|') {
      const n = this.expr();
      if (this.next() !== '|') throw new Error('abs');
      return { t: 'fn', name: 'abs', a: n };
    }
    if (tk === 'sqrt' || tk === 'abs') {
      if (this.next() !== '(') throw new Error('fn');
      const n = this.expr();
      if (this.next() !== ')') throw new Error('paren');
      return { t: 'fn', name: tk, a: n };
    }
    if (tk === 'x') return { t: 'var' };
    if (/^[0-9]*\.?[0-9]+$|^[0-9]+\.$/.test(tk)) return { t: 'num', v: parseFloat(tk) };
    throw new Error('token');
  }
}

function tokenize(src: string, variable: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push(src.slice(i, j));
      i = j;
      continue;
    }
    if (src.startsWith('sqrt', i)) {
      out.push('sqrt');
      i += 4;
      continue;
    }
    if (src.startsWith('abs', i)) {
      out.push('abs');
      i += 3;
      continue;
    }
    if ('+-*/^()|'.includes(c)) {
      out.push(c);
      i++;
      continue;
    }
    if (c === variable) {
      out.push('x');
      i++;
      continue;
    }
    throw new Error(`unsupported char ${c}`);
  }
  if (out.length > 400) throw new Error('too long');
  return out;
}

function evalNode(n: Node, x: number): number {
  switch (n.t) {
    case 'num':
      return n.v;
    case 'var':
      return x;
    case 'neg':
      return -evalNode(n.a, x);
    case 'fn': {
      const a = evalNode(n.a, x);
      return n.name === 'sqrt' ? (a < 0 ? NaN : Math.sqrt(a)) : Math.abs(a);
    }
    case 'bin': {
      const a = evalNode(n.a, x);
      const b = evalNode(n.b, x);
      switch (n.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return b === 0 ? NaN : a / b;
        case '^':
          return Math.pow(a, b);
      }
    }
  }
}

export function compileExpr(src: string, variable = 'x'): ((x: number) => number) | null {
  try {
    const node = new Parser(normalizeExpr(src), variable).parse();
    return (x: number) => evalNode(node, x);
  } catch {
    return null;
  }
}

export function evaluateNumber(src: string): number | null {
  const f = compileExpr(src, '\u0000');
  if (!f) return null;
  const v = f(0);
  return Number.isFinite(v) ? v : null;
}

function close(a: number, b: number, rel = 1e-7): boolean {
  return Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
}

export function formatNumber(v: number): string {
  if (Number.isInteger(v)) return String(v);
  // спроба показати простим дробом
  for (let d = 2; d <= 60; d++) {
    const n = Math.round(v * d);
    if (Math.abs(n / d - v) < 1e-9) return `${n}/${d}`;
  }
  return String(Math.round(v * 1e6) / 1e6).replace('.', ',');
}

export type CheckStatus = 'confirmed' | 'refuted' | 'unsupported';

export interface VerificationItem {
  status: CheckStatus;
  text: string;
}

export interface EquationCheckInput {
  type: 'equation';
  equation: string;
  variable?: string;
  roots: string[];
  /** Модель стверджує, що це всі корені. */
  complete?: boolean;
}

export interface ValueCheckInput {
  type: 'value';
  expression: string;
  value: string;
}

export type CheckInput = EquationCheckInput | ValueCheckInput;

/** Повертає дійсні корені, якщо L−R є многочленом степеня ≤ 2 (або null). */
export function solvePolynomial(f: (x: number) => number): { roots: number[] | 'all' } | null {
  const xs = [0, 1, 2];
  const ys = xs.map(f);
  if (ys.some((y) => !Number.isFinite(y))) return null;
  const c = ys[0];
  const a = (ys[2] - 2 * ys[1] + ys[0]) / 2;
  const b = ys[1] - ys[0] - a;
  for (const t of [3, -1.5, 0.37, 7, -4.2]) {
    const y = f(t);
    const p = a * t * t + b * t + c;
    if (!Number.isFinite(y) || !close(y, p, 1e-6)) return null;
  }
  const eps = 1e-9;
  if (Math.abs(a) < eps) {
    if (Math.abs(b) < eps) return { roots: Math.abs(c) < eps ? 'all' : [] };
    return { roots: [-c / b] };
  }
  const D = b * b - 4 * a * c;
  if (D < -eps) return { roots: [] };
  if (Math.abs(D) <= eps) return { roots: [-b / (2 * a)] };
  const s = Math.sqrt(D);
  return { roots: [(-b - s) / (2 * a), (-b + s) / (2 * a)].sort((p, q) => p - q) };
}

function fmtVar(v: string) {
  return v || 'x';
}

export function runCheck(input: CheckInput): VerificationItem {
  if (input.type === 'value') {
    const left = evaluateNumber(input.expression);
    const right = evaluateNumber(input.value);
    if (left === null || right === null) return { status: 'unsupported', text: '' };
    if (close(left, right)) {
      return { status: 'confirmed', text: `${input.expression} = ${input.value}` };
    }
    return {
      status: 'refuted',
      text: `${input.expression} = ${formatNumber(left)}, а не ${input.value}`,
    };
  }

  const variable = fmtVar((input.variable || 'x').trim().slice(0, 1));
  const parts = input.equation.split('=');
  if (parts.length !== 2) return { status: 'unsupported', text: '' };
  const L = compileExpr(parts[0], variable);
  const R = compileExpr(parts[1], variable);
  if (!L || !R) return { status: 'unsupported', text: '' };
  const f = (x: number) => L(x) - R(x);

  const rootVals: { src: string; v: number }[] = [];
  for (const r of input.roots.slice(0, 6)) {
    const v = evaluateNumber(r);
    if (v === null) return { status: 'unsupported', text: '' };
    rootVals.push({ src: r, v });
  }

  for (const r of rootVals) {
    const l = L(r.v);
    const rr = R(r.v);
    if (!Number.isFinite(l) || !Number.isFinite(rr)) {
      return {
        status: 'refuted',
        text: `${variable} = ${r.src} не входить в ОДЗ рівняння ${input.equation}: вираз не має змісту.`,
      };
    }
    if (!close(l, rr, 1e-6)) {
      return {
        status: 'refuted',
        text: `Підстановка ${variable} = ${r.src} у ${input.equation}: ліва частина ${formatNumber(l)}, права ${formatNumber(rr)}.`,
      };
    }
  }

  const poly = solvePolynomial(f);
  if (poly && poly.roots !== 'all') {
    const all = poly.roots;
    const missing = all.filter((t) => !rootVals.some((r) => close(r.v, t, 1e-6)));
    if (input.complete !== false && missing.length > 0) {
      return {
        status: 'refuted',
        text: `Рівняння ${input.equation} має корені: ${all.map((t) => `${variable} = ${formatNumber(t)}`).join('; ')}. Пропущено: ${missing.map(formatNumber).join(', ')}.`,
      };
    }
    if (rootVals.length === 0 && all.length === 0) {
      return { status: 'confirmed', text: `Рівняння ${input.equation} не має дійсних коренів.` };
    }
    return {
      status: 'confirmed',
      text: `Підстановка й повний розв’язок: ${input.equation} ⇒ ${all.map((t) => `${variable} = ${formatNumber(t)}`).join('; ') || 'коренів немає'}.`,
    };
  }
  if (rootVals.length === 0) return { status: 'unsupported', text: '' };
  return {
    status: 'confirmed',
    text: `Підстановка ${rootVals.map((r) => `${variable} = ${r.src}`).join(', ')} у ${input.equation} дає правильну рівність.`,
  };
}

export function runChecks(inputs: unknown): VerificationItem[] {
  if (!Array.isArray(inputs)) return [];
  const out: VerificationItem[] = [];
  for (const raw of inputs.slice(0, 4)) {
    const c = sanitizeCheck(raw);
    if (!c) continue;
    const r = runCheck(c);
    if (r.status !== 'unsupported') out.push(r);
  }
  return out;
}

function str(v: unknown, max = 300): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= max ? v : null;
}

function sanitizeCheck(raw: unknown): CheckInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.type === 'value') {
    const expression = str(r.expression);
    const value = str(r.value ?? r.result);
    return expression && value ? { type: 'value', expression, value } : null;
  }
  if (r.type === 'equation') {
    const equation = str(r.equation);
    if (!equation || !Array.isArray(r.roots)) return null;
    const roots = r.roots.map((x) => (typeof x === 'number' ? String(x) : str(x, 60))).filter((x): x is string => !!x);
    return {
      type: 'equation',
      equation,
      variable: str(r.variable, 3) ?? 'x',
      roots,
      complete: typeof r.complete === 'boolean' ? r.complete : undefined,
    };
  }
  return null;
}
