<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '../stores/authStore';
  import { apiFetch } from '../lib/api';

  interface Settings {
    user?: { displayName?: string; email?: string; timezone?: string };
    models?: { defaultProvider?: 'nim' | 'zhipu' | 'copilot' | 'openrouter'; defaultModelId?: string };
    mcp?: { servers?: unknown[] };
    skills?: { enabledIds?: string[] };
    accessibility?: { reducedMotion?: boolean; highContrast?: boolean };
    integrations?: { github?: { enabled: boolean }; twilio?: { enabled: boolean } };
  }

  let settings = $state<Settings | null>(null);
  let saving = $state(false);

  const modelOptions = [
    { provider: 'nim' as const, modelId: 'moonshotai/kimi-k2.5', label: 'Kimi K2.5 (NIM)' },
    { provider: 'zhipu' as const, modelId: 'glm-4', label: 'GLM 4' },
    { provider: 'copilot' as const, modelId: 'copilot-codex', label: 'Copilot Codex' },
    { provider: 'openrouter' as const, modelId: 'openrouter/moonshotai/kimi-k2.5', label: 'Kimi K2.5 (OpenRouter)' },
  ];

  onMount(() => {
    loadSettings();
  });

  async function loadSettings() {
    try {
      const res = await apiFetch('/api/settings');
      if (!res.ok) {
        settings = {};
        return;
      }
      const json = await res.json();
      settings = (json.settings ?? {}) as Settings;
    } catch {
      settings = {};
    }
  }

  async function saveModels(next: Settings['models']) {
    saving = true;
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ models: next }),
      });
      if (res.ok) {
        const json = await res.json();
        settings = (json.settings ?? settings ?? {}) as Settings;
      }
    } finally {
      saving = false;
    }
  }

  async function saveAccessibility(next: Settings['accessibility']) {
    saving = true;
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ accessibility: next }),
      });
      if (res.ok) {
        const json = await res.json();
        settings = (json.settings ?? settings ?? {}) as Settings;
      }
    } finally {
      saving = false;
    }
  }

  function modelValue(): string {
    const m = settings?.models;
    if (!m?.defaultModelId) return 'nim:moonshotai/kimi-k2.5';
    return `${m.defaultProvider ?? 'nim'}:${m.defaultModelId}`;
  }

  function handleModelChange(e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    const [provider, modelId] = v.includes(':') ? v.split(':') : ['nim', v];
    saveModels({
      ...settings?.models,
      defaultProvider: provider as 'nim' | 'zhipu' | 'copilot' | 'openrouter',
      defaultModelId: modelId,
    });
  }
</script>

<div class="settings p-6">
  <h1 class="text-2xl font-semibold text-gray-800 mb-4">Settings</h1>

  <section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-4">
    <h2 class="text-lg font-medium text-gray-900 mb-4">User</h2>
    <p class="text-gray-600">
      {#if $authStore.user?.email}
        Logged in as <strong>{$authStore.user.email}</strong>
      {/if}
    </p>
  </section>

  <section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-4">
    <h2 class="text-lg font-medium text-gray-900 mb-4">Models</h2>
    <p class="text-gray-600 text-sm mb-3">Default LLM for chat.</p>
    <label class="block">
      <span class="block text-sm font-medium text-gray-700 mb-1">Default model</span>
      <select
        value={modelValue()}
        onchange={handleModelChange}
        disabled={saving}
        class="mt-1 block w-64 rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
      >
        {#each modelOptions as opt}
          <option value="{opt.provider}:{opt.modelId}">{opt.label}</option>
        {/each}
      </select>
    </label>
  </section>

  <section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-4">
    <h2 class="text-lg font-medium text-gray-900 mb-4">MCP</h2>
    <p class="text-gray-600 text-sm">Model Context Protocol servers (add/edit in a future update).</p>
  </section>

  <section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-4">
    <h2 class="text-lg font-medium text-gray-900 mb-4">Skills</h2>
    <p class="text-gray-600 text-sm">Enabled skills (backend-controlled allowlist).</p>
  </section>

  <section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-4">
    <h2 class="text-lg font-medium text-gray-900 mb-4">Accessibility</h2>
    <p class="text-gray-600 text-sm mb-3">Reduced motion, contrast, font size.</p>
    <label class="flex items-center gap-2 mb-2">
      <input
        type="checkbox"
        checked={settings?.accessibility?.reducedMotion ?? false}
        onchange={(e) => saveAccessibility({ ...settings?.accessibility, reducedMotion: (e.target as HTMLInputElement).checked })}
      />
      <span>Reduced motion</span>
    </label>
    <label class="flex items-center gap-2">
      <input
        type="checkbox"
        checked={settings?.accessibility?.highContrast ?? false}
        onchange={(e) => saveAccessibility({ ...settings?.accessibility, highContrast: (e.target as HTMLInputElement).checked })}
      />
      <span>High contrast</span>
    </label>
  </section>

  <section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-4">
    <h2 class="text-lg font-medium text-gray-900 mb-4">Integrations</h2>
    <p class="text-gray-600 text-sm">GitHub, Twilio (text/call G-Rump), etc. Configured via backend env.</p>
  </section>
</div>
