<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { computeLineDiff, formatDiffSummary, detectLanguage, type FileDiff } from '../utils/diffUtils';
  import { highlightCode } from '../utils/highlighter';
  import { showToast } from '../stores/toastStore';

  interface Props {
    diff: FileDiff;
  }

  let { diff }: Props = $props();

  let viewMode: 'side-by-side' | 'unified' = $state('side-by-side');
  let diffLines = $state(computeLineDiff(diff.beforeContent, diff.afterContent));
  let beforeHighlighted = $state('');
  let afterHighlighted = $state('');
  let isCollapsed = $state(false);
  let language = $state(detectLanguage(diff.filePath));
  let summary = $state(formatDiffSummary(diff));
  let changeLocations = $state<Array<{ index: number; lineNumber: number; type: 'added' | 'removed' }>>([]);
  let currentChangeIndex = $state(0);
  let lineRefs: Record<number, HTMLElement> = $state({});
  let jumpNavVisible = $state(false);

  async function loadHighlights() {
    try {
      beforeHighlighted = await highlightCode(diff.beforeContent, language);
      afterHighlighted = await highlightCode(diff.afterContent, language);
    } catch (error) {
      console.error('Failed to highlight code:', error);
      beforeHighlighted = `<pre><code>${escapeHtml(diff.beforeContent)}</code></pre>`;
      afterHighlighted = `<pre><code>${escapeHtml(diff.afterContent)}</code></pre>`;
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

  async function copyBefore() {
    try {
      await navigator.clipboard.writeText(diff.beforeContent);
      showToast('Before content copied', 'success');
    } catch (error) {
      showToast('Failed to copy', 'error');
    }
  }

  async function copyAfter() {
    try {
      await navigator.clipboard.writeText(diff.afterContent);
      showToast('After content copied', 'success');
    } catch (error) {
      showToast('Failed to copy', 'error');
    }
  }

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
  }

  // Find all change locations
  function findChangeLocations() {
    const changes: Array<{ index: number; lineNumber: number; type: 'added' | 'removed' }> = [];
    diffLines.forEach((line, index) => {
      if (line.type === 'added' || line.type === 'removed') {
        changes.push({
          index,
          lineNumber: line.newLineNumber || line.oldLineNumber || 0,
          type: line.type,
        });
      }
    });
    changeLocations = changes;
    if (changes.length > 0) {
      jumpNavVisible = true;
    }
  }

  // Generate unified diff patch format
  function generatePatch(): string {
    let patch = `--- a/${diff.filePath}\n+++ b/${diff.filePath}\n`;
    let oldLine = 1;
    let newLine = 1;
    
    diffLines.forEach(line => {
      if (line.type === 'removed') {
        patch += `-${line.content}\n`;
        oldLine++;
      } else if (line.type === 'added') {
        patch += `+${line.content}\n`;
        newLine++;
      } else {
        patch += ` ${line.content}\n`;
        oldLine++;
        newLine++;
      }
    });
    
    return patch;
  }

  // Quick actions
  async function acceptAllChanges() {
    try {
      await navigator.clipboard.writeText(diff.afterContent);
      showToast('All changes accepted (copied to clipboard)', 'success');
    } catch (error) {
      showToast('Failed to accept changes', 'error');
    }
  }

  async function rejectAllChanges() {
    try {
      await navigator.clipboard.writeText(diff.beforeContent);
      showToast('All changes rejected (original copied to clipboard)', 'info');
    } catch (error) {
      showToast('Failed to reject changes', 'error');
    }
  }

  async function copyPatch() {
    try {
      const patch = generatePatch();
      await navigator.clipboard.writeText(patch);
      showToast('Diff patch copied to clipboard', 'success');
    } catch (error) {
      showToast('Failed to copy patch', 'error');
    }
  }

  async function exportUnifiedDiff() {
    try {
      const patch = generatePatch();
      const blob = new Blob([patch], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${diff.filePath.replace(/[^a-z0-9]/gi, '_')}.patch`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Unified diff exported', 'success');
    } catch (error) {
      showToast('Failed to export diff', 'error');
    }
  }

  // Jump to changes navigation
  function jumpToChange(index: number) {
    if (index < 0 || index >= changeLocations.length) return;
    currentChangeIndex = index;
    const change = changeLocations[index];
    const element = lineRefs[change.index];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight briefly
      element.classList.add('highlight-change');
      setTimeout(() => {
        element.classList.remove('highlight-change');
      }, 2000);
    }
  }

  function jumpToNextChange() {
    if (currentChangeIndex < changeLocations.length - 1) {
      jumpToChange(currentChangeIndex + 1);
    }
  }

  function jumpToPreviousChange() {
    if (currentChangeIndex > 0) {
      jumpToChange(currentChangeIndex - 1);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    // Only handle if diff viewer is focused or visible
    if (isCollapsed) return;
    
    // J/K for navigation (when not typing in input)
    if (event.target === document.body || (event.target as HTMLElement).closest('.diff-viewer')) {
      if (event.key === 'j' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        jumpToNextChange();
      } else if (event.key === 'k' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        jumpToPreviousChange();
      }
    }
  }

  function setLineRef(el: HTMLElement | null, index: number) {
    if (el) {
      lineRefs[index] = el;
    }
  }

  function setupLineRef(el: HTMLElement, index: number) {
    setLineRef(el, index);
    return {
      update(newIndex: number) {
        setLineRef(el, newIndex);
      }
    };
  }

  onMount(() => {
    loadHighlights();
    findChangeLocations();
    document.addEventListener('keydown', handleKeydown);
    
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<div class="diff-viewer">
  <div class="diff-header">
    <div class="diff-header-left">
      <span class="file-path">{diff.filePath}</span>
      <span class="change-badge" class:created={diff.changeType === 'created'} class:modified={diff.changeType === 'modified'} class:deleted={diff.changeType === 'deleted'}>
        {diff.changeType}
      </span>
      <span class="diff-summary">{summary}</span>
    </div>
    <div class="diff-header-right">
      <div class="quick-actions">
        <button class="action-btn" on:click={acceptAllChanges} title="Accept all changes">
          ✓ Accept All
        </button>
        <button class="action-btn" on:click={rejectAllChanges} title="Reject all changes">
          ✗ Reject All
        </button>
        <button class="action-btn" on:click={copyPatch} title="Copy as patch">
          📋 Copy Patch
        </button>
        <button class="action-btn" on:click={exportUnifiedDiff} title="Export unified diff">
          💾 Export
        </button>
      </div>
      <div class="view-toggle">
        <button
          class="toggle-btn"
          class:active={viewMode === 'side-by-side'}
          on:click={() => (viewMode = 'side-by-side')}
        >
          Side-by-side
        </button>
        <button
          class="toggle-btn"
          class:active={viewMode === 'unified'}
          on:click={() => (viewMode = 'unified')}
        >
          Unified
        </button>
      </div>
      <button class="collapse-btn" on:click={toggleCollapse}>
        {isCollapsed ? '▶' : '▼'}
      </button>
    </div>
  </div>

  {#if jumpNavVisible && changeLocations.length > 0 && !isCollapsed}
    <div class="jump-nav">
      <div class="jump-nav-header">
        <span class="jump-nav-title">Changes ({changeLocations.length})</span>
        <span class="jump-nav-hint">Press J/K to navigate</span>
      </div>
      <div class="jump-nav-list">
        {#each changeLocations as change, idx (idx)}
          <button
            class="jump-nav-item"
            class:active={idx === currentChangeIndex}
            on:click={() => jumpToChange(idx)}
            title="Line {change.lineNumber}"
          >
            <span class="jump-nav-type" class:added={change.type === 'added'} class:removed={change.type === 'removed'}>
              {change.type === 'added' ? '+' : '-'}
            </span>
            <span class="jump-nav-line">Line {change.lineNumber}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if !isCollapsed}
    {#if viewMode === 'side-by-side'}
      <div class="diff-content side-by-side">
        <div class="diff-pane before-pane">
          <div class="pane-header">
            <span class="pane-label">Before</span>
            <button class="copy-btn" on:click={copyBefore} title="Copy before content">
              📋
            </button>
          </div>
          <div class="code-container">
            <div class="line-numbers">
              {#each diffLines as line, idx (idx)}
                {#if line.type === 'removed' || line.type === 'unchanged'}
                  <div class="line-number" class:removed={line.type === 'removed'}>
                    {line.oldLineNumber || ''}
                  </div>
                {:else}
                  <div class="line-number empty"></div>
                {/if}
              {/each}
            </div>
            <div class="code-content before-content">
              {#each diffLines as line, idx (idx)}
                {#if line.type === 'removed' || line.type === 'unchanged'}
                  <div 
                    use:setupLineRef={idx}
                    class="code-line" 
                    class:removed={line.type === 'removed'} 
                    class:unchanged={line.type === 'unchanged'}
                    class:highlight-change={changeLocations.find(c => c.index === idx && idx === currentChangeIndex)}
                  >
                    {line.content}
                  </div>
                {:else}
                  <div class="code-line empty"></div>
                {/if}
              {/each}
            </div>
          </div>
        </div>
        <div class="diff-pane after-pane">
          <div class="pane-header">
            <span class="pane-label">After</span>
            <button class="copy-btn" on:click={copyAfter} title="Copy after content">
              📋
            </button>
          </div>
          <div class="code-container">
            <div class="line-numbers">
              {#each diffLines as line, idx (idx)}
                {#if line.type === 'added' || line.type === 'unchanged'}
                  <div class="line-number" class:added={line.type === 'added'}>
                    {line.newLineNumber || ''}
                  </div>
                {:else}
                  <div class="line-number empty"></div>
                {/if}
              {/each}
            </div>
            <div class="code-content after-content">
              {#each diffLines as line, idx (idx)}
                {#if line.type === 'added' || line.type === 'unchanged'}
                  <div 
                    use:setupLineRef={idx}
                    class="code-line" 
                    class:added={line.type === 'added'} 
                    class:unchanged={line.type === 'unchanged'}
                    class:highlight-change={changeLocations.find(c => c.index === idx && idx === currentChangeIndex)}
                  >
                    {line.content}
                  </div>
                {:else}
                  <div class="code-line empty"></div>
                {/if}
              {/each}
            </div>
          </div>
        </div>
      </div>
    {:else}
      <div class="diff-content unified">
        <div class="pane-header">
          <span class="pane-label">Unified Diff</span>
          <button class="copy-btn" on:click={copyAfter} title="Copy after content">
            📋
          </button>
        </div>
        <div class="code-container">
          <div class="line-numbers">
            {#each diffLines as line, idx (idx)}
              <div
                class="line-number"
                class:added={line.type === 'added'}
                class:removed={line.type === 'removed'}
              >
                {line.oldLineNumber && line.newLineNumber
                  ? `${line.oldLineNumber}:${line.newLineNumber}`
                  : line.oldLineNumber
                    ? `${line.oldLineNumber}:`
                    : line.newLineNumber
                      ? `:${line.newLineNumber}`
                      : ''}
              </div>
            {/each}
          </div>
          <div class="code-content unified-content">
            {#each diffLines as line, idx (idx)}
              <div
                use:setupLineRef={idx}
                class="code-line"
                class:added={line.type === 'added'}
                class:removed={line.type === 'removed'}
                class:unchanged={line.type === 'unchanged'}
                class:highlight-change={changeLocations.find(c => c.index === idx && idx === currentChangeIndex)}
              >
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                {line.content}
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* Light Theme CodeDiffViewer - Using Design System Tokens */
  .diff-viewer {
    background: white;
    border: 0;
    border-radius: 8px;
    overflow: hidden;
    margin: 8px 0;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: var(--font-size-sm, 0.8rem);
    line-height: var(--line-height-code, 1.6);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .diff-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: white;
    border-bottom: 1px solid #F0F0F0;
  }

  .diff-header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .file-path {
    color: var(--color-text-primary, #000000);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .change-badge {
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-sm, 0.25rem);
    font-size: var(--font-size-xs, 0.7rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .change-badge.created {
    background: var(--color-status-success, #059669);
    color: var(--color-text-inverse, #FFFFFF);
  }

  .change-badge.modified {
    background: var(--color-status-warning, #F59E0B);
    color: var(--color-text-inverse, #FFFFFF);
  }

  .change-badge.deleted {
    background: var(--color-status-error, #DC2626);
    color: var(--color-text-inverse, #FFFFFF);
  }

  .diff-summary {
    color: var(--color-text-muted, #9CA3AF);
    font-size: var(--font-size-xs, 0.7rem);
  }

  .diff-header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .view-toggle {
    display: flex;
    gap: 0.25rem;
    background: #F5F5F5;
    border-radius: 6px;
    padding: 0.25rem;
  }

  .toggle-btn {
    padding: 0.35rem 0.75rem;
    border: none;
    background: transparent;
    color: #3f3f46;
    cursor: pointer;
    border-radius: 4px;
    font-size: var(--font-size-xs, 0.7rem);
    font-family: inherit;
    transition: all 150ms ease;
  }

  .toggle-btn:hover {
    background: #EBEBEB;
    color: #18181b;
  }

  .toggle-btn.active {
    background: #0EA5E9;
    color: white;
  }

  .collapse-btn {
    padding: 0.35rem 0.5rem;
    border: none;
    background: transparent;
    color: var(--color-text-muted, #9CA3AF);
    cursor: pointer;
    font-size: var(--font-size-xs, 0.7rem);
    border-radius: var(--radius-sm, 0.25rem);
    transition: var(--transition-fast, 150ms ease-out);
  }

  .collapse-btn:hover {
    background: var(--color-bg-tertiary, #EBEBEB);
    color: var(--color-text-primary, #000000);
  }

  .diff-content {
    display: flex;
    overflow-x: auto;
  }

  .diff-content.side-by-side {
    flex-direction: row;
  }

  .diff-content.unified {
    flex-direction: column;
  }

  .diff-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #F0F0F0;
  }

  .diff-pane:last-child {
    border-right: none;
  }

  .pane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #F9F9F9;
    border-bottom: 1px solid #F0F0F0;
  }

  .pane-label {
    color: var(--color-text-secondary, #4B5563);
    font-size: var(--font-size-xs, 0.7rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .copy-btn {
    background: transparent;
    border: none;
    color: var(--color-text-muted, #9CA3AF);
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm, 0.25rem);
    font-size: 14px;
    transition: var(--transition-fast, 150ms ease-out);
  }

  .copy-btn:hover {
    background: var(--color-bg-tertiary, #EBEBEB);
    color: var(--color-text-primary, #000000);
  }

  .code-container {
    display: flex;
    overflow-x: auto;
    background: var(--color-bg-secondary, #FFFFFF);
  }

  .line-numbers {
    background: #F9F9F9;
    border-right: 1px solid #F0F0F0;
    padding: 0.5rem 0.75rem;
    color: #A1A1AA;
    font-size: var(--font-size-xs, 0.7rem);
    text-align: right;
    user-select: none;
    min-width: 60px;
    flex-shrink: 0;
  }

  .line-number {
    padding: 0 0.5rem;
    height: 20px;
    line-height: 20px;
  }

  .line-number.added {
    background: var(--color-diff-added-bg, #DCFCE7);
    color: var(--color-diff-added-text, #166534);
  }

  .line-number.removed {
    background: var(--color-diff-removed-bg, #FEE2E2);
    color: var(--color-diff-removed-text, #991B1B);
  }

  .line-number.empty {
    opacity: 0.3;
  }

  .code-content {
    flex: 1;
    padding: 0.5rem 0.75rem;
    overflow-x: auto;
    color: var(--color-text-code, #1F2937);
  }

  .code-line {
    padding: 0 0.5rem;
    height: 20px;
    line-height: 20px;
    white-space: pre;
    overflow-x: auto;
  }

  .code-line.added {
    background: var(--color-diff-added-bg, #DCFCE7);
    border-left: 2px solid var(--color-diff-added-border, #86EFAC);
    padding-left: calc(0.5rem - 2px);
    color: var(--color-diff-added-text, #166534);
  }

  .code-line.removed {
    background: var(--color-diff-removed-bg, #FEE2E2);
    border-left: 2px solid var(--color-diff-removed-border, #FCA5A5);
    padding-left: calc(0.5rem - 2px);
    color: var(--color-diff-removed-text, #991B1B);
  }

  .code-line.unchanged {
    color: var(--color-diff-unchanged-text, #374151);
  }

  .code-line.empty {
    height: 20px;
    background: transparent;
  }

  .unified-content .code-line {
    padding-left: 1rem;
  }

  .quick-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .action-btn {
    padding: 0.35rem 0.75rem;
    border: 0;
    background: white;
    color: #18181b;
    cursor: pointer;
    border-radius: 6px;
    font-size: var(--font-size-xs, 0.7rem);
    font-family: inherit;
    transition: all 150ms ease;
    white-space: nowrap;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .action-btn:hover {
    background: #F5F5F5;
    color: #0EA5E9;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .jump-nav {
    background: #F9F9F9;
    border-bottom: 1px solid #F0F0F0;
    max-height: 200px;
    overflow-y: auto;
  }

  .jump-nav-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    border-bottom: 1px solid #F0F0F0;
  }

  .jump-nav-title {
    color: var(--color-text-primary, #000000);
    font-size: var(--font-size-xs, 0.7rem);
    font-weight: 600;
  }

  .jump-nav-hint {
    color: var(--color-text-muted, #9CA3AF);
    font-size: var(--font-size-xs, 0.7rem);
  }

  .jump-nav-list {
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .jump-nav-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: transparent;
    border: 0;
    border-radius: 4px;
    color: #18181b;
    cursor: pointer;
    font-size: var(--font-size-xs, 0.7rem);
    text-align: left;
    transition: all 150ms ease;
  }

  .jump-nav-item:hover {
    background: #F0F0F0;
  }

  .jump-nav-item.active {
    background: #E0F2FE;
    border: 0;
  }

  .jump-nav-type {
    width: 20px;
    text-align: center;
    font-weight: 600;
  }

  .jump-nav-type.added {
    color: var(--color-status-success, #059669);
  }

  .jump-nav-type.removed {
    color: var(--color-status-error, #DC2626);
  }

  .jump-nav-line {
    flex: 1;
  }

  .code-line.highlight-change {
    animation: highlight-pulse 2s ease-out;
  }

  @keyframes highlight-pulse {
    0% {
      background: var(--color-accent-primary-light, rgba(0, 102, 255, 0.2));
      box-shadow: 0 0 0 0 rgba(0, 102, 255, 0.4);
    }
    50% {
      background: var(--color-accent-primary-light, rgba(0, 102, 255, 0.15));
      box-shadow: 0 0 0 4px rgba(0, 102, 255, 0);
    }
    100% {
      background: transparent;
      box-shadow: 0 0 0 0 rgba(0, 102, 255, 0);
    }
  }

  .code-line.added.highlight-change {
    animation: highlight-pulse-added 2s ease-out;
  }

  @keyframes highlight-pulse-added {
    0% {
      background: rgba(5, 150, 105, 0.3);
      box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.4);
    }
    50% {
      background: rgba(5, 150, 105, 0.2);
      box-shadow: 0 0 0 4px rgba(5, 150, 105, 0);
    }
    100% {
      background: var(--color-diff-added-bg, #DCFCE7);
      box-shadow: 0 0 0 0 rgba(5, 150, 105, 0);
    }
  }

  .code-line.removed.highlight-change {
    animation: highlight-pulse-removed 2s ease-out;
  }

  @keyframes highlight-pulse-removed {
    0% {
      background: rgba(220, 38, 38, 0.3);
      box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4);
    }
    50% {
      background: rgba(220, 38, 38, 0.2);
      box-shadow: 0 0 0 4px rgba(220, 38, 38, 0);
    }
    100% {
      background: var(--color-diff-removed-bg, #FEE2E2);
      box-shadow: 0 0 0 0 rgba(220, 38, 38, 0);
    }
  }
</style>
