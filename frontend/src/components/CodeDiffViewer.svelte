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
                    bind:this={(el) => setLineRef(el, idx)}
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
                    bind:this={(el) => setLineRef(el, idx)}
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
                bind:this={(el) => setLineRef(el, idx)}
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
  .diff-viewer {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    overflow: hidden;
    margin: 1rem 0;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New',
      monospace;
    font-size: 13px;
    line-height: 1.5;
  }

  .diff-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #161b22;
    border-bottom: 1px solid #30363d;
  }

  .diff-header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .file-path {
    color: #c9d1d9;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .change-badge {
    padding: 0.2rem 0.5rem;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .change-badge.created {
    background: #238636;
    color: #fff;
  }

  .change-badge.modified {
    background: #fb8500;
    color: #fff;
  }

  .change-badge.deleted {
    background: #da3633;
    color: #fff;
  }

  .diff-summary {
    color: #8b949e;
    font-size: 12px;
  }

  .diff-header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .view-toggle {
    display: flex;
    gap: 0.25rem;
    background: #21262d;
    border-radius: 4px;
    padding: 0.25rem;
  }

  .toggle-btn {
    padding: 0.35rem 0.75rem;
    border: none;
    background: transparent;
    color: #8b949e;
    cursor: pointer;
    border-radius: 3px;
    font-size: 12px;
    font-family: inherit;
    transition: all 0.15s;
  }

  .toggle-btn:hover {
    background: #30363d;
    color: #c9d1d9;
  }

  .toggle-btn.active {
    background: #0066ff;
    color: #fff;
  }

  .collapse-btn {
    padding: 0.35rem 0.5rem;
    border: none;
    background: transparent;
    color: #8b949e;
    cursor: pointer;
    font-size: 12px;
    border-radius: 3px;
    transition: all 0.15s;
  }

  .collapse-btn:hover {
    background: #30363d;
    color: #c9d1d9;
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
    border-right: 1px solid #30363d;
  }

  .diff-pane:last-child {
    border-right: none;
  }

  .pane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: #161b22;
    border-bottom: 1px solid #30363d;
  }

  .pane-label {
    color: #8b949e;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .copy-btn {
    background: transparent;
    border: none;
    color: #8b949e;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 14px;
    transition: all 0.15s;
  }

  .copy-btn:hover {
    background: #30363d;
    color: #c9d1d9;
  }

  .code-container {
    display: flex;
    overflow-x: auto;
    background: #0d1117;
  }

  .line-numbers {
    background: #161b22;
    border-right: 1px solid #30363d;
    padding: 0.5rem 0.75rem;
    color: #6e7681;
    font-size: 12px;
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
    background: rgba(35, 134, 54, 0.2);
    color: #3fb950;
  }

  .line-number.removed {
    background: rgba(218, 54, 51, 0.2);
    color: #f85149;
  }

  .line-number.empty {
    opacity: 0.3;
  }

  .code-content {
    flex: 1;
    padding: 0.5rem 0.75rem;
    overflow-x: auto;
    color: #c9d1d9;
  }

  .code-line {
    padding: 0 0.5rem;
    height: 20px;
    line-height: 20px;
    white-space: pre;
    overflow-x: auto;
  }

  .code-line.added {
    background: rgba(35, 134, 54, 0.15);
    border-left: 2px solid #3fb950;
    padding-left: calc(0.5rem - 2px);
  }

  .code-line.removed {
    background: rgba(218, 54, 51, 0.15);
    border-left: 2px solid #f85149;
    padding-left: calc(0.5rem - 2px);
  }

  .code-line.unchanged {
    color: #c9d1d9;
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
    border: 1px solid #30363d;
    background: #21262d;
    color: #c9d1d9;
    cursor: pointer;
    border-radius: 3px;
    font-size: 11px;
    font-family: inherit;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .action-btn:hover {
    background: #30363d;
    border-color: #0066ff;
    color: #fff;
  }

  .jump-nav {
    background: #161b22;
    border-bottom: 1px solid #30363d;
    max-height: 200px;
    overflow-y: auto;
  }

  .jump-nav-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #30363d;
  }

  .jump-nav-title {
    color: #c9d1d9;
    font-size: 12px;
    font-weight: 600;
  }

  .jump-nav-hint {
    color: #6e7681;
    font-size: 11px;
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
    border: 1px solid transparent;
    border-radius: 3px;
    color: #c9d1d9;
    cursor: pointer;
    font-size: 12px;
    text-align: left;
    transition: all 0.15s;
  }

  .jump-nav-item:hover {
    background: #21262d;
    border-color: #30363d;
  }

  .jump-nav-item.active {
    background: rgba(0, 102, 255, 0.2);
    border-color: #0066ff;
  }

  .jump-nav-type {
    width: 20px;
    text-align: center;
    font-weight: 600;
  }

  .jump-nav-type.added {
    color: #3fb950;
  }

  .jump-nav-type.removed {
    color: #f85149;
  }

  .jump-nav-line {
    flex: 1;
  }

  .code-line.highlight-change {
    animation: highlight-pulse 2s ease-out;
  }

  @keyframes highlight-pulse {
    0% {
      background: rgba(0, 102, 255, 0.3);
      box-shadow: 0 0 0 0 rgba(0, 102, 255, 0.5);
    }
    50% {
      background: rgba(0, 102, 255, 0.2);
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
      background: rgba(35, 134, 54, 0.4);
      box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.5);
    }
    50% {
      background: rgba(35, 134, 54, 0.25);
      box-shadow: 0 0 0 4px rgba(63, 185, 80, 0);
    }
    100% {
      background: rgba(35, 134, 54, 0.15);
      box-shadow: 0 0 0 0 rgba(63, 185, 80, 0);
    }
  }

  .code-line.removed.highlight-change {
    animation: highlight-pulse-removed 2s ease-out;
  }

  @keyframes highlight-pulse-removed {
    0% {
      background: rgba(218, 54, 51, 0.4);
      box-shadow: 0 0 0 0 rgba(248, 81, 73, 0.5);
    }
    50% {
      background: rgba(218, 54, 51, 0.25);
      box-shadow: 0 0 0 4px rgba(248, 81, 73, 0);
    }
    100% {
      background: rgba(218, 54, 51, 0.15);
      box-shadow: 0 0 0 0 rgba(248, 81, 73, 0);
    }
  }
</style>
