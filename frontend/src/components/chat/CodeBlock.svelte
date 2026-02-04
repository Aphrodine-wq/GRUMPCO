<script lang="ts">
  /**
   * CodeBlock Component
   *
   * Renders code snippets with:
   * - Syntax highlighting (future: Prism/Shiki)
   * - Copy button
   * - Language label
   * - Line numbers (optional)
   */
  import { Tooltip } from '../../lib/design-system';
  import { showToast } from '../../stores/toastStore';

  interface Props {
    /** The code content */
    code: string;
    /** Programming language for syntax highlighting */
    language?: string;
    /** Show line numbers */
    showLineNumbers?: boolean;
    /** Max height before scroll */
    maxHeight?: string;
    /** Filename to display */
    filename?: string;
  }

  let {
    code,
    language = '',
    showLineNumbers = false,
    maxHeight = '400px',
    filename = '',
  }: Props = $props();

  let copied = $state(false);

  // Language display names
  const languageLabels: Record<string, string> = {
    js: 'JavaScript',
    javascript: 'JavaScript',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    tsx: 'TypeScript React',
    jsx: 'JavaScript React',
    py: 'Python',
    python: 'Python',
    rust: 'Rust',
    go: 'Go',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
    cs: 'C#',
    csharp: 'C#',
    rb: 'Ruby',
    ruby: 'Ruby',
    php: 'PHP',
    swift: 'Swift',
    kotlin: 'Kotlin',
    sql: 'SQL',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    sass: 'Sass',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    xml: 'XML',
    md: 'Markdown',
    markdown: 'Markdown',
    bash: 'Bash',
    shell: 'Shell',
    sh: 'Shell',
    dockerfile: 'Dockerfile',
    docker: 'Docker',
    svelte: 'Svelte',
    vue: 'Vue',
  };

  const displayLanguage = $derived(
    languageLabels[language.toLowerCase()] || language.toUpperCase() || 'Code'
  );

  const lines = $derived(code.split('\n'));

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      copied = true;
      showToast('Copied to clipboard', 'success', 2000);
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch {
      showToast('Failed to copy', 'error');
    }
  }
</script>

<div class="code-block" style:--max-height={maxHeight}>
  <!-- Header -->
  <div class="code-header">
    <div class="code-info">
      <span class="language-badge">{displayLanguage}</span>
      {#if filename}
        <span class="filename">{filename}</span>
      {/if}
    </div>

    <Tooltip content={copied ? 'Copied!' : 'Copy code'} position="top">
      <button
        type="button"
        class="copy-btn"
        class:copied
        onclick={handleCopy}
        aria-label="Copy code"
      >
        {#if copied}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        {:else}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        {/if}
      </button>
    </Tooltip>
  </div>

  <!-- Code content -->
  <div class="code-content">
    <pre class="code-pre"><code class="code-text" class:with-numbers={showLineNumbers}
        >{#if showLineNumbers}{#each lines as line, i}<span class="line"
              ><span class="line-number">{i + 1}</span><span class="line-content">{line}</span
              ></span
            >
          {/each}{:else}{code}{/if}</code
      ></pre>
  </div>
</div>

<style>
  .code-block {
    background: #1e1e2e;
    border-radius: 0.75rem;
    overflow: hidden;
    font-family: 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.8125rem;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .code-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .language-badge {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    background: rgba(124, 58, 237, 0.2);
    color: #a78bfa;
    border-radius: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .filename {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.375rem;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s;
  }

  .copy-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
    color: #e5e7eb;
  }

  .copy-btn.copied {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
    color: #10b981;
  }

  .code-content {
    max-height: var(--max-height);
    overflow: auto;
  }

  .code-pre {
    margin: 0;
    padding: 1rem;
    overflow-x: auto;
  }

  .code-text {
    color: #e4e4e7;
    line-height: 1.6;
    white-space: pre;
    display: block;
  }

  .code-text.with-numbers {
    display: flex;
    flex-direction: column;
    counter-reset: line;
  }

  .line {
    display: flex;
    min-height: 1.6em;
  }

  .line-number {
    flex-shrink: 0;
    width: 2.5rem;
    padding-right: 1rem;
    text-align: right;
    color: #4b5563;
    user-select: none;
  }

  .line-content {
    flex: 1;
  }

  /* Scrollbar styling */
  .code-content::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .code-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .code-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  .code-content::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  /* Hover effect for lines */
  .line:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  @media (prefers-reduced-motion: reduce) {
    .copy-btn {
      transition: none;
    }
  }
</style>
