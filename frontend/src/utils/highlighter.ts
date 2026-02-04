/**
 * Syntax Highlighting Utility
 */

import type { Highlighter } from 'shiki';
import { createHighlighter } from 'shiki';

let highlighter: Highlighter | null = null;

export async function initHighlighter(): Promise<Highlighter> {
  if (highlighter) return highlighter;

  highlighter = await createHighlighter({
    themes: ['github-dark', 'github-light'],
    langs: [
      'javascript',
      'typescript',
      'html',
      'css',
      'json',
      'python',
      'rust',
      'bash',
      'sql',
      'markdown',
      'yaml',
      'svelte',
    ],
  });

  return highlighter;
}

export function getHighlighterInstance(): Highlighter | null {
  return highlighter;
}

export async function highlightCode(
  code: string,
  language: string = 'javascript'
): Promise<string> {
  const h = await initHighlighter();
  // Safe check if lang is loaded, else fallback to text/plain or just use it (shiki throws usually)
  const isLoaded = h.getLoadedLanguages().includes(language);
  const lang = isLoaded ? language : 'plaintext';

  return h.codeToHtml(code, {
    lang,
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
  });
}

export function getSupportedLanguages(): string[] {
  return [
    'javascript',
    'typescript',
    'html',
    'css',
    'json',
    'python',
    'rust',
    'bash',
    'sql',
    'markdown',
    'yaml',
    'svelte',
  ];
}
