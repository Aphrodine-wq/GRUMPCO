<script lang="ts">
  /**
   * ToolCallCard - Professional light theme
   */
  import { Badge } from '../lib/design-system';
  import { colors } from '../lib/design-system/tokens/colors';


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

  function formatStatus(status?: string) {
    if (status === 'executing') return 'Running';
    if (status === 'success') return 'Completed';
    if (status === 'error') return 'Failed';
    return status;
  }

  function getStatusVariant(status?: string): 'info' | 'success' | 'error' | 'warning' | 'default' {
    if (status === 'executing') return 'info';
    if (status === 'success') return 'success';
    if (status === 'error') return 'error';
    return 'default';
  }
</script>

{#if toolCall}
  <div 
    class="tool-call-card"
    style:--border-color={colors.border.default}
    style:--bg-header={colors.background.tertiary}
    style:--bg-content={colors.background.secondary}
    style:--text-primary={colors.text.primary}
    style:--text-secondary={colors.text.secondary}
    style:--accent-color={colors.accent.primary}
  >
    <div class="tool-call-header">
      <div class="tool-info">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-code-2"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
        <span class="tool-name">{toolCall.name}</span>
      </div>
      {#if toolCall.status}
        <Badge variant={getStatusVariant(toolCall.status)} size="sm" dot={toolCall.status === 'executing'}>
          {formatStatus(toolCall.status)}
        </Badge>
      {/if}
    </div>
    {#if toolCall.input && Object.keys(toolCall.input).length > 0}
      <div class="tool-input-container">
        <pre class="tool-input"><code>{JSON.stringify(toolCall.input, null, 2)}</code></pre>
      </div>
    {/if}
  </div>
{/if}

<style>
  .tool-call-card {
    border: 0;
    border-radius: 8px;
    overflow: hidden;
    margin: 8px 0;
    background: white;
    font-family: inherit;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .tool-call-header {
    background-color: white;
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

  .tool-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-color);
  }

  .tool-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .tool-input-container {
    padding: 12px 14px;
    max-height: 200px;
    overflow-y: auto;
  }

  .tool-input {
    margin: 0;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
