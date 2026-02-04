<script lang="ts">
  /**
   * CodeBlock - Professional light theme
   */
  import { highlightCode } from '../utils/highlighter';
  import { showToast } from '../stores/toastStore';
  import { colors } from '../lib/design-system/tokens/colors';
  import { Badge, Button } from '../lib/design-system';

  interface Props {
    code: string;
    language?: string;
    fileName?: string;
  }

  let {
    code = $bindable(''),
    language = $bindable('javascript'),
    fileName = $bindable(undefined),
  }: Props = $props();

  let highlightedCode = $state('');
  let isCollapsed = $state(false);
  let showLineNumbers = $state(true);
  const lineCount = $derived(code.split('\n').length);

  async function loadCode() {
    try {
      // We pass the colors to the highlighter if needed, or rely on its theme
      const html = await highlightCode(code, language);
      highlightedCode = html;
    } catch (error) {
      console.error('Failed to highlight code:', error);
      highlightedCode = `<pre><code>${escapeHtml(code)}</code></pre>`;
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      showToast('Code copied to clipboard', 'success');
    } catch (error) {
      console.error('Failed to copy code:', error);
      showToast('Failed to copy code', 'error');
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

  $effect(() => {
    loadCode();
  });
</script>

<div
  class="code-block"
  style:--bg-header={colors.background.tertiary}
  style:--bg-content={colors.background.code}
  style:--border-color={colors.border.default}
  style:--text-primary={colors.text.primary}
  style:--text-muted={colors.text.muted}
  style:--accent-color={colors.accent.primary}
>
  <div class="code-header">
    <div class="code-header-left">
      {#if fileName}
        <span class="file-name">{fileName}</span>
      {/if}
      <Badge variant="info" size="sm">{language}</Badge>
      {#if lineCount > 10}
        <span class="line-count">{lineCount} lines</span>
      {/if}
    </div>
    <div class="code-actions">
      <Button variant="ghost" size="sm" onclick={copyCode} title="Copy code">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </Button>
      {#if lineCount > 30}
        <Button
          variant="ghost"
          size="sm"
          onclick={() => (isCollapsed = !isCollapsed)}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            style:transform={isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)'}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </Button>
      {/if}
    </div>
  </div>

  {#if !isCollapsed}
    <div class="code-container">
      {#if showLineNumbers}
        <div class="line-numbers">
          {#each Array(lineCount) as _, i}
            <div class="line-number">{i + 1}</div>
          {/each}
        </div>
      {/if}
      <div class="code-content" class:with-line-numbers={showLineNumbers}>
        {@html highlightedCode}
      </div>
    </div>
  {:else}
    <div
      class="collapsed-placeholder"
      role="button"
      tabindex="0"
      onclick={() => (isCollapsed = false)}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          isCollapsed = false;
        }
      }}
    >
      <span class="collapsed-text">Code collapsed ({lineCount} lines)</span>
      <Button variant="secondary" size="sm">Expand</Button>
    </div>
  {/if}
</div>

<style>
  .code-block {
    background-color: var(--bg-content);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
    margin: 16px 0;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 13px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background-color: var(--bg-header);
    border-bottom: 1px solid var(--border-color);
  }

  .code-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .file-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .line-count {
    font-size: 11px;
    color: var(--text-muted);
  }

  .code-actions {
    display: flex;
    gap: 4px;
  }

  .code-container {
    display: flex;
    overflow-x: auto;
    background-color: #fff;
  }

  .line-numbers {
    background-color: #f9fafb;
    border-right: 1px solid var(--border-color);
    padding: 16px 10px;
    color: #9ca3af;
    text-align: right;
    user-select: none;
    min-width: 44px;
    line-height: 1.5;
  }

  .line-number {
    height: 1.5em;
  }

  .code-content {
    padding: 16px;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    color: var(--text-primary);
    line-height: 1.5;
  }

  .code-content :global(pre) {
    margin: 0;
    padding: 0;
    background: transparent !important;
  }

  .code-content :global(code) {
    font-family: inherit;
    background: transparent;
    padding: 0;
  }

  .collapsed-placeholder {
    padding: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    cursor: pointer;
    background-color: #f9fafb;
    transition: background-color 150ms;
  }

  .collapsed-placeholder:hover {
    background-color: #f3f4f6;
  }

  .collapsed-text {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
  }
</style>
