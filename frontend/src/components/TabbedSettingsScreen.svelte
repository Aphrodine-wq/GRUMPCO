<script lang="ts">
  /**
   * TabbedSettingsScreen - Reorganized settings with tabbed navigation
   * Replaces the long scrolling SettingsScreen with organized categories
   */
  import { onMount } from 'svelte';
  import { settingsStore } from '../stores/settingsStore';
  import { showToast } from '../stores/toastStore';
  import { fetchApi } from '../lib/api.js';
  import type {
    Settings,
    ModelsSettings,
    ModelPreset,
    CustomModelConfig,
    AccessibilitySettings,
    GuardRailsSettings,
  } from '../types/settings';
  import RecommendedExtensions from './RecommendedExtensions.svelte';
  import ScheduledAgents from './ScheduledAgents.svelte';
  import McpServersCard from './McpServersCard.svelte';
  import IntegrationsHub from './IntegrationsHub.svelte';
  import ModelPicker from './ModelPicker.svelte';
  import { Button, Card, Badge, Tabs } from '../lib/design-system';
  import { colors } from '../lib/design-system/tokens/colors';
  import { workspaceStore } from '../stores/workspaceStore';
  import { analyzeArchitecture } from '../stores/featuresStore';
  import { setCurrentView, showPricing } from '../stores/uiStore';
  import { onboardingStore } from '../stores/onboardingStore';
  import { newOnboardingStore } from '../stores/newOnboardingStore';
  import { authGateStore } from '../stores/authGateStore';
  import { preferencesStore, density, includeRagContext, gAgentCapabilities, type GAgentCapabilityKey } from '../stores/preferencesStore';
  import {
    wakeWordEnabled,
    setWakeWordEnabled,
    loadWakeWordEnabled,
  } from '../stores/wakeWordStore';
  import { getDockerInfo, isDockerSetupAvailable } from '../lib/dockerSetup';
  import { Settings2, Cpu, Shield, Puzzle, CreditCard, Info, GitBranch, Sun, Moon, Monitor } from 'lucide-svelte';
  import type { AppTheme } from '../stores/newOnboardingStore';

  interface Tier {
    id: string;
    name: string;
    priceMonthlyCents: number;
    priceYearlyCents?: number;
    apiCallsPerMonth: number;
    seats?: number;
    includedStorageGb?: number;
    includedComputeMinutes?: number;
    features: string[];
  }

  interface BillingMe {
    tier: string | null;
    usage: number | null;
    limit: number | null;
    computeMinutesUsed?: number;
    computeMinutesLimit?: number;
    storageGbUsed?: number;
    storageGbLimit?: number;
    overageRates?: {
      storageGbMonthlyCents: number;
      computeMinuteCents: number;
      extraConcurrentAgentMonthlyCents: number;
    };
    message?: string;
  }

  interface Props {
    onBack?: () => void;
    billingUrl?: string;
    /** When set, open this tab on first render (e.g. 'integrations' when navigating from sidebar). */
    initialTab?: string;
  }

  let { onBack, billingUrl = '#', initialTab }: Props = $props();

  // Tab definitions
  const settingsTabs = [
    { id: 'general', label: 'General', icon: Settings2 },
    { id: 'models', label: 'Models', icon: Cpu },
    { id: 'git', label: 'Git', icon: GitBranch },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: Puzzle },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'about', label: 'About', icon: Info },
  ];

  // svelte-ignore state_referenced_locally - initialTab is intentionally used only for initial tab
  let activeTab = $state(
    initialTab && settingsTabs.some((t) => t.id === initialTab) ? initialTab : 'general'
  );

  // State
  let settings = $state<Settings | null>(null);
  let saving = $state(false);
  let allowedDirsText = $state('');
  let tiers = $state<Tier[]>([]);
  let billingMe = $state<BillingMe | null>(null);
  let billingPaymentMethods = $state<{ id: string; brand?: string; last4?: string }[]>([]);
  let billingInvoices = $state<{ id: string; date: string; amount: number; status: string }[]>([]);
  let workspaceRoot = $state<string | null>(null);
  let analyzingArchitecture = $state(false);
  let architectureSummary = $state<string | null>(null);
  let architectureDiagram = $state<string | null>(null);
  let dockerStatus = $state<'running' | 'stopped' | 'error' | null>(null);
  let dockerLoading = $state(false);
  let dockerStartStopLoading = $state(false);
  let showCustomModelForm = $state(false);
  let customModelDraft = $state<Partial<CustomModelConfig>>({
    modelId: '',
    apiEndpoint: '',
    contextLength: 4096,
  });
  let isElectron = $state(false);
  let hasWakeWord = $state(false);

  /** Models list from /api/models/list for provider-first UI */
  interface ModelListItem {
    id: string;
    provider: string;
    capabilities: string[];
    contextWindow: number;
    description?: string;
    isRecommended?: boolean;
  }
  interface ModelListGroup {
    provider: string;
    displayName: string;
    icon: string;
    models: ModelListItem[];
  }
  let modelGroups = $state<ModelListGroup[]>([]);
  let modelGroupsLoading = $state(false);

  onMount(() => {
    // Check Electron features
    if (typeof window !== 'undefined') {
      const grump = (
        window as { grump?: { isElectron?: boolean; wakeWord?: { isSupported?: () => boolean } } }
      ).grump;
      isElectron = grump?.isElectron ?? false;
      hasWakeWord = grump?.wakeWord?.isSupported?.() ?? false;
    }

    wakeWordEnabled.set(loadWakeWordEnabled());
    const unsubWorkspace = workspaceStore.subscribe((state) => {
      workspaceRoot = state?.root ?? null;
    });

    settingsStore.load().then((s) => {
      settings = s;
      allowedDirsText = (s?.guardRails?.allowedDirs ?? []).join('\n');
    });

    fetchApi('/api/billing/tiers')
      .then((r) => r.json())
      .then((d: { tiers?: Tier[] }) => {
        tiers = d.tiers ?? [];
      })
      .catch(() => {
        tiers = [];
      });
    fetchApi('/api/billing/me')
      .then((r) => r.json())
      .then((d: BillingMe) => {
        billingMe = d;
      })
      .catch(() => {
        billingMe = null;
      });
    fetchApi('/api/billing/payment-methods')
      .then((r) => r.json())
      .then((d: { paymentMethods?: { id: string; brand?: string; last4?: string }[] }) => {
        billingPaymentMethods = d.paymentMethods ?? [];
      })
      .catch(() => {
        billingPaymentMethods = [];
      });
    fetchApi('/api/billing/invoices')
      .then((r) => r.json())
      .then((d: { invoices?: { id: string; date: string; amount: number; status: string }[] }) => {
        billingInvoices = d.invoices ?? [];
      })
      .catch(() => {
        billingInvoices = [];
      });
    const unsubSettings = settingsStore.subscribe((v) => {
      settings = v ?? null;
      if (v?.guardRails?.allowedDirs) allowedDirsText = v.guardRails.allowedDirs.join('\n');
    });

    if (isDockerSetupAvailable()) {
      dockerLoading = true;
      getDockerInfo()
        .then((info) => {
          dockerStatus = info.running ? 'running' : info.error ? 'error' : 'stopped';
        })
        .catch(() => {
          dockerStatus = 'error';
        })
        .finally(() => {
          dockerLoading = false;
        });
    }

    modelGroupsLoading = true;
    fetchApi('/api/models/list')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Failed to fetch models')))
      .then((d: { groups?: ModelListGroup[] }) => {
        modelGroups = d.groups ?? [];
      })
      .catch(() => {
        modelGroups = [];
      })
      .finally(() => {
        modelGroupsLoading = false;
      });

    return () => {
      unsubWorkspace();
      unsubSettings();
    };
  });

  async function dockerComposeUp() {
    dockerStartStopLoading = true;
    try {
      const res = await fetchApi('/api/docker/compose/up', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.ok) dockerStatus = 'running';
      else dockerStatus = 'error';
    } catch {
      dockerStatus = 'error';
    } finally {
      dockerStartStopLoading = false;
    }
  }

  async function dockerComposeDown() {
    dockerStartStopLoading = true;
    try {
      const res = await fetchApi('/api/docker/compose/down', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.ok) dockerStatus = 'stopped';
      else dockerStatus = 'error';
    } catch {
      dockerStatus = 'error';
    } finally {
      dockerStartStopLoading = false;
    }
  }

  function addCustomModel() {
    showCustomModelForm = true;
    customModelDraft = { modelId: '', apiEndpoint: '', contextLength: 4096 };
  }

  function saveCustomModel() {
    if (!customModelDraft.modelId?.trim() || !customModelDraft.apiEndpoint?.trim()) return;
    const list = settings?.models?.customModels ?? [];
    const newModel: CustomModelConfig = {
      id: `custom-${Date.now()}`,
      modelId: customModelDraft.modelId.trim(),
      apiEndpoint: customModelDraft.apiEndpoint.trim(),
      apiKey: customModelDraft.apiKey?.trim() || undefined,
      contextLength: customModelDraft.contextLength ?? 4096,
    };
    saveModels({ ...settings?.models, customModels: [...list, newModel] });
    showCustomModelForm = false;
    customModelDraft = {};
    showToast('Custom model added. Test connection from backend.', 'success');
  }

  function removeCustomModel(id: string) {
    const list = (settings?.models?.customModels ?? []).filter((m) => m.id !== id);
    saveModels({ ...settings?.models, customModels: list.length ? list : undefined });
    showToast('Custom model removed.', 'success');
  }

  async function saveModels(next: ModelsSettings) {
    saving = true;
    const ok = await settingsStore.save({ models: next });
    saving = false;
    if (ok) showToast('Models saved', 'success');
    else showToast('Failed to save models', 'error');
  }

  async function saveAccessibility(accessibility: AccessibilitySettings) {
    saving = true;
    const ok = await settingsStore.save({ accessibility });
    saving = false;
    if (ok) showToast('Accessibility saved', 'success');
    else showToast('Failed to save accessibility', 'error');
  }

  async function saveGuardRails(guardRails: GuardRailsSettings) {
    saving = true;
    const ok = await settingsStore.save({ guardRails });
    saving = false;
    if (ok) showToast('Guard rails saved', 'success');
    else showToast('Failed to save guard rails', 'error');
  }

  function parseAllowedDirs(s: string): string[] {
    return s
      .split(/[\n,]/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function modelValue(): string {
    const m = settings?.models;
    if (!m?.defaultModelId) return 'auto';
    return `${m.defaultProvider ?? 'nim'}:${m.defaultModelId}`;
  }

  async function handleAnalyzeArchitectureClick() {
    if (!workspaceRoot) {
      showToast('Set a workspace root in Code mode before analyzing the codebase.', 'error');
      return;
    }
    analyzingArchitecture = true;
    architectureSummary = null;
    architectureDiagram = null;
    try {
      const result = await analyzeArchitecture(workspaceRoot);
      architectureSummary = result.summary;
      architectureDiagram = result.mermaidDiagram;
      showToast('Codebase architecture diagram generated from workspace.', 'success');
    } catch (err) {
      showToast('Failed to analyze workspace architecture', 'error');
    } finally {
      analyzingArchitecture = false;
    }
  }
</script>

<div class="settings-screen" style:--bg-primary={colors.background.primary}>
  <header class="settings-header">
    <div class="header-left">
      <Button variant="ghost" size="sm" onclick={onBack}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Back
      </Button>
      <h1 class="settings-title">Settings</h1>
    </div>
  </header>

  <div class="settings-body">
    <div class="tabs-sidebar">
      <Tabs tabs={settingsTabs} bind:activeTab variant="pills" size="md" />
    </div>

    <div class="tab-content">
      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <!-- GENERAL TAB -->
      <!-- ═══════════════════════════════════════════════════════════════════ -->
      {#if activeTab === 'general'}
        <div class="tab-section">
          <Card title="Theme" padding="md">
            <p class="section-desc">
              Choose light, dark, or follow your system preference. Dark mode applies across the app.
            </p>
            <div class="theme-options-row">
              {#each [
                { id: 'light' as AppTheme, label: 'Light', icon: Sun },
                { id: 'dark' as AppTheme, label: 'Dark', icon: Moon },
                { id: 'system' as AppTheme, label: 'System', icon: Monitor },
              ] as option}
                <button
                  type="button"
                  class="theme-option-btn"
                  class:selected={$newOnboardingStore?.theme === option.id}
                  onclick={() => newOnboardingStore.setTheme(option.id)}
                  aria-pressed={$newOnboardingStore?.theme === option.id}
                >
                  <option.icon size={20} />
                  <span>{option.label}</span>
                </button>
              {/each}
            </div>
          </Card>

          <Card title="Appearance" padding="md">
            <p class="section-desc">
              Layout density for lists and padding. Compact uses about 20% less space.
            </p>
            <div class="field-group" role="group" aria-labelledby="density-label">
              <span id="density-label" class="radio-label">Density</span>
              <div class="radio-row">
                <label class="radio-option">
                  <input
                    type="radio"
                    name="density"
                    value="comfortable"
                    checked={$density !== 'compact'}
                    onchange={() => preferencesStore.setDensity('comfortable')}
                  />
                  <span>Comfortable</span>
                </label>
                <label class="radio-option">
                  <input
                    type="radio"
                    name="density"
                    value="compact"
                    checked={$density === 'compact'}
                    onchange={() => preferencesStore.setDensity('compact')}
                  />
                  <span>Compact</span>
                </label>
              </div>
            </div>
          </Card>

          <Card title="Privacy & Telemetry" padding="md">
            <p class="section-desc">
              Help improve G-Rump by sharing anonymous usage data. No code or prompts are sent.
            </p>
            <div class="field-group">
              <label class="checkbox-field">
                <input
                  type="checkbox"
                  checked={$newOnboardingStore?.telemetryOptIn ?? true}
                  onchange={(e) => newOnboardingStore.setTelemetry((e.target as HTMLInputElement).checked)}
                />
                <span class="checkbox-label-text">Send anonymous usage analytics</span>
              </label>
            </div>
          </Card>

          <Card title="Accessibility" padding="md">
            <div class="field-group">
              <label class="checkbox-field">
                <input
                  type="checkbox"
                  checked={settings?.accessibility?.reducedMotion ?? false}
                  onchange={(e) =>
                    saveAccessibility({
                      ...settings?.accessibility,
                      reducedMotion: (e.target as HTMLInputElement).checked,
                    })}
                />
                <span class="checkbox-label-text">Reduced Motion</span>
              </label>
              <p class="field-hint">Disable animations for users who prefer reduced motion.</p>
            </div>
            <div class="field-group">
              <label class="checkbox-field">
                <input
                  type="checkbox"
                  checked={settings?.accessibility?.highContrast ?? false}
                  onchange={(e) =>
                    saveAccessibility({
                      ...settings?.accessibility,
                      highContrast: (e.target as HTMLInputElement).checked,
                    })}
                />
                <span class="checkbox-label-text">High Contrast Mode</span>
              </label>
              <p class="field-hint">Increase contrast for better visibility.</p>
            </div>
          </Card>

          <Card title="Keyboard Shortcuts" padding="md">
            <p class="section-desc">Use these shortcuts to navigate and focus quickly.</p>
            <ul class="shortcuts-list">
              <li><kbd>Ctrl</kbd> + <kbd>B</kbd> — Toggle sidebar</li>
              <li>
                <kbd>/</kbd> or <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> — Focus chat input
              </li>
              <li><kbd>Ctrl</kbd> + <kbd>K</kbd> — Open command palette</li>
            </ul>
          </Card>

          {#if hasWakeWord}
            <Card title="Voice & Wake Word" padding="md">
              <p class="section-desc">
                When enabled, say the wake word to activate Talk Mode. Requires microphone access.
              </p>
              <div class="field-group">
                <label class="checkbox-field">
                  <input
                    type="checkbox"
                    checked={$wakeWordEnabled}
                    onchange={(e) => {
                      setWakeWordEnabled((e.target as HTMLInputElement).checked);
                      if ((e.target as HTMLInputElement).checked) {
                        (window as any).grump?.wakeWord?.start?.();
                      } else {
                        (window as any).grump?.wakeWord?.stop?.();
                      }
                    }}
                  />
                  <span>Enable wake word (e.g. "Hey G-Rump")</span>
                </label>
              </div>
            </Card>
          {/if}
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- MODELS TAB (redesigned: preset + model, embedding compact, custom collapsible) -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'models'}
        <div class="tab-section models-tab">
          <Card title="Default model & preset" padding="md">
            <div class="models-section models-preset">
              <label class="field-label" for="model-preset">Quality vs speed</label>
              <select
                id="model-preset"
                class="custom-select"
                value={settings?.models?.modelPreset ?? 'balanced'}
                onchange={(e) => {
                  const v = (e.target as HTMLSelectElement).value as ModelPreset;
                  saveModels({ ...settings?.models, modelPreset: v });
                }}
                disabled={saving}
              >
                <option value="balanced">Balanced (router default)</option>
                <option value="fast">Fast (NIM / Kimi K2.5)</option>
                <option value="quality">Quality (Kimi K2.6)</option>
              </select>
              <p class="field-hint">
                Fast = cheaper and lower latency; Quality = best capability; Balanced = auto by task.
              </p>
            </div>
            <div class="models-section">
              <span class="field-label">AI model (override)</span>
              <ModelPicker
                value={modelValue()}
                compact={false}
                showAuto={true}
                onSelect={(provider, modelId) => {
                  saveModels({
                    ...settings?.models,
                    defaultProvider: provider as 'nim',
                    defaultModelId: modelId ?? undefined,
                  });
                }}
              />
              <p class="field-hint">
                Providers: NVIDIA NIM, Kimi, OpenRouter, Groq, Together, Ollama. Configure API keys in Integrations or backend .env.
              </p>
            </div>
            <div class="models-section">
              <Button variant="ghost" size="sm" onclick={() => setCurrentView('model-benchmark')}>
                Model Benchmark (compare models)
              </Button>
            </div>
          </Card>

          <!-- Provider-first: all providers and models from backend -->
          <Card title="Models by provider" padding="md" class="models-provider-list-card">
            {#if modelGroupsLoading}
              <p class="models-provider-loading">Loading model list…</p>
            {:else if modelGroups.length === 0}
              <p class="field-hint">No providers available. Configure API keys in Integrations or backend .env.</p>
            {:else}
              <p class="field-hint models-provider-intro">Pick a model per provider; selecting one sets it as the default chat/code model.</p>
              <div class="models-provider-list">
                {#each modelGroups as group}
                  <div class="models-provider-row">
                    <div class="models-provider-heading">
                      <img
                        src={group.icon}
                        alt=""
                        class="models-provider-icon"
                        onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
                      />
                      <span class="models-provider-name">{group.displayName}</span>
                    </div>
                    <select
                      class="custom-select models-provider-select"
                      value={settings?.models?.defaultProvider === group.provider ? (settings?.models?.defaultModelId ?? '') : ''}
                      onchange={(e) => {
                        const modelId = (e.target as HTMLSelectElement).value;
                        if (!modelId) return;
                        saveModels({
                          ...settings?.models,
                          defaultProvider: group.provider as ModelsSettings['defaultProvider'],
                          defaultModelId: modelId,
                        });
                      }}
                      disabled={saving}
                      aria-label="Model for {group.displayName}"
                    >
                      <option value="">— Select model —</option>
                      {#each group.models as model}
                        <option value={model.id}>
                          {model.description ?? model.id}
                          {#if model.contextWindow}
                            ({model.contextWindow >= 1000 ? `${model.contextWindow / 1000}K` : model.contextWindow} ctx)
                          {/if}
                          {#if model.isRecommended} ★{/if}
                        </option>
                      {/each}
                    </select>
                  </div>
                {/each}
              </div>
            {/if}
          </Card>

          <Card title="Embedding" padding="md" class="models-embedding-card">
            <label class="field-label" for="embedding-model">RAG / semantic search</label>
            <select
              id="embedding-model"
              class="custom-select"
              value={settings?.models?.embeddingModelId ?? 'BAAI/bge-small-en-v1.5'}
              onchange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                saveModels({ ...settings?.models, embeddingModelId: v || undefined });
              }}
              disabled={saving}
            >
              <option value="BAAI/bge-small-en-v1.5">BAAI/bge-small-en-v1.5</option>
              <option value="nvidia/nv-embed-v2">nvidia/nv-embed-v2</option>
              <option value="">Default (backend)</option>
            </select>
            <p class="field-hint">Used for RAG. Test connection in backend.</p>
          </Card>

          <details class="models-custom-details">
            <summary>Custom models</summary>
            <div class="models-custom-inner">
              <p class="section-desc">Add a model by ID, API endpoint, and optional API key.</p>
              <Button
                variant="secondary"
                size="sm"
                onclick={() => addCustomModel()}
                disabled={saving}
              >
                Add Custom Model
              </Button>
              {#if showCustomModelForm}
                <div class="custom-model-form">
                  <input
                    type="text"
                    class="custom-input"
                    placeholder="Model ID"
                    bind:value={customModelDraft.modelId}
                  />
                  <input
                    type="text"
                    class="custom-input"
                    placeholder="API endpoint (e.g. https://api.example.com/v1)"
                    bind:value={customModelDraft.apiEndpoint}
                  />
                  <input
                    type="password"
                    class="custom-input"
                    placeholder="API key (optional)"
                    bind:value={customModelDraft.apiKey}
                  />
                  <input
                    type="number"
                    class="custom-input"
                    placeholder="Context length"
                    bind:value={customModelDraft.contextLength}
                  />
                  <div class="custom-model-form-actions">
                    <Button
                      variant="primary"
                      size="sm"
                      onclick={saveCustomModel}
                      disabled={!customModelDraft.modelId?.trim() ||
                        !customModelDraft.apiEndpoint?.trim()}>Save</Button
                    >
                    <Button
                      variant="ghost"
                      size="sm"
                      onclick={() => {
                        showCustomModelForm = false;
                        customModelDraft = {};
                      }}>Cancel</Button
                    >
                  </div>
                </div>
              {/if}
              {#if (settings?.models?.customModels ?? []).length > 0}
                <ul class="custom-models-list">
                  {#each settings?.models?.customModels ?? [] as model (model.id)}
                    <li class="custom-model-item">
                      <span class="custom-model-id">{model.modelId}</span>
                      <span class="custom-model-endpoint">{model.apiEndpoint}</span>
                      <Button variant="ghost" size="sm" onclick={() => removeCustomModel(model.id)}
                        >Remove</Button
                      >
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          </details>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- GIT TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'git'}
        <div class="tab-section git-tab">
          <Card title="Workspace & Repository" padding="md">
            <p class="section-desc">
              Current workspace and Git repository. Connect a GitHub repo in Integrations or open a folder in the app.
            </p>
            <div class="field-group">
              <span class="field-label">Workspace root</span>
              <p class="field-value monospace">{workspaceRoot ?? 'Not set'}</p>
            </div>
            <div class="field-group">
              <span class="field-label">Repository URL</span>
              <p class="field-value monospace">{$workspaceStore?.repoUrl ?? 'None (local only)'}</p>
            </div>
            <Button variant="ghost" size="sm" onclick={() => setCurrentView('integrations')}>
              Open Integrations to connect GitHub
            </Button>
          </Card>
          <Card title="G-Agent Git Capability" padding="md">
            <p class="section-desc">
              Allow G-Agent to run Git commands (status, diff, commit, branch, push) in your workspace.
            </p>
            <div class="field-group">
              <label class="checkbox-field">
                <input
                  type="checkbox"
                  checked={$gAgentCapabilities?.includes('git') ?? false}
                  onchange={(e) => {
                    const enabled = (e.target as HTMLInputElement).checked;
                    const current: GAgentCapabilityKey[] = $gAgentCapabilities ?? [];
                    const next: GAgentCapabilityKey[] = enabled
                      ? (current.includes('git') ? current : [...current, 'git'])
                      : current.filter((c) => c !== 'git');
                    preferencesStore.setGAgentCapabilities(next);
                  }}
                />
                <span class="checkbox-label-text">Enable Git for G-Agent</span>
              </label>
            </div>
          </Card>
          <Card title="Git Tips" padding="md">
            <ul class="tips-list">
              <li>Use Ship mode to push generated code to a new GitHub repo.</li>
              <li>Connect GitHub in Integrations for OAuth and repo access.</li>
              <li>G-Agent can run git status, diff, commit, and push when the capability is enabled.</li>
            </ul>
          </Card>
        </div>

        <!-- SECURITY TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'security'}
        <div class="tab-section security-tab">
          <Card title="File Access Control" padding="md">
            <p class="section-desc">
              Restrict which directories the agent can read and write. Leave empty to allow the current workspace only.
            </p>
            <div class="field-group">
              <div class="field-label-row">
                <label class="field-label" for="allowed-dirs">Allowed directories</label>
                {#if isElectron}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={saving}
                    onclick={async () => {
                      const grump = (window as { grump?: { selectDirectory?: () => Promise<{ path?: string; canceled?: boolean }> } }).grump;
                      const result = await grump?.selectDirectory?.();
                      if (result?.canceled || !result?.path) return;
                      const trimmed = result.path.trim();
                      if (!trimmed) return;
                      allowedDirsText = allowedDirsText.trim() ? `${allowedDirsText.trim()}\n${trimmed}` : trimmed;
                      const dirs = parseAllowedDirs(allowedDirsText);
                      saveGuardRails({
                        ...settings?.guardRails,
                        allowedDirs: dirs.length ? dirs : undefined,
                      });
                    }}
                  >
                    Browse
                  </Button>
                {/if}
              </div>
              <textarea
                id="allowed-dirs"
                class="custom-textarea security-textarea"
                placeholder="C:\projects\my-app&#10;/home/user/projects&#10;/Users/me/workspace"
                rows={5}
                bind:value={allowedDirsText}
                onfocus={async () => {
                  if (!isElectron || saving) return;
                  const grump = (window as { grump?: { selectDirectory?: () => Promise<{ path?: string; canceled?: boolean }> } }).grump;
                  if (!grump?.selectDirectory) return;
                  const result = await grump.selectDirectory();
                  if (result?.canceled || !result?.path) return;
                  const trimmed = result.path.trim();
                  if (!trimmed) return;
                  allowedDirsText = allowedDirsText.trim() ? `${allowedDirsText.trim()}\n${trimmed}` : trimmed;
                  const dirs = parseAllowedDirs(allowedDirsText);
                  saveGuardRails({
                    ...settings?.guardRails,
                    allowedDirs: dirs.length ? dirs : undefined,
                  });
                }}
                onblur={() => {
                  const dirs = parseAllowedDirs(allowedDirsText);
                  saveGuardRails({
                    ...settings?.guardRails,
                    allowedDirs: dirs.length ? dirs : undefined,
                  });
                }}
                disabled={saving}
                aria-describedby="allowed-dirs-hint"
              ></textarea>
              <p id="allowed-dirs-hint" class="field-hint">
                One path per line. Example: <code>C:\projects\my-app</code> or <code>/Users/me/workspace</code>
                {#if isElectron}
                  Focus this field to open folder picker (Electron).
                {:else}
                  In the desktop app you can use <strong>Browse</strong> or focus the field to pick a folder.
                {/if}
              </p>
            </div>
          </Card>

          <Card title="Guard Rails" padding="md">
            <p class="section-desc">
              Control how the agent behaves when modifying files and using tools.
            </p>
            <div class="guard-rail-options">
              <label class="guard-rail-item">
                <input
                  type="checkbox"
                  checked={settings?.guardRails?.confirmEveryWrite !== false}
                  onchange={(e) =>
                    saveGuardRails({
                      ...settings?.guardRails,
                      confirmEveryWrite: (e.target as HTMLInputElement).checked,
                    })}
                />
                <span class="guard-rail-title">Confirm every file write</span>
                <span class="guard-rail-desc">Require approval before any file is modified</span>
              </label>
              <label class="guard-rail-item">
                <input
                  type="checkbox"
                  checked={settings?.guardRails?.autonomousMode ?? false}
                  onchange={(e) =>
                    saveGuardRails({
                      ...settings?.guardRails,
                      autonomousMode: (e.target as HTMLInputElement).checked,
                    })}
                />
                <span class="guard-rail-title">Autonomous (YOLO) mode</span>
                <span class="guard-rail-desc">Skip confirmations; tools run without per-step approval. Use with care.</span>
              </label>
              <label class="guard-rail-item">
                <input
                  type="checkbox"
                  checked={settings?.guardRails?.useLargeContext ?? false}
                  onchange={(e) =>
                    saveGuardRails({
                      ...settings?.guardRails,
                      useLargeContext: (e.target as HTMLInputElement).checked,
                    })}
                />
                <span class="guard-rail-title">Large context (200K+)</span>
                <span class="guard-rail-desc">Allow longer messages for models that support it</span>
              </label>
              <label class="guard-rail-item">
                <input
                  type="checkbox"
                  checked={$includeRagContext}
                  onchange={(e) =>
                    preferencesStore.setIncludeRagContext((e.target as HTMLInputElement).checked)}
                />
                <span class="guard-rail-title">Include RAG context in chat</span>
                <span class="guard-rail-desc">Inject indexed docs for more tailored answers</span>
              </label>
            </div>
          </Card>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- INTEGRATIONS TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'integrations'}
        <div class="tab-section integrations-tab">
          <section class="integrations-section">
            <h2 class="integrations-section-title">Connect services</h2>
            <p class="integrations-section-desc">OAuth and API connections for GitHub, Slack, Notion, and more.</p>
            <div class="integrations-section-content integrations-primary">
              <IntegrationsHub onBack={() => {}} embedInTab={true} />
            </div>
          </section>

          <section class="integrations-section">
            <h2 class="integrations-section-title">Local & MCP</h2>
            <p class="integrations-section-desc">Docker stack, MCP servers, and scheduled agents.</p>
            <div class="integrations-section-content integrations-grid-three">
              <Card title="Docker" padding="md">
                <p class="section-desc">
                  Start or stop the G-Rump Docker stack. Use Setup Wizard for one-click GPU setup.
                </p>
                {#if dockerLoading}
                  <p class="status-text">Checking Docker status…</p>
                {:else if dockerStatus}
                  <div class="status-row">
                    <span class="status-label">Status</span>
                    <Badge
                      variant={dockerStatus === 'running'
                        ? 'success'
                        : dockerStatus === 'error'
                          ? 'error'
                          : 'default'}
                    >
                      {dockerStatus === 'running'
                        ? 'Running'
                        : dockerStatus === 'error'
                          ? 'Error'
                          : 'Stopped'}
                    </Badge>
                  </div>
                {/if}
                <div class="docker-actions">
                  <Button
                    variant="primary"
                    size="sm"
                    onclick={dockerComposeUp}
                    disabled={dockerStartStopLoading}
                  >
                    Start Stack
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onclick={dockerComposeDown}
                    disabled={dockerStartStopLoading}
                  >
                    Stop Stack
                  </Button>
                  <Button variant="ghost" size="sm" onclick={() => setCurrentView('docker')}>
                    Open Docker Panel
                  </Button>
                  <Button variant="ghost" size="sm" onclick={() => setCurrentView('docker-setup')}>
                    Docker Setup Wizard
                  </Button>
                </div>
              </Card>
              <McpServersCard />
              <ScheduledAgents />
            </div>
          </section>

          <section class="integrations-section">
            <h2 class="integrations-section-title">Workspace</h2>
            <p class="integrations-section-desc">Codebase diagram and recommended VS Code extensions.</p>
            <div class="integrations-section-content integrations-grid-two">
              <Card title="Codebase Architecture" padding="md">
                <p class="section-desc">
                  Scan your current workspace and generate a Mermaid architecture diagram.
                </p>
                <div class="field-group">
                  <Button
                    variant="primary"
                    size="sm"
                    onclick={handleAnalyzeArchitectureClick}
                    disabled={analyzingArchitecture}
                  >
                    {#if analyzingArchitecture}
                      Analyzing workspace…
                    {:else}
                      Generate diagram from workspace
                    {/if}
                  </Button>
                  <p class="field-hint">
                    Uses the workspace root from Code mode. Diagram is generated using codebase
                    analysis.
                  </p>
                </div>
                {#if architectureSummary || architectureDiagram}
                  {#if architectureSummary}
                    <div class="field-group">
                      <p class="field-label">Summary</p>
                      <p class="architecture-summary">{architectureSummary}</p>
                    </div>
                  {/if}
                  {#if architectureDiagram}
                    <div class="field-group">
                      <p class="field-label">Mermaid diagram</p>
                      <pre class="mermaid-output"><code>{architectureDiagram}</code></pre>
                      <p class="field-hint">
                        Copy this into Architecture mode or any Mermaid viewer to visualize.
                      </p>
                    </div>
                  {/if}
                {/if}
              </Card>
              <div class="integrations-grid-cell-tools">
                <Card title="Tools & Extensions" padding="md">
                  <RecommendedExtensions />
                </Card>
              </div>
            </div>
          </section>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- BILLING TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'billing'}
        <div class="tab-section">
          <Card title="Subscription & Usage" padding="md">
            <div class="billing-status">
              {#if billingMe?.tier}
                <div class="status-row">
                  <span class="status-label">Current Tier</span>
                  <Badge variant="primary">{billingMe.tier}</Badge>
                </div>
                <div class="status-row">
                  <span class="status-label">Usage</span>
                  <span class="status-value"
                    >{billingMe.usage ?? 0} / {billingMe.limit ?? '∞'} calls</span
                  >
                </div>
                {#if billingMe.computeMinutesLimit != null}
                  <div class="status-row">
                    <span class="status-label">Compute</span>
                    <span class="status-value"
                      >{(billingMe.computeMinutesUsed ?? 0).toFixed(1)} / {billingMe.computeMinutesLimit}
                      min</span
                    >
                  </div>
                {/if}
                {#if billingMe.storageGbLimit != null}
                  <div class="status-row">
                    <span class="status-label">Storage</span>
                    <span class="status-value"
                      >{(billingMe.storageGbUsed ?? 0).toFixed(2)} / {billingMe.storageGbLimit} GB</span
                    >
                  </div>
                {/if}
                {#if billingMe.overageRates}
                  <div class="status-row">
                    <span class="status-label">Overages</span>
                    <span class="status-value">
                      ${(billingMe.overageRates.storageGbMonthlyCents / 100).toFixed(2)}/GB • ${(
                        billingMe.overageRates.computeMinuteCents / 100
                      ).toFixed(2)}/min • ${(
                        billingMe.overageRates.extraConcurrentAgentMonthlyCents / 100
                      ).toFixed(2)}/slot
                    </span>
                  </div>
                {/if}
                {#if tiers.length}
                  <div class="status-row">
                    <span class="status-label">Available tiers</span>
                    <span class="status-value">{tiers.length}</span>
                  </div>
                {/if}
              {:else}
                <p class="billing-empty">Sign in to view your subscription details.</p>
              {/if}
            </div>
            <div class="billing-actions">
              <Button variant="primary" size="sm" onclick={() => showPricing.set(true)}>
                Upgrade
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onclick={() => {
                  setCurrentView('cost');
                }}
              >
                Cost Dashboard
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onclick={() => window.open(billingUrl, '_blank')}
                title="Open external billing portal if configured"
              >
                Billing portal
              </Button>
            </div>
          </Card>

          <Card title="Payment methods" padding="md">
            <p class="section-desc">
              Manage payment methods for your subscription. In-app management coming soon.
            </p>
            {#if billingPaymentMethods.length > 0}
              <ul class="billing-list">
                {#each billingPaymentMethods as pm}
                  <li class="billing-list-item">
                    <span>{pm.brand ?? 'Card'} •••• {pm.last4 ?? '----'}</span>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="billing-empty">No payment methods on file. Add one when upgrading.</p>
            {/if}
          </Card>

          <Card title="Invoices" padding="md">
            <p class="section-desc">Download past invoices. In-app list when billing is fully wired.</p>
            {#if billingInvoices.length > 0}
              <ul class="billing-list">
                {#each billingInvoices as inv}
                  <li class="billing-list-item">
                    <span>{inv.date}</span>
                    <span>${(inv.amount / 100).toFixed(2)}</span>
                    <Badge variant={inv.status === 'paid' ? 'success' : 'default'}>{inv.status}</Badge>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="billing-empty">No invoices yet.</p>
            {/if}
          </Card>

          <Card title="Add-On Credit Usage" padding="md">
            <p class="section-desc">
              Credits used by add-ons and platform features (AI calls, compute, storage).
            </p>
            <div class="billing-status">
              {#if billingMe?.tier}
                <div class="status-row">
                  <span class="status-label">API / AI calls</span>
                  <span class="status-value"
                    >{billingMe.usage ?? 0} / {billingMe.limit ?? '∞'} calls</span
                  >
                </div>
                {#if billingMe.computeMinutesLimit != null}
                  <div class="status-row">
                    <span class="status-label">Compute minutes</span>
                    <span class="status-value"
                      >{(billingMe.computeMinutesUsed ?? 0).toFixed(1)} / {billingMe.computeMinutesLimit}
                      min</span
                    >
                  </div>
                {/if}
                {#if billingMe.storageGbLimit != null}
                  <div class="status-row">
                    <span class="status-label">Storage</span>
                    <span class="status-value"
                      >{(billingMe.storageGbUsed ?? 0).toFixed(2)} / {billingMe.storageGbLimit} GB</span
                    >
                  </div>
                {/if}
              {:else}
                <p class="billing-empty">Sign in to view add-on credit usage.</p>
              {/if}
            </div>
          </Card>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- ABOUT TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'about'}
        <div class="tab-section">
          <Card title="Onboarding & Help" padding="md">
            <p class="section-desc">
              Show the welcome and setup carousel again, run troubleshooting, or factory reset.
            </p>
            <div class="docker-actions">
              <Button
                variant="secondary"
                size="sm"
                onclick={() => {
                  newOnboardingStore.reset();
                  onboardingStore.resetOnboarding();
                  setCurrentView('chat');
                  window.location.reload();
                }}
              >
                Show onboarding again
              </Button>
              {#if isElectron}
                <Button
                  variant="secondary"
                  size="sm"
                  onclick={() => {
                    authGateStore.resetAuthSkipped();
                    window.location.reload();
                  }}
                >
                  Re-prompt for sign-in
                </Button>
              {/if}
              <Button variant="ghost" size="sm" onclick={() => setCurrentView('troubleshooting')}>
                Troubleshooting
              </Button>
              <Button variant="ghost" size="sm" onclick={() => setCurrentView('reset')}>
                Factory Reset
              </Button>
            </div>
          </Card>

          <Card title="Legal" padding="md">
            <p class="section-desc">Terms of Service, Privacy Policy, and Acceptable Use Policy.</p>
            <div class="legal-links">
              <Button
                variant="ghost"
                size="sm"
                onclick={() => window.open('https://docs.g-rump.com/legal/terms', '_blank')}
              >
                Terms of Service
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onclick={() => window.open('https://docs.g-rump.com/legal/privacy', '_blank')}
              >
                Privacy Policy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onclick={() =>
                  window.open('https://docs.g-rump.com/legal/acceptable-use', '_blank')}
              >
                Acceptable Use
              </Button>
            </div>
          </Card>

          <Card title="About G-Rump" padding="md">
            <div class="about-info">
              <p class="about-version">Version: 1.0.0-beta</p>
              <p class="about-desc">
                G-Rump is an AI-powered development assistant that helps you write, understand, and
                refactor code.
              </p>
            </div>
          </Card>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .settings-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--bg-primary);
    overflow: hidden;
  }

  .settings-header {
    background-color: white;
    border-bottom: 1px solid var(--border-color, #e4e4e7);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 10;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .settings-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
    color: #18181b;
  }

  .settings-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .tabs-sidebar {
    width: 220px;
    padding: 24px 16px;
    background: #f9fafb;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
  }

  .tabs-sidebar :global(.tabs-container) {
    flex-direction: column;
  }

  .tabs-sidebar :global(.tabs-list) {
    flex-direction: column;
    gap: 4px;
  }

  .tabs-sidebar :global(.tab) {
    justify-content: flex-start;
    text-align: left;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
    transition: background 0.15s, color 0.15s;
  }

  .tabs-sidebar :global(.tab:hover) {
    background: #f3f4f6;
    color: #374151;
  }

  .tabs-sidebar :global(.tab.active) {
    background: #ffffff;
    color: #111827;
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    border: 1px solid #e5e7eb;
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 32px;
    background: #ffffff;
  }

  .tab-section {
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .tab-section.integrations-tab {
    max-width: none;
    display: flex;
    flex-direction: column;
    gap: 2rem;
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

  .integrations-section-content.integrations-primary {
    width: 100%;
  }

  .integrations-section-content.integrations-grid-three {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    align-items: start;
  }

  .integrations-section-content.integrations-grid-two {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    align-items: start;
  }

  .integrations-grid-cell-tools {
    min-width: 0;
    min-height: 0;
  }

  .integrations-grid-cell-tools :global(.card) {
    overflow: visible;
    height: auto;
  }

  .tab-section.integrations-tab .section-desc {
    font-size: 0.8125rem;
    line-height: 1.4;
    margin-bottom: 0.5rem;
  }

  .tab-section.integrations-tab .field-label,
  .tab-section.integrations-tab .label {
    font-size: 0.8125rem;
  }

  .tab-section.integrations-tab .docker-actions {
    margin-top: 0.5rem;
    gap: 0.5rem;
  }

  .tab-section.integrations-tab .status-text {
    font-size: 0.8125rem;
    margin: 0.375rem 0;
  }

  @media (max-width: 1024px) {
    .integrations-section-content.integrations-grid-three {
      grid-template-columns: repeat(2, 1fr);
    }

    .integrations-section-content.integrations-grid-two {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .integrations-section-content.integrations-grid-three {
      grid-template-columns: 1fr;
    }
  }

  .tab-section :global(.card) {
    border: 1px solid #e5e7eb;
  }

  .models-tab {
    max-width: 720px;
  }

  .models-tab .models-section {
    margin-bottom: 1.25rem;
  }

  .models-tab .models-section:last-child {
    margin-bottom: 0;
  }

  .models-tab .models-preset .custom-select {
    max-width: 280px;
  }

  .models-provider-list-card {
    max-width: 720px;
  }

  .models-provider-loading {
    color: #6b7280;
    font-size: 0.875rem;
    margin: 0;
  }

  .models-provider-intro {
    margin-bottom: 1rem;
  }

  .models-provider-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 360px;
    overflow-y: auto;
  }

  .models-provider-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .models-provider-heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 140px;
  }

  .models-provider-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }

  .models-provider-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  .models-provider-select {
    flex: 1;
    min-width: 200px;
    max-width: 400px;
  }

  .models-custom-details {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    overflow: hidden;
  }

  .models-custom-details summary {
    padding: 0.875rem 1rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    background: #f9fafb;
    list-style: none;
  }

  .models-custom-details summary::-webkit-details-marker {
    display: none;
  }

  .models-custom-details summary::before {
    content: '▸ ';
    display: inline-block;
    margin-right: 0.375rem;
    transition: transform 0.2s;
  }

  .models-custom-details[open] summary::before {
    transform: rotate(90deg);
  }

  .models-custom-inner {
    padding: 1rem 1rem 1.25rem;
    border-top: 1px solid #e5e7eb;
  }

  .models-custom-inner .section-desc {
    margin-bottom: 0.75rem;
  }

  .section-desc {
    font-size: 14px;
    color: #71717a;
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
    color: #3f3f46;
    margin-bottom: 8px;
  }

  .field-label-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 8px;
  }

  .field-label-row .field-label {
    margin-bottom: 0;
  }

  .field-hint {
    font-size: 12px;
    color: #a1a1aa;
    margin-top: 6px;
  }

  .radio-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #3f3f46;
    margin-bottom: 8px;
  }

  .theme-options-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .theme-option-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary, #4a4a5a);
    background: var(--color-bg-input, #f3f4f6);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .theme-option-btn:hover {
    background: var(--color-bg-card-hover, #f9fafb);
    border-color: var(--color-border-highlight, #d1d5db);
  }

  .theme-option-btn.selected {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
  }

  .field-value {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary, #4a4a5a);
  }

  .field-value.monospace {
    font-family: ui-monospace, monospace;
    font-size: 0.8125rem;
    word-break: break-all;
  }

  .tips-list {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary, #4a4a5a);
    line-height: 1.6;
  }

  .tips-list li {
    margin-bottom: 0.5rem;
  }

  .radio-row {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }

  .radio-option {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #3f3f46;
    cursor: pointer;
  }

  .radio-option input {
    cursor: pointer;
  }

  .custom-select {
    width: 100%;
    height: 40px;
    padding: 0 12px;
    border: 1px solid #e4e4e7;
    border-radius: 6px;
    background-color: white;
    font-size: 14px;
    outline: none;
    transition: border-color 150ms;
  }

  .custom-select:focus {
    border-color: var(--color-primary, #7c3aed);
  }

  .custom-textarea {
    width: 100%;
    min-height: 80px;
    padding: 12px;
    border: 1px solid #e4e4e7;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    outline: none;
    resize: vertical;
  }

  .custom-textarea:focus {
    border-color: var(--color-primary, #7c3aed);
  }

  .security-tab .section-desc {
    margin-bottom: 1rem;
    color: #71717a;
    line-height: 1.5;
  }

  .security-textarea {
    min-height: 120px;
    font-family: ui-monospace, monospace;
  }

  .field-hint code {
    font-size: 0.75em;
    padding: 0.1em 0.35em;
    background: #f4f4f5;
    border-radius: 4px;
  }

  .guard-rail-options {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .guard-rail-item {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    gap: 2px 12px;
    padding: 14px 0;
    border-bottom: 1px solid #f4f4f5;
    cursor: pointer;
    user-select: none;
    align-items: start;
  }

  .guard-rail-item:last-child {
    border-bottom: none;
  }

  .guard-rail-item input {
    grid-row: 1 / -1;
    margin-top: 3px;
    cursor: pointer;
  }

  .guard-rail-title {
    font-size: 14px;
    font-weight: 500;
    color: #3f3f46;
  }

  .guard-rail-desc {
    font-size: 12px;
    color: #71717a;
    line-height: 1.4;
  }

  .checkbox-field {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label-text {
    font-size: 14px;
    color: #3f3f46;
  }

  .billing-status {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }

  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background-color: #f9fafb;
    border-radius: 8px;
  }

  .status-label {
    font-size: 14px;
    font-weight: 500;
    color: #71717a;
  }

  .status-value {
    font-size: 14px;
    font-weight: 600;
    color: #18181b;
  }

  .billing-empty {
    font-size: 14px;
    color: #71717a;
    font-style: italic;
    margin-bottom: 16px;
  }

  .billing-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .billing-list-item {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: #18181b;
  }

  .billing-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .docker-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .status-text {
    margin: 8px 0;
    color: #71717a;
    font-size: 14px;
  }

  .custom-model-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
    padding: 12px;
    background: #f9fafb;
    border-radius: 8px;
  }

  .custom-model-form .custom-input {
    padding: 8px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 14px;
  }

  .custom-model-form-actions {
    display: flex;
    gap: 8px;
  }

  .custom-models-list {
    list-style: none;
    padding: 0;
    margin: 12px 0 0;
  }

  .custom-model-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    margin-bottom: 4px;
  }

  .custom-model-id {
    font-family: monospace;
    font-weight: 600;
    font-size: 13px;
  }

  .custom-model-endpoint {
    font-size: 12px;
    color: #6b7280;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .shortcuts-list {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: 14px;
    color: #3f3f46;
  }

  .shortcuts-list li {
    padding: 8px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .shortcuts-list kbd {
    padding: 2px 6px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    background: #f4f4f5;
    border: 1px solid #e4e4e7;
    border-radius: 4px;
  }

  .legal-links {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .about-info {
    text-align: center;
    padding: 20px;
  }

  .about-version {
    font-size: 14px;
    font-weight: 600;
    color: #3f3f46;
    margin-bottom: 8px;
  }

  .about-desc {
    font-size: 14px;
    color: #71717a;
  }

  .architecture-summary {
    font-size: 14px;
    color: #3f3f46;
    line-height: 1.5;
    background: #f9fafb;
    padding: 12px;
    border-radius: 6px;
  }

  .mermaid-output {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    font-size: 13px;
  }

  .mermaid-output code {
    font-family: ui-monospace, monospace;
  }
</style>
