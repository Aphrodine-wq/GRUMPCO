/**
 * Syntax Highlighting Utility
 * Uses Shiki for VS Code-quality syntax highlighting
 */

import type { Highlighter } from 'shiki';
import { getHighlighter } from 'shiki';

let highlighter: Highlighter | null = null;

/**
 * Initialize the syntax highlighter
 * This should be called once on app startup
 */
export async function initHighlighter(): Promise<Highlighter> {
  if (highlighter) {
    return highlighter;
  }

  try {
    highlighter = await getHighlighter({
      themes: ['github-dark'],
      langs: [
        'typescript',
        'javascript',
        'python',
        'bash',
        'shell',
        'json',
        'yaml',
        'html',
        'css',
        'jsx',
        'tsx',
        'vue',
        'sql',
        'markdown',
        'plaintext',
      ],
    });

    return highlighter;
  } catch (error) {
    console.error('Failed to initialize highlighter:', error);
    throw error;
  }
}

/**
 * Get the initialized highlighter
 * Assumes initHighlighter has been called
 */
export function getHighlighterInstance(): Highlighter | null {
  return highlighter;
}

/**
 * Highlight code using Shiki
 */
export async function highlightCode(code: string, language: string = 'javascript'): Promise<string> {
  if (!highlighter) {
    await initHighlighter();
  }

  if (!highlighter) {
    // Fallback if highlighter failed to load
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }

  try {
    // Default to plaintext if language not supported
    const lang = language || 'plaintext';

    const html = highlighter.codeToHtml(code, {
      lang,
      theme: 'github-dark',
      transforms: {
        line(line) {
          return `<div class="shiki-line">${line.children}</div>`;
        },
      },
    });

    return html;
  } catch (error) {
    console.warn(`Failed to highlight code with language ${language}:`, error);
    // Fallback to unformatted code
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
}

/**
 * Escape HTML special characters
 */
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

/**
 * Get the list of supported languages
 */
export function getSupportedLanguages(): string[] {
  return [
    'typescript',
    'javascript',
    'python',
    'bash',
    'shell',
    'json',
    'yaml',
    'html',
    'css',
    'jsx',
    'tsx',
    'vue',
    'sql',
    'markdown',
    'plaintext',
  ];
}
