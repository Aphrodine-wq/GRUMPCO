<script lang="ts">
  /**
   * G-Agent Screen — Agent Command Center
   *
   * A completely unique, purpose-built agent workspace.
   * NOT a chat wrapper — this is a mission-control-style hub for AI agents.
   */
  import { onMount } from 'svelte';
  import { setCurrentView } from '../stores/uiStore';
  import { sessionsStore, currentSession, sortedSessions } from '../stores/sessionsStore';
  import type { Session } from '../types/index';
  import { getApiBase } from '$lib/api';
  import {
    Bot,
    Terminal,
    Cpu,
    Activity,
    Layers,
    Clock,
    ArrowRight,
    Play,
    Pause,
    Trash2,
    Settings,
    Sparkles,
    Wrench,
    Globe,
    FileCode,
    Braces,
    LayoutGrid,
    Plus,
    ChevronRight,
    Wifi,
    WifiOff,
    Zap,
    Eye,
    Code,
    MessagesSquare,
    Workflow,
  } from 'lucide-svelte';
  import { Button, Card, Badge } from '../lib/design-system';

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

  let backendStatus = $state<'checking' | 'online' | 'offline'>('checking');
  let activeView = $state<'hub' | 'session'>('hub');
  let currentTime = $state(new Date());
  let selectedTask = $state<string | null>(null);

  // Agent quick-start task templates
  const QUICK_TASKS = [
    {
      id: 'code',
      icon: Code,
      label: 'Write Code',
      desc: 'Generate, refactor, or debug code',
      color: '#7c3aed',
      prompt: 'Help me write code for ',
    },
    {
      id: 'analyze',
      icon: Eye,
      label: 'Analyze',
      desc: 'Review code, find bugs, audit security',
      color: '#0891b2',
      prompt: 'Analyze this codebase and ',
    },
    {
      id: 'automate',
      icon: Workflow,
      label: 'Automate',
      desc: 'Create scripts, pipelines, workflows',
      color: '#059669',
      prompt: 'Help me automate ',
    },
    {
      id: 'architect',
      icon: Layers,
      label: 'Architect',
      desc: 'Design systems, APIs, databases',
      color: '#d97706',
      prompt: 'Help me design the architecture for ',
    },
    {
      id: 'debug',
      icon: Wrench,
      label: 'Debug',
      desc: 'Trace errors, fix crashes, resolve issues',
      color: '#dc2626',
      prompt: 'Help me debug ',
    },
    {
      id: 'chat',
      icon: MessagesSquare,
      label: 'Open Chat',
      desc: 'Free-form conversation with the agent',
      color: '#6366f1',
      prompt: '',
    },
  ];

  // Agent capabilities shown in the status panel
  const AGENT_CAPABILITIES = [
    { icon: FileCode, label: 'Code Generation', status: 'active' },
    { icon: Braces, label: 'Code Review', status: 'active' },
    { icon: Terminal, label: 'Command Execution', status: 'active' },
    { icon: Globe, label: 'Web Browsing', status: 'active' },
    { icon: Layers, label: 'Multi-file Editing', status: 'active' },
    { icon: Sparkles, label: 'Reasoning & Planning', status: 'active' },
  ];

  // Get agent sessions only
  const agentSessions = $derived(
    $sortedSessions.filter((s) => s.sessionType === 'gAgent' || s.sessionType === 'freeAgent')
  );

  const activeCount = $derived(agentSessions.length);
  const totalMessages = $derived(
    agentSessions.reduce((sum, s) => sum + (s.messages?.length ?? 0), 0)
  );

  onMount(() => {
    // Health check
    (async () => {
      try {
        const base = getApiBase();
        const res = await fetch(`${base}/health/quick`, {
          signal: AbortSignal.timeout(5000),
        });
        backendStatus = res.ok ? 'online' : 'offline';
      } catch {
        backendStatus = 'offline';
      }
    })();

    // Live clock
    const clockInterval = setInterval(() => {
      currentTime = new Date();
    }, 1000);

    return () => clearInterval(clockInterval);
  });

  function handleBack() {
    if (activeView === 'session') {
      activeView = 'hub';
      return;
    }
    onBack?.() ?? setCurrentView('chat');
  }

  function handleStartTask(task: (typeof QUICK_TASKS)[0]) {
    sessionsStore.createSession([], undefined, 'gAgent');
    activeView = 'session';
  }

  function handleNewSession() {
    sessionsStore.createSession([], undefined, 'gAgent');
    activeView = 'session';
  }

  function handleResumeSession(session: Session) {
    sessionsStore.switchSession(session.id);
    activeView = 'session';
  }

  function handleDeleteSession(e: Event, session: Session) {
    e.stopPropagation();
    sessionsStore.deleteSession(session.id);
  }

  function formatTime(dateStr: string | number): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  function getClockStr(): string {
    return currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

{#if activeView === 'session'}
  <!-- Full Agent Session View -->
  {#await import('./RefactoredChatInterface.svelte') then module}
    <div class="agent-session-view">
      <div class="session-topbar">
        <button class="topbar-back" onclick={() => (activeView = 'hub')}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            width="18"
            height="18"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Command Center</span>
        </button>
        <div class="topbar-center">
          <div class="topbar-indicator" class:online={backendStatus === 'online'}></div>
          <Bot size={16} />
          <span>Agent Session Active</span>
        </div>
        <div class="topbar-clock">{getClockStr()}</div>
      </div>
      <div class="session-body">
        <module.default />
      </div>
    </div>
  {/await}
{:else}
  <!-- Agent Command Center -->
  <div class="command-center">
    <!-- Top Status Bar -->
    <div class="cc-status-bar">
      <div class="cc-status-left">
        <div class="cc-logo">
          <div class="cc-logo-icon">
            <Cpu size={22} />
          </div>
          <div class="cc-logo-text">
            <h1>Agent Command Center</h1>
            <span class="cc-subtitle">AI-Powered Development Workspace</span>
          </div>
        </div>
      </div>
      <div class="cc-status-right">
        <div
          class="cc-status-pill"
          class:online={backendStatus === 'online'}
          class:offline={backendStatus === 'offline'}
        >
          {#if backendStatus === 'online'}
            <Wifi size={14} />
            <span>Connected</span>
          {:else if backendStatus === 'offline'}
            <WifiOff size={14} />
            <span>Offline</span>
          {:else}
            <Activity size={14} />
            <span>Connecting…</span>
          {/if}
        </div>
        <div class="cc-clock">{getClockStr()}</div>
        <button
          class="cc-settings-btn"
          onclick={() => setCurrentView('settings')}
          title="Agent Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </div>

    <div class="cc-body">
      <!-- Quick Stats Row -->
      <div class="cc-stats-row">
        <div class="cc-stat">
          <div class="cc-stat-icon sessions">
            <LayoutGrid size={18} />
          </div>
          <div class="cc-stat-info">
            <span class="cc-stat-value">{activeCount}</span>
            <span class="cc-stat-label">Sessions</span>
          </div>
        </div>
        <div class="cc-stat">
          <div class="cc-stat-icon messages">
            <MessagesSquare size={18} />
          </div>
          <div class="cc-stat-info">
            <span class="cc-stat-value">{totalMessages}</span>
            <span class="cc-stat-label">Messages</span>
          </div>
        </div>
        <div class="cc-stat">
          <div class="cc-stat-icon capabilities">
            <Sparkles size={18} />
          </div>
          <div class="cc-stat-info">
            <span class="cc-stat-value">{AGENT_CAPABILITIES.length}</span>
            <span class="cc-stat-label">Active Skills</span>
          </div>
        </div>
        <div class="cc-stat">
          <div class="cc-stat-icon uptime">
            <Zap size={18} />
          </div>
          <div class="cc-stat-info">
            <span class="cc-stat-value">{backendStatus === 'online' ? '100%' : '0%'}</span>
            <span class="cc-stat-label">Uptime</span>
          </div>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="cc-main-grid">
        <!-- Left: Quick Actions -->
        <div class="cc-section cc-quick-actions">
          <div class="cc-section-header">
            <h2>
              <Play size={18} />
              Quick Actions
            </h2>
            <span class="cc-section-hint">Start a new task</span>
          </div>
          <div class="cc-task-grid">
            {#each QUICK_TASKS as task (task.id)}
              <button
                class="cc-task-card"
                class:selected={selectedTask === task.id}
                onclick={() => handleStartTask(task)}
                style="--task-color: {task.color}"
              >
                <div class="cc-task-icon">
                  <task.icon size={22} />
                </div>
                <div class="cc-task-info">
                  <span class="cc-task-label">{task.label}</span>
                  <span class="cc-task-desc">{task.desc}</span>
                </div>
                <ChevronRight size={16} class="cc-task-arrow" />
              </button>
            {/each}
          </div>
        </div>

        <!-- Right: Sessions + Capabilities -->
        <div class="cc-right-panel">
          <!-- Recent Sessions -->
          <div class="cc-section cc-sessions">
            <div class="cc-section-header">
              <h2>
                <Clock size={18} />
                Recent Sessions
              </h2>
              <Button variant="ghost" size="sm" onclick={handleNewSession}>
                <Plus size={14} />
                New
              </Button>
            </div>

            {#if agentSessions.length === 0}
              <div class="cc-empty-sessions">
                <div class="cc-empty-icon">
                  <Terminal size={32} />
                </div>
                <p>No sessions yet</p>
                <span>Start a task above to create your first agent session</span>
              </div>
            {:else}
              <div class="cc-session-list">
                {#each agentSessions.slice(0, 6) as session (session.id)}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="cc-session-row"
                    onclick={() => handleResumeSession(session)}
                    onkeydown={(e) => e.key === 'Enter' && handleResumeSession(session)}
                    role="button"
                    tabindex="0"
                  >
                    <div class="cc-session-indicator"></div>
                    <div class="cc-session-info">
                      <span class="cc-session-name">{session.name || 'Agent Session'}</span>
                      <span class="cc-session-meta">
                        {formatTime(session.updatedAt || session.timestamp)}
                        · {session.messages?.length ?? 0} msgs
                      </span>
                    </div>
                    <div class="cc-session-actions">
                      <button
                        class="cc-session-delete"
                        onclick={(e) => handleDeleteSession(e, session)}
                        title="Delete session"
                      >
                        <Trash2 size={14} />
                      </button>
                      <ArrowRight size={14} class="cc-session-arrow" />
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Agent Capabilities -->
          <div class="cc-section cc-capabilities">
            <div class="cc-section-header">
              <h2>
                <Cpu size={18} />
                Agent Capabilities
              </h2>
            </div>
            <div class="cc-cap-grid">
              {#each AGENT_CAPABILITIES as cap}
                <div class="cc-cap-item">
                  <div class="cc-cap-icon">
                    <cap.icon size={16} />
                  </div>
                  <span class="cc-cap-label">{cap.label}</span>
                  <div class="cc-cap-status"></div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Session View ─────────────────────────────────────── */
  .agent-session-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }

  .session-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    background: var(--color-bg-elevated, #f5f3ff);
    border-bottom: 1px solid var(--color-border, #e9d5ff);
    gap: 1rem;
    flex-shrink: 0;
  }

  .topbar-back {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.08));
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 8px;
    color: var(--color-primary, #7c3aed);
    padding: 0.4rem 0.75rem;
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .topbar-back:hover {
    background: rgba(124, 58, 237, 0.12);
    color: var(--color-primary-dark, #6d28d9);
  }

  .topbar-center {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-text, #1f1147);
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .topbar-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-text-muted);
  }

  .topbar-indicator.online {
    background: var(--color-success);
    box-shadow: 0 0 8px var(--color-success-border);
    animation: pulse-green 2s infinite;
  }

  .topbar-clock {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    font-variant-numeric: tabular-nums;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }

  .session-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ── Command Center ───────────────────────────────────── */
  .command-center {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: var(--color-bg, #faf8ff);
  }

  /* Status Bar */
  .cc-status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--color-border, #e9d5ff);
    background: var(--color-bg-elevated, #f5f3ff);
    flex-shrink: 0;
    contain: layout style;
  }

  .cc-status-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .cc-logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .cc-logo-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    border: 1px solid var(--color-border);
    border-radius: 10px;
    color: var(--color-primary);
  }

  .cc-logo-text h1 {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-text, #1f1147);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .cc-subtitle {
    font-size: 0.75rem;
    color: var(--color-primary, #7c3aed);
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .cc-status-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .cc-status-pill {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.3rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    border: 1px solid var(--color-border, #e9d5ff);
    color: var(--color-text-muted, #6b7280);
    background: var(--color-bg-subtle, #f5f3ff);
  }

  .cc-status-pill.online {
    color: var(--color-success);
    border-color: var(--color-success-border);
    background: var(--color-success-subtle);
  }

  .cc-status-pill.offline {
    color: var(--color-error);
    border-color: var(--color-error-border);
    background: var(--color-error-subtle);
  }

  .cc-clock {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    font-variant-numeric: tabular-nums;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }

  .cc-settings-btn {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1px solid var(--color-border, #e9d5ff);
    background: var(--color-bg-subtle, #f5f3ff);
    color: var(--color-primary, #7c3aed);
    cursor: pointer;
    transition: all 0.2s;
  }

  .cc-settings-btn:hover {
    background: var(--color-primary-subtle);
    border-color: var(--color-primary);
  }

  /* Body */
  .cc-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* Stats Row */
  .cc-stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }

  .cc-stat {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: var(--shadow-sm);
  }

  .cc-stat-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .cc-stat-icon.sessions {
    background: var(--color-primary-subtle);
    color: var(--color-primary);
  }
  .cc-stat-icon.messages {
    background: var(--color-info-subtle);
    color: var(--color-info);
  }
  .cc-stat-icon.capabilities {
    background: var(--color-warning-subtle);
    color: var(--color-warning);
  }
  .cc-stat-icon.uptime {
    background: var(--color-success-subtle);
    color: var(--color-success);
  }

  .cc-stat-info {
    display: flex;
    flex-direction: column;
  }

  .cc-stat-value {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--color-text, #1f1147);
    line-height: 1;
  }

  .cc-stat-label {
    font-size: 0.6875rem;
    color: var(--color-text-muted, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 500;
    margin-top: 0.125rem;
  }

  /* Main Grid */
  .cc-main-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
    flex: 1;
    min-height: 0;
  }

  /* Sections */
  .cc-section {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 14px;
    padding: 1rem 1.25rem;
    box-shadow: var(--shadow-sm);
  }

  .cc-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .cc-section-header h2 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-primary, #7c3aed);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .cc-section-hint {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
  }

  /* Task Cards */
  .cc-task-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .cc-task-card {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.875rem 1rem;
    background: var(--color-bg-subtle, #f5f3ff);
    border: 1px solid var(--color-border-light, #f3e8ff);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
    color: inherit;
  }

  .cc-task-card:hover {
    background: var(--color-primary-subtle);
    border-color: var(--task-color, var(--color-primary));
    transform: translateX(2px);
    box-shadow: var(--shadow-sm);
  }

  .cc-task-card:hover .cc-task-icon {
    background: var(--task-color, var(--color-primary));
    color: var(--color-text-inverse);
    box-shadow: var(--shadow-sm);
  }

  .cc-task-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: var(--color-primary-subtle);
    color: var(--task-color, var(--color-primary));
    flex-shrink: 0;
    transition: background 0.2s, color 0.2s, box-shadow 0.2s;
  }

  .cc-task-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .cc-task-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text, #1f1147);
  }

  .cc-task-desc {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
    margin-top: 0.125rem;
  }

  .cc-task-card :global(.cc-task-arrow) {
    color: var(--color-text-muted, #9ca3af);
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .cc-task-card:hover :global(.cc-task-arrow) {
    color: var(--task-color, var(--color-primary));
    transform: translateX(1px);
  }

  /* Right Panel */
  .cc-right-panel {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* Sessions */
  .cc-session-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .cc-session-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    background: var(--color-bg-subtle, #f5f3ff);
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    width: 100%;
    text-align: left;
    color: inherit;
  }

  .cc-session-row:hover {
    background: var(--color-primary-subtle);
    border-color: var(--color-border);
  }

  .cc-session-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-primary, #7c3aed);
    flex-shrink: 0;
  }

  .cc-session-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .cc-session-name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text, #1f1147);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cc-session-meta {
    font-size: 0.6875rem;
    color: var(--color-text-muted, #6b7280);
    margin-top: 0.125rem;
  }

  .cc-session-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .cc-session-delete {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--color-text-muted, #6b7280);
    cursor: pointer;
    opacity: 0;
    transition: all 0.15s;
  }

  .cc-session-row:hover .cc-session-delete {
    opacity: 1;
  }

  .cc-session-delete:hover {
    background: var(--color-error-subtle);
    color: var(--color-error);
  }

  .cc-session-actions :global(.cc-session-arrow) {
    color: var(--color-text-muted, #9ca3af);
    flex-shrink: 0;
  }

  .cc-empty-sessions {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 1.5rem 1rem;
    gap: 0.25rem;
  }

  .cc-empty-icon {
    color: var(--color-text-muted, #9ca3af);
    margin-bottom: 0.5rem;
  }

  .cc-empty-sessions p {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-muted, #6b7280);
  }

  .cc-empty-sessions span {
    font-size: 0.75rem;
    color: var(--color-text-muted, #9ca3af);
  }

  /* Capabilities */
  .cc-cap-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .cc-cap-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    border-radius: 8px;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border-light);
  }

  .cc-cap-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    flex-shrink: 0;
  }

  .cc-cap-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text);
    flex: 1;
  }

  .cc-cap-status {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-success);
    box-shadow: 0 0 6px var(--color-success-border);
    flex-shrink: 0;
  }

  /* Animations */
  @keyframes pulse-green {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Responsive */
  @media (max-width: 900px) {
    .cc-main-grid {
      grid-template-columns: 1fr;
    }
    .cc-stats-row {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 600px) {
    .cc-stats-row {
      grid-template-columns: 1fr 1fr;
    }
    .cc-status-bar {
      flex-direction: column;
      gap: 0.5rem;
    }
    .cc-cap-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
