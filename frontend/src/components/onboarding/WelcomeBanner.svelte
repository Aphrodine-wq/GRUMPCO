<script lang="ts">
  /**
   * WelcomeBanner - Quick start guide for new users
   * Shows when user first lands on chat after onboarding
   */
  import { slide } from 'svelte/transition';
  import { MessageSquare, Code, FileText, Cpu, ArrowRight, X } from 'lucide-svelte';
  import { setCurrentView } from '../../stores/uiStore';
  import type { ViewType } from '../../stores/uiStore';

  interface Props {
    onDismiss?: () => void;
    onAction?: (action: ViewType) => void;
  }

  let { onDismiss, onAction }: Props = $props();

  const BANNER_KEY = 'grump-welcome-banner-dismissed';
  let dismissed = $state(false);

  // Check if already dismissed
  $effect(() => {
    try {
      if (localStorage.getItem(BANNER_KEY) === 'true') {
        dismissed = true;
      }
    } catch {}
  });

  function dismiss() {
    dismissed = true;
    try {
      localStorage.setItem(BANNER_KEY, 'true');
    } catch {}
    onDismiss?.();
  }

  function handleAction(view: ViewType) {
    onAction?.(view);
    setCurrentView(view);
    dismiss();
  }

  const quickActions = [
    {
      id: 'chat',
      icon: MessageSquare,
      title: 'Start chatting',
      description: 'Ask anything',
      action: 'chat' as ViewType,
    },
    {
      id: 'architecture',
      icon: Cpu,
      title: 'Design architecture',
      description: 'Generate diagrams',
      action: 'architecture' as ViewType,
    },
    {
      id: 'code',
      icon: Code,
      title: 'Generate code',
      description: 'Full-stack apps',
      action: 'code' as ViewType,
    },
    {
      id: 'prd',
      icon: FileText,
      title: 'Create PRD',
      description: 'Product specs',
      action: 'prd' as ViewType,
    },
  ];
</script>

{#if !dismissed}
  <div class="welcome-banner" transition:slide={{ duration: 200 }}>
    <button class="dismiss-btn" onclick={dismiss} aria-label="Dismiss">
      <X size={16} />
    </button>

    <div class="banner-content">
      <div class="banner-header">
        <h2>Welcome to G-Rump!</h2>
        <p>Here are some things you can do:</p>
      </div>

      <div class="quick-actions">
        {#each quickActions as action}
          <button class="action-card" onclick={() => handleAction(action.action)}>
            <div class="action-icon">
              {#if action.icon}
                {@const ActionIcon = action.icon}
                <ActionIcon size={20} />
              {/if}
            </div>
            <div class="action-text">
              <span class="action-title">{action.title}</span>
              <span class="action-desc">{action.description}</span>
            </div>
            <ArrowRight size={16} class="action-arrow" />
          </button>
        {/each}
      </div>

      <div class="banner-footer">
        <span class="keyboard-hint">
          Pro tip: Press <kbd>Ctrl</kbd>+<kbd>K</kbd> to open the command palette
        </span>
      </div>
    </div>
  </div>
{/if}

<style>
  .welcome-banner {
    position: relative;
    margin: 24px;
    padding: 24px;
    background: linear-gradient(135deg, #f8f5ff 0%, #fdf4ff 100%);
    border: 1px solid #e9d5ff;
    border-radius: 16px;
  }

  .dismiss-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: white;
    border: 1px solid #e4e4e7;
    border-radius: 6px;
    color: #71717a;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .dismiss-btn:hover {
    background: #f4f4f5;
    color: #3f3f46;
  }

  .banner-content {
    max-width: 600px;
    margin: 0 auto;
  }

  .banner-header {
    text-align: center;
    margin-bottom: 24px;
  }

  .banner-header h2 {
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 700;
    color: #18181b;
  }

  .banner-header p {
    margin: 0;
    font-size: 14px;
    color: #71717a;
  }

  .quick-actions {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .action-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    background: white;
    border: 1px solid #e4e4e7;
    border-radius: 12px;
    text-align: left;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .action-card:hover {
    border-color: #7c3aed;
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.1);
    transform: translateY(-2px);
  }

  .action-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: #f3e8ff;
    border-radius: 10px;
    color: #7c3aed;
  }

  .action-text {
    flex: 1;
    min-width: 0;
  }

  .action-title {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #18181b;
    margin-bottom: 2px;
  }

  .action-desc {
    display: block;
    font-size: 12px;
    color: #71717a;
  }

  .action-card :global(.action-arrow) {
    flex-shrink: 0;
    color: #a1a1aa;
    transition: all 150ms ease;
  }

  .action-card:hover :global(.action-arrow) {
    color: #7c3aed;
    transform: translateX(2px);
  }

  .banner-footer {
    margin-top: 20px;
    text-align: center;
  }

  .keyboard-hint {
    font-size: 12px;
    color: #a1a1aa;
  }

  .keyboard-hint kbd {
    padding: 2px 6px;
    font-size: 11px;
    font-family: ui-monospace, monospace;
    background: white;
    border: 1px solid #e4e4e7;
    border-radius: 4px;
    color: #3f3f46;
  }

  @media (max-width: 480px) {
    .quick-actions {
      grid-template-columns: 1fr;
    }
  }
</style>
