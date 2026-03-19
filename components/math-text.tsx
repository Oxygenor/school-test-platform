'use client';

import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

export function MathText({ text }: { text: string }) {
  const parts = text.split(/(\$[^$]+\$)/g);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          try {
            return <InlineMath key={i} math={part.slice(1, -1)} />;
          } catch {
            return <span key={i}>{part}</span>;
          }
        }
        return (
          <span key={i} className="whitespace-pre-line">
            {part}
          </span>
        );
      })}
    </span>
  );
}
