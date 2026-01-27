<script lang="ts">
  import CodeDiffViewer from './CodeDiffViewer.svelte';
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
    return toolName === 'file_write' || toolName === 'file_edit';
  };
</script>

{#if toolResult}
  <div class="tool-result-card" class:success={toolResult.success} class:error={!toolResult.success}>
    <div class="tool-result-header">
      <span class="tool-result-name">{toolResult.toolName}</span>
      {#if toolResult.executionTime != null}
        <span class="tool-result-time">{toolResult.executionTime}ms</span>
      {/if}
      <span class="tool-result-badge">{toolResult.success ? 'ok' : 'error'}</span>
    </div>
    {#if toolResult.diff && isFileOperation(toolResult.toolName)}
      <div class="diff-container">
        <CodeDiffViewer diff={toolResult.diff} />
      </div>
    {:else if toolResult.output}
      <pre class="tool-result-output">{toolResult.output}</pre>
    {/if}
  </div>
{/if}

<style>
  .tool-result-card {
    padding: 0.75rem 1rem;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 4px;
    margin: 0.5rem 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
  }
  .tool-result-card.error {
    background: #fef2f2;
    border-color: #fecaca;
  }
  .tool-result-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  .tool-result-name {
    font-weight: 600;
    color: #15803d;
  }
  .tool-result-card.error .tool-result-name { color: #b91c1c; }
  .tool-result-time {
    font-size: 0.75rem;
    color: #6b7280;
  }
  .tool-result-badge {
    font-size: 0.7rem;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    background: #dcfce7;
    color: #166534;
  }
  .tool-result-card.error .tool-result-badge {
    background: #fee2e2;
    color: #991b1b;
  }
  .tool-result-output {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    color: #374151;
    font-size: 0.75rem;
    max-height: 12rem;
    overflow-y: auto;
  }

  .diff-container {
    margin-top: 0.5rem;
  }
</style>
