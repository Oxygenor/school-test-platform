'use client';

import { MathText } from '@/components/math-text';

const SECTIONS = [
  {
    title: 'Основні правила',
    note: 'Все, що між знаками $…$, стає формулою. Можна поєднувати текст і формули.',
    rows: [
      { input: 'Знайди $x$, якщо $x + 5 = 10$', desc: 'текст + формула разом' },
      { input: '$2 + 2 = 4$',                    desc: 'проста формула' },
    ],
  },
  {
    title: 'Дроби',
    rows: [
      { input: '$\\frac{1}{2}$',       desc: 'половина' },
      { input: '$\\frac{a+b}{c}$',     desc: 'дріб із виразом' },
      { input: '$\\frac{2x}{3y}$',     desc: 'дріб із змінними' },
      { input: '$\\frac{4}{3}\\pi r^3$', desc: 'складений вираз' },
    ],
  },
  {
    title: 'Степені',
    rows: [
      { input: '$x^2$',      desc: 'квадрат' },
      { input: '$x^{10}$',   desc: 'степінь більше 9 — у дужки' },
      { input: '$a^{n+1}$',  desc: 'степінь — вираз' },
      { input: '$2^{32}$',   desc: 'числовий степінь' },
    ],
  },
  {
    title: 'Індекси (підрядкові)',
    rows: [
      { input: '$x_1$',       desc: 'перший елемент' },
      { input: '$x_{12}$',    desc: 'двозначний індекс — у дужки' },
      { input: '$a_n$',       desc: 'загальний елемент' },
      { input: '$x_1^2$',     desc: 'індекс і степінь разом' },
      { input: '$F_1$',       desc: 'сила 1' },
    ],
  },
  {
    title: 'Корені',
    rows: [
      { input: '$\\sqrt{x}$',      desc: 'квадратний корінь' },
      { input: '$\\sqrt{16}$',     desc: 'корінь із числа' },
      { input: '$\\sqrt{x+1}$',    desc: 'корінь із виразу' },
      { input: '$\\sqrt[3]{x}$',   desc: 'кубічний корінь' },
      { input: '$\\sqrt[n]{a}$',   desc: 'корінь n-го степеня' },
    ],
  },
  {
    title: 'Вектори (фізика)',
    rows: [
      { input: '$\\vec{F}$',    desc: 'вектор сили' },
      { input: '$\\vec{F}_1$',  desc: 'вектор сили з індексом' },
      { input: '$\\vec{v}$',    desc: 'вектор швидкості' },
      { input: '$\\vec{a}$',    desc: 'вектор прискорення' },
      { input: '$\\vec{AB}$',   desc: 'вектор відрізка' },
    ],
  },
  {
    title: 'Знаки порівняння',
    rows: [
      { input: '$a \\leq b$',   desc: 'менше або рівне' },
      { input: '$a \\geq b$',   desc: 'більше або рівне' },
      { input: '$a \\neq b$',   desc: 'не рівне' },
      { input: '$a \\approx b$',desc: 'приблизно рівне' },
    ],
  },
  {
    title: 'Арифметичні знаки',
    rows: [
      { input: '$a \\cdot b$',  desc: 'множення крапкою' },
      { input: '$a \\times b$', desc: 'множення хрестиком' },
      { input: '$a \\div b$',   desc: 'ділення' },
      { input: '$\\pm 5$',      desc: 'плюс-мінус' },
    ],
  },
  {
    title: 'Кути та градуси',
    rows: [
      { input: '$90^{\\circ}$',           desc: 'прямий кут' },
      { input: '$\\angle ABC = 45^{\\circ}$', desc: 'кут з позначенням' },
      { input: '$180^{\\circ}$',          desc: 'розгорнутий кут' },
    ],
  },
  {
    title: 'Грецькі літери',
    rows: [
      { input: '$\\pi$',      desc: 'пі ≈ 3.14' },
      { input: '$\\alpha$',   desc: 'альфа' },
      { input: '$\\beta$',    desc: 'бета' },
      { input: '$\\gamma$',   desc: 'гамма' },
      { input: '$\\Delta$',   desc: 'дельта (велика)' },
      { input: '$\\omega$',   desc: 'омега' },
      { input: '$\\lambda$',  desc: 'лямбда' },
      { input: '$\\mu$',      desc: 'мю' },
      { input: '$\\phi$',     desc: 'фі' },
    ],
  },
  {
    title: 'Інше',
    rows: [
      { input: '$\\infty$',     desc: 'нескінченність' },
      { input: '$\\%$',         desc: 'відсоток у формулі' },
      { input: '$n!$',          desc: 'факторіал' },
      { input: '$|x|$',         desc: 'модуль числа' },
      { input: '$\\log_2 x$',   desc: 'логарифм за основою 2' },
      { input: '$\\lg x$',      desc: 'десятковий логарифм' },
      { input: '$\\sin x$',     desc: 'синус' },
      { input: '$\\cos x$',     desc: 'косинус' },
      { input: '$\\tan x$',     desc: 'тангенс' },
    ],
  },
  {
    title: 'Приклади завдань',
    rows: [
      { input: 'Площа кола: $S = \\pi r^2$',                              desc: '' },
      { input: 'Обєм кулі: $V = \\frac{4}{3}\\pi r^3$',                  desc: '' },
      { input: 'Рівняння: $2x^2 - 5x + 3 = 0$',                          desc: '' },
      { input: 'Піфагор: $c = \\sqrt{a^2 + b^2}$',                        desc: '' },
      { input: 'Якщо $a \\leq b$ і $b \\leq c$, то $a \\leq c$',         desc: '' },
      { input: '$\\vec{F}_1 = 10$ Н, $\\vec{F}_2 = 5$ Н',                desc: '' },
      { input: '$\\frac{x^2 - 1}{x + 1}$ при $x = 3$',                   desc: '' },
    ],
  },
];

export default function MathGuidePage() {
  return (
    <div className="math-guide-page">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .math-guide-page { padding: 15mm 20mm; font-family: serif; }
          table { page-break-inside: avoid; }
          h2 { page-break-after: avoid; }
        }
        @media screen {
          .math-guide-page { max-width: 860px; margin: 0 auto; padding: 40px 24px; font-family: sans-serif; }
        }
      `}</style>

      {/* Шапка */}
      <div className="no-print mb-6 flex gap-3">
        <button
          onClick={() => window.print()}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm text-white hover:bg-slate-700"
        >
          Друкувати / Зберегти PDF
        </button>
        <button
          onClick={() => window.history.back()}
          className="rounded-xl border border-slate-300 px-5 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Назад
        </button>
      </div>

      <div className="mb-8 border-b-2 border-black pb-4">
        <h1 className="text-2xl font-bold">Довідник формул</h1>
        <p className="mt-1 text-sm text-slate-500">
          Формули вводяться між знаками <code className="rounded bg-slate-100 px-1">{'$…$'}</code>.
          Наприклад: <code className="rounded bg-slate-100 px-1">{'$\\frac{1}{2}$'}</code>
        </p>
      </div>

      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="mb-2 text-base font-bold uppercase tracking-wide text-slate-700 border-b border-slate-200 pb-1">
              {section.title}
            </h2>
            {section.note && (
              <p className="mb-2 text-sm italic text-slate-500">{section.note}</p>
            )}
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="border border-slate-200 px-3 py-2 w-5/12">Що вводити</th>
                  <th className="border border-slate-200 px-3 py-2 w-4/12">Результат</th>
                  <th className="border border-slate-200 px-3 py-2 w-3/12 no-print">Пояснення</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="border border-slate-200 px-3 py-2 font-mono text-xs text-slate-600">
                      {row.input}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      <MathText text={row.input} />
                    </td>
                    <td className="border border-slate-200 px-3 py-2 text-xs text-slate-400 no-print">
                      {row.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-400">
        Платформа використовує KaTeX — підтримуються всі стандартні LaTeX-команди.
      </div>
    </div>
  );
}
