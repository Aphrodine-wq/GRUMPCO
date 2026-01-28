<script lang="ts">
  import { onMount } from 'svelte';
  import { highlightCode } from '../utils/highlighter';
  import { showToast } from '../stores/toastStore';

  interface Props {
    code: string;
    language?: string;
    fileName?: string;
  }

  let {
    code = $bindable(''),
    language = $bindable('javascript'),
    fileName = $bindable(undefined)
  }: Props = $props();

  let highlightedCode = $state('');
  let isCollapsed = $state(false);
  let showLineNumbers = $state(true);
  const lineCount = $derived(code.split('\n').length);

  async function loadCode() {
    try {
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

  <div class="code-block">
  <div class="code-header">
    <div class="code-header-left">
      <span class="header-icon">⏺</span>
      {#if fileName}
        <span class="file-name">{fileName}</span>
      {/if}
      <span class="language-label">{language}</span>
      {#if lineCount > 20}
        <span class="line-count">{lineCount} lines</span>
      {/if}
    </div>
    <div class="code-actions">
      {#if lineCount > 20}
        <button
          on:click={() => (showLineNumbers = !showLineNumbers)}
          class="action-btn"
          title="Toggle line numbers"
        >
          #
        </button>
      {/if}
      <button on:click={copyCode} class="action-btn copy-btn" title="Copy code">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="0" ry="0"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
      {#if lineCount > 50}
        <button
          on:click={() => (isCollapsed = !isCollapsed)}
          class="action-btn"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? '▶' : '▼'}
        </button>
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
      <div class="code-content" class:with-line-numbers={showLineNumbers} bind:innerHTML={highlightedCode}></div>
    </div>
  {:else}
    <div class="collapsed-placeholder">
      <span>// Code collapsed ({lineCount} lines)</span>
      <button on:click={() => (isCollapsed = false)} class="expand-btn">EXPAND</button>
    </div>
  {/if}
</div>

<style>
  .code-block {
    background: #000;
    border: 1px solid #333;
    border-radius: 0;
    overflow: hidden;
    margin: 1rem 0;
    font-family: 'JetBrains Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 13px;
    line-height: 1.5;
  }

  .code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.625rem 0.875rem;
    background: #0A0A0A;
    border-bottom: 1px solid #222;
    font-size: 12px;
  }

  .code-header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .header-icon {
    color: #00E5FF;
    font-size: 0.7rem;
  }

  .file-name {
    color: #D4D4D4;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .language-label {
    color: #00E5FF;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.05em;
    padding: 0.15rem 0.4rem;
    background: rgba(0, 229, 255, 0.1);
    border: 1px solid #00E5FF;
  }

  .line-count {
    color: #444;
    font-size: 10px;
  }

  .code-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .action-btn {
    background: transparent;
    border: 1px solid #333;
    color: #525252;
    cursor: pointer;
    padding: 0.35rem;
    transition: all 0.1s;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #00E5FF;
    border-color: #00E5FF;
  }

  .action-btn svg {
    width: 14px;
    height: 14px;
  }

  .code-container {
    display: flex;
    overflow-x: auto;
    background: #000;
  }

  .line-numbers {
    background: #0A0A0A;
    border-right: 1px solid #222;
    padding: 1rem 0.75rem;
    color: #333;
    font-size: 12px;
    text-align: right;
    user-select: none;
    min-width: 50px;
    flex-shrink: 0;
    line-height: 1.5;
  }

  .line-number {
    height: 20px;
    line-height: 20px;
    padding-right: 0.5rem;
  }

  .code-content {
    padding: 1rem;
    overflow-x: auto;
    color: #D4D4D4;
    flex: 1;
    min-width: 0;
  }

  .code-content.with-line-numbers {
    padding-left: 0.75rem;
  }

  .code-content :global(pre) {
    margin: 0;
    padding: 0;
    background: transparent;
  }

  .code-content :global(code) {
    font-family: inherit;
    font-size: inherit;
  }

  .code-content :global(.shiki-line) {
    display: block;
    min-height: 20px;
    line-height: 20px;
  }

  .collapsed-placeholder {
    padding: 2rem;
    text-align: center;
    color: #444;
    font-size: 0.875rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    background: #0A0A0A;
  }

  .expand-btn {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid #333;
    color: #666;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: all 0.1s;
  }

  .expand-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: #00FF41;
    color: #00FF41;
  }
</style>
