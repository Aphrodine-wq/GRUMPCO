<script lang="ts">
  /**
   * UnifiedSidebar - ChatGPT-inspired collapsible sidebar
   *
   * Features:
   * - Collapsible with icon rail mode
   * - Session list with grouping
   * - Screen navigation
   * - User profile section
   * - Agent/model picker
   */
  import { onMount } from 'svelte';
  import {
    Plus,
    MessageSquare,
    Settings,
    User,
    ChevronLeft,
    ChevronRight,
    Search,
    Plug,
    Server,
    LogOut,
    BookOpen,
    Brain,
    Bot,
    FolderOpen,
    Clock,
    Cloud,
    Sparkles,
    Github,
    Database,
    BarChart3,
    Trash2,
  } from 'lucide-svelte';
  import { sessionsStore, sortedSessions, currentSession } from '../../stores/sessionsStore';
  import {
    setCurrentView,
    sidebarCollapsed,
    currentView,
    chatStreaming,
  } from '../../stores/uiStore';
  import type { ViewType } from '../../stores/uiStore';
  import { isAuthenticated, user as currentUser, logout } from '../../stores/authStore';
  import { authGateStore } from '../../stores/authGateStore';
  import type { Session } from '../../types';
  import Modal from '../../lib/design-system/components/Modal/Modal.svelte';
  import GoogleAuthGate from '../GoogleAuthGate.svelte';
  import CreditUsageWidget from '../CreditUsageWidget.svelte';

  // Sidebar state
  let collapsed = $derived($sidebarCollapsed);
  let hoverExpanded = $state(false);
  let hoverTimer: ReturnType<typeof setTimeout> | null = $state(null);
  let searchQuery = $state('');
  let accountMenuOpen = $state(false);
  let showAuthModal = $state(false);
  let accountMenuRef: HTMLDivElement | null = $state(null);

  // Effective collapsed state (collapsed but can expand on hover)
  const effectiveCollapsed = $derived(collapsed && !hoverExpanded);

  // Nav: Chat, Projects, Builder, Integrations, Tasks, Skills, Memory, MCP, Cloud (Settings in account menu)
  interface NavItem {
    id: ViewType;
    label: string;
    icon:
      | 'chat'
      | 'agent'
      | 'projects'
      | 'integrations'
      | 'skills'
      | 'memory'
      | 'mcp'
      | 'cloud'
      | 'github'
      | 'analytics'
      | 'settings';
    badge?: string;
  }

  const primaryNav: NavItem[] = [
    { id: 'chat', label: 'Chat', icon: 'chat' },
    { id: 'gAgent', label: 'Agent', icon: 'agent' },
    { id: 'projects', label: 'Projects', icon: 'projects' },
    { id: 'integrations', label: 'Integrations', icon: 'integrations' },
    { id: 'memory', label: 'Knowledge', icon: 'memory' },
    { id: 'cloud', label: 'Cloud', icon: 'cloud' },
    { id: 'analytics', label: 'Analytics', icon: 'analytics' },
    { id: 'github', label: 'GitHub', icon: 'github' },
  ];

  const secondaryNav: NavItem[] = [];

  // Filter sessions based on search
  const filteredSessions = $derived(
    searchQuery.trim()
      ? $sortedSessions.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : $sortedSessions
  );

  // Group sessions by time
  const groupedSessions = $derived(() => {
    const today: Session[] = [];
    const yesterday: Session[] = [];
    const thisWeek: Session[] = [];
    const older: Session[] = [];

    const dayMs = 24 * 60 * 60 * 1000;
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const yesterdayStart = todayStart - dayMs;
    const weekStart = todayStart - 7 * dayMs;

    for (const session of filteredSessions) {
      const updated = session.updatedAt;
      if (updated >= todayStart) {
        today.push(session);
      } else if (updated >= yesterdayStart) {
        yesterday.push(session);
      } else if (updated >= weekStart) {
        thisWeek.push(session);
      } else {
        older.push(session);
      }
    }

    return { today, yesterday, thisWeek, older };
  });

  function handleNewSession() {
    sessionsStore.createSession([]);
    setCurrentView('chat');
  }

  function handleSelectSession(id: string) {
    sessionsStore.switchSession(id);
    setCurrentView('chat');
  }

  function handleDeleteSession(e: MouseEvent, id: string) {
    e.stopPropagation();
    if (confirm('Delete this session?')) {
      sessionsStore.deleteSession(id);
    }
  }

  function goTo(view: ViewType) {
    // Block navigation while chat is streaming to prevent accidental page switches
    if ($chatStreaming && view !== 'chat') {
      // Allow navigating back to chat but not away from it
      return;
    }
    setCurrentView(view);
  }

  function toggleCollapse() {
    sidebarCollapsed.update((v) => !v);
  }

  function formatSessionName(name: string): string {
    if (effectiveCollapsed) {
      return name.charAt(0).toUpperCase();
    }
    return name.length > 28 ? name.slice(0, 28) + '...' : name;
  }

  function toggleAccountMenu() {
    accountMenuOpen = !accountMenuOpen;
  }

  function closeAccountMenu() {
    accountMenuOpen = false;
  }

  function handleSignIn() {
    closeAccountMenu();
    showAuthModal = true;
  }

  function handleSignOut() {
    closeAccountMenu();
    logout();
  }

  function handleAuthComplete() {
    showAuthModal = false;
  }

  function handleAuthSkip() {
    authGateStore.markAuthSkipped();
    showAuthModal = false;
  }

  onMount(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountMenuOpen && accountMenuRef && !accountMenuRef.contains(e.target as Node)) {
        closeAccountMenu();
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });

  function getInitials(name?: string, email?: string): string {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  }
</script>

<aside
  class="unified-sidebar"
  class:collapsed={effectiveCollapsed}
  class:hover-expanded={hoverExpanded}
  onmouseenter={() => {
    if (collapsed) {
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        hoverExpanded = true;
      }, 120);
    }
  }}
  onmouseleave={() => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    hoverExpanded = false;
  }}
  role="navigation"
  aria-label="Main navigation"
>
  <!-- Header: New Chat + Collapse Toggle -->
  <div class="sidebar-header">
    <button class="new-chat-btn" onclick={handleNewSession} title="New chat">
      <Plus size={20} strokeWidth={2.5} />
      {#if !effectiveCollapsed}
        <span>New chat</span>
      {/if}
    </button>

    <button
      class="collapse-btn"
      onclick={toggleCollapse}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {#if collapsed}
        <ChevronRight size={16} />
      {:else}
        <ChevronLeft size={16} />
      {/if}
    </button>
  </div>

  <!-- Search (only when expanded) -->
  {#if !effectiveCollapsed}
    <div class="sidebar-search">
      <Search size={16} class="search-icon" />
      <input
        type="text"
        placeholder="Search chats..."
        bind:value={searchQuery}
        class="search-input"
      />
    </div>
  {/if}

  <!-- Primary Navigation -->
  <nav class="primary-nav">
    {#each primaryNav as item}
      <button
        class="nav-item"
        class:active={$currentView === item.id}
        onclick={() => goTo(item.id)}
        title={item.label}
      >
        {#if item.icon === 'chat'}
          <MessageSquare size={16} />
        {:else if item.icon === 'agent'}
          <Bot size={16} />
        {:else if item.icon === 'projects'}
          <FolderOpen size={16} />
        {:else if item.icon === 'integrations'}
          <Plug size={16} />
        {:else if item.icon === 'skills'}
          <BookOpen size={16} />
        {:else if item.icon === 'memory'}
          <Brain size={16} />
        {:else if item.icon === 'mcp'}
          <Server size={16} />
        {:else if item.icon === 'cloud'}
          <Cloud size={16} />
        {:else if item.icon === 'github'}
          <Github size={16} />
        {:else if item.icon === 'analytics'}
          <BarChart3 size={16} />
        {:else}
          <Settings size={16} />
        {/if}
        {#if !effectiveCollapsed}
          <span class="nav-label">{item.label}</span>
          {#if item.badge}
            <span class="nav-badge">{item.badge}</span>
          {/if}
        {/if}
      </button>
    {/each}
  </nav>

  <!-- Sessions List -->
  <div class="sessions-section">
    {#if !effectiveCollapsed}
      <div class="section-header">
        <span class="section-title">Recent</span>
      </div>
    {/if}

    <div class="sessions-list">
      {#if groupedSessions().today.length > 0}
        {#if !effectiveCollapsed}
          <div class="session-group-label">Today</div>
        {/if}
        {#each groupedSessions().today as session (session.id)}
          <div
            class="session-item"
            class:active={session.id === $currentSession?.id}
            class:collapsed={effectiveCollapsed}
            role="group"
          >
            <button
              type="button"
              class="session-select-btn"
              onclick={() => handleSelectSession(session.id)}
              title={session.name}
            >
              <span class="session-name">{formatSessionName(session.name)}</span>
            </button>
            {#if !effectiveCollapsed}
              <button
                type="button"
                class="delete-btn"
                onclick={(e) => handleDeleteSession(e, session.id)}
                title="Delete"
                aria-label="Delete session"
              >
                <Trash2 size={14} />
              </button>
            {/if}
          </div>
        {/each}
      {/if}

      {#if groupedSessions().yesterday.length > 0}
        {#if !effectiveCollapsed}
          <div class="session-group-label">Yesterday</div>
        {/if}
        {#each groupedSessions().yesterday as session (session.id)}
          <div
            class="session-item"
            class:active={session.id === $currentSession?.id}
            class:collapsed={effectiveCollapsed}
            role="group"
          >
            <button
              type="button"
              class="session-select-btn"
              onclick={() => handleSelectSession(session.id)}
              title={session.name}
            >
              <span class="session-name">{formatSessionName(session.name)}</span>
            </button>
            {#if !effectiveCollapsed}
              <button
                type="button"
                class="delete-btn"
                onclick={(e) => handleDeleteSession(e, session.id)}
                title="Delete"
                aria-label="Delete session"
              >
                <Trash2 size={14} />
              </button>
            {/if}
          </div>
        {/each}
      {/if}

      {#if groupedSessions().thisWeek.length > 0}
        {#if !effectiveCollapsed}
          <div class="session-group-label">This week</div>
        {/if}
        {#each groupedSessions().thisWeek as session (session.id)}
          <div
            class="session-item"
            class:active={session.id === $currentSession?.id}
            class:collapsed={effectiveCollapsed}
            role="group"
          >
            <button
              type="button"
              class="session-select-btn"
              onclick={() => handleSelectSession(session.id)}
              title={session.name}
            >
              <span class="session-name">{formatSessionName(session.name)}</span>
            </button>
            {#if !effectiveCollapsed}
              <button
                type="button"
                class="delete-btn"
                onclick={(e) => handleDeleteSession(e, session.id)}
                title="Delete"
                aria-label="Delete session"
              >
                <Trash2 size={14} />
              </button>
            {/if}
          </div>
        {/each}
      {/if}

      {#if groupedSessions().older.length > 0}
        {#if !effectiveCollapsed}
          <div class="session-group-label">Older</div>
        {/if}
        {#each groupedSessions().older.slice(0, 10) as session (session.id)}
          <div
            class="session-item"
            class:active={session.id === $currentSession?.id}
            class:collapsed={effectiveCollapsed}
            role="group"
          >
            <button
              type="button"
              class="session-select-btn"
              onclick={() => handleSelectSession(session.id)}
              title={session.name}
            >
              <span class="session-name">{formatSessionName(session.name)}</span>
            </button>
            {#if !effectiveCollapsed}
              <button
                type="button"
                class="delete-btn"
                onclick={(e) => handleDeleteSession(e, session.id)}
                title="Delete"
                aria-label="Delete session"
              >
                <Trash2 size={14} />
              </button>
            {/if}
          </div>
        {/each}
      {/if}

      {#if filteredSessions.length === 0}
        <div class="empty-sessions">
          {#if effectiveCollapsed}
            <span class="empty-dot"></span>
          {:else}
            <span>No chats yet</span>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Spacer -->
  <div class="sidebar-spacer"></div>

  <!-- Footer: Credit usage + User (Settings moved to Account menu) -->
  <div class="sidebar-footer">
    {#if !effectiveCollapsed}
      <CreditUsageWidget />
    {/if}
    {#each secondaryNav as item}
      <button
        class="nav-item"
        class:active={$currentView === item.id}
        onclick={() => goTo(item.id)}
        title={item.label}
      >
        <Settings size={20} />
        {#if !effectiveCollapsed}
          <span class="nav-label">{item.label}</span>
        {/if}
      </button>
    {/each}

    <!-- User Profile -->
    <div class="user-section" bind:this={accountMenuRef}>
      <button
        type="button"
        class="user-btn"
        title={$currentUser?.email || 'Account'}
        onclick={toggleAccountMenu}
        aria-expanded={accountMenuOpen}
        aria-haspopup="menu"
      >
        <div class="user-avatar">
          {#if $isAuthenticated && $currentUser}
            <span>{getInitials($currentUser.name, $currentUser.email)}</span>
          {:else}
            <User size={16} />
          {/if}
        </div>
        {#if !effectiveCollapsed}
          <div class="user-info">
            {#if $isAuthenticated && $currentUser}
              <span class="user-name">{$currentUser.name || $currentUser.email?.split('@')[0]}</span
              >
              <span class="user-plan">Free plan</span>
            {:else}
              <span class="user-name">Guest</span>
              <span class="user-plan">Sign in</span>
            {/if}
          </div>
        {/if}
      </button>

      <!-- Account menu popover -->
      {#if accountMenuOpen}
        <div
          class="account-menu"
          role="menu"
          aria-label="Account menu"
          tabindex="-1"
          onkeydown={(e) => {
            if (e.key === 'Escape') closeAccountMenu();
          }}
        >
          {#if $isAuthenticated && $currentUser}
            <div class="account-menu-header">
              <span class="account-menu-name"
                >{$currentUser.name || $currentUser.email?.split('@')[0]}</span
              >
              <span class="account-menu-email">{$currentUser.email}</span>
            </div>
            <div class="account-menu-divider"></div>
          {/if}
          {#if !$isAuthenticated}
            <button
              type="button"
              class="account-menu-item primary"
              role="menuitem"
              onclick={handleSignIn}
            >
              <User size={16} />
              <span>Sign in</span>
            </button>
          {/if}
          <button
            type="button"
            class="account-menu-item"
            role="menuitem"
            onclick={() => {
              closeAccountMenu();
              goTo('settings');
            }}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
          {#if $isAuthenticated}
            <div class="account-menu-divider"></div>
            <button
              type="button"
              class="account-menu-item danger"
              role="menuitem"
              onclick={handleSignOut}
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</aside>

<!-- Auth modal -->
<Modal bind:open={showAuthModal} title="Sign in" size="sm">
  <GoogleAuthGate onComplete={handleAuthComplete} onSkip={handleAuthSkip} />
</Modal>

<style>
  .unified-sidebar {
    display: flex;
    flex-direction: column;
    width: 250px;
    height: calc(100vh - 40px); /* Account for title bar */
    margin: 8px;
    background: var(--glass-bg, rgba(255, 255, 255, 0.95));
    backdrop-filter: blur(6px);
    border: 1px solid var(--color-border-light, #f3e8ff);
    border-radius: 16px;
    transition: width 220ms cubic-bezier(0.4, 0, 0.2, 1);
    will-change: width;
    overflow: hidden;
    flex-shrink: 0;
    color: var(--color-text, #1f1147);
    contain: layout style;
  }

  .unified-sidebar.collapsed {
    width: 64px;
  }

  /* Hover-expanded state: overlay on top of content without pushing layout */
  .unified-sidebar.hover-expanded {
    position: relative;
    z-index: 100;
    box-shadow: 8px 0 32px rgba(0, 0, 0, 0.1);
  }

  /* Header */
  .sidebar-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    border-bottom: 1px solid var(--color-border-light, #f3e8ff);
  }

  .new-chat-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 42px;
    padding: 0 10px;
    background: var(--color-primary, #7c3aed);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background 60ms ease-out,
      transform 50ms ease-out;
  }

  .new-chat-btn:hover {
    background: var(--color-primary-hover, #6d28d9);
    transform: translateY(-1px);
  }

  .new-chat-btn:active {
    transform: translateY(0);
  }

  .collapsed .new-chat-btn {
    padding: 0;
    width: 40px;
    flex: none;
  }

  .collapse-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 8px;
    color: var(--color-text-muted, #6d28d9);
    cursor: pointer;
    transition: all 60ms ease-out;
  }

  .collapse-btn:hover {
    background: var(--color-bg-card-hover, #f8f5ff);
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
  }

  .collapsed .collapse-btn {
    display: none;
  }

  /* Search */
  .sidebar-search {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 10px;
    padding: 6px 10px;
    background: var(--color-bg-input, #f3e8ff);
    border-radius: 10px;
    border: 1px solid transparent;
    transition:
      border-color 60ms ease-out,
      opacity 150ms ease-out,
      max-height 220ms cubic-bezier(0.4, 0, 0.2, 1);
    max-height: 50px;
    overflow: hidden;
  }

  .sidebar-search:focus-within {
    border-color: var(--color-primary, #7c3aed);
  }

  .sidebar-search :global(.search-icon) {
    color: var(--color-text-muted, #6d28d9);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 14px;
    color: var(--color-text, #1f1147);
    outline: none;
  }

  .search-input::placeholder {
    color: var(--color-text-muted, #6d28d9);
    opacity: 0.7;
  }

  .primary-nav {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 3px 6px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 36px;
    padding: 0 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text, #1f1147);
    cursor: pointer;
    transition: all 60ms ease-out;
    text-align: left;
  }

  .nav-item:hover {
    background: var(--color-bg-card-hover, #f8f5ff);
  }

  .nav-item.active {
    background: var(--color-primary, #7c3aed);
    color: white;
  }

  .collapsed .nav-item {
    justify-content: center;
    padding: 0;
  }

  .nav-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 1;
    transition: opacity 150ms ease-out;
  }

  .collapsed .nav-label {
    opacity: 0;
    pointer-events: none;
    width: 0;
    overflow: hidden;
  }

  .nav-badge {
    padding: 2px 6px;
    background: var(--color-primary-glow, rgba(124, 58, 237, 0.2));
    color: var(--color-primary, #7c3aed);
    font-size: 11px;
    font-weight: 600;
    border-radius: 6px;
  }

  .nav-item.active .nav-badge {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  /* Sessions Section */
  .sessions-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    transition: opacity 150ms ease-out 60ms;
  }

  .collapsed .sessions-section .section-header,
  .collapsed .sessions-section .session-group-label {
    opacity: 0;
    transition: opacity 100ms ease-out;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px 4px;
  }

  .section-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #6d28d9);
  }

  .sessions-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 6px 6px;
  }

  .sessions-list::-webkit-scrollbar {
    width: 4px;
  }

  .sessions-list::-webkit-scrollbar-thumb {
    background: var(--color-border, #e9d5ff);
    border-radius: 2px;
  }

  .sessions-list:hover::-webkit-scrollbar-thumb {
    background: var(--color-primary-glow, rgba(124, 58, 237, 0.4));
  }

  .session-group-label {
    padding: 10px 6px 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #6d28d9);
    opacity: 0.7;
  }

  .session-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 34px;
    padding: 4px 8px;
    background: transparent;
    border: none;
    border-radius: 10px;
    font-size: 13px;
    color: var(--color-text, #1f1147);
    cursor: pointer;
    transition: all 60ms ease-out;
    text-align: left;
  }

  .session-item:hover {
    background: var(--color-bg-card-hover, #f8f5ff);
  }

  .session-item.active {
    background: var(--color-bg-card, #ffffff);
    border-left: 3px solid var(--color-primary, #7c3aed);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .session-item.collapsed {
    justify-content: center;
    padding: 6px;
    width: 36px;
    min-width: 36px;
    height: 36px;
    margin: 0 auto 4px;
    border-radius: 10px;
    font-weight: 600;
  }

  .session-item.collapsed.active {
    background: var(--color-primary, #7c3aed);
    color: white;
    border-left: none;
  }

  .session-select-btn {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    padding: inherit;
    margin: 0;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .session-item.collapsed .session-select-btn {
    justify-content: center;
    padding: 0;
  }

  .session-item.collapsed .session-name {
    flex: none;
    font-size: 14px;
    font-weight: 600;
    line-height: 1;
    overflow: visible;
    text-overflow: unset;
  }

  .session-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--color-text-muted, #6d28d9);
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition: all 60ms ease-out;
  }

  .session-item:hover .delete-btn,
  .delete-btn:focus-visible {
    opacity: 0.6;
    pointer-events: auto;
  }

  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    opacity: 1;
  }

  .empty-sessions {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    color: var(--color-text-muted, #6d28d9);
    font-size: 14px;
    opacity: 0.6;
  }

  .empty-dot {
    width: 6px;
    height: 6px;
    background: var(--color-border, #e9d5ff);
    border-radius: 50%;
  }

  /* Spacer */
  .sidebar-spacer {
    flex: 0;
  }

  /* Footer */
  .sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 6px;
    border-top: 1px solid var(--color-border-light, #f3e8ff);
    background: transparent;
  }

  .user-section {
    position: relative;
    margin-top: 4px;
  }

  .account-menu {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    margin-bottom: 4px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    padding: 6px 0;
    z-index: 1000;
    min-width: 200px;
  }

  .account-menu-header {
    padding: 10px 14px 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .account-menu-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text, #111827);
  }

  .account-menu-email {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
  }

  .account-menu-divider {
    height: 1px;
    background: var(--color-border, #e5e7eb);
    margin: 6px 0;
  }

  .account-menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 14px;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--color-text, #374151);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 60ms ease-out;
  }

  .account-menu-item:hover {
    background: var(--color-bg-subtle, #f5f5f5);
  }

  .account-menu-item.primary {
    color: var(--color-primary, #7c3aed);
    font-weight: 500;
  }

  .account-menu-item.danger:hover {
    background: rgba(239, 68, 68, 0.08);
    color: var(--color-error);
  }

  .user-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 6px 10px;
    background: transparent;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 60ms ease-out;
    text-align: left;
  }

  .user-btn:hover {
    background: var(--color-bg-card-hover, #f8f5ff);
  }

  .collapsed .user-btn {
    justify-content: center;
    padding: 6px;
  }

  .user-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--color-primary-glow, rgba(124, 58, 237, 0.2));
    color: var(--color-primary, #7c3aed);
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    opacity: 1;
    transition: opacity 150ms ease-out;
  }

  .collapsed .user-info {
    opacity: 0;
    width: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .user-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text, #1f1147);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-plan {
    font-size: 12px;
    color: var(--color-text-muted, #6d28d9);
    opacity: 0.7;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .unified-sidebar,
    .new-chat-btn,
    .collapse-btn,
    .nav-item,
    .session-item,
    .delete-btn,
    .user-btn {
      transition: none;
    }
  }

  /* Dark mode sidebar */
  :global(.dark) .unified-sidebar {
    background: #1e1e2e;
    border-color: #2e2e3e;
    color: #e0e0e5;
  }

  :global(.dark) .sidebar-header {
    border-bottom-color: #2e2e3e;
  }

  :global(.dark) .sidebar-search {
    background: #2a2a3a;
    border-color: #3a3a4a;
  }

  :global(.dark) .search-input {
    color: #e0e0e5;
  }

  :global(.dark) .search-input::placeholder {
    color: #8888a0;
  }

  :global(.dark) .sidebar-search :global(.search-icon) {
    color: #8888a0;
  }

  :global(.dark) .nav-item {
    color: #c0c0d0;
  }

  :global(.dark) .nav-item:hover {
    background: #2a2a3a;
    color: #e0e0e5;
  }

  :global(.dark) .nav-item.active {
    background: var(--color-primary, #7c3aed);
    color: white;
  }

  :global(.dark) .section-title {
    color: #8888a0;
  }

  :global(.dark) .session-group-label {
    color: #8888a0;
  }

  :global(.dark) .session-item {
    color: #c0c0d0;
  }

  :global(.dark) .session-item:hover {
    background: #2a2a3a;
  }

  :global(.dark) .session-item.active {
    background: #2a2a3a;
    border-left-color: var(--color-primary, #7c3aed);
    box-shadow: none;
  }

  :global(.dark) .collapse-btn {
    border-color: #3a3a4a;
    color: #8888a0;
  }

  :global(.dark) .collapse-btn:hover {
    background: #2a2a3a;
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
  }

  :global(.dark) .user-name {
    color: #e0e0e5;
  }

  :global(.dark) .user-plan {
    color: #8888a0;
  }

  :global(.dark) .user-btn:hover {
    background: #2a2a3a;
  }

  :global(.dark) .user-avatar {
    background: rgba(124, 58, 237, 0.3);
    color: #c4b5fd;
  }

  :global(.dark) .account-menu {
    background: #252535;
    border-color: #3a3a4a;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  :global(.dark) .account-menu-item {
    color: #c0c0d0;
  }

  :global(.dark) .account-menu-item:hover {
    background: #2a2a3a;
  }

  :global(.dark) .account-menu-divider {
    background: #3a3a4a;
  }

  :global(.dark) .empty-sessions span {
    color: #8888a0;
  }
</style>
