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
    return (
      toolName === 'file_write' ||
      toolName === 'file_edit' ||
      toolName === 'write_file' ||
      toolName === 'edit_file'
    );
  };

  const getFilePath = (): string | null => {
    if (!toolResult) return null;
    if (toolResult.diff?.filePath) return toolResult.diff.filePath;
    const match = toolResult.output?.match(/:\s*([^\n\r]+)$/m);
    return match?.[1]?.trim() || null;
  };

  const getFileActionLabel = (): string => {
    const type = toolResult?.diff?.changeType;
    if (type === 'created') return 'Created';
    if (type === 'modified') return 'Updated';
    if (type === 'deleted') return 'Deleted';
    return 'Changed';
  };

  const filePath = $derived(getFilePath());
  const fileAction = $derived(getFileActionLabel());
</script>

{#if toolResult}
  <div
    class="tool-result-card"
    class:is-error={!toolResult.success}
    class:file-result={isFileOperation(toolResult.toolName)}
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
        {#if toolResult.success}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-check"><path d="M20 6 9 17l-5-5" /></svg
          >
        {:else}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg
          >
        {/if}
        <span class="tool-name">{toolResult.toolName}</span>
        {#if isFileOperation(toolResult.toolName)}
          <span class="grump-chip">G-Rump Write</span>
        {/if}
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

    {#if isFileOperation(toolResult.toolName) && filePath}
      <div class="file-result-summary">
        <span class="file-action">{fileAction}</span>
        <code class="file-path">{filePath}</code>
      </div>
    {/if}

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
    border: 0;
    border-radius: 8px;
    overflow: hidden;
    margin: 8px 0;
    background: var(--color-bg-elevated, #ffffff);
    font-family: inherit;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .tool-result-card.file-result {
    border: 1px solid color-mix(in srgb, var(--success-color, #22c55e) 30%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--success-color, #22c55e) 16%, transparent);
  }

  .tool-result-header {
    background-color: var(--color-bg-elevated, #ffffff);
    padding: 12px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 0;
  }

  .tool-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tool-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .grump-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--success-color, #22c55e);
    background: color-mix(in srgb, var(--success-color, #22c55e) 14%, transparent);
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

  .file-result-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px 10px;
    flex-wrap: wrap;
  }

  .file-action {
    font-size: 11px;
    font-weight: 700;
    color: var(--success-color, #22c55e);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .file-path {
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 11px;
    color: var(--text-primary);
    background: var(--bg-content);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 3px 7px;
  }

  .output-wrapper {
    padding: 12px 14px;
    background-color: var(--color-bg-card, #f8f8f8);
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
