<script lang="ts">
  /**
   * ToolResultCard - Professional light theme
   */
  import CodeDiffViewer from './CodeDiffViewer.svelte';
  import { Badge } from '../lib/design-system';
  import { colors } from '../lib/design-system/tokens/colors';
  import type { FileDiff } from '../types';

  interface Props {
    toolResult?: {
      type: 'tool_result';
      id: string;
      toolName: string;
      output: string;
      success: boolean;
      executionTime?: number;
      diff?: FileDiff;
    };
  }

  let { toolResult }: Props = $props();

  const isFileOperation = (toolName: string): boolean => {
    return toolName === 'file_write' || toolName === 'file_edit' || toolName === 'write_file' || toolName === 'edit_file';
  };
</script>

{#if toolResult}
  <div 
    class="tool-result-card" 
    class:is-error={!toolResult.success}
    style:--border-color={colors.border.default}
    style:--bg-header={colors.background.tertiary}
    style:--bg-content={colors.background.secondary}
    style:--text-primary={colors.text.primary}
    style:--text-secondary={colors.text.secondary}
    style:--success-color={colors.status.success}
    style:--error-color={colors.status.error}
  >
    <div class="tool-result-header">
      <div class="tool-info">
        <span class="result-icon">
          {#if toolResult.success}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          {/if}
        </span>
        <span class="tool-name">{toolResult.toolName}</span>
      </div>
      <div class="header-meta">
        {#if toolResult.executionTime != null}
          <span class="execution-time">{toolResult.executionTime}ms</span>
        {/if}
        <Badge variant={toolResult.success ? 'success' : 'error'} size="sm">
          {toolResult.success ? 'Success' : 'Error'}
        </Badge>
      </div>
    </div>

    <div class="tool-result-content">
      {#if toolResult.diff && isFileOperation(toolResult.toolName)}
        <div class="diff-viewer-wrapper">
          <CodeDiffViewer diff={toolResult.diff} />
        </div>
      {:else if toolResult.output}
        <div class="output-wrapper">
          <pre class="tool-output"><code>{toolResult.output}</code></pre>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .tool-result-card {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
    margin: 12px 0;
    background: var(--bg-content);
    font-family: inherit;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .tool-result-header {
    background-color: var(--bg-header);
    padding: 10px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border-color);
  }

  .tool-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .result-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tool-result-card:not(.is-error) .result-icon { color: var(--success-color); }
  .tool-result-card.is-error .result-icon { color: var(--error-color); }

  .tool-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .header-meta {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .execution-time {
    font-size: 12px;
    color: var(--text-secondary);
    opacity: 0.7;
  }

  .tool-result-content {
    max-height: 400px;
    overflow-y: auto;
  }

  .output-wrapper {
    padding: 12px 14px;
    background-color: #f9fafb;
  }

  .tool-output {
    margin: 0;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .diff-viewer-wrapper {
    padding: 0;
  }
</style>
