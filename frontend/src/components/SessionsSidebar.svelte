<script lang="ts">
  import { CollapsibleSidebar, Button } from '../lib/design-system';
  import { sessionsStore, sortedSessions, currentSession } from '../stores/sessionsStore';
  import { setCurrentView, sidebarCollapsed, showPricing, currentView } from '../stores/uiStore';
  import type { ViewType } from '../stores/uiStore';
  import OpenRepoModal from './OpenRepoModal.svelte';
  import EmptyState from './EmptyState.svelte';
  import {
    Crown,
    Bot,
    LayoutGrid,
    Mic,
    BookOpen,
    Layers,
    Users,
    Box,
    CheckSquare,
    Clock,
    Cloud,
    Cog,
    DollarSign,
    FileText,
  } from 'lucide-svelte';
  let hoveredSessionId: string | null = $state(null);
  let hoverExpanded = $state(false);
  const collapsed = $derived($sidebarCollapsed);
  const effectiveCollapsed = $derived(collapsed && !hoverExpanded);
  let mobileMenuOpen = $state(false);
  let showRepoModal = $state(false);

  type NavGroup = 'build' | 'tools' | 'ai' | 'infra' | 'manage' | 'settings';
  interface NavItem {
    view: ViewType;
    label: string;
    keywords: string[];
    group: NavGroup;
    icon: string;
    shipMode?: boolean;
  }

  // Nav items: Design to Code, Integrations, Advanced AI, Model Benchmark, Troubleshooting, Reset moved to chat context / Settings
  const navItems: NavItem[] = [
    {
      view: 'freeAgent',
      label: 'G-Agent',
      keywords: ['g-agent', 'gagent', 'agent', 'autonomous'],
      group: 'build',
      icon: 'free-agent',
    },
    {
      view: 'voiceCode',
      label: 'Voice code',
      keywords: ['voice', 'mic'],
      group: 'tools',
      icon: 'voice',
    },
    {
      view: 'talkMode',
      label: 'Talk Mode',
      keywords: ['talk', 'voice', 'conversation'],
      group: 'tools',
      icon: 'voice',
    },
    {
      view: 'canvas',
      label: 'Live Canvas',
      keywords: ['canvas', 'a2ui', 'visual'],
      group: 'tools',
      icon: 'canvas',
    },
    {
      view: 'askDocs',
      label: 'Ask docs',
      keywords: ['ask', 'docs', 'documentation'],
      group: 'tools',
      icon: 'docs',
    },
    { view: 'skills', label: 'Skills', keywords: ['skills'], group: 'tools', icon: 'skills' },
    {
      view: 'swarm',
      label: 'Agent swarm',
      keywords: ['agent', 'swarm'],
      group: 'ai',
      icon: 'swarm',
    },
    { view: 'memory', label: 'Memory', keywords: ['memory'], group: 'ai', icon: 'memory' },
    {
      view: 'approvals',
      label: 'Approvals',
      keywords: ['approvals'],
      group: 'ai',
      icon: 'approvals',
    },
    {
      view: 'heartbeats',
      label: 'Scheduled tasks',
      keywords: ['scheduled', 'tasks', 'cron'],
      group: 'ai',
      icon: 'heartbeats',
    },
    { view: 'docker', label: 'Docker', keywords: ['docker'], group: 'infra', icon: 'docker' },
    {
      view: 'docker-setup',
      label: 'Docker setup',
      keywords: ['docker', 'setup'],
      group: 'infra',
      icon: 'docker-setup',
    },
    { view: 'cloud', label: 'Cloud', keywords: ['cloud'], group: 'infra', icon: 'cloud' },
    {
      view: 'cost',
      label: 'Cost dashboard',
      keywords: ['cost', 'usage'],
      group: 'manage',
      icon: 'cost',
    },
    { view: 'auditLog', label: 'Audit log', keywords: ['audit'], group: 'manage', icon: 'audit' },
    {
      view: 'settings',
      label: 'Settings',
      keywords: ['settings'],
      group: 'settings',
      icon: 'settings',
    },
  ];

  const groupLabels: Record<NavGroup, string> = {
    build: 'Build',
    tools: 'Tools',
    ai: 'AI',
    infra: 'Infra',
    manage: 'Manage',
    settings: 'Settings',
  };

  const groupOrder: NavGroup[] = ['build', 'tools', 'ai', 'infra', 'manage', 'settings'];

  const filteredNavItems = $derived(
    groupOrder.flatMap((group) => {
      const items = navItems.filter((i) => i.group === group);
      return items.length ? [{ group, items }] : [];
    })
  );

  const iconMap: Record<string, typeof Bot> = {
    canvas: LayoutGrid,
    'free-agent': Bot,
    design: LayoutGrid,
    voice: Mic,
    docs: BookOpen,
    skills: Layers,
    swarm: Users,
    memory: Box,
    approvals: CheckSquare,
    heartbeats: Clock,
    docker: Box,
    'docker-setup': Cog,
    cloud: Cloud,
    cost: DollarSign,
    audit: FileText,
    settings: Cog,
  };

  function handleNewSession() {
    sessionsStore.createSession([]);
    if (window.innerWidth < 768) {
      mobileMenuOpen = false;
    }
  }

  function handleSelectSession(id: string) {
    sessionsStore.switchSession(id);
    setCurrentView('chat');
    if (window.innerWidth < 768) {
      mobileMenuOpen = false;
    }
  }

  function goTo(view: ViewType) {
    setCurrentView(view);
    if (window.innerWidth < 768) {
      mobileMenuOpen = false;
    }
  }

  function handleDeleteSession(e: MouseEvent, id: string) {
    e.stopPropagation();
    if (confirm('Delete this session?')) {
      sessionsStore.deleteSession(id);
    }
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function truncateText(text: string, maxLength: number = 50): string {
    if (effectiveCollapsed) {
      return text.charAt(0).toUpperCase();
    }
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  }
</script>

<!-- Mobile toggle button -->
<button
  class="mobile-toggle"
  class:open={mobileMenuOpen}
  onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
  aria-label="Toggle menu"
>
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    {#if mobileMenuOpen}
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    {:else}
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    {/if}
  </svg>
</button>

<!-- Mobile backdrop -->
{#if mobileMenuOpen}
  <div
    class="mobile-backdrop"
    onclick={() => (mobileMenuOpen = false)}
    onkeydown={(e) => e.key === 'Escape' && (mobileMenuOpen = false)}
    role="button"
    tabindex="0"
    aria-label="Close menu"
  ></div>
{/if}

<div
  class="sidebar-wrapper"
  class:mobile-open={mobileMenuOpen}
  role="navigation"
  aria-label="Sessions and navigation"
  onmouseenter={() => {
    if (collapsed) hoverExpanded = true;
  }}
  onmouseleave={() => {
    hoverExpanded = false;
  }}
>
  <CollapsibleSidebar
    collapsed={effectiveCollapsed}
    onToggle={() => sidebarCollapsed.update((v) => !v)}
    width={240}
    collapsedWidth={64}
  >
    {#snippet header()}
      <Button variant="primary" size="md" fullWidth onclick={handleNewSession} class="new-chat-btn">
        <div class="btn-inner" class:collapsed={effectiveCollapsed}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-plus"><path d="M5 12h14" /><path d="M12 5v14" /></svg
          >
          {#if !effectiveCollapsed}
            <span>New Chat</span>
          {/if}
        </div>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        fullWidth
        onclick={() => (showRepoModal = true)}
        class="github-connect-btn"
      >
        <div class="btn-inner" class:collapsed={effectiveCollapsed}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-github"
            ><path
              d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"
            /><path d="M9 18c-4.51 2-5-2-7-2" /></svg
          >
          {#if !effectiveCollapsed}
            <span>Open GitHub Repo</span>
          {/if}
        </div>
      </Button>
    {/snippet}

    <div class="sessions-list" class:collapsed={effectiveCollapsed}>
      {#each $sortedSessions as session (session.id)}
        <div
          class="session-item"
          class:active={session.id === $currentSession?.id}
          class:collapsed={effectiveCollapsed}
          onmouseenter={() => (hoveredSessionId = session.id)}
          onmouseleave={() => (hoveredSessionId = null)}
          onclick={() => handleSelectSession(session.id)}
          onkeydown={(e) => e.key === 'Enter' && handleSelectSession(session.id)}
          role="button"
          tabindex="0"
          title={session.name}
        >
          <div class="session-content" class:collapsed={effectiveCollapsed}>
            <div class="session-name" class:collapsed={effectiveCollapsed}>
              {truncateText(session.name)}
              {#if (session.sessionType === 'gAgent' || session.sessionType === 'freeAgent') && !collapsed}
                <span class="session-type-badge" title="G-Agent session">GA</span>
              {/if}
            </div>
            {#if !effectiveCollapsed}
              <div class="session-meta">
                {formatDate(session.updatedAt)} · {session.messages.length} msg
              </div>
            {/if}
          </div>

          {#if hoveredSessionId === session.id && !effectiveCollapsed}
            <button
              class="delete-btn"
              onclick={(e) => handleDeleteSession(e, session.id)}
              title="Delete session"
              aria-label="Delete session"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="lucide lucide-trash-2"
                ><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path
                  d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
                /><line x1="10" x2="10" y1="11" y2="17" /><line
                  x1="14"
                  x2="14"
                  y1="11"
                  y2="17"
                /></svg
              >
            </button>
          {/if}
        </div>
      {/each}

      {#if $sortedSessions.length === 0}
        <div class="empty-state" class:collapsed={effectiveCollapsed}>
          {#if !effectiveCollapsed}
            <EmptyState
              headline="Your ideas land here"
              description="Click New Chat above to get started"
              variant="compact"
            />
          {:else}
            <div class="empty-dot"></div>
          {/if}
        </div>
      {/if}
    </div>
    {#snippet footer()}
      <div class="sidebar-footer-content" class:collapsed={effectiveCollapsed}>
        <div class="upgrade-btn-wrap">
          <Button
            variant="primary"
            size="sm"
            fullWidth
            onclick={() => showPricing.set(true)}
            title="Upgrade your account"
          >
            <div class="btn-inner" class:collapsed={effectiveCollapsed}>
              <Crown class="w-4 h-4 shrink-0" strokeWidth={2} />
              {#if !effectiveCollapsed}
                <span>Upgrade</span>
              {/if}
            </div>
          </Button>
        </div>

        <!-- Grouped nav sections -->
        {#each filteredNavItems as { group, items }}
          <div class="sidebar-footer-section">
            {#if !effectiveCollapsed}
              <div class="sidebar-footer-section-title">{groupLabels[group]}</div>
            {/if}
            {#each items as item}
              {@const IconComponent = iconMap[item.icon] ?? Cog}
              <button
                class="settings-btn"
                class:active={$currentView === item.view}
                title={item.label}
                aria-label={item.label}
                onclick={() => goTo(item.view)}
              >
                <IconComponent class="nav-icon" width={20} height={20} strokeWidth={2} />
                {#if !effectiveCollapsed}<span>{item.label}</span>{/if}
              </button>
            {/each}
          </div>
        {/each}
      </div>
    {/snippet}
  </CollapsibleSidebar>
</div>

{#if showRepoModal}
  <OpenRepoModal onClose={() => (showRepoModal = false)} />
{/if}

<style>
  .btn-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
  }

  .btn-inner.collapsed {
    gap: 0;
  }

  .sessions-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    flex: 1;
    overflow-y: auto;
    transition: padding 200ms ease;
  }

  .sessions-list.collapsed {
    padding: 8px 4px;
    align-items: center;
  }

  .session-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    text-align: left;
    transition: all 150ms ease;
    min-height: 48px;
  }

  .session-item.collapsed {
    justify-content: center;
    padding: 8px;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    margin: 0 auto;
  }

  .session-item:hover {
    background-color: var(--color-bg-card-hover);
    border-color: var(--color-border-light);
  }

  .session-item.active {
    background-color: var(--color-bg-card);
    border-left: 3px solid var(--color-primary);
    border-color: var(--color-border-highlight);
    padding-left: 9px;
  }

  .session-item.active.collapsed {
    border-left: none;
    background-color: var(--color-primary);
    padding-left: 8px;
  }

  .session-item.active.collapsed .session-name {
    color: white;
  }

  .session-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .session-content.collapsed {
    align-items: center;
    justify-content: center;
  }

  .session-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .session-name.collapsed {
    font-size: 16px;
    font-weight: 600;
  }

  .session-meta {
    font-size: 11px;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .session-type-badge {
    display: inline-block;
    margin-left: 6px;
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 600;
    color: var(--color-primary);
    background: rgba(99, 102, 241, 0.15);
    border-radius: 4px;
    vertical-align: middle;
  }

  .delete-btn {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .delete-btn:hover {
    background-color: var(--color-error-light, rgba(239, 68, 68, 0.2));
    color: var(--color-error);
  }

  .empty-state {
    padding: 24px 12px;
    text-align: center;
    color: var(--color-text-muted);
  }

  .empty-state.collapsed {
    padding: 24px 0;
  }

  .empty-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: var(--color-border);
    margin: 0 auto;
  }

  .sidebar-footer-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .sidebar-footer-content.collapsed {
    align-items: center;
  }

  .sidebar-footer-section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    margin-top: 16px;
    margin-bottom: 6px;
    padding: 0 4px;
  }

  .sidebar-footer-content.collapsed .sidebar-footer-section-title {
    display: none;
  }

  .sidebar-footer-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sidebar-footer-content.collapsed .sidebar-footer-section {
    align-items: center;
  }

  .upgrade-btn-wrap {
    margin-bottom: 8px;
  }

  .settings-btn :global(svg) {
    flex-shrink: 0;
  }

  .settings-btn.active {
    background-color: var(--color-primary);
    color: white;
  }

  .settings-btn.active:hover {
    background-color: var(--color-primary-hover);
    color: white;
  }

  .settings-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 44px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--color-text);
    cursor: pointer;
    transition: all 150ms ease;
    font-size: 14px;
    font-weight: 500;
  }

  .settings-btn:hover {
    background-color: var(--color-bg-card-hover);
    color: var(--color-primary);
  }

  .sidebar-footer-content.collapsed .settings-btn {
    padding: 10px;
    justify-content: center;
    width: 44px;
    min-width: 44px;
    height: 44px;
    min-height: 44px;
  }

  /* Custom scrollbar - visible on left side */
  .sessions-list {
    direction: rtl; /* Moves scrollbar to left */
    scrollbar-width: thin;
    scrollbar-color: var(--color-primary-light, rgba(124, 58, 237, 0.3)) transparent;
  }

  .sessions-list > * {
    direction: ltr; /* Reset content direction */
  }

  .sessions-list::-webkit-scrollbar {
    width: 6px;
  }

  .sessions-list::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 3px;
  }

  .sessions-list::-webkit-scrollbar-thumb {
    background: var(--color-primary-light, rgba(124, 58, 237, 0.4));
    border-radius: 3px;
  }

  .sessions-list::-webkit-scrollbar-thumb:hover {
    background: var(--color-primary, #7c3aed);
  }

  /* Mobile styles */
  .mobile-toggle {
    display: none;
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: 1001;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: none;
    background: white;
    color: #18181b;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .mobile-toggle:hover {
    background: #f4f4f5;
    transform: scale(1.05);
  }

  .mobile-toggle.open {
    background: #18181b;
    color: white;
  }

  .mobile-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 999;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .sidebar-wrapper {
    display: contents;
  }

  @media (max-width: 768px) {
    .mobile-toggle {
      display: flex;
    }

    .mobile-backdrop {
      display: block;
    }

    .sidebar-wrapper {
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
      z-index: 1000;
      transform: translateX(-100%);
      transition: transform 0.3s ease-out;
    }

    .sidebar-wrapper.mobile-open {
      transform: translateX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sessions-list {
      transition: none;
    }
    .session-item,
    .delete-btn,
    .settings-btn {
      transition: none;
    }
    .mobile-toggle {
      transition: none;
    }
    .mobile-backdrop {
      animation: none;
      transition: opacity 150ms ease;
    }
    @media (max-width: 768px) {
      .sidebar-wrapper {
        transition: none;
      }
    }
  }
</style>
