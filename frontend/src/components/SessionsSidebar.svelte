<script lang="ts">
  import { CollapsibleSidebar, Button } from '../lib/design-system';
  import { sessionsStore, sortedSessions, currentSession } from '../stores/sessionsStore';
  import { showSettings, showAskDocs, showVoiceCode, showSwarm, showDesignToCode, showIntegrations, showApprovals, showHeartbeats, showMemory, showAuditLog, showAdvancedAI, showDocker, showCloudDashboard, sidebarCollapsed } from '../stores/uiStore';
  import OpenRepoModal from './OpenRepoModal.svelte';
  import CostSnippet from './CostSnippet.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import type { Session } from '../types';

  let hoveredSessionId: string | null = $state(null);
  let collapsed = $state($sidebarCollapsed);
  $effect(() => {
    collapsed = $sidebarCollapsed;
  });
  $effect(() => {
    sidebarCollapsed.set(collapsed);
  });
  let mobileMenuOpen = $state(false);
  let showRepoModal = $state(false);

  function handleNewSession() {
    sessionsStore.createSession([]);
    if (window.innerWidth < 768) {
      mobileMenuOpen = false;
    }
  }

  function handleSelectSession(id: string) {
    sessionsStore.switchSession(id);
    showSettings.set(false);
    showAskDocs.set(false);
    showVoiceCode.set(false);
    showSwarm.set(false);
    showIntegrations.set(false);
    showApprovals.set(false);
    showHeartbeats.set(false);
    showMemory.set(false);
    showAdvancedAI.set(false);
    showDocker.set(false);
    showCloudDashboard.set(false);
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

function openSettings() {
    showSettings.set(true);
    showAskDocs.set(false);
    showVoiceCode.set(false);
    showSwarm.set(false);
    showDesignToCode.set(false);
    showIntegrations.set(false);
    showApprovals.set(false);
    showHeartbeats.set(false);
    showMemory.set(false);
    showAdvancedAI.set(false);
    showDocker.set(false);
    showCloudDashboard.set(false);
  }

  function openAskDocs() {
    showAskDocs.set(true);
    showSettings.set(false);
    showVoiceCode.set(false);
    showSwarm.set(false);
    showDesignToCode.set(false);
    showIntegrations.set(false);
    showApprovals.set(false);
    showHeartbeats.set(false);
    showMemory.set(false);
    showAdvancedAI.set(false);
    showDocker.set(false);
    showCloudDashboard.set(false);
  }

  function openVoiceCode() {
    showVoiceCode.set(true);
    showSettings.set(false);
    showAskDocs.set(false);
    showSwarm.set(false);
    showDesignToCode.set(false);
    showIntegrations.set(false);
    showApprovals.set(false);
    showHeartbeats.set(false);
    showMemory.set(false);
    showAdvancedAI.set(false);
    showDocker.set(false);
    showCloudDashboard.set(false);
  }

  function openDesignToCode() {
    showDesignToCode.set(true);
    showSettings.set(false);
    showAskDocs.set(false);
    showVoiceCode.set(false);
    showSwarm.set(false);
    showIntegrations.set(false);
    showApprovals.set(false);
    showHeartbeats.set(false);
    showMemory.set(false);
    showAdvancedAI.set(false);
    showDocker.set(false);
    showCloudDashboard.set(false);
  }

  function openSwarm() {
    showSwarm.set(true);
    showSettings.set(false);
    showAskDocs.set(false);
    showVoiceCode.set(false);
    showIntegrations.set(false);
    showApprovals.set(false);
    showHeartbeats.set(false);
    showMemory.set(false);
    showAdvancedAI.set(false);
    showDocker.set(false);
    showCloudDashboard.set(false);
  }

  function openIntegrations() {
    showIntegrations.set(true);
    showSettings.set(false);
    showAskDocs.set(false);
    showVoiceCode.set(false);
    showSwarm.set(false);
    showDesignToCode.set(false);
    showApprovals.set(false);
    showHeartbeats.set(false);
    showMemory.set(false);
    showAdvancedAI.set(false);
    showDocker.set(false);
    showCloudDashboard.set(false);
  }

  function openApprovals() {
    showApprovals.set(true);
    showSettings.set(false);
    showAskDocs.set(false);
    showVoiceCode.set(false);
    showSwarm.set(false);
    showDesignToCode.set(false);
    showIntegrations.set(false);
    showHeartbeats.set(false);
    showMemory.set(false);
    showAdvancedAI.set(false);
    showDocker.set(false);
    showCloudDashboard.set(false);
  }

  function openHeartbeats() {
    showHeartbeats.set(true);
    showSettings.set(false);
    showAskDocs.set(false);
    showVoiceCode.set(false);
    showSwarm.set(false);
    showDesignToCode.set(false);
    showIntegrations.set(false);
    showApprovals.set(false);
    showMemory.set(false);
    showAdvancedAI.set(false);
    showDocker.set(false);
    showCloudDashboard.set(false);
  }

  function openMemory() {
    showMemory.set(true);
    showSettings.set(false);
    showAskDocs.set(false);
    showVoiceCode.set(false);
    showSwarm.set(false);
    showDesignToCode.set(false);
    showIntegrations.set(false);
    showApprovals.set(false);
    showHeartbeats.set(false);
    showAuditLog.set(false);
    showAdvancedAI.set(false);
    showDocker.set(false);
    showCloudDashboard.set(false);
  }

function openAuditLog() {
    showAuditLog.set(true);
    showSettings.set(false);
    showAskDocs.set(false);
    showVoiceCode.set(false);
    showSwarm.set(false);
    showDesignToCode.set(false);
    showIntegrations.set(false);
    showApprovals.set(false);
    showHeartbeats.set(false);
    showMemory.set(false);
    showAdvancedAI.set(false);
    showDocker.set(false);
    showCloudDashboard.set(false);
  }

  function openAdvancedAI() {
    showAdvancedAI.set(true);
    showSettings.set(false);
    showAskDocs.set(false);
    showVoiceCode.set(false);
    showSwarm.set(false);
    showDesignToCode.set(false);
    showIntegrations.set(false);
    showApprovals.set(false);
    showHeartbeats.set(false);
    showMemory.set(false);
    showAuditLog.set(false);
    showDocker.set(false);
    showCloudDashboard.set(false);
  }

  function openDocker() {
    showDocker.set(true);
    showSettings.set(false);
    showAskDocs.set(false);
    showVoiceCode.set(false);
    showSwarm.set(false);
    showDesignToCode.set(false);
    showIntegrations.set(false);
    showApprovals.set(false);
    showHeartbeats.set(false);
    showMemory.set(false);
    showAuditLog.set(false);
    showAdvancedAI.set(false);
    showCloudDashboard.set(false);
  }

  function openCloudDashboard() {
    showCloudDashboard.set(true);
    showSettings.set(false);
    showAskDocs.set(false);
    showVoiceCode.set(false);
    showSwarm.set(false);
    showDesignToCode.set(false);
    showIntegrations.set(false);
    showApprovals.set(false);
    showHeartbeats.set(false);
    showMemory.set(false);
    showAuditLog.set(false);
    showAdvancedAI.set(false);
    showDocker.set(false);
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
    if (collapsed) {
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
  <div class="mobile-backdrop" onclick={() => (mobileMenuOpen = false)}></div>
{/if}

<div class="sidebar-wrapper" class:mobile-open={mobileMenuOpen}>
  <CollapsibleSidebar bind:collapsed width={240} collapsedWidth={64}>
    {#snippet header()}
      <Button variant="primary" size="md" fullWidth onclick={handleNewSession} class="new-chat-btn">
        <div class="btn-inner" class:collapsed>
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
          {#if !collapsed}
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
        <div class="btn-inner" class:collapsed>
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
          {#if !collapsed}
            <span>Open GitHub Repo</span>
          {/if}
        </div>
      </Button>
    {/snippet}

    <div class="sessions-list" class:collapsed>
      {#each $sortedSessions as session (session.id)}
        <div
          class="session-item"
          class:active={session.id === $currentSession?.id}
          class:collapsed
          onmouseenter={() => (hoveredSessionId = session.id)}
          onmouseleave={() => (hoveredSessionId = null)}
          onclick={() => handleSelectSession(session.id)}
          onkeydown={(e) => e.key === 'Enter' && handleSelectSession(session.id)}
          role="button"
          tabindex="0"
          title={session.name}
        >
          <div class="session-content" class:collapsed>
            <div class="session-name" class:collapsed>
              {truncateText(session.name)}
            </div>
            {#if !collapsed}
              <div class="session-meta">
                {formatDate(session.updatedAt)} · {session.messages.length} msg
              </div>
            {/if}
          </div>

          {#if hoveredSessionId === session.id && !collapsed}
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
        <div class="empty-state" class:collapsed>
          {#if !collapsed}
            <div class="empty-state-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p class="empty-state-heading">Your chats will appear here</p>
            <p class="hint">Click <strong>New Chat</strong> above to get started</p>
          {:else}
            <div class="empty-dot"></div>
          {/if}
        </div>
      {/if}
    </div>
    {#snippet footer()}
      <div class="sidebar-footer-content" class:collapsed>
        <div class="cost-snippet-wrap">
          <CostSnippet compact={collapsed} refreshMs={60000} />
        </div>
        <button class="settings-btn" title="Voice code" aria-label="Voice code" onclick={openVoiceCode}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          {#if !collapsed}
            <span>Voice code</span>
          {/if}
        </button>
        <button class="settings-btn" title="Agent swarm" aria-label="Agent swarm" onclick={openSwarm}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {#if !collapsed}
            <span>Agent swarm</span>
          {/if}
        </button>
        <button class="settings-btn" title="Design to code" aria-label="Design to code" onclick={openDesignToCode}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          {#if !collapsed}
            <span>Design to code</span>
          {/if}
        </button>
        <button class="settings-btn" title="Integrations" aria-label="Integrations" onclick={openIntegrations}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 2v4" />
            <path d="M12 18v4" />
            <path d="m4.93 4.93 2.83 2.83" />
            <path d="m16.24 16.24 2.83 2.83" />
            <path d="M2 12h4" />
            <path d="M18 12h4" />
            <path d="m4.93 19.07 2.83-2.83" />
            <path d="m16.24 7.76 2.83-2.83" />
          </svg>
          {#if !collapsed}
            <span>Integrations</span>
          {/if}
        </button>
        <button class="settings-btn" title="Approvals" aria-label="Approvals" onclick={openApprovals}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          {#if !collapsed}
            <span>Approvals</span>
          {/if}
        </button>
        <button class="settings-btn" title="Scheduled tasks" aria-label="Scheduled tasks" onclick={openHeartbeats}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {#if !collapsed}
            <span>Scheduled tasks</span>
          {/if}
        </button>
        <button class="settings-btn" title="Memory bank" aria-label="Memory bank" onclick={openMemory}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          {#if !collapsed}
            <span>Memory bank</span>
          {/if}
        </button>
        <button class="settings-btn" title="Advanced AI" aria-label="Advanced AI" onclick={openAdvancedAI}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          {#if !collapsed}
            <span>Advanced AI</span>
          {/if}
        </button>
        <button class="settings-btn" title="Audit log" aria-label="Audit log" onclick={openAuditLog}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
          </svg>
          {#if !collapsed}
            <span>Audit log</span>
          {/if}
        </button>
        <button class="settings-btn" title="Docker" aria-label="Docker" onclick={openDocker}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M22 12.5c-.5-1-1.5-1.5-3-1.5h-1v-2h-2v2h-2v-2h-2v2h-2v-2H8v2H6c-1.5 0-2.5.5-3 1.5C2.5 13 2 14 2 15.5 2 18 4.5 20 8 20h8c3.5 0 6-2 6-4.5 0-1.5-.5-2.5-1-3z" />
            <rect x="10" y="6" width="2" height="2" />
            <rect x="10" y="2" width="2" height="2" />
            <rect x="14" y="6" width="2" height="2" />
          </svg>
          {#if !collapsed}
            <span>Docker</span>
          {/if}
        </button>
        <button class="settings-btn" title="Cloud Dashboard" aria-label="Cloud Dashboard" onclick={openCloudDashboard}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            <path d="M22 10a3 3 0 0 0-3-3h-2.207a5.502 5.502 0 0 0-10.702.5" />
          </svg>
          {#if !collapsed}
            <span>Cloud</span>
          {/if}
        </button>
        <button class="settings-btn" title="Ask docs" aria-label="Ask docs" onclick={openAskDocs}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <path d="M8 7h8" />
            <path d="M8 11h8" />
          </svg>
          {#if !collapsed}
            <span>Ask docs</span>
          {/if}
        </button>
        <button class="settings-btn" title="Settings" aria-label="Settings" onclick={openSettings}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-settings"
            ><path
              d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
            /><circle cx="12" cy="12" r="3" /></svg
          >
          {#if !collapsed}
            <span>Settings</span>
          {/if}
        </button>
        <div class="theme-toggle-wrapper" class:collapsed>
          <ThemeToggle size="sm" showLabel={!collapsed} />
        </div>
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
    gap: 4px;
    padding: 8px;
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

  .empty-state-icon {
    margin-bottom: 8px;
    color: var(--color-border);
  }

  .empty-state-heading {
    margin: 0 0 4px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-muted);
  }

  .empty-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: var(--color-border);
    margin: 0 auto;
  }

  .empty-state p {
    margin: 0;
    font-size: 13px;
  }

  .empty-state .hint {
    font-size: 12px;
    margin-top: 4px;
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

  .cost-snippet-wrap {
    margin-bottom: 4px;
    display: flex;
    justify-content: flex-start;
    align-items: center;
  }

  .sidebar-footer-content.collapsed .cost-snippet-wrap {
    justify-content: center;
  }

  .settings-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
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
    width: 40px;
    height: 40px;
  }

  /* Custom scrollbar */
  .sessions-list::-webkit-scrollbar {
    width: 4px;
  }

  .sessions-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .sessions-list::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 10px;
  }

  .sessions-list::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.1);
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

  .theme-toggle-wrapper {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    border-top: 1px solid var(--color-border-light);
    margin-top: 4px;
  }

  .theme-toggle-wrapper.collapsed {
    padding: 10px;
    justify-content: center;
  }
</style>
