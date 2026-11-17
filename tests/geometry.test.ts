import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDrawing } from '../lib/geometry/check';
import { construction, parseGeometryProblem, PRESET_TASKS, solve, statement, validateTask } from '../lib/geometry/tasks';
import { angleAt } from '../lib/geometry/measure';
import type { Drawing } from '../lib/geometry/types';

const REF = PRESET_TASKS[0]; // ∠AOB = 136°, OC — бісектриса, OD протилежний OA

function refDrawing(transform: (p: { x: number; y: number }) => { x: number; y: number } = (p) => p, wrongRay = false): Drawing {
  const raw = { O: { x: 200, y: 220 }, A: { x: 350, y: 220 }, B: { x: 92, y: 116 }, C: { x: 256, y: 81 }, D: { x: 50, y: 220 } };
  const points = Object.entries(raw).map(([label, p]) => ({ id: label.toLowerCase(), label, ...transform(p) }));
  return {
    points,
    segments: [],
    rays: [
      { id: 'r1', from: 'o', through: 'a' },
      { id: 'r2', from: 'o', through: 'b' },
      { id: 'r3', from: 'o', through: 'c' },
      wrongRay ? { id: 'r4', from: 'd', through: 'o' } : { id: 'r4', from: 'o', through: 'd' },
    ],
    angles: [
      { id: 'm1', vertex: 'o', a: 'a', b: 'b', text: '136°', arcs: 1 },
      { id: 'm2', vertex: 'o', a: 'a', b: 'c', arcs: 2 },
      { id: 'm3', vertex: 'o', a: 'c', b: 'b', arcs: 2 },
    ],
  };
}

const mirror = (p: { x: number; y: number }) => ({ x: 400 - p.x, y: p.y });
const rotate = (deg: number) => (p: { x: number; y: number }) => {
  const r = (deg * Math.PI) / 180;
  const dx = p.x - 200;
  const dy = p.y - 220;
  return { x: 200 + dx * Math.cos(r) - dy * Math.sin(r), y: 220 + dx * Math.sin(r) + dy * Math.cos(r) };
};

test('еталон: розбір тексту задачі 136° / бісектриса / протилежний промінь', () => {
  const t = parseGeometryProblem('Кут AOB = 136°, OC — бісектриса кута AOB, OD — промінь, протилежний до променя OA. Знайдіть кут COD.');
  assert.ok(t);
  assert.equal(t!.kind, 'bisector_adjacent');
  assert.equal(t!.alpha, 136);
  assert.deepEqual(t!.labels, { A: 'A', O: 'O', B: 'B', C: 'C', D: 'D' });
  assert.equal(solve(t!).value, 112);
});

test('розбір: кириличні літери, інші позначення, трикутники, поза набором', () => {
  const t = parseGeometryProblem('∠МКР = 120°, KT — бісектриса. KN — промінь, доповняльний до KP. Знайдіть ∠TKN.');
  assert.equal(t?.kind, 'bisector_adjacent');
  assert.deepEqual(t?.labels, { A: 'P', O: 'K', B: 'M', C: 'T', D: 'N' });
  assert.equal(solve(t!).value, 120);
  const tri = parseGeometryProblem('У трикутнику ABC ∠A = 45°, ∠B = 65°. Сторону AC продовжено за точку C до точки D. Знайдіть кут BCD.');
  assert.equal(tri?.kind, 'triangle_exterior');
  assert.equal(solve(tri!).value, 110);
  const sum = parseGeometryProblem('У трикутнику MNK кут M = 50°, кут N = 60°. Знайдіть кут K.');
  assert.equal(sum?.kind, 'triangle_sum');
  assert.equal(solve(sum!).value, 70);
  assert.equal(parseGeometryProblem('Знайдіть площу кола радіуса 3 см'), null);
  assert.equal(validateTask({ kind: 'triangle_sum', alpha: 100, beta: 90 }), null);
});

test('покрокова побудова еталона узгоджена з поясненням відповіді 112°', () => {
  const steps = construction(REF);
  const titles = steps.map((s) => s.title);
  assert.match(titles[0], /∠AOB = 136°/);
  assert.match(titles[1], /бісектрису OC/);
  // Спочатку кут і бісектриса, потім пояснення 68°, далі суміжний COD
  const i68 = steps.findIndex((s) => /136° : 2 = 68°/.test(s.text));
  const iAdj = steps.findIndex((s) => /∠COD суміжний з ∠AOC/.test(s.title));
  const iAns = steps.findIndex((s) => /∠COD = 180° − 68° = 112°/.test(s.text));
  assert.ok(i68 > 1 && iAdj > i68 && iAns > iAdj);
  assert.deepEqual(steps[i68].highlight.angles, ['a_AOC', 'a_COB']);
  assert.deepEqual(steps[iAdj].highlight.angles, ['a_AOC', 'a_COD']);
  // На рисунку кожного кроку величини відповідають тексту
  const last = steps.at(-1)!;
  const P = (id: string) => last.drawing.points.find((p) => p.id === id)!;
  assert.ok(Math.abs(angleAt(P('O'), P('A'), P('B')) - 136) < 0.5);
  assert.ok(Math.abs(angleAt(P('O'), P('A'), P('C')) - 68) < 0.5);
  assert.ok(Math.abs(angleAt(P('O'), P('C'), P('D')) - 112) < 0.5);
  assert.equal(last.drawing.angles.find((a) => a.id === 'a_COD')?.text, '112°');
  // Усі точки в межах полотна
  for (const p of last.drawing.points) assert.ok(p.x >= 0 && p.x <= 400 && p.y >= 0 && p.y <= 320, JSON.stringify(p));
  // До спроби учня — лише кроки рисунка, без 68° і 112°
  const figure = steps.filter((s) => s.stage === 'figure');
  assert.ok(figure.every((s) => !/68°|112°/.test(s.text + JSON.stringify(s.drawing.angles))));
  assert.match(statement(REF), /Знайдіть ∠COD/);
});

test('побудова для трикутника вміщується в полотно й узгоджена з відповіддю', () => {
  const steps = construction(PRESET_TASKS[4]);
  const last = steps.at(-1)!;
  const P = (id: string) => last.drawing.points.find((p) => p.id === id)!;
  assert.ok(Math.abs(angleAt(P('C'), P('B'), P('D')) - 110) < 0.5);
  for (const p of last.drawing.points) assert.ok(p.x >= 0 && p.x <= 400 && p.y >= 0 && p.y <= 320);
});

test('перевірка рисунка: правильна, дзеркальна й повернута побудови приймаються', () => {
  for (const [name, tf] of [
    ['оригінал', (p: { x: number; y: number }) => p],
    ['дзеркальна', mirror],
    ['повернута 40°', rotate(40)],
    ['повернута 200°', rotate(200)],
  ] as const) {
    const r = checkDrawing(REF, refDrawing(tf));
    assert.equal(r.question, null, name);
    assert.equal(r.passed, true, `${name}: ${JSON.stringify(r.items.filter((i) => i.status !== 'ok'))}`);
    assert.ok(!r.items.some((i) => i.status === 'warning'), name);
  }
});

test('перевірка рисунка: неправильний напрямок променя OD', () => {
  const r = checkDrawing(REF, refDrawing(undefined, true));
  assert.equal(r.passed, false);
  assert.ok(r.items.some((i) => i.status === 'error' && /Промінь OD напрямлений неправильно/.test(i.text)));
});

test('перевірка рисунка: D на промені OA, а не на продовженні', () => {
  const d = refDrawing();
  d.points.find((p) => p.label === 'D')!.x = 300;
  const r = checkDrawing(REF, d);
  assert.ok(r.items.some((i) => i.status === 'error' && /лежить на промені OA/.test(i.text)));
});

test('перевірка рисунка: бісектриса не посередині та гострий кут замість тупого', () => {
  const d = refDrawing();
  Object.assign(d.points.find((p) => p.label === 'C')!, { x: 330, y: 150 });
  const r = checkDrawing(REF, d);
  assert.ok(r.items.some((i) => i.status === 'error' && /не ділить кут навпіл/.test(i.text)));
  const d2 = refDrawing();
  Object.assign(d2.points.find((p) => p.label === 'B')!, { x: 300, y: 100 });
  Object.assign(d2.points.find((p) => p.label === 'C')!, { x: 340, y: 170 });
  const r2 = checkDrawing(REF, d2);
  assert.ok(r2.items.some((i) => i.status === 'error' && /гострий/.test(i.text)));
});

test('перевірка рисунка: бракує підпису — одне конкретне запитання; позначення відокремлені від доведення', () => {
  const d = refDrawing();
  d.points.find((p) => p.label === 'D')!.label = '';
  const r = checkDrawing(REF, d);
  assert.match(r.question!, /не бачу точки D/);
  assert.equal(r.items.length, 0);

  const d2 = refDrawing();
  d2.angles = [];
  const r2 = checkDrawing(REF, d2);
  assert.equal(r2.passed, true, 'відсутні позначки — попередження, не помилка');
  assert.ok(r2.items.some((i) => i.kind === 'mark' && /однаковою кількістю дуг/.test(i.text)));
  assert.ok(r2.items.some((i) => i.kind === 'derived' && /не доводить/.test(i.text)));
});

test('точна побудова: допуск у градусах', () => {
  const exact = { ...REF, exact: true };
  assert.equal(checkDrawing(exact, refDrawing()).passed, true);
  const d = refDrawing();
  // ∠AOB ≈ 125° замість 136°
  const r = (125 * Math.PI) / 180;
  Object.assign(d.points.find((p) => p.label === 'B')!, { x: 200 + 150 * Math.cos(r), y: 220 - 150 * Math.sin(r) });
  const c = (62.5 * Math.PI) / 180;
  Object.assign(d.points.find((p) => p.label === 'C')!, { x: 200 + 150 * Math.cos(c), y: 220 - 150 * Math.sin(c) });
  const res = checkDrawing(exact, d);
  assert.ok(res.items.some((i) => i.status === 'error' && /має бути 136°/.test(i.text)));
  assert.equal(checkDrawing(REF, d).passed, true, 'для ескізу такий кут прийнятний');
});

test('продовження сторони відрізком приймається як ескіз (сторони), промінь-відрізок — попередження', () => {
  const d = refDrawing();
  d.rays = d.rays.filter((r) => r.id !== 'r4' && r.id !== 'r1');
  d.segments.push({ id: 's1', a: 'd', b: 'a' }); // одна лінія DA через O
  const r = checkDrawing(REF, d);
  assert.equal(r.passed, true, JSON.stringify(r.items.filter((i) => i.status === 'error')));
  assert.ok(r.items.some((i) => i.status === 'warning' && /Промінь OD намальовано відрізком/.test(i.text)));
});

test('зразок бісектриси 80°: вершина O, сторони OA й OB, бісектриса OC, дві дуги по 40°', () => {
  const task = PRESET_TASKS.find((p) => p.kind === 'angle_bisector')!;
  assert.equal(task.alpha, 80);
  const last = construction(task).at(-1)!;
  const d = last.drawing;
  const P = (id: string) => d.points.find((p) => p.id === id)!;
  assert.deepEqual(d.points.map((p) => p.label).sort(), ['A', 'B', 'C', 'O']);
  assert.deepEqual(d.rays.map((r) => `${P(r.from).label}${P(r.through).label}`).sort(), ['OA', 'OB', 'OC']);
  const marks = Object.fromEntries(d.angles.map((a) => [`${P(a.a).label}${P(a.vertex).label}${P(a.b).label}`, a]));
  assert.equal(marks.AOB.text, '80°');
  assert.equal(marks.AOC.text, '40°');
  assert.equal(marks.COB.text, '40°');
  assert.equal(marks.AOC.arcs, marks.COB.arcs, 'рівні кути — однакова кількість дуг');
  assert.ok(Math.abs(angleAt(P('O'), P('A'), P('C')) - 40) < 0.5 && Math.abs(angleAt(P('O'), P('C'), P('B')) - 40) < 0.5);
  assert.match(last.text, /∠AOC = ∠COB = 80° : 2 = 40°/);
  assert.deepEqual(last.highlight.angles, ['a_AOC', 'a_COB']);
});
