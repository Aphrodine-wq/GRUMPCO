<script lang="ts">
  /**
   * McpTab – Extracted from TabbedSettingsScreen.svelte (tab: 'mcp')
   * Phase 2 decomposition.
   *
   * TODO: Replace `any` props with explicit types for full type safety.
   */
  import { Card } from '../../lib/design-system';
  import McpServersCard from '../McpServersCard.svelte';

  interface Props {
    saveMcp: any;
    settings: any;
  }

  let { saveMcp, settings }: Props = $props();
</script>

<div class="tab-section integrations-tab">
  <Card title="MCP defaults" padding="md">
    <p class="section-desc">Global timeout and retry behavior for MCP server calls.</p>
    <div class="field-group">
      <label class="field-label" for="mcp-timeout">Request timeout (seconds)</label>
      <input
        id="mcp-timeout"
        type="number"
        min="1"
        max="300"
        step="1"
        class="settings-number-input"
        value={settings?.mcp?.requestTimeoutSeconds ?? ''}
        onchange={(e) => {
          const v = parseInt((e.target as HTMLInputElement).value, 10);
          if (!Number.isNaN(v) && v >= 1) saveMcp({ ...settings?.mcp, requestTimeoutSeconds: v });
          else if ((e.target as HTMLInputElement).value === '')
            saveMcp({ ...settings?.mcp, requestTimeoutSeconds: undefined });
        }}
        placeholder="30"
      />
      <p class="field-hint">Max time to wait for an MCP response. Leave empty for default.</p>
    </div>
    <div class="field-group">
      <label class="field-label" for="mcp-retries">Max retries</label>
      <input
        id="mcp-retries"
        type="number"
        min="0"
        max="10"
        step="1"
        class="settings-number-input"
        value={settings?.mcp?.maxRetries ?? ''}
        onchange={(e) => {
          const v = parseInt((e.target as HTMLInputElement).value, 10);
          if (!Number.isNaN(v) && v >= 0) saveMcp({ ...settings?.mcp, maxRetries: v });
          else if ((e.target as HTMLInputElement).value === '')
            saveMcp({ ...settings?.mcp, maxRetries: undefined });
        }}
        placeholder="2"
      />
      <p class="field-hint">Number of retries on failure. Leave empty for default.</p>
    </div>
  </Card>
  <section class="integrations-section">
    <h2 class="integrations-section-title">MCP Servers</h2>
    <p class="integrations-section-desc">
      Model Context Protocol – configure stdio or URL-based servers so the agent can use their
      tools.
    </p>
    <div class="integrations-section-content">
      <McpServersCard />
    </div>
  </section>
</div>

<style>
  .tab-section {
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .integrations-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .integrations-section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #18181b;
    margin: 0;
  }

  .integrations-section-desc {
    font-size: 0.875rem;
    color: #71717a;
    margin: 0;
  }

  .integrations-section-content {
    min-width: 0;
  }

  .integrations-section-content.integrations-grid-two {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    align-items: start;
  }

  .tab-section :global(.card) {
    border: 1px solid #e5e7eb;
  }

  .settings-number-input,
  .settings-text-input {
    max-width: 200px;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.5rem;
    background: var(--color-bg-card, #fff);
  }

  .section-desc {
    font-size: 14px;
    color: var(--color-text-muted, #71717a);
    margin-bottom: 20px;
  }

  .field-group {
    margin-bottom: 20px;
  }

  .field-group:last-child {
    margin-bottom: 0;
  }

  .field-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary, #3f3f46);
    margin-bottom: 8px;
  }

  .field-hint {
    font-size: 12px;
    color: var(--color-text-muted, #a1a1aa);
    margin-top: 6px;
  }
</style>
