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
      <span class="result-icon">{toolResult.success ? '✓' : '✗'}</span>
      <span class="tool-result-name">{toolResult.toolName}</span>
      {#if toolResult.executionTime != null}
        <span class="tool-result-time">{toolResult.executionTime}ms</span>
      {/if}
      <span class="tool-result-badge">{toolResult.success ? 'OK' : 'ERR'}</span>
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
    background: #0A0A0A;
    border: 1px solid #333;
    border-left: 3px solid #00FF41;
    border-radius: 0;
    margin: 0.5rem 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
  }
  .tool-result-card.error {
    border-left-color: #FF3131;
  }
  .tool-result-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  .result-icon {
    font-size: 0.8rem;
    color: #00FF41;
    font-weight: bold;
  }
  .tool-result-card.error .result-icon {
    color: #FF3131;
  }
  .tool-result-name {
    font-weight: 600;
    color: #00FF41;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .tool-result-card.error .tool-result-name { 
    color: #FF3131; 
  }
  .tool-result-time {
    font-size: 0.65rem;
    color: #525252;
    margin-left: auto;
  }
  .tool-result-badge {
    font-size: 0.6rem;
    padding: 0.1rem 0.35rem;
    border: 1px solid #00FF41;
    color: #00FF41;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .tool-result-card.error .tool-result-badge {
    border-color: #FF3131;
    color: #FF3131;
  }
  .tool-result-output {
    margin: 0.5rem 0 0 0;
    padding: 0.5rem;
    white-space: pre-wrap;
    word-break: break-word;
    color: #A3A3A3;
    font-size: 0.7rem;
    max-height: 12rem;
    overflow-y: auto;
    background: #000;
    border: 1px solid #222;
  }

  .diff-container {
    margin-top: 0.5rem;
  }
</style>
