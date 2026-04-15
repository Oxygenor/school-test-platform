'use client';

import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

export function MathText({ text }: { text: string }) {
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$]+\$)/g);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
          try {
            return <BlockMath key={i} math={part.slice(2, -2)} />;
          } catch {
            return <span key={i}>{part}</span>;
          }
        }
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
