<script lang="ts">
  import { onMount } from 'svelte';

  // ── Components ────────────────────────────────────────────────────────────
  import ChatInterface from './components/RefactoredChatInterface.svelte';
  import { UnifiedSidebar } from './components/sidebar';
  import Toast from './components/Toast.svelte';
  import QuestionModal from './components/QuestionModal.svelte';
  import PricingModal from './components/PricingModal.svelte';
  import BootScreen from './components/BootScreen.svelte';
  import SettingsScreen from './components/TabbedSettingsScreen.svelte';
  import ElectronTitleBar from './components/ElectronTitleBar.svelte';
  import { OnboardingFlow, isOnboardingComplete } from './components/onboarding-v2';
  import LazyView from './components/LazyView.svelte';
  import ConnectionStatusBanner from './components/ConnectionStatusBanner.svelte';
  import CommandPalette from './components/CommandPalette.svelte';
  import FileExplorerPanel from './components/FileExplorerPanel.svelte';

  // ── Registry & lazy-loaded views ──────────────────────────────────────────
  import { VIEW_REGISTRY } from './lib/viewRegistry';
  const TutorialOverlay = () => import('./components/TutorialOverlay.svelte');

  // ── Extracted concern modules ─────────────────────────────────────────────
  import { initTheme } from './lib/themeManager';
  import { registerKeyboardShortcuts } from './lib/keyboardShortcuts';
  import { initElectronBridge } from './lib/electronBridge';

  // ── Stores ─────────────────────────────────────────────────────────────────
  import { get } from 'svelte/store';
  import { sessionsStore, currentSession } from './stores/sessionsStore';
  import { settingsStore } from './stores/settingsStore';
  import { preferencesStore, density } from './stores/preferencesStore';
  import { checkAuth } from './stores/authStore';
  import {
    currentView,
    setCurrentView,
    sidebarCollapsed,
    showPricing,
    commandPaletteOpen,
    settingsInitialTab,
  } from './stores/uiStore';
  import { workspaceStore } from './stores/workspaceStore';
  import { demoStore } from './stores/demoStore';
  import { isMobileDevice } from './utils/touchGestures';
  import { showToast } from './stores/toastStore';
  import type { Message } from './types';

  const SHORTCUTS_TIP_SHOWN_KEY = 'g-rump-shortcuts-tip-shown';
  const FILE_EXPLORER_OPEN_KEY = 'g-rump-file-explorer-open';
  const BOOT_SHOWN_KEY = 'g-rump-boot-shown-session';

  // Show boot screen once per browser session
  let bootComplete = $state(
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem(BOOT_SHOWN_KEY) === 'true'
  );

  function handleBootComplete() {
    bootComplete = true;
    try {
      sessionStorage.setItem(BOOT_SHOWN_KEY, 'true');
    } catch {}
  }

  const showFileExplorerCondition = $derived(
    $currentView === 'chat' && ($workspaceStore?.root != null || $currentSession?.projectId != null)
  );

  let fileExplorerOpen = $state(true);

  function setFileExplorerOpen(open: boolean) {
    fileExplorerOpen = open;
    try {
      localStorage.setItem(FILE_EXPLORER_OPEN_KEY, String(open));
    } catch (_) {}
  }

  /** Views that use full width of main content (no outer padding; view controls its own padding). */
  const FULL_WIDTH_VIEWS = [
    'designToCode',
    'integrations',
    'credits',
    'memory',
    'heartbeats',
    'auditLog',
  ] as const;
  const isFullWidthView = $derived(
    FULL_WIDTH_VIEWS.includes($currentView as (typeof FULL_WIDTH_VIEWS)[number])
  );

  let isMobile = $state(false);
  let densityValue = $derived($density);

  // One-time tip after user reaches main chat (onboarding complete)
  $effect(() => {
    const view = get(currentView);
    const onboardingDone = get(isOnboardingComplete);
    if (view !== 'chat' || !onboardingDone) return;
    try {
      if (typeof window === 'undefined') return;
      if (localStorage.getItem(SHORTCUTS_TIP_SHOWN_KEY) === 'true') return;
      localStorage.setItem(SHORTCUTS_TIP_SHOWN_KEY, 'true');
      showToast('Tip: Press / to focus chat or Ctrl+K for commands.', 'info', 6000);
    } catch (_) {}
  });

  onMount(() => {
    // Restore persisted file-explorer state
    try {
      const v = localStorage.getItem(FILE_EXPLORER_OPEN_KEY);
      if (v === 'false') fileExplorerOpen = false;
      else if (v === 'true') fileExplorerOpen = true;
    } catch (_) {}
    localStorage.removeItem('mermaid-app-state');
    settingsStore.load().catch(() => {});

    // ── Initialise extracted concerns ─────────────────────────────────────
    const cleanupTheme = initTheme();
    const cleanupKeys = registerKeyboardShortcuts();
    const cleanupElectron = initElectronBridge();

    checkAuth().catch(() => {});

    // Restore view from URL hash (e.g. after billing portal return)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash?.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      if (hash === '#credits' || params.get('view') === 'credits') {
        setCurrentView('credits');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }

    if (!$currentSession) {
      sessionsStore.createSession([]);
    }

    // Detect mobile device and auto-collapse sidebar
    isMobile = isMobileDevice();
    if (isMobile) {
      sidebarCollapsed.set(true);
    }

    return () => {
      cleanupTheme();
      cleanupKeys();
      cleanupElectron();
    };
  });

  function getInitialMessages(): Message[] | undefined {
    return $currentSession?.messages || undefined;
  }

  function handleMessagesUpdate(messages: Message[]): void {
    if ($currentSession) {
      sessionsStore.updateSession($currentSession.id, messages);
    } else {
      sessionsStore.createSession(messages);
    }
  }
</script>

{#if !bootComplete}
  <BootScreen onComplete={handleBootComplete} />
{/if}

<div class="app" data-density={densityValue}>
  <ElectronTitleBar />
  <div class="app-body">
    {#if $isOnboardingComplete}
      <UnifiedSidebar />
    {/if}

    <div class="main-content" class:full-width={isFullWidthView}>
      {#key $currentView}
        <div class="main-content-view">
          {#if $currentView === 'settings'}
            <SettingsScreen
              onBack={() => setCurrentView('chat')}
              initialTab={$settingsInitialTab}
            />
          {:else if VIEW_REGISTRY[$currentView]}
            <LazyView definition={VIEW_REGISTRY[$currentView]} />
          {:else if !$isOnboardingComplete}
            <!-- New unified onboarding flow (auth, API setup, tech stack, preferences - all in one) -->
            <OnboardingFlow
              onComplete={() => {
                // New onboarding handles everything - mark setup complete for backwards compat
                preferencesStore.completeSetup();
                // Mark old onboarding localStorage key for any legacy checks
                try {
                  localStorage.setItem('g-rump-onboarding-seen', 'true');
                } catch {}
              }}
              onSkip={() => {
                preferencesStore.completeSetup();
                try {
                  localStorage.setItem('g-rump-onboarding-seen', 'true');
                } catch {}
              }}
            />
          {:else}
            <div class="chat-with-explorer">
              <div class="chat-main">
                {#key $currentSession?.id ?? 'none'}
                  <ChatInterface
                    initialMessages={getInitialMessages()}
                    onmessagesUpdated={handleMessagesUpdate}
                  />
                {/key}
              </div>
              {#if showFileExplorerCondition}
                {#if fileExplorerOpen}
                  <FileExplorerPanel
                    workspaceRoot={$workspaceStore?.root ?? null}
                    onClose={() => setFileExplorerOpen(false)}
                  />
                {:else}
                  <button
                    type="button"
                    class="file-explorer-tab"
                    onclick={() => setFileExplorerOpen(true)}
                    title="Show file explorer"
                    aria-label="Show file explorer"
                  >
                    Files
                  </button>
                {/if}
              {/if}
            </div>
          {/if}
        </div>
      {/key}
    </div>
  </div>

  <div class="connection-banner-wrapper">
    <ConnectionStatusBanner />
  </div>
  <Toast />
  <QuestionModal />
  <CommandPalette open={$commandPaletteOpen} onClose={() => commandPaletteOpen.set(false)} />
  {#if $showPricing}
    <PricingModal onClose={() => showPricing.set(false)} />
  {/if}

  {#if $demoStore.active && $demoStore.steps.length > 0}
    {#await TutorialOverlay() then { default: Component }}
      <Component
        steps={$demoStore.steps}
        onComplete={() => demoStore.reset()}
        onSkip={() => demoStore.reset()}
      />
    {/await}
  {/if}
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    height: 100dvh;
    width: 100%;
    font-size: var(--app-font-size, 14px);
    /* Removed max-width constraint - now full width on maximize */
    margin: 0 auto;
    background: var(--color-bg-app, #fafafa);
    overflow: hidden;
    position: relative;
  }

  .app-body {
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }

  /* Spacious layout: content padding; apply UI font size from Settings */
  .app {
    --space-content: 24px;
    font-size: var(--app-font-size, 14px);
  }

  /* Compact density: noticeably less padding and spacing */
  .app[data-density='compact'] {
    --space-content: 12px;
  }
  .app[data-density='compact'] .main-content {
    padding: var(--space-content);
  }
  .app[data-density='compact'] :global(.settings-btn),
  .app[data-density='compact'] :global(.session-item) {
    padding-top: 4px;
    padding-bottom: 4px;
  }
  .app[data-density='compact'] :global(.nav-item) {
    padding-top: 0.35rem;
    padding-bottom: 0.35rem;
    height: 36px;
  }

  /* Ensure background fills the "void" outside the app on large screens; apply UI font size */
  :global(body) {
    background-color: var(--color-bg-subtle, #f0f2f5);
    font-size: var(--app-font-size, 14px);
  }

  /* Respect user preference for reduced motion */
  @media (prefers-reduced-motion: reduce) {
    :global(*),
    :global(*::before),
    :global(*::after) {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: var(--space-content, 20px);
    padding-bottom: 0;
  }

  .connection-banner-wrapper {
    flex-shrink: 0;
    margin-top: 0;
    line-height: 0;
  }

  .main-content.full-width {
    padding: 0;
  }

  .main-content-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .chat-with-explorer {
    flex: 1;
    display: flex;
    flex-direction: row;
    min-width: 0;
    overflow: hidden;
  }

  .chat-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: flex 0.25s ease;
  }

  .file-explorer-tab {
    flex-shrink: 0;
    width: 32px;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    padding: 0.5rem 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-muted, #71717a);
    background: var(--color-bg-subtle, #f4f4f5);
    border: 1px solid var(--color-border, #e5e7eb);
    border-left: none;
    border-radius: 0 8px 8px 0;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .file-explorer-tab:hover {
    background: var(--color-bg-card-hover, #e4e4e7);
    color: var(--color-text, #18181b);
  }

  /* Responsive adjustments (tablet: sidebar collapses to 64px via layout) */

  /* Touch-friendly adjustments */
  @media (hover: none) and (pointer: coarse) {
    /* Increase touch target sizes */
    :global(button) {
      min-height: 44px;
      min-width: 44px;
    }

    :global(input),
    :global(textarea) {
      font-size: 16px; /* Prevent zoom on iOS */
    }
  }
</style>
