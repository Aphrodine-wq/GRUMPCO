/**
 * Syntax Highlighting Utility - Optimized for lazy loading
 */

import type { Highlighter } from 'shiki';

let highlighter: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

const SUPPORTED_LANGUAGES = [
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

/**
 * Initialize the highlighter lazily - only loads shiki when first needed
 */
export async function initHighlighter(): Promise<Highlighter> {
  if (highlighter) return highlighter;

  // Prevent multiple concurrent initialization attempts
  if (highlighterPromise) return highlighterPromise;

  highlighterPromise = (async () => {
    // Dynamically import shiki only when needed
    const { createHighlighter } = await import('shiki');

    highlighter = await createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: SUPPORTED_LANGUAGES,
    });

    return highlighter;
  })();

  return highlighterPromise;
}

export function getHighlighterInstance(): Highlighter | null {
  return highlighter;
}

/**
 * Highlight code with automatic language detection fallback
 */
export async function highlightCode(
  code: string,
  language: string = 'javascript'
): Promise<string> {
  const h = await initHighlighter();

  // Safe check if lang is loaded, else fallback to text/plain
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
  return [...SUPPORTED_LANGUAGES];
}
