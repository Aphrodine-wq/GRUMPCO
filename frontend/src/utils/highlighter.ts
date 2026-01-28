/**
 * Syntax Highlighting Utility
 * TEMPORARY DUMMY IMPLEMENTATION TO DEBUG RUNTIME ERROR
 */

import type { Highlighter } from 'shiki';
// import { createHighlighter } from 'shiki';

let highlighter: Highlighter | null = null;

export async function initHighlighter(): Promise<Highlighter> {
  return {} as Highlighter;
}

export function getHighlighterInstance(): Highlighter | null {
  return null;
}

export async function highlightCode(code: string, language: string = 'javascript'): Promise<string> {
  return `<pre><code>${escapeHtml(code)}</code></pre>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

export function getSupportedLanguages(): string[] {
  return ['plaintext'];
}


