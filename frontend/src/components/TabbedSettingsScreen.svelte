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
  import ModelPicker from './ModelPicker.svelte';
  import { Button, Card, Badge, Tabs } from '../lib/design-system';
  import { colors } from '../lib/design-system/tokens/colors';
  import { workspaceStore } from '../stores/workspaceStore';
  import { analyzeArchitecture } from '../stores/featuresStore';
  import { setCurrentView, showPricing } from '../stores/uiStore';
  import { onboardingStore } from '../stores/onboardingStore';
  import { authGateStore } from '../stores/authGateStore';
  import { preferencesStore, density, includeRagContext } from '../stores/preferencesStore';
  import {
    wakeWordEnabled,
    setWakeWordEnabled,
    loadWakeWordEnabled,
  } from '../stores/wakeWordStore';
  import { getDockerInfo, isDockerSetupAvailable } from '../lib/dockerSetup';
  import { Settings2, Cpu, Shield, Puzzle, CreditCard, Info } from 'lucide-svelte';

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
  }

  let { onBack, billingUrl = '#' }: Props = $props();

  // Tab definitions
  const settingsTabs = [
    { id: 'general', label: 'General', icon: Settings2 },
    { id: 'models', label: 'Models', icon: Cpu },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: Puzzle },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'about', label: 'About', icon: Info },
  ];

  let activeTab = $state('general');

  // State
  let settings = $state<Settings | null>(null);
  let saving = $state(false);
  let allowedDirsText = $state('');
  let tiers = $state<Tier[]>([]);
  let billingMe = $state<BillingMe | null>(null);
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
        <!-- MODELS TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'models'}
        <div class="tab-section">
          <Card title="AI Models" padding="md">
            <p class="section-desc">Default AI model for code generation and chat.</p>
            <div class="field-group">
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
                <option value="fast">Fast (NIM / Kimi)</option>
                <option value="quality">Quality (Kimi K2.6)</option>
              </select>
              <p class="field-hint">
                Fast = cheaper and lower latency; Quality = best capability; Balanced = auto by
                task.
              </p>
            </div>
            <div class="field-group">
              <span class="field-label">AI Model (override)</span>
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
            </div>
            <div class="field-group">
              <Button variant="ghost" size="sm" onclick={() => setCurrentView('model-benchmark')}>
                Model Benchmark (compare models)
              </Button>
            </div>
          </Card>

          <Card title="Embedding Model" padding="md">
            <div class="field-group">
              <label class="field-label" for="embedding-model">Embedding model for RAG</label>
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
              <p class="field-hint">
                Used for RAG and semantic search. Test connection in backend.
              </p>
            </div>
          </Card>

          <Card title="Custom Models" padding="md">
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
          </Card>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- SECURITY TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'security'}
        <div class="tab-section">
          <Card title="File Access" padding="md">
            <p class="section-desc">Control which directories the agent can access.</p>
            <div class="field-group">
              <label class="field-label" for="allowed-dirs">Allowed Directories</label>
              <textarea
                id="allowed-dirs"
                class="custom-textarea"
                placeholder="C:\projects\my-app"
                bind:value={allowedDirsText}
                onblur={() => {
                  const dirs = parseAllowedDirs(allowedDirsText);
                  saveGuardRails({
                    ...settings?.guardRails,
                    allowedDirs: dirs.length ? dirs : undefined,
                  });
                }}
                disabled={saving}
              ></textarea>
              <p class="field-hint">
                One path per line. Only these directories will be accessible.
              </p>
            </div>
          </Card>

          <Card title="Guard Rails" padding="md">
            <div class="field-group">
              <label class="checkbox-field">
                <input
                  type="checkbox"
                  checked={settings?.guardRails?.confirmEveryWrite !== false}
                  onchange={(e) =>
                    saveGuardRails({
                      ...settings?.guardRails,
                      confirmEveryWrite: (e.target as HTMLInputElement).checked,
                    })}
                />
                <span class="checkbox-label-text">Confirm every file write</span>
              </label>
              <p class="field-hint">Require approval before any file is modified.</p>
            </div>
            <div class="field-group">
              <label class="checkbox-field">
                <input
                  type="checkbox"
                  checked={settings?.guardRails?.autonomousMode ?? false}
                  onchange={(e) =>
                    saveGuardRails({
                      ...settings?.guardRails,
                      autonomousMode: (e.target as HTMLInputElement).checked,
                    })}
                />
                <span class="checkbox-label-text">Autonomous (YOLO) mode</span>
              </label>
              <p class="field-hint">
                Skip tool confirmations; tools run without per-step approval. Use with care.
              </p>
            </div>
            <div class="field-group">
              <label class="checkbox-field">
                <input
                  type="checkbox"
                  checked={settings?.guardRails?.useLargeContext ?? false}
                  onchange={(e) =>
                    saveGuardRails({
                      ...settings?.guardRails,
                      useLargeContext: (e.target as HTMLInputElement).checked,
                    })}
                />
                <span class="checkbox-label-text">Large context (200K+)</span>
              </label>
              <p class="field-hint">
                Allow longer messages for chat when using models that support large context.
              </p>
            </div>
            <div class="field-group">
              <label class="checkbox-field">
                <input
                  type="checkbox"
                  checked={$includeRagContext}
                  onchange={(e) =>
                    preferencesStore.setIncludeRagContext((e.target as HTMLInputElement).checked)}
                />
                <span class="checkbox-label-text">Include RAG context in chat</span>
              </label>
              <p class="field-hint">Inject indexed docs into chat for more tailored answers.</p>
            </div>
          </Card>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- INTEGRATIONS TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'integrations'}
        <div class="tab-section">
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

          <ScheduledAgents />

          <Card title="Tools & Extensions" padding="md">
            <RecommendedExtensions />
          </Card>

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
                variant="secondary"
                size="sm"
                onclick={() => window.open(billingUrl, '_blank')}
              >
                Manage Billing
              </Button>
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
                  onboardingStore.resetOnboarding();
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
    width: 200px;
    padding: 24px 16px;
    background: #fafafa;
    border-right: 1px solid #e4e4e7;
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
    padding: 10px 14px;
    border-radius: 8px;
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 32px;
  }

  .tab-section {
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: 24px;
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
