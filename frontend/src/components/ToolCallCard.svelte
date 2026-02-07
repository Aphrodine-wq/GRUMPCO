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

  const FILE_TOOLS = new Set(['file_write', 'file_edit', 'write_file', 'edit_file']);

  function isFileTool(name?: string): boolean {
    return !!name && FILE_TOOLS.has(name);
  }

  function getPathFromInput(input?: Record<string, unknown>): string | null {
    const raw = input?.path;
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
  }

  function getOperationCount(input?: Record<string, unknown>): number | null {
    const ops = input?.operations;
    return Array.isArray(ops) ? ops.length : null;
  }

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

  const inputPath = $derived(getPathFromInput(toolCall?.input));
  const operationCount = $derived(getOperationCount(toolCall?.input));
</script>

{#if toolCall}
  <div
    class="tool-call-card"
    class:file-tool={isFileTool(toolCall.name)}
    style:--border-color={colors.border.default}
    style:--bg-header={colors.background.tertiary}
    style:--bg-content={colors.background.secondary}
    style:--text-primary={colors.text.primary}
    style:--text-secondary={colors.text.secondary}
    style:--accent-color={colors.accent.primary}
  >
    <div class="tool-call-header">
      <div class="tool-info">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-code-2"
          ><path d="m18 16 4-4-4-4" /><path d="m6 8-4 4 4 4" /><path d="m14.5 4-5 16" /></svg
        >
        <span class="tool-name">{toolCall.name}</span>
        {#if isFileTool(toolCall.name)}
          <span class="grump-chip">G-Rump File Flow</span>
        {/if}
      </div>
      {#if toolCall.status}
        <Badge
          variant={getStatusVariant(toolCall.status)}
          size="sm"
          dot={toolCall.status === 'executing'}
        >
          {formatStatus(toolCall.status)}
        </Badge>
      {/if}
    </div>
    {#if isFileTool(toolCall.name)}
      <div class="file-summary">
        {#if inputPath}
          <span class="summary-item">Path: <code>{inputPath}</code></span>
        {/if}
        {#if operationCount !== null}
          <span class="summary-item">Ops: {operationCount}</span>
        {/if}
      </div>
    {/if}
    {#if toolCall.input && Object.keys(toolCall.input).length > 0}
      <div class="tool-input-container">
        {#if isFileTool(toolCall.name)}
          <details>
            <summary>View raw tool input</summary>
            <pre class="tool-input"><code>{JSON.stringify(toolCall.input, null, 2)}</code></pre>
          </details>
        {:else}
          <pre class="tool-input"><code>{JSON.stringify(toolCall.input, null, 2)}</code></pre>
        {/if}
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
    background: var(--color-bg-elevated, #ffffff);
    font-family: inherit;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .tool-call-card.file-tool {
    border: 1px solid color-mix(in srgb, var(--accent-color, #7c3aed) 22%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-color, #7c3aed) 14%, transparent);
  }

  .tool-call-header {
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
    color: var(--accent-color, #7c3aed);
    background: color-mix(in srgb, var(--accent-color, #7c3aed) 14%, transparent);
  }

  .file-summary {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px 10px;
    font-size: 11px;
    color: var(--text-secondary);
    flex-wrap: wrap;
  }

  .summary-item code {
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 11px;
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

  details summary {
    font-size: 11px;
    cursor: pointer;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }
</style>
