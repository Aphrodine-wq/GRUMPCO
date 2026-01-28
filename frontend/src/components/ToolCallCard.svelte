<script lang="ts">
  interface Props {
    toolCall?: {
      type: 'tool_call';
      id: string;
      name: string;
      input: Record<string, unknown>;
      status?: string;
    };
  }

  let { toolCall }: Props = $props();
</script>

{#if toolCall}
  <div class="tool-call-card">
    <div class="tool-call-header">
      <span class="tool-call-name">{toolCall.name}</span>
      {#if toolCall.status}
        <span class="tool-call-status" class:success={toolCall.status === 'success'} class:error={toolCall.status === 'error'}>
          {toolCall.status === 'executing' ? '…' : toolCall.status}
        </span>
      {/if}
    </div>
    {#if toolCall.input && Object.keys(toolCall.input).length > 0}
      <pre class="tool-call-input">{JSON.stringify(toolCall.input, null, 2)}</pre>
    {/if}
  </div>
{/if}

<style>
  .tool-call-card {
    padding: 0.75rem 1rem;
    background: #EEF2FF;
    border-radius: 6px;
    margin: 0.5rem 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }
  .tool-call-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  .tool-call-name {
    font-weight: 600;
    color: #4338ca;
  }
  .tool-call-status {
    font-size: 0.75rem;
    color: #6b7280;
  }
  .tool-call-status.success { color: #059669; }
  .tool-call-status.error { color: #dc2626; }
  .tool-call-input {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    color: #374151;
    font-size: 0.75rem;
  }
</style>
