import { angleAt, coverage, normLabel, pointsByLabel } from './measure';
import { L, solve, type GeometryTask } from './tasks';
import type { Drawing, GPoint } from './types';

export type ItemKind = 'element' | 'given' | 'mark' | 'derived';

export interface CheckItem {
  status: 'ok' | 'error' | 'warning' | 'info';
  kind: ItemKind;
  text: string;
}

export interface DrawingCheckResult {
  /** Немає помилок у потрібних елементах і зв’язках. */
  passed: boolean;
  items: CheckItem[];
  /** Одне конкретне уточнювальне запитання, якщо бракує підписів. */
  question: string | null;
}

const TOL = {
  sketch: { bisector: 12, straight: 8, given: 0 },
  exact: { bisector: 3, straight: 2, given: 3 },
};

const r0 = (n: number) => Math.round(n);

/**
 * Перевіряє рисунок учня для підтримуваної задачі. Повертає лише однозначні результати.
 * Повернуті й дзеркальні рисунки приймаються: усі перевірки спираються на величини кутів
 * і належність точок, а не на орієнтацію.
 */
export function checkDrawing(task: GeometryTask, d: Drawing): DrawingCheckResult {
  const items: CheckItem[] = [];
  const byLabel = pointsByLabel(d);
  const tol = task.exact ? TOL.exact : TOL.sketch;
  const lab = (role: string) => L(task, role);

  // 1) Підписи точок: бракує — одне конкретне запитання
  const roles = Object.keys(task.labels);
  const get = (role: string): GPoint | null => (byLabel.get(normLabel(lab(role))) || [])[0] ?? null;
  for (const role of roles) {
    const found = byLabel.get(normLabel(lab(role))) || [];
    if (found.length > 1) {
      return { passed: false, items, question: `На рисунку дві точки з підписом ${lab(role)}. Яку з них ти мав на увазі? Перейменуй іншу інструментом «Підпис».` };
    }
  }
  const missing = roles.filter((r) => !get(r));
  if (missing.length > 0) {
    const r = missing[0];
    const hint = missingHint(task, r);
    return {
      passed: false,
      items,
      question: d.points.length === 0 ? 'Рисунок поки порожній. Почни з вершини: постав точку і підпиши її.' : `Я не бачу точки ${lab(r)}. ${hint}`,
    };
  }
  const P = (role: string) => get(role)!;

  // 2) Елементи та напрямки
  const side = (v: string, p: string, name: string, mustBeRay: boolean) => {
    const c = coverage(d, P(v), P(p));
    const nm = `${lab(v)}${lab(p)}`;
    if (c === 'ray') items.push({ status: 'ok', kind: 'element', text: `${name} ${nm} є.` });
    else if (c === 'segment') {
      items.push(
        mustBeRay
          ? { status: 'warning', kind: 'element', text: `${name} ${nm} намальовано відрізком. Для променя скористайся інструментом «Промінь» з початком у точці ${lab(v)}.` }
          : { status: 'ok', kind: 'element', text: `${name} ${nm} є.` },
      );
    } else if (c === 'reversed') {
      items.push({ status: 'error', kind: 'element', text: `Промінь ${nm} напрямлений неправильно: він має починатися в точці ${lab(v)} і йти через ${lab(p)}, а в тебе починається в ${lab(p)}.` });
    } else {
      items.push({ status: 'error', kind: 'element', text: `Немає ${name === 'Сторона' ? 'сторони' : 'променя'} ${nm}: проведи його з точки ${lab(v)} через ${lab(p)}.` });
    }
  };

  const angleVal = (a: string, v: string, b: string) => angleAt(P(v), P(a), P(b));

  const checkGiven = (a: string, v: string, b: string, value: number) => {
    const m = angleVal(a, v, b);
    const name = `∠${lab(a)}${lab(v)}${lab(b)}`;
    if (task.exact) {
      if (Math.abs(m - value) <= tol.given) items.push({ status: 'ok', kind: 'given', text: `${name} ≈ ${r0(m)}° — у межах допуску від ${value}°.` });
      else items.push({ status: 'error', kind: 'given', text: `${name} має бути ${value}°, а на рисунку ≈ ${r0(m)}°. Побудуй його точніше транспортиром.` });
      return;
    }
    const cls = (x: number) => (x < 85 ? 'гострий' : x <= 95 ? 'прямий' : 'тупий');
    if (cls(m) === cls(value)) items.push({ status: 'ok', kind: 'given', text: `${name} на ескізі ${cls(m)}, як і за умовою (${value}°). Точну величину на ескізі не вимірюємо — вона дана в умові.` });
    else items.push({ status: 'error', kind: 'given', text: `За умовою ${name} = ${value}° (${cls(value)}), а на рисунку він ${cls(m)} (≈${r0(m)}°). Ескіз має передавати умову.` });
  };

  const findMark = (a: string, v: string, b: string) =>
    d.angles.find((m) => {
      if (m.vertex !== P(v).id) return false;
      const pa = d.points.find((p) => p.id === m.a)!;
      const pb = d.points.find((p) => p.id === m.b)!;
      const same = (x: GPoint, y: GPoint) => x.id === y.id || angleAt(P(v), x, y) < 4;
      return (same(pa, P(a)) && same(pb, P(b))) || (same(pa, P(b)) && same(pb, P(a)));
    });

  const markGiven = (a: string, v: string, b: string, value: number) => {
    const m = findMark(a, v, b);
    const name = `∠${lab(a)}${lab(v)}${lab(b)}`;
    if (!m) {
      items.push({ status: 'warning', kind: 'mark', text: `Познач ${name} і підпиши ${value}° — це дано в умові.` });
      return;
    }
    const n = parseFloat((m.text || '').replace(',', '.'));
    if (m.text && Number.isFinite(n) && Math.abs(n - value) > 0.01) {
      items.push({ status: 'warning', kind: 'mark', text: `Біля ${name} підписано «${m.text}», а за умовою ${value}°.` });
    } else items.push({ status: 'ok', kind: 'mark', text: `${name} позначено.` });
  };

  const markEqual = (a: string, v: string, c: string, b: string) => {
    const m1 = findMark(a, v, c);
    const m2 = findMark(c, v, b);
    const n1 = `∠${lab(a)}${lab(v)}${lab(c)}`;
    const n2 = `∠${lab(c)}${lab(v)}${lab(b)}`;
    const equal = m1 && m2 && (((m1.arcs ?? 0) > 0 && m1.arcs === m2.arcs) || (!!m1.text && m1.text === m2.text));
    if (equal) items.push({ status: 'ok', kind: 'mark', text: `${n1} і ${n2} позначені як рівні.` });
    else items.push({ status: 'warning', kind: 'mark', text: `Познач ${n1} і ${n2} однаковою кількістю дуг: їх рівність дана в умові (бісектриса).` });
  };

  const bisector = (a: string, v: string, b: string, c: string) => {
    const avc = angleVal(a, v, c);
    const cvb = angleVal(c, v, b);
    const avb = angleVal(a, v, b);
    const nm = `${lab(v)}${lab(c)}`;
    if (Math.abs(avc + cvb - avb) > 4) {
      items.push({ status: 'error', kind: 'element', text: `Бісектриса ${nm} має лежати всередині ∠${lab(a)}${lab(v)}${lab(b)}, а зараз вона поза кутом.` });
      return;
    }
    if (Math.abs(avc - cvb) <= tol.bisector) {
      items.push({ status: 'ok', kind: 'element', text: `${nm} лежить усередині кута й ділить його ${task.exact ? 'навпіл у межах допуску' : 'приблизно навпіл'}.` });
    } else {
      items.push({ status: 'error', kind: 'element', text: `${nm} помітно не ділить кут навпіл (≈${r0(avc)}° і ≈${r0(cvb)}°). Перетягни точку ${lab(c)}, щоб кути виглядали рівними.` });
    }
  };

  const straight = (a: string, v: string, dd: string, what: string) => {
    const m = angleVal(a, v, dd);
    if (Math.abs(m - 180) <= tol.straight) {
      items.push({ status: 'ok', kind: 'element', text: `${what}: ${lab(a)}, ${lab(v)}, ${lab(dd)} на одній прямій, ${lab(v)} між ${lab(a)} і ${lab(dd)}.` });
    } else if (m < 30) {
      items.push({ status: 'error', kind: 'element', text: `Точка ${lab(dd)} лежить на промені ${lab(v)}${lab(a)}, а має бути на продовженні за точку ${lab(v)} — з іншого боку від ${lab(v)}.` });
    } else {
      items.push({ status: 'error', kind: 'element', text: `${what}: ${lab(a)}, ${lab(v)}, ${lab(dd)} мають лежати на одній прямій (кут 180°), а зараз ∠${lab(a)}${lab(v)}${lab(dd)} ≈ ${r0(m)}°.` });
    }
  };

  const ans = solve(task);
  switch (task.kind) {
    case 'angle_bisector':
    case 'bisector_adjacent':
    case 'adjacent': {
      side('O', 'A', 'Сторона', false);
      side('O', 'B', 'Сторона', false);
      checkGiven('A', 'O', 'B', task.alpha);
      if (task.kind !== 'adjacent') {
        side('O', 'C', 'Промінь', true);
        bisector('A', 'O', 'B', 'C');
      }
      if (task.kind !== 'angle_bisector') {
        side('O', 'D', 'Промінь', true);
        straight('A', 'O', 'D', `Продовження ${lab('O')}${lab('A')}`);
      }
      markGiven('A', 'O', 'B', task.alpha);
      if (task.kind !== 'adjacent') markEqual('A', 'O', 'C', 'B');
      break;
    }
    case 'triangle_sum':
    case 'triangle_exterior': {
      side('A', 'B', 'Сторона', false);
      side('B', 'C', 'Сторона', false);
      side('A', 'C', 'Сторона', false);
      checkGiven('C', 'A', 'B', task.alpha);
      checkGiven('A', 'B', 'C', task.beta ?? 0);
      if (task.kind === 'triangle_exterior') {
        side('C', 'D', 'Промінь', true);
        straight('A', 'C', 'D', `Продовження ${lab('A')}${lab('C')}`);
      }
      markGiven('C', 'A', 'B', task.alpha);
      markGiven('A', 'B', 'C', task.beta ?? 0);
      break;
    }
  }

  items.push({
    status: 'info',
    kind: 'derived',
    text: `${ans.name} треба знайти міркуванням і обчисленням. Вигляд рисунка не доводить рівність кутів чи належність прямій — це беремо з умови або доводимо.`,
  });

  return { passed: !items.some((i) => i.status === 'error'), items, question: null };
}

function missingHint(task: GeometryTask, role: string): string {
  const l = (r: string) => L(task, r);
  if (task.kind.startsWith('triangle')) {
    if (role === 'D') return `Постав точку на продовженні сторони ${l('A')}${l('C')} за точку ${l('C')} і підпиши її ${l('D')}.`;
    return `Підпиши вершину трикутника буквою ${l(role)} (інструмент «Підпис»).`;
  }
  switch (role) {
    case 'O':
      return `Підпиши вершину кута буквою ${l('O')}.`;
    case 'C':
      return `Де бісектриса? Постав на ній точку й підпиши ${l('C')}.`;
    case 'D':
      return `Постав точку на продовженні сторони ${l('O')}${l('A')} за точку ${l('O')} і підпиши її ${l('D')}.`;
    default:
      return `Підпиши точку на стороні кута буквою ${l(role)}.`;
  }
}
