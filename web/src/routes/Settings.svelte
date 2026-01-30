<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '../stores/authStore';
  import { apiFetch } from '../lib/api';
  import { trackSettingsEvent } from '../lib/analytics';

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
  let saveStatus = $state('');

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
    saveStatus = 'Saving model settings...';
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ models: next }),
      });
      if (res.ok) {
        const json = await res.json();
        settings = (json.settings ?? settings ?? {}) as Settings;
        saveStatus = 'Model settings saved successfully';
        trackSettingsEvent('save_models', { 
          provider: next?.defaultProvider, 
          model: next?.defaultModelId 
        });
        setTimeout(() => saveStatus = '', 3000);
      } else {
        saveStatus = 'Failed to save model settings';
      }
    } finally {
      saving = false;
    }
  }

  async function saveAccessibility(next: Settings['accessibility']) {
    saving = true;
    saveStatus = 'Saving accessibility settings...';
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ accessibility: next }),
      });
      if (res.ok) {
        const json = await res.json();
        settings = (json.settings ?? settings ?? {}) as Settings;
        saveStatus = 'Accessibility settings saved successfully';
        trackSettingsEvent('save_accessibility', { 
          reduced_motion: next?.reducedMotion, 
          high_contrast: next?.highContrast 
        });
        setTimeout(() => saveStatus = '', 3000);
      } else {
        saveStatus = 'Failed to save accessibility settings';
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

<div class="settings responsive-p safe-x safe-bottom overflow-y-auto" role="region" aria-label="User settings">
  <div class="max-w-3xl mx-auto">
    <h1 class="text-xl sm:text-2xl font-semibold text-gray-800 mb-4">Settings</h1>
    
    <!-- Live region for status announcements - WCAG 4.1.3 -->
    <div 
      role="status" 
      aria-live="polite" 
      aria-atomic="true" 
      class="sr-only"
    >
      {saveStatus}
    </div>

    <section class="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm mb-4" aria-labelledby="user-heading">
      <h2 class="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4" id="user-heading">User</h2>
      <p class="text-gray-600 text-mobile-base">
        {#if $authStore.user?.email}
          Logged in as <strong class="break-all">{$authStore.user.email}</strong>
        {:else}
          Not logged in
        {/if}
      </p>
    </section>

    <section class="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm mb-4" aria-labelledby="models-heading">
      <h2 class="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4" id="models-heading">Models</h2>
      <p class="text-gray-600 text-sm mb-3">Default LLM for chat.</p>
      <div class="block">
        <label for="model-select" class="block text-sm font-medium text-gray-700 mb-1">Default model</label>
        <select
          id="model-select"
          value={modelValue()}
          onchange={handleModelChange}
          disabled={saving}
          class="mt-1 block w-full sm:w-64 rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm form-input touch-target-lg"
          aria-describedby="model-help"
        >
          {#each modelOptions as opt}
            <option value="{opt.provider}:{opt.modelId}">{opt.label}</option>
          {/each}
        </select>
        <p id="model-help" class="sr-only">Select your preferred AI model for chat conversations</p>
      </div>
    </section>

    <section class="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm mb-4" aria-labelledby="mcp-heading">
      <h2 class="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4" id="mcp-heading">MCP</h2>
      <p class="text-gray-600 text-sm">Model Context Protocol servers (add/edit in a future update).</p>
    </section>

    <section class="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm mb-4" aria-labelledby="skills-heading">
      <h2 class="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4" id="skills-heading">Skills</h2>
      <p class="text-gray-600 text-sm">Enabled skills (backend-controlled allowlist).</p>
    </section>

    <section class="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm mb-4" aria-labelledby="accessibility-heading">
      <h2 class="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4" id="accessibility-heading">Accessibility</h2>
      <p class="text-gray-600 text-sm mb-3">Customize your experience for better accessibility.</p>
      <fieldset class="border-0 p-0 m-0 space-y-3">
        <legend class="sr-only">Accessibility preferences</legend>
        <label class="flex items-center gap-3 cursor-pointer touch-target tap-transparent">
          <input
            type="checkbox"
            checked={settings?.accessibility?.reducedMotion ?? false}
            onchange={(e) => saveAccessibility({ ...settings?.accessibility, reducedMotion: (e.target as HTMLInputElement).checked })}
            aria-describedby="reduced-motion-help"
            class="form-checkbox touch-target"
          />
          <span class="text-mobile-base">Reduced motion</span>
        </label>
        <p id="reduced-motion-help" class="sr-only">Minimize animations and transitions throughout the application</p>
        
        <label class="flex items-center gap-3 cursor-pointer touch-target tap-transparent">
          <input
            type="checkbox"
            checked={settings?.accessibility?.highContrast ?? false}
            onchange={(e) => saveAccessibility({ ...settings?.accessibility, highContrast: (e.target as HTMLInputElement).checked })}
            aria-describedby="high-contrast-help"
            class="form-checkbox touch-target"
          />
          <span class="text-mobile-base">High contrast</span>
        </label>
        <p id="high-contrast-help" class="sr-only">Increase contrast for better visibility</p>
      </fieldset>
    </section>

    <section class="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm mb-4" aria-labelledby="integrations-heading">
      <h2 class="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4" id="integrations-heading">Integrations</h2>
      <p class="text-gray-600 text-sm">GitHub, Twilio (text/call G-Rump), etc. Configured via backend env.</p>
    </section>
  </div>
</div>
