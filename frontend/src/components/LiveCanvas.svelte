<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '../lib/design-system';
  import { fetchApi } from '../lib/api.js';
  import { colors } from '../lib/design-system/tokens/colors.js';

  interface Props {
    sessionId?: string;
    onBack?: () => void;
  }

  let { sessionId = 'default', onBack }: Props = $props();

  let elements = $state<Array<Record<string, unknown>>>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function loadCanvas() {
    loading = true;
    error = null;
    try {
      const res = await fetchApi(`/api/canvas/${sessionId}`);
      if (!res.ok) throw new Error('Failed to load canvas');
      const data = (await res.json()) as { elements?: Record<string, unknown>[] };
      elements = data.elements ?? [];
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadCanvas();
  });
</script>

<div class="live-canvas" style:--bg-primary={colors.background.primary}>
  <header class="canvas-header">
    {#if onBack}
      <Button variant="ghost" size="sm" onclick={onBack}>Back</Button>
    {/if}
    <h1 class="canvas-title">Live Canvas</h1>
    <Button variant="secondary" size="sm" onclick={loadCanvas}>Refresh</Button>
  </header>

  <div class="canvas-content">
    {#if loading}
      <p class="loading">Loading canvas…</p>
    {:else if error}
      <p class="error">{error}</p>
    {:else if elements.length === 0}
      <p class="empty">
        No elements. Use the chat with canvas_update tool to add panels, text, or widgets.
      </p>
    {:else}
      <div class="canvas-grid">
        {#each elements as el (el.id)}
          <div class="canvas-element" data-type={el.type ?? 'panel'}>
            {#if el.title}
              <div class="element-title">{el.title as string}</div>
            {/if}
            {#if el.content}
              <div class="element-content">{el.content as string}</div>
            {/if}
            {#if el.type === 'chart' && el.data}
              <pre class="element-data">{JSON.stringify(el.data, null, 2)}</pre>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .live-canvas {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--bg-primary);
  }

  .canvas-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 24px;
    border-bottom: 1px solid #e4e4e7;
    background: white;
  }

  .canvas-title {
    flex: 1;
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }

  .canvas-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .loading,
  .error,
  .empty {
    color: #71717a;
    font-size: 14px;
    text-align: center;
  }

  .error {
    color: #dc2626;
  }

  .canvas-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .canvas-element {
    padding: 16px;
    background: #fafafa;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    min-height: 80px;
  }

  .element-title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 8px;
  }

  .element-content {
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .element-data {
    font-size: 11px;
    overflow-x: auto;
    margin: 0;
  }
</style>
