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
      <span class="tool-icon">⏺</span>
      <span class="tool-call-name">{toolCall.name}</span>
      {#if toolCall.status}
        <span class="tool-call-status" class:success={toolCall.status === 'success'} class:error={toolCall.status === 'error'} class:executing={toolCall.status === 'executing'}>
          {toolCall.status === 'executing' ? 'RUNNING' : toolCall.status.toUpperCase()}
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
    background: #121212;
    border: 1px solid #333;
    border-left: 3px solid #00E5FF;
    border-radius: 0;
    margin: 0.5rem 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
  }
  .tool-call-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  .tool-icon {
    color: #00E5FF;
    font-size: 0.7rem;
  }
  .tool-call-name {
    font-weight: 600;
    color: #00E5FF;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .tool-call-status {
    font-size: 0.65rem;
    color: #525252;
    padding: 0.1rem 0.4rem;
    border: 1px solid #333;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .tool-call-status.success { 
    color: #00FF41; 
    border-color: #00FF41;
  }
  .tool-call-status.error { 
    color: #FF3131; 
    border-color: #FF3131;
  }
  .tool-call-status.executing {
    color: #FFD700;
    border-color: #FFD700;
    animation: pulse-border 1s ease-in-out infinite;
  }
  @keyframes pulse-border {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .tool-call-input {
    margin: 0.5rem 0 0 0;
    padding: 0.5rem;
    white-space: pre-wrap;
    word-break: break-all;
    color: #A3A3A3;
    font-size: 0.7rem;
    background: #0A0A0A;
    border: 1px solid #222;
  }
</style>
