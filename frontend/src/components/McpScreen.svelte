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
      <h1>MCP</h1>
      <p class="subtitle">Model Context Protocol servers – configure tools and data sources for G-Agent</p>
    </div>
  </header>
  <main class="mcp-main">
    <McpServersCard />
  </main>
</div>

<style>
  .mcp-screen {
    padding: 32px;
    max-width: 800px;
    margin: 0 auto;
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
  }

  .mcp-header {
    margin-bottom: 24px;
  }

  .header-text {
    margin-top: 16px;
  }

  .mcp-header h1 {
    font-size: 24px;
    font-weight: 700;
    color: #18181b;
    margin: 0 0 8px;
  }

  .subtitle {
    color: #71717a;
    margin: 0;
    font-size: 15px;
  }

  .mcp-main {
    min-height: 0;
  }
</style>
