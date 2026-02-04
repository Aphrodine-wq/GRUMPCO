<script lang="ts">
  /**
   * Model Benchmark - run same prompt against multiple models and compare quality, latency, cost.
   */
  import { fetchApi } from '$lib/api';
  import { Button, Card } from '$lib/design-system';

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

  let prompt = $state('Write a hello world in TypeScript.');
  let selectedModelIds = $state<string[]>([
    'moonshotai/kimi-k2.5',
    'nvidia/llama-3.3-nemotron-super-49b-v1.5',
  ]);
  let running = $state(false);
  let results = $state<
    Array<{ modelId: string; latencyMs: number; responseLength: number; error?: string }>
  >([]);

  const availableModels = [
    { id: 'moonshotai/kimi-k2.5', label: 'Kimi K2.5' },
    { id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', label: 'NemoTRON Ultra' },
    { id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', label: 'NemoTRON Super' },
    { id: 'meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B' },
  ];

  function toggleModel(id: string) {
    if (selectedModelIds.includes(id)) {
      selectedModelIds = selectedModelIds.filter((m) => m !== id);
    } else {
      selectedModelIds = [...selectedModelIds, id];
    }
  }

  async function runBenchmark() {
    if (selectedModelIds.length === 0) return;
    running = true;
    results = [];
    for (const modelId of selectedModelIds) {
      const t0 = Date.now();
      try {
        const res = await fetchApi('/api/chat/stream', {
          method: 'POST',
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            modelId,
            provider: 'nim',
          }),
        });
        if (!res.ok) {
          results = [
            ...results,
            { modelId, latencyMs: Date.now() - t0, responseLength: 0, error: `HTTP ${res.status}` },
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
        results = [...results, { modelId, latencyMs: Date.now() - t0, responseLength: length }];
      } catch (e) {
        results = [
          ...results,
          { modelId, latencyMs: Date.now() - t0, responseLength: 0, error: (e as Error).message },
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
    <h2>Model Benchmark</h2>
  </header>
  <div class="benchmark-body">
    <Card title="Prompt" padding="md">
      <textarea
        class="benchmark-prompt"
        bind:value={prompt}
        placeholder="Enter a prompt to run against all selected models..."
        rows="3"
      ></textarea>
    </Card>
    <Card title="Models" padding="md">
      <div class="model-checkboxes">
        {#each availableModels as model}
          <label class="model-check">
            <input
              type="checkbox"
              checked={selectedModelIds.includes(model.id)}
              onchange={() => toggleModel(model.id)}
            />
            <span>{model.label}</span>
          </label>
        {/each}
      </div>
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
              <th>Latency (ms)</th>
              <th>Response length</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {#each results as r}
              <tr>
                <td class="model-id">{r.modelId}</td>
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
    background: var(--bg-primary, #1a1a2e);
    color: var(--text-primary, #e8e8e8);
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
  }

  .benchmark-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border, #333);
  }

  .benchmark-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .benchmark-body {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .benchmark-prompt {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border, #333);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    resize: vertical;
    background: var(--bg-secondary, #16213e);
    color: var(--text-primary, #e8e8e8);
  }

  .model-checkboxes {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .model-check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .benchmark-actions {
    display: flex;
    gap: 0.5rem;
  }

  .results-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .results-table th,
  .results-table td {
    padding: 0.5rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--border, #333);
  }

  .results-table th {
    color: var(--text-secondary, #888);
    font-weight: 600;
  }

  .model-id {
    font-family: monospace;
    font-size: 0.8rem;
  }
</style>
