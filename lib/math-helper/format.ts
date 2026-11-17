/** Прибирає зворотні лапки навколо формул і ставить $$ на окремі рядки (вимога remark-math). */
export function fixMath(content: string): string {
  return content
    .replace(/`(\$\$[\s\S]+?\$\$)`/g, '$1')
    .replace(/`(\$[^`\n]+?\$)`/g, '$1')
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => `\n$$\n${m}\n$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m: string) => `$${m}$`)
    .replace(/([^\n])\$\$/g, (_, c: string) => `${c}\n$$`)
    .replace(/\$\$([^\n])/g, (_, c: string) => `$$\n${c}`);
}
