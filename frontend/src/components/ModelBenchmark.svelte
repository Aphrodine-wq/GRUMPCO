<script lang="ts">
  /**
   * Model Benchmark - run same prompt against multiple models and compare quality, latency, cost.
   */
  import { onMount } from 'svelte';
  import { fetchApi } from '$lib/api';
  import { Button, Card } from '$lib/design-system';

  interface Props {
    onBack?: () => void;
  }

  interface ModelItem {
    id: string;
    provider: string;
    costPerMillionInput?: number;
    costPerMillionOutput?: number;
  }

  interface ModelGroup {
    provider: string;
    displayName: string;
    models: ModelItem[];
  }

  let { onBack }: Props = $props();

  let prompt = $state('Write a hello world in TypeScript.');
  let selectedModelIds = $state<string[]>([]);
  let running = $state(false);
  let results = $state<
    Array<{
      modelId: string;
      provider: string;
      latencyMs: number;
      responseLength: number;
      cost?: number;
      error?: string;
    }>
  >([]);
  let availableModels = $state<ModelItem[]>([]);
  let modelsLoading = $state(true);
  let modelsError = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetchApi('/api/models/list');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { groups?: ModelGroup[] };
      const groups = data.groups ?? [];
      const flat: ModelItem[] = [];
      for (const g of groups) {
        for (const m of g.models) {
          flat.push({ ...m, provider: m.provider || g.provider });
        }
      }
      availableModels = flat;
      if (flat.length > 0 && selectedModelIds.length === 0) {
        selectedModelIds = flat.slice(0, 3).map((m) => `${m.provider}:${m.id}`);
      }
    } catch (e) {
      modelsError = (e as Error).message;
      availableModels = [];
    } finally {
      modelsLoading = false;
    }
  });

  function modelKey(m: ModelItem): string {
    return `${m.provider}:${m.id}`;
  }

  function toggleModel(key: string) {
    if (selectedModelIds.includes(key)) {
      selectedModelIds = selectedModelIds.filter((k) => k !== key);
    } else {
      selectedModelIds = [...selectedModelIds, key];
    }
  }

  function formatCost(m: ModelItem): string {
    const inC = m.costPerMillionInput ?? 0;
    const outC = m.costPerMillionOutput ?? 0;
    if (inC === 0 && outC === 0) return '-';
    const avg = (inC + outC) / 2;
    return avg < 0.1 ? '$' : avg < 1 ? '$$' : '$$$';
  }

  /** NVIDIA NIM model guide – recommended use per model (static reference). */
  const NIM_MODEL_GUIDE: { id: string; params?: string; use: string }[] = [
    {
      id: 'meta/llama-3.1-405b-instruct',
      params: '405B',
      use: 'Flagship – best quality, long context',
    },
    {
      id: 'meta/llama-3.1-70b-instruct',
      params: '70B',
      use: 'Balanced – daily driver, code & chat',
    },
    { id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', params: '49B', use: 'Fast – agentic, demos' },
    {
      id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
      params: '253B',
      use: 'Scientific reasoning, complex tasks',
    },
    {
      id: 'mistralai/mistral-large-2-instruct',
      params: 'Large 2',
      use: 'Multilingual, instruction following',
    },
    {
      id: 'mistralai/mixtral-8x22b-instruct-v0.1',
      params: '8x22B',
      use: 'MoE – efficient, broad use',
    },
  ];

  async function runBenchmark() {
    if (selectedModelIds.length === 0) return;
    running = true;
    results = [];
    for (const key of selectedModelIds) {
      const colon = key.indexOf(':');
      const provider = colon >= 0 ? key.slice(0, colon) : 'nim';
      const modelId = colon >= 0 ? key.slice(colon + 1) : key;
      const t0 = Date.now();
      try {
        const res = await fetchApi('/api/chat/stream', {
          method: 'POST',
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            modelId,
            provider: provider || 'nim',
          }),
        });
        if (!res.ok) {
          results = [
            ...results,
            {
              modelId,
              provider,
              latencyMs: Date.now() - t0,
              responseLength: 0,
              error: `HTTP ${res.status}`,
            },
          ];
          continue;
        }
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let length = 0;
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            length += decoder.decode(value, { stream: true }).length;
          }
        }
        results = [
          ...results,
          { modelId, provider, latencyMs: Date.now() - t0, responseLength: length },
        ];
      } catch (e) {
        results = [
          ...results,
          {
            modelId,
            provider,
            latencyMs: Date.now() - t0,
            responseLength: 0,
            error: (e as Error).message,
          },
        ];
      }
    }
    running = false;
  }
</script>

<div class="model-benchmark">
  <header class="benchmark-header">
    {#if onBack}
      <Button variant="ghost" size="sm" onclick={onBack}>Back</Button>
    {/if}
    <div>
      <h2>Model Benchmark</h2>
      <p class="benchmark-subtitle">
        Compare model performance across providers. Same prompt, different models.
      </p>
    </div>
  </header>
  <div class="benchmark-body">
    <Card title="NVIDIA NIM model guide" padding="md" class="nim-guide-card">
      <p class="nim-guide-desc">Recommended use for NIM models in G-Rump. Pick by task type.</p>
      <table class="nim-guide-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Size</th>
            <th>Recommended use</th>
          </tr>
        </thead>
        <tbody>
          {#each NIM_MODEL_GUIDE as row}
            <tr>
              <td class="nim-guide-id">{row.id}</td>
              <td>{row.params ?? '—'}</td>
              <td>{row.use}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="nim-guide-link">
        <a href="https://build.nvidia.com" target="_blank" rel="noopener noreferrer"
          >NVIDIA NIM docs</a
        >
      </p>
    </Card>
    <Card title="Prompt" padding="md">
      <textarea
        class="benchmark-prompt"
        bind:value={prompt}
        placeholder="Enter a prompt to run against all selected models..."
        rows="3"
      ></textarea>
    </Card>
    <Card title="Models" padding="md">
      {#if modelsLoading}
        <p class="models-loading">Loading models...</p>
      {:else if modelsError}
        <p class="models-error">{modelsError}</p>
      {:else if availableModels.length === 0}
        <p class="models-empty">No models available. Ensure backend is configured.</p>
      {:else}
        <p class="models-hint">Click to select models for the benchmark. Multi-select supported.</p>
        <div class="model-cards">
          {#each availableModels as model}
            {@const key = modelKey(model)}
            {@const selected = selectedModelIds.includes(key)}
            <button
              type="button"
              class="model-card"
              class:selected
              onclick={() => toggleModel(key)}
              aria-pressed={selected}
            >
              <span class="model-card-provider" aria-hidden="true"
                >{model.provider?.charAt(0)?.toUpperCase() ?? '?'}</span
              >
              <span class="model-card-id">{model.id}</span>
              <span class="model-card-cost">{formatCost(model)}</span>
              {#if (model as { isRecommended?: boolean }).isRecommended}
                <span class="model-card-badge">★</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </Card>
    <div class="benchmark-actions">
      <Button
        variant="primary"
        onclick={runBenchmark}
        disabled={running || selectedModelIds.length === 0}
      >
        {running ? 'Running…' : 'Run benchmark'}
      </Button>
    </div>
    {#if results.length > 0}
      <Card title="Results" padding="md">
        <table class="results-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Provider</th>
              <th>Latency (ms)</th>
              <th>Response length</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {#each results as r}
              <tr>
                <td class="model-id">{r.modelId}</td>
                <td>{r.provider}</td>
                <td>{r.latencyMs}</td>
                <td>{r.responseLength}</td>
                <td>{r.error ?? 'OK'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </Card>
    {/if}
  </div>
</div>

<style>
  .model-benchmark {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-subtle, #f5f3ff);
    color: var(--color-text, #1f1147);
    font-family: inherit;
  }

  .benchmark-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid var(--color-border, #e9d5ff);
    background: var(--color-bg-card, #ffffff);
    flex-shrink: 0;
  }

  .benchmark-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text, #1f1147);
    letter-spacing: -0.02em;
  }

  .benchmark-subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary, #6b7280);
    line-height: 1.4;
  }

  .benchmark-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  }

  .models-loading,
  .models-error,
  .models-empty {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
  }

  .models-error {
    color: var(--color-error, #dc2626);
  }

  .models-hint {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0 0 0.75rem;
  }

  .model-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
  }

  .model-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.375rem;
    padding: 0.75rem 1rem;
    text-align: left;
    background: var(--color-bg-card, #ffffff);
    border: 2px solid var(--color-border, #e5e7eb);
    border-radius: 10px;
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s,
      box-shadow 0.15s;
    font-family: inherit;
    color: var(--color-text, #111827);
  }

  .model-card:hover {
    border-color: var(--color-primary, #7c3aed);
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.06));
  }

  .model-card.selected {
    border-color: var(--color-primary, #7c3aed);
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.12));
    box-shadow: 0 0 0 1px var(--color-primary, #7c3aed);
  }

  .model-card-provider {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: var(--color-bg-subtle, #f3f4f6);
    color: var(--color-primary, #7c3aed);
    font-size: 0.75rem;
    font-weight: 700;
  }

  .model-card-id {
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1.3;
    word-break: break-word;
  }

  .model-card-cost {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
  }

  .model-card-badge {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-warning, #eab308);
  }

  .benchmark-prompt {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    resize: vertical;
    background: #ffffff;
    color: #111827;
  }

  .benchmark-prompt::placeholder {
    color: #9ca3af;
  }

  .benchmark-actions {
    display: flex;
    gap: 0.5rem;
  }

  .results-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
  }

  .results-table th,
  .results-table td {
    padding: 0.5rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid #e5e7eb;
    color: #374151;
  }

  .results-table th {
    color: #6b7280;
    font-weight: 600;
    background: #f9fafb;
  }

  .model-id {
    font-family: monospace;
    font-size: 0.8rem;
    color: #111827;
  }

  .nim-guide-desc {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0 0 0.75rem;
  }

  .nim-guide-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }

  .nim-guide-table th,
  .nim-guide-table td {
    padding: 0.5rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
  }

  .nim-guide-table th {
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
  }

  .nim-guide-id {
    font-family: monospace;
    font-size: 0.75rem;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nim-guide-link {
    margin: 0.75rem 0 0;
    font-size: 0.8125rem;
  }

  .nim-guide-link a {
    color: var(--color-primary, #7c3aed);
  }
</style>
