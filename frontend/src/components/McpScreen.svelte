<script lang="ts">
  /**
   * McpScreen - Dedicated view for MCP server list and configuration.
   * Reuses McpServersCard for the main content.
   */
  import { ArrowLeft } from 'lucide-svelte';
  import { Button } from '../lib/design-system';
  import McpServersCard from './McpServersCard.svelte';

  interface Props {
    onBack: () => void;
  }
  let { onBack }: Props = $props();
</script>

<div class="mcp-screen">
  <header class="mcp-header">
    <Button variant="ghost" size="sm" onclick={onBack}>
      <ArrowLeft size={16} />
      Back
    </Button>
    <div class="header-text">
      <h1>MCP Servers</h1>
      <p class="subtitle">
        Model Context Protocol – configure stdio or URL-based servers so the agent can use their
        tools.
      </p>
    </div>
  </header>
  <main class="mcp-main">
    <McpServersCard />
  </main>
</div>

<style>
  .mcp-screen {
    padding: var(--space-content, 24px);
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
    background: var(--color-bg-app, #ffffff);
  }

  .mcp-header {
    margin-bottom: var(--space-content, 24px);
  }

  .header-text {
    margin-top: 1rem;
  }

  .mcp-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #1f1147);
    margin: 0 0 0.5rem;
  }

  .subtitle {
    color: var(--color-text-muted, #6b7280);
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .mcp-main {
    min-height: 0;
  }
</style>
