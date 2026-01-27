import { codeToHtml } from 'shiki';

export async function highlightCode(code: string, language: string = 'javascript'): Promise<string> {
  try {
    const html = await codeToHtml(code, {
      lang: language,
      theme: 'github-dark',
    });
    return html;
  } catch (error) {
    console.error('Failed to highlight code:', error);
    // Fallback to plain text
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
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
