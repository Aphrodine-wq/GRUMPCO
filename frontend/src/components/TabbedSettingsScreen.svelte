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
  import ModelPicker from './ModelPicker.svelte';
  import { Button, Card, Badge, Tabs } from '../lib/design-system';
  import { colors } from '../lib/design-system/tokens/colors';
  import { workspaceStore } from '../stores/workspaceStore';
  import { analyzeArchitecture } from '../stores/featuresStore';
  import { setCurrentView, showPricing, settingsInitialTab } from '../stores/uiStore';
  import { onboardingStore } from '../stores/onboardingStore';
  import { newOnboardingStore } from '../stores/newOnboardingStore';
  import { authGateStore } from '../stores/authGateStore';
  import {
    preferencesStore,
    density,
    includeRagContext,
    gAgentCapabilities,
    gAgentExternalAllowlist,
    type GAgentCapabilityKey,
  } from '../stores/preferencesStore';
  import {
    wakeWordEnabled,
    setWakeWordEnabled,
    loadWakeWordEnabled,
  } from '../stores/wakeWordStore';
  import { getDockerInfo, isDockerSetupAvailable } from '../lib/dockerSetup';
  import {
    Settings2,
    Cpu,
    Shield,
    Puzzle,
    CreditCard,
    Info,
    GitBranch,
    Sun,
    Moon,
    Monitor,
    Bot,
    Brain,
    Server,
    Check,
    AlertCircle,
    ExternalLink,
  } from 'lucide-svelte';
  import type { AppTheme } from '../stores/newOnboardingStore';
  import { getProviderIconPath, getProviderFallbackLetter } from '../lib/aiProviderIcons.js';
  import { AI_PROVIDER_OPTIONS } from '../stores/newOnboardingStore';

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
    { id: 'ai', label: 'AI Providers', icon: Bot },
    { id: 'models', label: 'AI Settings', icon: Cpu },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'git', label: 'Git', icon: GitBranch },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: Puzzle },
    { id: 'mcp', label: 'MCP', icon: Server },
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
  let billingPortalLoading = $state(false);
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

  const ACCENT_STORAGE_KEY = 'g-rump-accent';
  const FONT_SIZE_STORAGE_KEY = 'g-rump-font-size';
  const STARTUP_VIEW_KEY = 'g-rump-startup-view';
  const ACCENT_COLORS: Record<string, string> = {
    purple: '#7c3aed',
    blue: '#2563eb',
    green: '#059669',
    amber: '#d97706',
  };
  const ACCENT_HOVER: Record<string, string> = {
    purple: '#6d28d9',
    blue: '#1d4ed8',
    green: '#047857',
    amber: '#b45309',
  };
  const FONT_SCALES: Record<string, string> = { small: '13px', medium: '14px', large: '15px' };
  let accentColor = $state('purple');
  let uiFontSize = $state<'small' | 'medium' | 'large'>('medium');
  let startupView = $state<'chat' | 'projects' | 'last'>('chat');

  function setAccentColor(id: string) {
    accentColor = id;
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    applyAppearance();
  }

  function setUiFontSize(size: 'small' | 'medium' | 'large') {
    uiFontSize = size;
    try {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, size);
    } catch {
      /* ignore */
    }
    applyAppearance();
  }

  function setStartupView(view: 'chat' | 'projects' | 'last') {
    startupView = view;
    try {
      localStorage.setItem(STARTUP_VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }

  function openIntegrationsTab() {
    activeTab = 'integrations';
  }

  function applyAppearance() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.purple;
    const hover = ACCENT_HOVER[accentColor] ?? ACCENT_HOVER.purple;
    root.style.setProperty('--color-primary', accent);
    root.style.setProperty('--color-primary-hover', hover);
    const scale = FONT_SCALES[uiFontSize] ?? FONT_SCALES.medium;
    root.style.setProperty('--app-font-size', scale);
  }

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
  /** Selected provider in AI Providers tab for model picker */
  let selectedProviderInAiTab = $state<string | null>(null);
  /** Inline AI provider config: which provider is being configured */
  let configuringProvider = $state<string | null>(null);
  let configuringApiKey = $state('');
  let configuringTestState = $state<'idle' | 'testing' | 'success' | 'error'>('idle');
  let configuringErrorMessage = $state('');

  function startConfiguringProvider(providerId: string) {
    configuringProvider = providerId;
    configuringApiKey = '';
    configuringTestState = 'idle';
    configuringErrorMessage = '';
  }

  function cancelConfiguringProvider() {
    configuringProvider = null;
    configuringApiKey = '';
    configuringTestState = 'idle';
    configuringErrorMessage = '';
  }

  async function testAndSaveAiProvider() {
    if (!configuringProvider) return;
    const needsKey = configuringProvider !== 'ollama';
    if (needsKey && !configuringApiKey.trim()) {
      configuringTestState = 'error';
      configuringErrorMessage = 'API key is required';
      return;
    }
    configuringTestState = 'testing';
    configuringErrorMessage = '';
    try {
      // For Ollama, test connection to local instance
      if (configuringProvider === 'ollama') {
        try {
          const ollamaRes = await fetchApi('/api/ollama/status');
          const ollamaData = await ollamaRes.json();
          if (!ollamaData.detected) {
            throw new Error('Ollama not detected - make sure Ollama is running');
          }
        } catch (e) {
          configuringTestState = 'error';
          configuringErrorMessage = e instanceof Error ? e.message : 'Cannot connect to Ollama';
          return;
        }
      } else {
        // Simulate API test for other providers; backend may validate in future
        await new Promise((r) => setTimeout(r, 800));
      }

      // Save to onboarding store (localStorage)
      newOnboardingStore.setAiProvider(
        configuringProvider,
        needsKey ? configuringApiKey : undefined
      );

      // Also save to backend settings so models API can detect provider
      await settingsStore.save({
        models: {
          defaultProvider: configuringProvider as 'nim' | 'ollama' | 'mock',
        },
      });

      configuringTestState = 'success';
      showToast(
        `${AI_PROVIDER_OPTIONS.find((p) => p.id === configuringProvider)?.name ?? configuringProvider} configured`,
        'success'
      );

      // Refresh models list
      fetchApi('/api/models/list')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to fetch'))))
        .then((d: { groups?: ModelListGroup[] }) => {
          modelGroups = d.groups ?? [];
        })
        .catch(() => {});
      setTimeout(() => {
        cancelConfiguringProvider();
      }, 1200);
    } catch (e) {
      configuringTestState = 'error';
      configuringErrorMessage = e instanceof Error ? e.message : 'Connection failed';
    }
  }

  const configuringProviderInfo = $derived(
    configuringProvider ? AI_PROVIDER_OPTIONS.find((p) => p.id === configuringProvider) : null
  );

  onMount(() => {
    // Clear initial tab after use so next open doesn't default to it
    if (initialTab) settingsInitialTab.set(undefined);
    // Load accent and font size from localStorage and apply
    try {
      const a = localStorage.getItem(ACCENT_STORAGE_KEY);
      if (a && ACCENT_COLORS[a]) accentColor = a;
      const f = localStorage.getItem(FONT_SIZE_STORAGE_KEY) as 'small' | 'medium' | 'large' | null;
      if (f === 'small' || f === 'medium' || f === 'large') uiFontSize = f;
      const sv = localStorage.getItem(STARTUP_VIEW_KEY) as 'chat' | 'projects' | 'last' | null;
      if (sv === 'chat' || sv === 'projects' || sv === 'last') startupView = sv;
      applyAppearance();
    } catch {
      /* ignore */
    }
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
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to fetch models'))))
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

  async function saveMemory(memory: import('../types/settings').MemorySettings) {
    saving = true;
    const ok = await settingsStore.save({ memory });
    saving = false;
    if (ok) showToast('Memory settings saved', 'success');
    else showToast('Failed to save memory settings', 'error');
  }

  async function saveGit(git: import('../types/settings').GitSettings) {
    saving = true;
    const ok = await settingsStore.save({ git });
    saving = false;
    if (ok) showToast('Git settings saved', 'success');
    else showToast('Failed to save git settings', 'error');
  }

  async function saveMcp(mcp: import('../types/settings').McpSettings) {
    saving = true;
    const ok = await settingsStore.save({ mcp });
    saving = false;
    if (ok) showToast('MCP settings saved', 'success');
    else showToast('Failed to save MCP settings', 'error');
  }

  async function savePreferences(next: import('../types/settings').SettingsPreferences) {
    saving = true;
    const ok = await settingsStore.save({
      preferences: { ...settings?.preferences, ...next },
    });
    saving = false;
    if (ok) showToast('Preferences saved', 'success');
    else showToast('Failed to save preferences', 'error');
  }

  async function handleBillingPortalClick() {
    billingPortalLoading = true;
    try {
      const returnUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname || '/'}#settings`
          : undefined;
      const res = await fetchApi('/api/billing/portal-session', {
        method: 'POST',
        body: JSON.stringify({ returnUrl }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        showToast(data.error ?? 'Billing portal unavailable', 'error');
        if (billingUrl && billingUrl !== '#') window.open(billingUrl, '_blank');
      }
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to open billing portal', 'error');
      if (billingUrl && billingUrl !== '#') window.open(billingUrl, '_blank');
    } finally {
      billingPortalLoading = false;
    }
  }

  function formatCredits(u: number | null | undefined): string {
    const n = u ?? 0;
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(4).replace(/\.?0+$/, '');
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
              Choose light, dark, or follow your system preference. Dark mode applies across the
              app.
            </p>
            <div class="theme-cards">
              {#each [{ id: 'light' as AppTheme, label: 'Light', icon: Sun, desc: 'Bright backgrounds' }, { id: 'dark' as AppTheme, label: 'Dark', icon: Moon, desc: 'Easy on the eyes' }, { id: 'system' as AppTheme, label: 'System', icon: Monitor, desc: 'Follow OS setting' }] as option}
                <button
                  type="button"
                  class="theme-card"
                  class:selected={$newOnboardingStore?.theme === option.id}
                  onclick={() => newOnboardingStore.setTheme(option.id)}
                  aria-pressed={$newOnboardingStore?.theme === option.id}
                >
                  <span class="theme-card-icon"><option.icon size={24} /></span>
                  <span class="theme-card-label">{option.label}</span>
                  <span class="theme-card-desc">{option.desc}</span>
                </button>
              {/each}
            </div>
          </Card>

          <Card title="Appearance" padding="md">
            <p class="section-desc">Layout density, accent color, and UI font size.</p>
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
            <div class="field-group" role="group" aria-labelledby="accent-label">
              <span id="accent-label" class="radio-label">Accent color</span>
              <div class="accent-row">
                {#each [{ id: 'purple', color: '#7c3aed', label: 'Purple' }, { id: 'blue', color: '#2563eb', label: 'Blue' }, { id: 'green', color: '#059669', label: 'Green' }, { id: 'amber', color: '#d97706', label: 'Amber' }] as acc}
                  <button
                    type="button"
                    class="accent-swatch"
                    class:selected={accentColor === acc.id}
                    style="--swatch-color: {acc.color}"
                    onclick={() => setAccentColor(acc.id)}
                    title={acc.label}
                    aria-pressed={accentColor === acc.id}
                  >
                    {#if accentColor === acc.id}
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        stroke-width="3"><path d="M5 12l5 5L20 7" /></svg
                      >
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
            <div class="field-group" role="group" aria-labelledby="font-size-label">
              <span id="font-size-label" class="radio-label">UI font size</span>
              <div class="radio-row">
                {#each ['small', 'medium', 'large'] as size}
                  <label class="radio-option">
                    <input
                      type="radio"
                      name="fontSize"
                      value={size}
                      checked={uiFontSize === size}
                      onchange={() => setUiFontSize(size as 'small' | 'medium' | 'large')}
                    />
                    <span>{size.charAt(0).toUpperCase() + size.slice(1)}</span>
                  </label>
                {/each}
              </div>
            </div>
          </Card>

          <Card title="Startup" padding="md">
            <p class="section-desc">Choose which view to show when the app opens.</p>
            <div class="field-group" role="group" aria-labelledby="startup-label">
              <span id="startup-label" class="radio-label">Startup view</span>
              <div class="radio-row">
                <label class="radio-option">
                  <input
                    type="radio"
                    name="startupView"
                    value="chat"
                    checked={startupView === 'chat'}
                    onchange={() => setStartupView('chat')}
                  />
                  <span>Chat</span>
                </label>
                <label class="radio-option">
                  <input
                    type="radio"
                    name="startupView"
                    value="projects"
                    checked={startupView === 'projects'}
                    onchange={() => setStartupView('projects')}
                  />
                  <span>Projects</span>
                </label>
                <label class="radio-option">
                  <input
                    type="radio"
                    name="startupView"
                    value="last"
                    checked={startupView === 'last'}
                    onchange={() => setStartupView('last')}
                  />
                  <span>Last view</span>
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
                  onchange={(e) =>
                    newOnboardingStore.setTelemetry((e.target as HTMLInputElement).checked)}
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
        <!-- AI PROVIDERS TAB (provider grid + model picker, connect providers) -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'ai'}
        <div class="tab-section models-tab ai-providers-tab">
          <p class="ai-tab-quick-start">
            Pick a provider below and add an API key to get started. Then choose your default model
            for chat and code.
          </p>
          <Card title="Default model" padding="md" class="ai-providers-default-card">
            <p class="field-hint models-provider-intro">
              Select a configured provider, then pick the model for chat and code.
            </p>
            {#if modelGroupsLoading}
              <p class="models-provider-loading">Loading model list…</p>
            {:else if modelGroups.length === 0}
              <p class="field-hint">
                No providers available. Configure API keys in AI Providers (below) or in your
                backend .env.
              </p>
            {:else}
              <div class="providers-grid settings-providers-grid">
                {#each modelGroups as group}
                  {@const iconPath = getProviderIconPath(group.provider)}
                  {@const fallbackLetter = getProviderFallbackLetter(group.provider)}
                  {@const isSelected =
                    selectedProviderInAiTab === group.provider ||
                    (settings?.models?.defaultProvider === group.provider &&
                      !selectedProviderInAiTab)}
                  <div class="provider-card-wrap" class:selected={isSelected}>
                    <button
                      type="button"
                      class="provider-card settings-provider-card"
                      class:selected={isSelected}
                      onclick={() => {
                        selectedProviderInAiTab = group.provider;
                      }}
                      aria-pressed={isSelected}
                    >
                      <span class="provider-icon" aria-hidden="true">
                        {#if group.icon && group.icon.startsWith('http')}
                          <img
                            src={group.icon}
                            alt=""
                            class="provider-icon-img"
                            onerror={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        {:else if iconPath}
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            role="img"
                          >
                            <path d={iconPath} />
                          </svg>
                        {:else}
                          <span class="provider-icon-fallback">{fallbackLetter}</span>
                        {/if}
                      </span>
                      <span class="provider-name">{group.displayName}</span>
                    </button>
                    {#if modelGroups.length > 1 && settings?.models?.defaultProvider !== group.provider}
                      <Button
                        variant="ghost"
                        size="sm"
                        class="set-default-btn"
                        onclick={(e) => {
                          e.stopPropagation();
                          if (group.models?.[0]?.id) {
                            saveModels({
                              ...settings?.models,
                              defaultProvider: group.provider as ModelsSettings['defaultProvider'],
                              defaultModelId: group.models[0].id,
                            });
                          }
                        }}
                        disabled={saving}
                      >
                        Set as default
                      </Button>
                    {/if}
                  </div>
                {/each}
              </div>
              {#if selectedProviderInAiTab}
                {@const group = modelGroups.find((g) => g.provider === selectedProviderInAiTab)}
                {#if group}
                  <div class="models-section provider-model-select">
                    <label class="field-label" for="ai-provider-model"
                      >Model for {group.displayName}</label
                    >
                    <select
                      id="ai-provider-model"
                      class="custom-select"
                      value={settings?.models?.defaultProvider === group.provider
                        ? (settings?.models?.defaultModelId ?? '')
                        : ''}
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
                    >
                      <option value="">— Select model —</option>
                      {#each group.models as model}
                        <option value={model.id}>
                          {model.description ?? model.id}
                          {#if model.contextWindow}
                            ({model.contextWindow >= 1000
                              ? `${model.contextWindow / 1000}K`
                              : model.contextWindow} ctx)
                          {/if}
                          {#if model.isRecommended}
                            ★{/if}
                        </option>
                      {/each}
                    </select>
                    {#if group.provider === 'nim' || group.displayName
                        ?.toLowerCase()
                        .includes('nim')}
                      <p class="field-hint nim-model-hint">
                        NIM: 405B = flagship, 70B = balanced, 49B = fast.
                      </p>
                    {/if}
                  </div>
                {/if}
              {/if}
            {/if}
          </Card>
          <Card title="Add more providers" padding="md" class="ai-providers-add-card">
            <p class="section-desc ai-providers-add-desc">
              Supported providers appear here once configured. Add API keys in this tab (AI
              Providers) or set them in your backend <code>.env</code>.
            </p>
            <div class="providers-grid settings-providers-grid add-more-providers-grid">
              {#each AI_PROVIDER_OPTIONS as option}
                {@const iconPath = getProviderIconPath(option.id)}
                {@const fallbackLetter = getProviderFallbackLetter(option.id)}
                {@const isConfigured = modelGroups.some(
                  (g) =>
                    g.provider === option.id || (option.id === 'nvidia-nim' && g.provider === 'nim')
                )}
                <div
                  class="provider-card settings-provider-card add-more-card"
                  class:configured={isConfigured}
                >
                  <span class="provider-icon" aria-hidden="true">
                    {#if iconPath}
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        role="img"
                      >
                        <path d={iconPath} />
                      </svg>
                    {:else}
                      <span class="provider-icon-fallback">{fallbackLetter}</span>
                    {/if}
                  </span>
                  <span class="provider-name">{option.name}</span>
                  {#if option.description}
                    <span class="provider-desc">{option.description}</span>
                  {/if}
                  {#if isConfigured}
                    <span class="configured-badge">Configured</span>
                  {:else}
                    <Button
                      variant="ghost"
                      size="sm"
                      onclick={() => startConfiguringProvider(option.id)}
                    >
                      Configure provider
                    </Button>
                  {/if}
                </div>
              {/each}
            </div>
            {#if configuringProvider}
              <div class="ai-provider-inline-config">
                {#if configuringProvider === 'ollama'}
                  <div class="ollama-inline-notice">
                    <p>Make sure Ollama is running locally on your machine.</p>
                    <a href="https://ollama.ai" target="_blank" rel="noopener" class="help-link">
                      <ExternalLink size={14} />
                      Download Ollama
                    </a>
                  </div>
                {:else}
                  <div class="inline-config-input-group">
                    <label for="ai-provider-api-key" class="field-label">
                      {configuringProviderInfo?.name ?? configuringProvider} API Key
                    </label>
                    <div class="inline-config-input-row">
                      <input
                        id="ai-provider-api-key"
                        type="password"
                        bind:value={configuringApiKey}
                        placeholder="Enter your API key..."
                        class="custom-input"
                        class:error={configuringTestState === 'error'}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onclick={testAndSaveAiProvider}
                        disabled={configuringTestState === 'testing' ||
                          (configuringProvider !== 'ollama' && !configuringApiKey.trim())}
                      >
                        {#if configuringTestState === 'testing'}
                          <span class="inline-spinner"></span>
                          Testing…
                        {:else if configuringTestState === 'success'}
                          <Check size={14} />
                          Saved
                        {:else}
                          Test & Save
                        {/if}
                      </Button>
                    </div>
                    {#if configuringTestState === 'error' && configuringErrorMessage}
                      <p class="inline-config-error">
                        <AlertCircle size={14} />
                        {configuringErrorMessage}
                      </p>
                    {/if}
                    <a
                      href="https://docs.g-rump.dev/providers/{configuringProvider}"
                      target="_blank"
                      rel="noopener"
                      class="help-link"
                    >
                      <ExternalLink size={14} />
                      How to get a {configuringProviderInfo?.name ?? configuringProvider} API key
                    </a>
                  </div>
                {/if}
                <div class="inline-config-actions">
                  <Button variant="ghost" size="sm" onclick={cancelConfiguringProvider}>
                    Cancel
                  </Button>
                  {#if configuringProvider === 'ollama'}
                    <Button variant="primary" size="sm" onclick={testAndSaveAiProvider}>
                      Save
                    </Button>
                  {/if}
                </div>
              </div>
            {/if}
            <div class="open-integrations-wrap">
              <Button variant="secondary" size="sm" onclick={openIntegrationsTab}>
                Need GitHub or OAuth? Open Integrations tab
              </Button>
            </div>
          </Card>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- MEMORY TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'memory'}
        <div class="tab-section memory-tab">
          <Card title="Memory Settings" padding="md">
            <p class="section-desc">
              Control what G-Agent remembers across sessions: limits, persistence, and search
              behavior.
            </p>
            <div class="field-group">
              <span class="field-label">Persistence</span>
              <p class="field-hint">
                Memories are stored locally per workspace. Clear data in Memory manager to reset.
              </p>
            </div>
            <div class="field-group">
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
                <span class="guard-rail-title">Large context (200K+) for memory search</span>
                <span class="guard-rail-desc"
                  >Allow longer context when searching memories; uses more tokens.</span
                >
              </label>
            </div>
            <div class="field-group">
              <label class="field-label" for="max-memories">Max memories to keep</label>
              <input
                id="max-memories"
                type="number"
                min="0"
                max="10000"
                step="100"
                value={settings?.memory?.maxMemoriesToKeep ?? ''}
                onchange={(e) => {
                  const v = parseInt((e.target as HTMLInputElement).value, 10);
                  if (!Number.isNaN(v) && v >= 0)
                    saveMemory({ ...settings?.memory, maxMemoriesToKeep: v });
                  else if ((e.target as HTMLInputElement).value === '')
                    saveMemory({ ...settings?.memory, maxMemoriesToKeep: undefined });
                }}
                placeholder="No limit"
                class="settings-number-input"
              />
              <p class="field-hint">
                Optional cap for stored memories. Leave empty for no limit. Manage in Memory
                manager.
              </p>
            </div>
            <div class="field-group">
              <span class="field-label">Default memory types</span>
              <p class="field-hint">
                Fact, Preference, Task, Context, Conversation. Add and manage in Memory manager.
              </p>
            </div>
            <div class="memory-actions">
              <Button variant="primary" size="sm" onclick={() => setCurrentView('memory')}>
                Open Memory manager
              </Button>
            </div>
          </Card>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- MODELS TAB (redesigned: preset + model, embedding compact, custom collapsible) -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'models'}
        <div class="tab-section models-tab">
          <Card title="Chat model" padding="md" class="chat-model-card">
            <div class="preset-segmented">
              <span class="preset-label">Preset</span>
              <div class="preset-options" role="group" aria-label="Model preset">
                {#each ['balanced', 'fast', 'quality'] as preset}
                  {@const label =
                    preset === 'balanced' ? 'Balanced' : preset === 'fast' ? 'Fast' : 'Quality'}
                  {@const desc =
                    preset === 'balanced'
                      ? 'Auto by task'
                      : preset === 'fast'
                        ? 'Lower cost'
                        : 'Best quality'}
                  <button
                    type="button"
                    class="preset-option"
                    class:selected={(settings?.models?.modelPreset ?? 'balanced') === preset}
                    onclick={() =>
                      saveModels({ ...settings?.models, modelPreset: preset as ModelPreset })}
                    disabled={saving}
                    title={desc}
                  >
                    {label}
                  </button>
                {/each}
              </div>
            </div>
            <div class="default-model-row">
              <span class="field-label">Default model</span>
              <ModelPicker
                value={modelValue()}
                compact={true}
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
            <p class="field-hint chat-model-hint">Override when needed.</p>
            <div class="advanced-finetuning">
              <span class="field-label">Advanced (finetuning)</span>
              <div class="advanced-row">
                <label class="advanced-field">
                  <span>Temperature</span>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings?.models?.temperature ?? 0.7}
                    onchange={(e) => {
                      const v = parseFloat((e.currentTarget as HTMLInputElement).value);
                      if (!Number.isNaN(v)) saveModels({ ...settings?.models, temperature: v });
                    }}
                  />
                </label>
                <label class="advanced-field">
                  <span>Max tokens</span>
                  <input
                    type="number"
                    min="256"
                    max="128000"
                    step="256"
                    value={settings?.models?.maxTokens ?? 4096}
                    onchange={(e) => {
                      const v = parseInt((e.currentTarget as HTMLInputElement).value, 10);
                      if (!Number.isNaN(v)) saveModels({ ...settings?.models, maxTokens: v });
                    }}
                  />
                </label>
              </div>
              <p class="field-hint">
                Temperature: higher = more creative. Max tokens: cap per response.
              </p>
            </div>
          </Card>

          <!-- Provider-first: all providers and models from backend -->
          <Card title="Models by provider" padding="md" class="models-provider-list-card">
            {#if modelGroupsLoading}
              <p class="models-provider-loading">Loading model list…</p>
            {:else if modelGroups.length === 0}
              <p class="field-hint">
                No providers available. Configure API keys in AI Providers (below) or in your
                backend .env.
              </p>
            {:else}
              <p class="field-hint models-provider-intro">
                Pick a model per provider; selecting one sets it as the default chat/code model.
              </p>
              <div class="models-provider-list">
                {#each modelGroups as group}
                  <div class="models-provider-row">
                    <div class="models-provider-heading">
                      <img
                        src={group.icon}
                        alt=""
                        class="models-provider-icon"
                        onerror={(e) =>
                          ((e.currentTarget as HTMLImageElement).style.display = 'none')}
                      />
                      <span class="models-provider-name">{group.displayName}</span>
                    </div>
                    <select
                      class="custom-select models-provider-select"
                      value={settings?.models?.defaultProvider === group.provider
                        ? (settings?.models?.defaultModelId ?? '')
                        : ''}
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
                            ({model.contextWindow >= 1000
                              ? `${model.contextWindow / 1000}K`
                              : model.contextWindow} ctx)
                          {/if}
                          {#if model.isRecommended}
                            ★{/if}
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
          {#if !$workspaceStore?.repoUrl}
            <Card title="Connect GitHub" padding="md" class="git-oauth-card">
              <p class="section-desc">
                Connect your GitHub account with OAuth to link repos and enable push/pull from the
                app.
              </p>
              <Button variant="primary" size="md" onclick={() => setCurrentView('integrations')}>
                Connect GitHub with OAuth
              </Button>
            </Card>
          {/if}
          <Card title="Workspace & Repository" padding="md">
            <p class="section-desc">
              Current workspace and Git repository. Connect a GitHub repo in Integrations or open a
              folder in the app.
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
              Connect GitHub (OAuth) in Integrations
            </Button>
          </Card>
          <Card title="Git preferences" padding="md">
            <p class="section-desc">Default branch and auto-fetch behavior for Git operations.</p>
            <div class="field-group">
              <label class="field-label" for="git-default-branch">Default branch</label>
              <input
                id="git-default-branch"
                type="text"
                class="settings-text-input"
                placeholder="main"
                value={settings?.git?.defaultBranch ?? ''}
                onchange={(e) => {
                  const v = (e.target as HTMLInputElement).value.trim();
                  saveGit({ ...settings?.git, defaultBranch: v || undefined });
                }}
              />
              <p class="field-hint">
                Branch name used when creating new repos or suggesting pushes.
              </p>
            </div>
            <div class="field-group">
              <label class="field-label" for="git-auto-fetch">Auto-fetch interval (minutes)</label>
              <input
                id="git-auto-fetch"
                type="number"
                min="0"
                max="1440"
                step="1"
                class="settings-number-input"
                value={settings?.git?.autoFetchIntervalMinutes ?? ''}
                onchange={(e) => {
                  const v = parseInt((e.target as HTMLInputElement).value, 10);
                  if (!Number.isNaN(v) && v >= 0)
                    saveGit({ ...settings?.git, autoFetchIntervalMinutes: v });
                  else if ((e.target as HTMLInputElement).value === '')
                    saveGit({ ...settings?.git, autoFetchIntervalMinutes: undefined });
                }}
                placeholder="0 (disabled)"
              />
              <p class="field-hint">0 = disabled. How often to run git fetch in the background.</p>
            </div>
          </Card>
          <Card title="G-Agent Git Capability" padding="md">
            <p class="section-desc">
              Allow G-Agent to run Git commands (status, diff, commit, branch, push) in your
              workspace.
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
                      ? current.includes('git')
                        ? current
                        : [...current, 'git']
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
              <li>
                G-Agent can run git status, diff, commit, and push when the capability is enabled.
              </li>
            </ul>
          </Card>
        </div>

        <!-- SECURITY TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'security'}
        <div class="tab-section security-tab">
          <Card title="File Access Control" padding="md">
            <p class="section-desc">
              Restrict which directories the agent can read and write. Leave empty to allow the
              current workspace only.
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
                      const grump = (
                        window as {
                          grump?: {
                            selectDirectory?: () => Promise<{ path?: string; canceled?: boolean }>;
                          };
                        }
                      ).grump;
                      const result = await grump?.selectDirectory?.();
                      if (result?.canceled || !result?.path) return;
                      const trimmed = result.path.trim();
                      if (!trimmed) return;
                      allowedDirsText = allowedDirsText.trim()
                        ? `${allowedDirsText.trim()}\n${trimmed}`
                        : trimmed;
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
                  const grump = (
                    window as {
                      grump?: {
                        selectDirectory?: () => Promise<{ path?: string; canceled?: boolean }>;
                      };
                    }
                  ).grump;
                  if (!grump?.selectDirectory) return;
                  const result = await grump.selectDirectory();
                  if (result?.canceled || !result?.path) return;
                  const trimmed = result.path.trim();
                  if (!trimmed) return;
                  allowedDirsText = allowedDirsText.trim()
                    ? `${allowedDirsText.trim()}\n${trimmed}`
                    : trimmed;
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
                One path per line. Example: <code>C:\projects\my-app</code> or
                <code>/Users/me/workspace</code>
                {#if isElectron}
                  Focus this field to open folder picker (Electron).
                {:else}
                  In the desktop app you can use <strong>Browse</strong> or focus the field to pick a
                  folder.
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
                <span class="guard-rail-desc"
                  >Skip confirmations; tools run without per-step approval. Use with care.</span
                >
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
                <span class="guard-rail-desc">Allow longer messages for models that support it</span
                >
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

          <Card title="Allowed API domains" padding="md">
            <p class="section-desc">
              Domains G-Agent may call (HTTP/API). One per line. Leave empty to use defaults.
              Example: <code>api.github.com</code>, <code>*.openai.com</code>.
            </p>
            <div class="field-group">
              <textarea
                class="custom-textarea security-textarea"
                rows={4}
                placeholder="api.github.com&#10;api.openai.com"
                value={($gAgentExternalAllowlist ?? []).join('\n')}
                oninput={(e) => {
                  const text = (e.target as HTMLTextAreaElement).value;
                  const list = text
                    .split(/\n/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  preferencesStore.setGAgentExternalAllowlist(list);
                }}
                aria-describedby="api-domains-hint"
              ></textarea>
              <p id="api-domains-hint" class="field-hint">
                Used to restrict outbound API calls from G-Agent.
              </p>
            </div>
          </Card>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- INTEGRATIONS TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'integrations'}
        <div class="tab-section integrations-tab">
          <section class="integrations-section">
            <h2 class="integrations-section-title">Local</h2>
            <p class="integrations-section-desc">Docker stack and scheduled agents.</p>
            <div class="integrations-section-content integrations-grid-two">
              <Card title="Docker" padding="md">
                <p class="section-desc">
                  Manage containers and stacks in Docker Desktop. Open Docker Desktop to start/stop
                  containers and run compose.
                </p>
                <div class="docker-actions">
                  <Button
                    variant="primary"
                    size="sm"
                    onclick={() =>
                      window.open(
                        'https://app.docker.com/open-desktop',
                        '_blank',
                        'noopener,noreferrer'
                      )}
                  >
                    Open Docker Desktop
                  </Button>
                  <Button variant="ghost" size="sm" onclick={() => setCurrentView('docker')}>
                    Docker
                  </Button>
                  <Button variant="ghost" size="sm" onclick={() => setCurrentView('docker-setup')}>
                    Docker Setup Wizard
                  </Button>
                </div>
              </Card>
              <ScheduledAgents />
            </div>
          </section>

          <section class="integrations-section">
            <h2 class="integrations-section-title">Workspace</h2>
            <p class="integrations-section-desc">
              Codebase diagram and recommended VS Code extensions.
            </p>
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
                  <p class="section-desc">
                    Integrate into G-Rump: extensions that work with our platform and your workflow
                    (ESLint, Prettier, GitLens, Docker, Thunder Client). We support multiple users
                    and workspaces—install from the Marketplace or enable recommended extensions
                    below.
                  </p>
                  <RecommendedExtensions />
                </Card>
              </div>
            </div>
          </section>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- MCP TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'mcp'}
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
                  if (!Number.isNaN(v) && v >= 1)
                    saveMcp({ ...settings?.mcp, requestTimeoutSeconds: v });
                  else if ((e.target as HTMLInputElement).value === '')
                    saveMcp({ ...settings?.mcp, requestTimeoutSeconds: undefined });
                }}
                placeholder="30"
              />
              <p class="field-hint">
                Max time to wait for an MCP response. Leave empty for default.
              </p>
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
              Model Context Protocol – configure stdio or URL-based servers so G-Agent can use their
              tools.
            </p>
            <div class="integrations-section-content">
              <McpServersCard />
            </div>
          </section>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- BILLING TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'billing'}
        <div class="tab-section billing-tab">
          <Card title="Subscription & Usage" padding="md">
            <div class="billing-status">
              {#if billingMe?.tier}
                <div class="billing-tier-row">
                  <span class="status-label">Current plan</span>
                  <Badge variant="primary">{billingMe.tier}</Badge>
                </div>
                <div class="billing-usage-dashboard">
                  <div class="usage-item">
                    <div class="usage-header">
                      <span class="usage-label">API / AI calls</span>
                      <span class="usage-value"
                        >{formatCredits(billingMe.usage)} / {billingMe.limit ?? '∞'}</span
                      >
                    </div>
                    {#if typeof billingMe.limit === 'number' && billingMe.limit > 0}
                      <div class="usage-bar">
                        <div
                          class="usage-bar-fill"
                          style="width: {Math.min(
                            100,
                            ((Number(billingMe.usage) ?? 0) / billingMe.limit) * 100
                          )}%"
                        ></div>
                      </div>
                    {/if}
                  </div>
                  {#if billingMe.computeMinutesLimit != null && billingMe.computeMinutesLimit > 0}
                    <div class="usage-item">
                      <div class="usage-header">
                        <span class="usage-label">Compute (min)</span>
                        <span class="usage-value"
                          >{(billingMe.computeMinutesUsed ?? 0).toFixed(1)} / {billingMe.computeMinutesLimit}</span
                        >
                      </div>
                      <div class="usage-bar">
                        <div
                          class="usage-bar-fill"
                          style="width: {Math.min(
                            100,
                            ((billingMe.computeMinutesUsed ?? 0) / billingMe.computeMinutesLimit) *
                              100
                          )}%"
                        ></div>
                      </div>
                    </div>
                  {/if}
                  {#if billingMe.storageGbLimit != null && billingMe.storageGbLimit > 0}
                    <div class="usage-item">
                      <div class="usage-header">
                        <span class="usage-label">Storage (GB)</span>
                        <span class="usage-value"
                          >{(billingMe.storageGbUsed ?? 0).toFixed(2)} / {billingMe.storageGbLimit}</span
                        >
                      </div>
                      <div class="usage-bar">
                        <div
                          class="usage-bar-fill"
                          style="width: {Math.min(
                            100,
                            ((billingMe.storageGbUsed ?? 0) / billingMe.storageGbLimit) * 100
                          )}%"
                        ></div>
                      </div>
                    </div>
                  {/if}
                </div>
                {#if billingMe.overageRates}
                  <div class="billing-overages">
                    <span class="status-label">Overage rates</span>
                    <ul class="overage-list">
                      <li>
                        Storage: ${(billingMe.overageRates.storageGbMonthlyCents / 100).toFixed(
                          2
                        )}/GB
                      </li>
                      <li>
                        Compute: ${(billingMe.overageRates.computeMinuteCents / 100).toFixed(2)}/min
                      </li>
                      <li>
                        Extra slot: ${(
                          billingMe.overageRates.extraConcurrentAgentMonthlyCents / 100
                        ).toFixed(2)}/slot
                      </li>
                    </ul>
                  </div>
                {/if}
                {#if tiers.length > 0}
                  <p class="billing-tiers-note">
                    {tiers.length} plan(s) available. Upgrade for more.
                  </p>
                {/if}
              {:else}
                <p class="billing-empty">Sign in to view your subscription details.</p>
              {/if}
            </div>
            <div class="field-group billing-alert-field">
              <label class="field-label" for="usage-alert-percent"
                >Alert when usage exceeds % of limit</label
              >
              <input
                id="usage-alert-percent"
                type="number"
                min="0"
                max="100"
                step="5"
                class="settings-number-input"
                value={settings?.preferences?.usageAlertPercent ?? ''}
                onchange={(e) => {
                  const v = parseInt((e.target as HTMLInputElement).value, 10);
                  if (!Number.isNaN(v) && v >= 0 && v <= 100)
                    savePreferences({ usageAlertPercent: v });
                  else if ((e.target as HTMLInputElement).value === '')
                    savePreferences({ usageAlertPercent: undefined });
                }}
                placeholder="80"
              />
              <p class="field-hint">
                Show a warning when API/usage reaches this percent of your plan limit. Leave empty
                to disable.
              </p>
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
              Manage payment methods for your subscription in the billing portal.
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
            <Button
              variant="secondary"
              size="sm"
              onclick={handleBillingPortalClick}
              disabled={billingPortalLoading}
            >
              {billingPortalLoading ? 'Opening…' : 'Open billing portal'}
            </Button>
          </Card>

          <Card title="Invoices" padding="md">
            <p class="section-desc">Download past invoices from the billing portal.</p>
            {#if billingInvoices.length > 0}
              <ul class="billing-list">
                {#each billingInvoices as inv}
                  <li class="billing-list-item">
                    <span>{inv.date}</span>
                    <span>${(inv.amount / 100).toFixed(2)}</span>
                    <Badge variant={inv.status === 'paid' ? 'success' : 'default'}
                      >{inv.status}</Badge
                    >
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="billing-empty">No invoices yet.</p>
            {/if}
            <Button
              variant="secondary"
              size="sm"
              onclick={handleBillingPortalClick}
              disabled={billingPortalLoading}
            >
              {billingPortalLoading ? 'Opening…' : 'Open billing portal'}
            </Button>
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
                    >{formatCredits(billingMe.usage)} / {billingMe.limit ?? '∞'} credits</span
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
    background-color: var(--color-bg-card);
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
    color: var(--color-text);
  }

  .settings-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .tabs-sidebar {
    width: 220px;
    padding: 24px 16px;
    background: var(--color-bg-secondary);
    border-right: 1px solid var(--color-border);
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
    color: var(--color-text-muted);
    transition:
      background 0.15s,
      color 0.15s;
  }

  .tabs-sidebar :global(.tab:hover) {
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
  }

  .tabs-sidebar :global(.tab.active) {
    background: var(--color-bg-card);
    color: var(--color-text);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    border: 1px solid var(--color-border);
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 32px;
    background: var(--color-bg-card);
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

  .chat-model-card .preset-segmented {
    margin-bottom: 1rem;
  }

  .preset-label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    margin-bottom: 0.5rem;
  }

  .preset-options {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .preset-option {
    padding: 0.4rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-muted, #6b7280);
    background: var(--color-bg-inset, #f3f4f6);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.5rem;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
  }

  .preset-option:hover {
    background: var(--color-bg-secondary, #f9fafb);
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
  }

  .preset-option.selected {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
  }

  .default-model-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }

  .default-model-row .field-label {
    flex-shrink: 0;
  }

  .chat-model-hint {
    margin: 0;
    font-size: 0.8125rem;
  }

  .inline-link {
    background: none;
    border: none;
    padding: 0;
    font-size: inherit;
    font-weight: 600;
    color: var(--color-primary, #7c3aed);
    text-decoration: underline;
    cursor: pointer;
  }

  .inline-link:hover {
    color: var(--color-primary-hover, #6d28d9);
  }

  .advanced-finetuning {
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--color-border, #e5e7eb);
  }

  .advanced-finetuning .field-label {
    display: block;
    margin-bottom: 0.5rem;
  }

  .advanced-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .advanced-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
  }

  .advanced-field input {
    width: 100px;
    padding: 0.35rem 0.5rem;
    font-size: 0.875rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.5rem;
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

  .settings-text-input {
    width: 100%;
    max-width: 280px;
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

  .ai-tab-quick-start {
    margin: 0 0 1.25rem;
    padding: 0.75rem 1rem;
    background: var(--color-bg-subtle, #f8fafc);
    border-radius: 10px;
    font-size: 0.875rem;
    color: var(--color-text-secondary, #6b7280);
    line-height: 1.5;
  }

  .ai-providers-tab .models-provider-intro {
    color: var(--color-text-secondary, #6b7280);
    line-height: 1.5;
  }

  .ai-providers-tab .provider-card-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .ai-providers-tab .provider-card-wrap .set-default-btn {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }

  .ai-providers-tab .settings-providers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .ai-providers-tab .settings-provider-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.625rem;
    padding: 1.25rem 1rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 14px;
    background: var(--color-bg-card, #ffffff);
    box-shadow: var(--shadow-xs, 0 1px 2px rgba(0, 0, 0, 0.04));
    cursor: pointer;
    transition:
      border-color 0.2s,
      box-shadow 0.2s,
      background 0.2s;
    text-align: center;
  }

  .ai-providers-tab .settings-provider-card:hover {
    border-color: var(--color-primary, #7c3aed);
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.06));
    box-shadow: var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.05));
  }

  .ai-providers-tab .settings-provider-card.selected {
    border-color: var(--color-primary, #7c3aed);
    box-shadow: 0 0 0 2px var(--color-primary-subtle, rgba(124, 58, 237, 0.25));
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
  }

  .ai-providers-tab .provider-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: var(--color-bg-subtle, #f5f3ff);
    color: var(--color-text-secondary, #6b7280);
  }

  .ai-providers-tab .settings-provider-card.selected .provider-icon {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.15));
    color: var(--color-primary, #7c3aed);
  }

  .ai-providers-tab .provider-icon svg {
    width: 24px;
    height: 24px;
  }

  .ai-providers-tab .provider-icon-img {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }

  .ai-providers-tab .provider-icon-fallback {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-primary, #7c3aed);
  }

  .ai-providers-tab .add-more-providers-grid {
    margin-bottom: 1rem;
  }

  .ai-providers-tab .add-more-card {
    cursor: default;
    min-height: 120px;
    background: var(--color-bg-subtle, #f9fafb);
  }

  .ai-providers-tab .add-more-card .provider-icon {
    background: var(--color-bg-card, #ffffff);
  }

  .ai-providers-tab .add-more-card .provider-desc {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.3;
    max-width: 140px;
  }

  .ai-providers-tab .add-more-card .configured-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    background: var(--color-success-subtle, rgba(16, 185, 129, 0.15));
    color: var(--color-success, #10b981);
  }

  .ai-providers-tab .section-desc.ai-providers-add-desc {
    margin-bottom: 1.25rem;
    line-height: 1.5;
  }

  .ai-providers-tab .open-integrations-wrap {
    margin-top: 1rem;
  }

  .ai-provider-inline-config {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--color-bg-subtle, #f9fafb);
    border-radius: 12px;
    border: 1px solid var(--color-border, #e5e7eb);
  }

  .ai-provider-inline-config .ollama-inline-notice {
    padding: 0.5rem 0;
  }

  .ai-provider-inline-config .ollama-inline-notice p {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary, #6b7280);
  }

  .inline-config-input-group {
    margin-bottom: 0.75rem;
  }

  .inline-config-input-group .field-label {
    margin-bottom: 0.5rem;
  }

  .inline-config-input-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .inline-config-input-row .custom-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    font-size: 0.875rem;
  }

  .inline-config-input-row .custom-input.error {
    border-color: #ef4444;
  }

  .inline-config-error {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin: 0.5rem 0 0 0;
    font-size: 0.8125rem;
    color: #ef4444;
  }

  .inline-config-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .ai-provider-inline-config .help-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: var(--color-primary, #7c3aed);
    text-decoration: none;
  }

  .ai-provider-inline-config .help-link:hover {
    text-decoration: underline;
  }

  .inline-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: ai-config-spin 0.8s linear infinite;
  }

  @keyframes ai-config-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .ai-providers-tab .provider-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text, #111827);
    line-height: 1.2;
  }

  .ai-providers-tab .provider-model-select {
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--color-border, #e5e7eb);
    max-width: 360px;
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

  .theme-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .theme-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.25rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary, #4a4a5a);
    background: var(--color-bg-input, #f3f4f6);
    border: 2px solid var(--color-border, #e5e7eb);
    border-radius: 12px;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
    text-align: center;
  }

  .theme-card:hover {
    background: var(--color-bg-card-hover, #f9fafb);
    border-color: var(--color-border-highlight, #d1d5db);
  }

  .theme-card.selected {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
  }

  .theme-card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: inherit;
  }

  .theme-card-label {
    font-weight: 600;
  }

  .theme-card-desc {
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--color-text-muted, #6b7280);
  }

  .accent-row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .accent-swatch {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--swatch-color, #7c3aed);
    border: 2px solid transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      transform 0.15s,
      box-shadow 0.15s;
  }

  .accent-swatch:hover {
    transform: scale(1.08);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .accent-swatch.selected {
    border-color: var(--color-text, #111827);
    box-shadow:
      0 0 0 2px white,
      0 0 0 4px var(--color-text, #111827);
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
    gap: 16px;
    margin-bottom: 20px;
  }

  .billing-tier-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 4px;
  }

  .billing-tier-row .tier-badge {
    font-size: 0.875rem;
  }

  .billing-usage-dashboard {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .usage-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .usage-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .usage-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-muted, #71717a);
  }

  .usage-value {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }

  .usage-bar {
    height: 8px;
    background: var(--color-bg-subtle, #f3f4f6);
    border-radius: 4px;
    overflow: hidden;
  }

  .usage-bar-fill {
    height: 100%;
    background: var(--color-primary, #7c3aed);
    border-radius: 4px;
    transition: width 0.2s ease;
  }

  .billing-overages {
    margin-top: 4px;
  }

  .billing-overages .status-label {
    display: block;
    margin-bottom: 6px;
  }

  .overage-list {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
  }

  .overage-list li {
    padding: 2px 0;
  }

  .billing-tiers-note {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
    margin: 0;
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
