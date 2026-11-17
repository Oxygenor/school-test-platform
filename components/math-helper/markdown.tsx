'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { fixMath } from '@/lib/math-helper/format';

export function MathMarkdown({ content }: { content: string }) {
  return (
    <div
      className="math-md prose prose-invert prose-sm max-w-none text-slate-100
      prose-p:my-1.5 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
      prose-headings:text-white prose-strong:text-white prose-blockquote:text-amber-100 prose-blockquote:border-amber-400
      prose-code:text-indigo-300 prose-code:bg-slate-700 prose-code:px-1 prose-code:rounded"
    >
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {fixMath(content)}
      </ReactMarkdown>
    </div>
  );
}
