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
  import {
    Plus,
    MessageSquare,
    Settings,
    User,
    ChevronLeft,
    ChevronRight,
    Search,
    Layout,
    Plug,
  } from 'lucide-svelte';
  import { sessionsStore, sortedSessions, currentSession } from '../../stores/sessionsStore';
  import { setCurrentView, sidebarCollapsed, currentView } from '../../stores/uiStore';
  import type { ViewType } from '../../stores/uiStore';
  import { isAuthenticated, user as currentUser } from '../../stores/authStore';
  import type { Session } from '../../types';

  // Sidebar state
  let collapsed = $derived($sidebarCollapsed);
  let hoverExpanded = $state(false);
  let searchQuery = $state('');
  let hoveredSessionId: string | null = $state(null);

  // Effective collapsed state (collapsed but can expand on hover)
  const effectiveCollapsed = $derived(collapsed && !hoverExpanded);

  // Nav first: Chat, Architecture, Integrations, Settings (G-Agent moved into chat)
  interface NavItem {
    id: ViewType;
    label: string;
    icon: 'chat' | 'architecture' | 'integrations' | 'settings';
    badge?: string;
  }

  const primaryNav: NavItem[] = [
    { id: 'chat', label: 'Chat', icon: 'chat' },
    { id: 'designToCode', label: 'Architecture', icon: 'architecture' },
    { id: 'integrations', label: 'Integrations', icon: 'integrations' },
  ];

  const secondaryNav: NavItem[] = [{ id: 'settings', label: 'Settings', icon: 'settings' }];

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
  onmouseenter={() => {
    if (collapsed) hoverExpanded = true;
  }}
  onmouseleave={() => {
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
          <MessageSquare size={20} />
        {:else if item.icon === 'architecture'}
          <Layout size={20} />
        {:else if item.icon === 'integrations'}
          <Plug size={20} />
        {:else}
          <Settings size={20} />
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
            onmouseenter={() => (hoveredSessionId = session.id)}
            onmouseleave={() => (hoveredSessionId = null)}
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
            {#if hoveredSessionId === session.id && !effectiveCollapsed}
              <button
                type="button"
                class="delete-btn"
                onclick={(e) => handleDeleteSession(e, session.id)}
                title="Delete"
                aria-label="Delete session"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
                  />
                </svg>
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
            onmouseenter={() => (hoveredSessionId = session.id)}
            onmouseleave={() => (hoveredSessionId = null)}
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
            {#if hoveredSessionId === session.id && !effectiveCollapsed}
              <button
                type="button"
                class="delete-btn"
                onclick={(e) => handleDeleteSession(e, session.id)}
                title="Delete"
                aria-label="Delete session"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
                  />
                </svg>
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
            onmouseenter={() => (hoveredSessionId = session.id)}
            onmouseleave={() => (hoveredSessionId = null)}
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
            {#if hoveredSessionId === session.id && !effectiveCollapsed}
              <button
                type="button"
                class="delete-btn"
                onclick={(e) => handleDeleteSession(e, session.id)}
                title="Delete"
                aria-label="Delete session"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
                  />
                </svg>
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
            onmouseenter={() => (hoveredSessionId = session.id)}
            onmouseleave={() => (hoveredSessionId = null)}
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
            {#if hoveredSessionId === session.id && !effectiveCollapsed}
              <button
                type="button"
                class="delete-btn"
                onclick={(e) => handleDeleteSession(e, session.id)}
                title="Delete"
                aria-label="Delete session"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
                  />
                </svg>
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

  <!-- Footer: Secondary Nav + User -->
  <div class="sidebar-footer">
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
    <div class="user-section">
      <button class="user-btn" title={$currentUser?.email || 'Account'}>
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
    </div>
  </div>
</aside>

<style>
  .unified-sidebar {
    display: flex;
    flex-direction: column;
    width: 260px;
    height: calc(100vh - 40px); /* Account for title bar */
    margin: 8px;
    background: var(--glass-bg, rgba(255, 255, 255, 0.95));
    backdrop-filter: blur(20px);
    border: 1px solid var(--color-border-light, #f3e8ff);
    border-radius: 16px;
    transition: width 200ms ease;
    overflow: hidden;
    flex-shrink: 0;
  }

  .unified-sidebar.collapsed {
    width: 64px;
  }

  /* Header */
  .sidebar-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid var(--color-border-light, #f3e8ff);
  }

  .new-chat-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 40px;
    padding: 0 12px;
    background: var(--color-primary, #7c3aed);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background 150ms ease,
      transform 100ms ease;
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
    transition: all 150ms ease;
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
    margin: 8px 12px;
    padding: 8px 12px;
    background: var(--color-bg-input, #f3e8ff);
    border-radius: 10px;
    border: 1px solid transparent;
    transition: border-color 150ms ease;
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

  /* Primary Navigation */
  .primary-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: 44px;
    padding: 0 12px;
    background: transparent;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text, #1f1147);
    cursor: pointer;
    transition: all 150ms ease;
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
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px 4px;
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
    padding: 0 8px 8px;
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
    padding: 12px 8px 4px;
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
    min-height: 40px;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    color: var(--color-text, #1f1147);
    cursor: pointer;
    transition: all 150ms ease;
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
    padding: 8px;
    width: 40px;
    height: 40px;
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

  .session-name {
    flex: 1;
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
    opacity: 0.6;
    transition: all 150ms ease;
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
    padding: 24px;
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
    padding: 12px 8px;
    border-top: 1px solid var(--color-border-light, #f3e8ff);
    background: rgba(255, 255, 255, 0.5);
  }

  .user-section {
    margin-top: 4px;
  }

  .user-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .user-btn:hover {
    background: var(--color-bg-card-hover, #f8f5ff);
  }

  .collapsed .user-btn {
    justify-content: center;
    padding: 8px;
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
</style>
