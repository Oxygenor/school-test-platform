import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateNumber, runCheck, runChecks } from '../lib/math-helper/verify';
import { splitMeta, collectText } from '../lib/math-helper/model';
import { fixMath } from '../lib/math-helper/format';

test('обчислювач: дроби, степені, LaTeX, кути', () => {
  assert.equal(evaluateNumber('3/8 + 1/4'), 0.625);
  assert.equal(evaluateNumber('\\frac{3}{8}+\\frac{1}{4}'), 0.625);
  assert.equal(evaluateNumber('180^\\circ - 68^\\circ'), 112);
  assert.equal(evaluateNumber('2^{3}·5'), 40);
  assert.equal(evaluateNumber('√16 + 2(3-1)'), 8);
  assert.equal(evaluateNumber('1,5 : 0,5'), 3);
  assert.equal(evaluateNumber('process.exit()'), null);
});

test('підстановка кореня і повнота множини коренів', () => {
  assert.equal(runCheck({ type: 'equation', equation: '2x+3=7', roots: ['2'] }).status, 'confirmed');
  assert.equal(runCheck({ type: 'equation', equation: '2x+3=7', roots: ['3'] }).status, 'refuted');
  const missing = runCheck({ type: 'equation', equation: 'x^2-5x+6=0', roots: ['2'], complete: true });
  assert.equal(missing.status, 'refuted');
  assert.match(missing.text, /Пропущено: 3/);
  assert.equal(runCheck({ type: 'equation', equation: 'x^2 = 9', roots: ['3', '-3'] }).status, 'confirmed');
  assert.equal(runCheck({ type: 'equation', equation: 'x^2 + 1 = 0', roots: [] }).status, 'confirmed');
  const odz = runCheck({ type: 'equation', equation: '1/(x-2) = 1/(x-2)', roots: ['2'] });
  assert.equal(odz.status, 'refuted');
  assert.match(odz.text, /ОДЗ/);
  // раціональне рівняння: підстановка працює, повнота — ні (не позначаємо як повну)
  const rat = runCheck({ type: 'equation', equation: '6/x = 3', roots: ['2'] });
  assert.equal(rat.status, 'confirmed');
  assert.doesNotMatch(rat.text, /повний/);
  assert.equal(runCheck({ type: 'value', expression: '180-136/2', value: '112' }).status, 'confirmed');
  assert.equal(runCheck({ type: 'value', expression: 'sin(30)', value: '0.5' }).status, 'unsupported');
  assert.equal(runChecks([{ type: 'value', expression: 'sin(30)', value: '0.5' }, 'junk', null]).length, 0, 'непідтримуване не позначається');
});

test('службовий рядок: розбір, обрізання, пошкоджений JSON', () => {
  const a = splitMeta('Текст\n<meta>{"exercise":"x+1=2","new_exercise":true,"attempt":true,"quiz_correct":false,"construction":{"kind":"adjacent","alpha":50,"labels":{"A":"A","O":"O","B":"B","D":"D"}}}</meta>');
  assert.equal(a.text, 'Текст');
  assert.equal(a.meta.newExercise, true);
  assert.equal(a.meta.quizCorrect, false);
  assert.equal(a.meta.construction?.kind, 'adjacent');
  assert.equal(a.meta.construction?.source, 'student');
  assert.equal(splitMeta('Текст <meta>{"exer').text, 'Текст');
  assert.equal(splitMeta('Текст <meta>{bad}</meta>').meta.attempt, false);
  assert.equal(splitMeta('Без meta').text, 'Без meta');
  assert.equal(splitMeta('X <meta>{"construction":{"kind":"bogus"}}</meta>').meta.construction, null);
});

test('збір тексту: усі text-блоки по порядку, thinking пропускається', () => {
  assert.equal(
    collectText([
      { type: 'thinking' },
      { type: 'text', text: 'а' },
      { type: 'redacted_thinking' },
      { type: 'text', text: 'б' },
    ]),
    'аб',
  );
});

test('формули: $$ на окремих рядках, \\[ \\] і \\( \\) перетворюються', () => {
  assert.equal(fixMath('Маємо $$x^2$$ далі'), 'Маємо \n$$\nx^2\n$$\n далі');
  assert.equal(fixMath('\\(\\frac{3}{8}\\)'), '$\\frac{3}{8}$');
  assert.equal(fixMath('`$a$`'), '$a$');
});
