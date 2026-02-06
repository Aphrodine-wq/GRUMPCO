<script lang="ts">
  /**
   * Simplified Agent Screen
   *
   * A clean, simple interface for the Agent feature.
   * Removed complex API dependencies that were causing issues.
   */
  import { onMount } from 'svelte';
  import { setCurrentView } from '../stores/uiStore';
  import { sessionsStore } from '../stores/sessionsStore';
  import { getApiBase } from '$lib/api';
  import {
    Bot,
    MessageCircle,
    Rocket,
    Zap,
    Settings,
    Play,
    CheckCircle,
    AlertCircle,
  } from 'lucide-svelte';
  import ScreenLayout from './ScreenLayout.svelte';
  import { Button, Card } from '../lib/design-system';

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

  let backendStatus = $state<'checking' | 'online' | 'offline'>('checking');

  onMount(async () => {
    // Simple health check
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/health/quick`, {
        signal: AbortSignal.timeout(5000),
      });
      backendStatus = res.ok ? 'online' : 'offline';
    } catch {
      backendStatus = 'offline';
    }
  });

  function handleBack() {
    onBack?.() ?? setCurrentView('chat');
  }

  function handleStartAgentChat() {
    sessionsStore.createSession([], undefined, 'gAgent');
    setCurrentView('chat');
  }

  function handleOpenSettings() {
    setCurrentView('settings');
  }
</script>

<ScreenLayout
  title="Agent"
  subtitle="Your AI assistant with advanced capabilities"
  onBack={handleBack}
>
  <div class="agent-screen">
    <!-- Hero Section -->
    <div class="hero-section">
      <div class="hero-icon">
        <Bot size={48} strokeWidth={1.5} />
      </div>
      <h2 class="hero-title">Start an Agent Session</h2>
      <p class="hero-desc">
        The Agent can help you with complex tasks, write code, manage files, and interact with
        external services. Start a conversation to get going.
      </p>
      <Button variant="primary" size="lg" onclick={handleStartAgentChat}>
        <Play size={20} strokeWidth={2} />
        Start Agent Chat
      </Button>
    </div>

    <!-- Status Card -->
    <Card padding="md" variant="outlined" class="status-section">
      <div class="status-header">
        <h3 class="status-title">System Status</h3>
      </div>
      <div class="status-item">
        <div
          class="status-icon"
          class:online={backendStatus === 'online'}
          class:offline={backendStatus === 'offline'}
        >
          {#if backendStatus === 'checking'}
            <div class="spinner"></div>
          {:else if backendStatus === 'online'}
            <CheckCircle size={20} />
          {:else}
            <AlertCircle size={20} />
          {/if}
        </div>
        <div class="status-info">
          <span class="status-label">Backend</span>
          <span class="status-value">
            {#if backendStatus === 'checking'}
              Checking...
            {:else if backendStatus === 'online'}
              Connected
            {:else}
              Offline
            {/if}
          </span>
        </div>
      </div>
      {#if backendStatus === 'offline'}
        <p class="status-hint">
          The backend server appears to be offline. Make sure it's running for full functionality.
        </p>
      {/if}
    </Card>

    <!-- Quick Features -->
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-icon">
          <MessageCircle size={24} strokeWidth={1.5} />
        </div>
        <h4 class="feature-title">Natural Conversation</h4>
        <p class="feature-desc">Chat naturally about your project and goals</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">
          <Zap size={24} strokeWidth={1.5} />
        </div>
        <h4 class="feature-title">Code Generation</h4>
        <p class="feature-desc">Generate and edit code with AI assistance</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">
          <Rocket size={24} strokeWidth={1.5} />
        </div>
        <h4 class="feature-title">Task Automation</h4>
        <p class="feature-desc">Automate repetitive development tasks</p>
      </div>
    </div>

    <!-- Settings Link -->
    <div class="settings-link">
      <Button variant="ghost" size="sm" onclick={handleOpenSettings}>
        <Settings size={16} strokeWidth={2} />
        Configure Agent Settings
      </Button>
    </div>
  </div>
</ScreenLayout>

<style>
  .agent-screen {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 800px;
    margin: 0 auto;
  }

  /* Hero Section */
  .hero-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 2rem;
    background: linear-gradient(
      135deg,
      var(--color-primary-subtle, rgba(124, 58, 237, 0.08)),
      transparent
    );
    border-radius: 16px;
    border: 1px solid var(--color-border, #e9d5ff);
  }

  .hero-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    background: var(--color-primary, #7c3aed);
    color: white;
    border-radius: 20px;
    margin-bottom: 1.5rem;
    box-shadow: 0 8px 24px rgba(124, 58, 237, 0.25);
  }

  .hero-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #1f1147);
    margin: 0 0 0.75rem 0;
  }

  .hero-desc {
    font-size: 1rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0 0 1.5rem 0;
    max-width: 480px;
    line-height: 1.6;
  }

  /* Status Section */
  .status-section {
    padding: 1.25rem !important;
  }

  .status-header {
    margin-bottom: 1rem;
  }

  .status-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .status-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--color-bg-subtle, #f5f3ff);
    color: var(--color-text-muted, #6b7280);
  }

  .status-icon.online {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  .status-icon.offline {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .status-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .status-label {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
  }

  .status-value {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text, #1f1147);
  }

  .status-hint {
    margin: 0.75rem 0 0 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    padding: 0.5rem 0.75rem;
    background: rgba(239, 68, 68, 0.05);
    border-radius: 6px;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--color-border, #e9d5ff);
    border-top-color: var(--color-primary, #7c3aed);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Features Grid */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .feature-card {
    padding: 1.25rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 12px;
    text-align: center;
    transition:
      box-shadow 0.2s,
      border-color 0.2s;
  }

  .feature-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    border-color: var(--color-primary-light, #a78bfa);
  }

  .feature-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    margin: 0 auto 0.75rem;
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    color: var(--color-primary, #7c3aed);
    border-radius: 12px;
  }

  .feature-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text, #1f1147);
    margin: 0 0 0.375rem 0;
  }

  .feature-desc {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
    line-height: 1.4;
  }

  /* Settings Link */
  .settings-link {
    display: flex;
    justify-content: center;
    padding-top: 0.5rem;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .hero-section {
      padding: 1.5rem;
    }

    .hero-icon {
      width: 64px;
      height: 64px;
    }

    .hero-title {
      font-size: 1.25rem;
    }

    .features-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
