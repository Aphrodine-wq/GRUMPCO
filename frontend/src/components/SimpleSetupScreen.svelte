<script lang="ts">
  /**
   * Simple Setup Screen
   * Zero-config setup experience with progressive disclosure
   *
   * Features:
   * - One-click start with auto-detection
   * - Quick-start templates
   * - Progressive feature unlocking
   */
  import { onMount } from 'svelte';
  import Button from '$lib/design-system/components/Button/Button.svelte';
  import { preferencesStore } from '../stores/preferencesStore';
  import { fetchApi } from '$lib/api';
  import { trackSetupComplete } from '$lib/analytics';
  import {
    Zap,
    Settings,
    Rocket,
    Code2,
    Server,
    Globe,
    Bot,
    CheckCircle2,
    AlertCircle,
  } from 'lucide-svelte';

  interface Props {
    onComplete?: () => void;
    onAdvancedSetup?: () => void;
  }

  let { onComplete, onAdvancedSetup }: Props = $props();

  let mode = $state<'initial' | 'detecting' | 'ready' | 'templates' | 'error'>('initial');
  let detectionResult = $state<{
    configured: boolean;
    provider: string | null;
    features: string[];
    warnings: string[];
    suggestions: string[];
  } | null>(null);
  let selectedTemplate = $state<string | null>(null);
  let isApplying = $state(false);

  const templates = [
    {
      id: 'fullstack-react',
      name: 'Full-Stack React',
      description: 'React + Node.js + PostgreSQL',
      icon: Code2,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'python-api',
      name: 'Python API',
      description: 'FastAPI + SQLAlchemy',
      icon: Server,
      color: 'from-green-500 to-emerald-500',
    },
    {
      id: 'static-site',
      name: 'Static Site',
      description: 'Modern static website',
      icon: Globe,
      color: 'from-purple-500 to-pink-500',
    },
    {
      id: 'ai-agent',
      name: 'AI Agent',
      description: 'LLM-powered assistant',
      icon: Bot,
      color: 'from-orange-500 to-red-500',
    },
  ];

  async function detectConfiguration() {
    mode = 'detecting';

    try {
      const res = await fetchApi('/api/settings/zero-config', { method: 'POST' });
      if (res.ok) {
        detectionResult = await res.json();
        mode = detectionResult?.configured ? 'ready' : 'error';
      } else {
        mode = 'error';
      }
    } catch (err) {
      console.error('Detection failed:', err);
      mode = 'error';
    }
  }

  async function startNow() {
    preferencesStore.update({ setupComplete: true });
    trackSetupComplete({ method: 'zero-config', template: null });
    onComplete?.();
  }

  function showTemplates() {
    mode = 'templates';
  }

  async function applyTemplate(templateId: string) {
    selectedTemplate = templateId;
    isApplying = true;

    try {
      const res = await fetchApi(`/api/settings/templates/${templateId}`, { method: 'POST' });
      if (res.ok) {
        preferencesStore.update({ setupComplete: true });
        trackSetupComplete({ method: 'template', template: templateId });
        onComplete?.();
      }
    } catch (err) {
      console.error('Template apply failed:', err);
    } finally {
      isApplying = false;
    }
  }

  onMount(() => {
    detectConfiguration();
  });
</script>

<div class="simple-setup">
  <!-- Initial / Detecting -->
  {#if mode === 'initial' || mode === 'detecting'}
    <div class="setup-card">
      <div class="icon-container detecting">
        <Zap size={48} />
      </div>
      <h1>Setting Up G-Rump</h1>
      <p class="subtitle">Detecting your configuration...</p>
      <div class="spinner"></div>
    </div>
  {/if}

  <!-- Ready -->
  {#if mode === 'ready'}
    <div class="setup-card">
      <div class="icon-container ready">
        <CheckCircle2 size={48} />
      </div>
      <h1>You're All Set!</h1>
      <p class="subtitle">
        {#if detectionResult?.provider}
          Connected to <strong>{detectionResult.provider.toUpperCase()}</strong>
        {:else}
          G-Rump is ready to use
        {/if}
      </p>

      {#if detectionResult?.features && detectionResult.features.length > 0}
        <div class="features-list">
          <p class="features-label">Available features:</p>
          <div class="feature-tags">
            {#each detectionResult.features.slice(0, 6) as feature}
              <span class="feature-tag">{feature.replace(/_/g, ' ')}</span>
            {/each}
          </div>
        </div>
      {/if}

      <div class="action-buttons">
        <Button variant="primary" size="lg" onclick={startNow}>
          <Rocket size={20} />
          Start Now
        </Button>
        <Button variant="secondary" size="lg" onclick={showTemplates}>Choose a Template</Button>
        <button class="text-btn" onclick={() => onAdvancedSetup?.()}> Advanced Setup </button>
      </div>

      {#if detectionResult?.suggestions && detectionResult.suggestions.length > 0}
        <div class="suggestions">
          <p class="suggestions-label">Suggestions:</p>
          {#each detectionResult.suggestions as suggestion}
            <p class="suggestion">{suggestion}</p>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Templates -->
  {#if mode === 'templates'}
    <div class="setup-card wide">
      <h1>Choose Your Starting Point</h1>
      <p class="subtitle">Pick a template that matches your project</p>

      <div class="templates-grid">
        {#each templates as template}
          {@const Icon = template.icon}
          <button
            class="template-card"
            class:selected={selectedTemplate === template.id}
            class:loading={isApplying && selectedTemplate === template.id}
            onclick={() => applyTemplate(template.id)}
            disabled={isApplying}
          >
            <div class="template-icon bg-gradient-to-br {template.color}">
              <Icon size={24} />
            </div>
            <div class="template-info">
              <h3>{template.name}</h3>
              <p>{template.description}</p>
            </div>
            {#if selectedTemplate === template.id && isApplying}
              <div class="template-loading">
                <div class="mini-spinner"></div>
              </div>
            {/if}
          </button>
        {/each}
      </div>

      <div class="template-actions">
        <button class="text-btn" onclick={() => (mode = 'ready')}> Back </button>
        <button class="text-btn" onclick={startNow}> Skip, I'll configure later </button>
      </div>
    </div>
  {/if}

  <!-- Error -->
  {#if mode === 'error'}
    <div class="setup-card">
      <div class="icon-container error">
        <AlertCircle size={48} />
      </div>
      <h1>Setup Required</h1>
      <p class="subtitle">
        {detectionResult?.warnings?.[0] || 'Please configure an API provider to get started.'}
      </p>

      <div class="action-buttons">
        <Button variant="primary" size="lg" onclick={() => onAdvancedSetup?.()}>
          <Settings size={20} />
          Configure Now
        </Button>
        <button class="text-btn" onclick={detectConfiguration}> Test Connection </button>
      </div>

      <div class="help-text">
        <p>Need help? Check the <a href="/docs/setup" target="_blank">setup guide</a>.</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .simple-setup {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
  }

  .setup-card {
    background: var(--color-bg-card);
    border-radius: 1.5rem;
    padding: 3rem;
    max-width: 480px;
    width: 100%;
    text-align: center;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  }

  .setup-card.wide {
    max-width: 640px;
  }

  .icon-container {
    width: 96px;
    height: 96px;
    margin: 0 auto 1.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .icon-container.detecting {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    animation: pulse 2s infinite;
  }

  .icon-container.ready {
    background: linear-gradient(135deg, #22c55e, #10b981);
  }

  .icon-container.error {
    background: linear-gradient(135deg, #ef4444, #f97316);
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.05);
      opacity: 0.8;
    }
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    color: #1f1147;
    margin: 0 0 0.5rem;
  }

  .subtitle {
    font-size: 1rem;
    color: var(--color-text-muted);
    margin: 0 0 2rem;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e9d5ff;
    border-top-color: #6366f1;
    border-radius: 50%;
    margin: 1rem auto 0;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .features-list {
    margin-bottom: 2rem;
  }

  .features-label {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin: 0 0 0.75rem;
  }

  .feature-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
  }

  .feature-tag {
    padding: 0.25rem 0.75rem;
    background: rgba(99, 102, 241, 0.15);
    border-radius: 9999px;
    font-size: 0.75rem;
    color: #6366f1;
    text-transform: capitalize;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .text-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 0.875rem;
    cursor: pointer;
    padding: 0.5rem;
  }

  .text-btn:hover {
    color: #1f1147;
  }

  .suggestions {
    padding: 1rem;
    background: rgba(234, 179, 8, 0.1);
    border-radius: 0.5rem;
    text-align: left;
  }

  .suggestions-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #b45309;
    margin: 0 0 0.5rem;
    text-transform: uppercase;
  }

  .suggestion {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin: 0.25rem 0;
  }

  .templates-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin: 2rem 0;
  }

  @media (max-width: 480px) {
    .templates-grid {
      grid-template-columns: 1fr;
    }
  }

  .template-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #f5f3ff;
    border: 2px solid transparent;
    border-radius: 0.75rem;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    position: relative;
  }

  .template-card:hover {
    background: #ede9fe;
    border-color: #e9d5ff;
  }

  .template-card.selected {
    border-color: #6366f1;
    background: rgba(99, 102, 241, 0.1);
  }

  .template-card:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .template-icon {
    width: 48px;
    height: 48px;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    flex-shrink: 0;
  }

  .template-info h3 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #1f1147;
    margin: 0 0 0.25rem;
  }

  .template-info p {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .template-loading {
    position: absolute;
    top: 50%;
    right: 1rem;
    transform: translateY(-50%);
  }

  .mini-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e9d5ff;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .template-actions {
    display: flex;
    justify-content: space-between;
    padding-top: 1rem;
    border-top: 1px solid #e9d5ff;
  }

  .help-text {
    margin-top: 1rem;
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .help-text a {
    color: #6366f1;
    text-decoration: underline;
  }
</style>
