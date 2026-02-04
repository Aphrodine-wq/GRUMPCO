<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import ChatInterface from './components/RefactoredChatInterface.svelte';
  import { UnifiedSidebar } from './components/sidebar';
  import Toast from './components/Toast.svelte';
  import QuestionModal from './components/QuestionModal.svelte';
  import PricingModal from './components/PricingModal.svelte';
  import SettingsScreen from './components/TabbedSettingsScreen.svelte';
  import ElectronTitleBar from './components/ElectronTitleBar.svelte';
  import { OnboardingFlow, isOnboardingComplete } from './components/onboarding-v2';

  // Lazy-loaded views are defined in the view registry (data-driven)
  import LazyView from './components/LazyView.svelte';
  import { VIEW_REGISTRY } from './lib/viewRegistry';
  const TutorialOverlay = () => import('./components/TutorialOverlay.svelte');

  import { get } from 'svelte/store';
  import { sessionsStore, currentSession } from './stores/sessionsStore';
  import { settingsStore } from './stores/settingsStore';
  import { preferencesStore, density } from './stores/preferencesStore';
  import { onboardingStore } from './stores/onboardingStore';
  import { setUserAndSession, checkAuth } from './stores/authStore';
  import {
    currentView,
    setCurrentView,
    sidebarCollapsed,
    focusChatTrigger,
    showPricing,
  } from './stores/uiStore';
  import { workspaceStore } from './stores/workspaceStore';
  import { demoStore } from './stores/demoStore';
  import { newOnboardingStore } from './stores/newOnboardingStore';
  import { isMobileDevice } from './utils/touchGestures';
  import { showToast } from './stores/toastStore';
  import type { Message } from './types';
  import ConnectionStatusBanner from './components/ConnectionStatusBanner.svelte';
  import CommandPalette from './components/CommandPalette.svelte';

  const SHORTCUTS_TIP_SHOWN_KEY = 'g-rump-shortcuts-tip-shown';

  /** Views that use full width of main content (no outer padding; view controls its own padding). */
  const FULL_WIDTH_VIEWS = ['designToCode', 'integrations'] as const;
  const isFullWidthView = $derived(FULL_WIDTH_VIEWS.includes($currentView as (typeof FULL_WIDTH_VIEWS)[number]));

  let isMobile = $state(false);
  let densityValue = $state<'comfortable' | 'compact'>('comfortable');
  let commandPaletteOpen = $state(false);

  $effect(() => {
    densityValue = get(density);
  });

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
    localStorage.removeItem('mermaid-app-state');
    settingsStore.load().catch(() => {});

    // Apply theme (light / dark / system) to document so dark mode works
    function applyTheme() {
      const data = get(newOnboardingStore);
      const theme = data?.theme ?? 'system';
      const resolved =
        theme === 'system'
          ? (typeof window !== 'undefined' &&
            window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light')
          : theme;
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.setAttribute('data-theme', resolved);
      }
    }
    applyTheme();
    const unsubTheme = newOnboardingStore.subscribe(() => applyTheme());
    let mediaQuery: MediaQueryList | null = null;
    if (typeof window !== 'undefined') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', applyTheme);
    }

    checkAuth().catch(() => {});

    if (!$currentSession) {
      sessionsStore.createSession([]);
    }

    // Detect mobile device
    isMobile = isMobileDevice();

    // Auto-collapse sidebar on mobile
    if (isMobile) {
      sidebarCollapsed.set(true);
    }

    function onKeydown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'k') {
        e.preventDefault();
        commandPaletteOpen = !commandPaletteOpen;
        return;
      }
      if (mod && e.key === 'b') {
        e.preventDefault();
        sidebarCollapsed.update((v) => !v);
      }
      if (
        (mod && e.shiftKey && e.key === 'L') ||
        (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey)
      ) {
        const target = e.target as HTMLElement;
        if (target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          focusChatTrigger.update((n) => n + 1);
        }
      }
    }
    window.addEventListener('keydown', onKeydown);

    // Signal readiness to Electron (close splash, show main window) – main.ts also calls closeSplashShowMain after mount for reliability
    const grump = (
      window as {
        grump?: {
          isElectron?: boolean;
          closeSplashShowMain?: () => Promise<void>;
          onAppCommand?: (event: string, callback: () => void) => () => void;
          onProtocolUrl?: (callback: (url: string) => void) => () => void;
          openPath?: (path: string) => Promise<{ error?: string }>;
        };
      }
    ).grump;
    if (grump?.isElectron && grump.closeSplashShowMain) {
      setTimeout(() => {
        grump.closeSplashShowMain!().catch((err: unknown) =>
          console.error('[App] Failed to close splash:', err)
        );
      }, 100);
    }

    // Wake word: when detected, switch to Talk Mode (Electron only)
    const unsubs: (() => void)[] = [];
    const grumpAny = grump as { wakeWord?: { onDetected?: (cb: () => void) => () => void } };
    if (grumpAny?.wakeWord?.onDetected) {
      unsubs.push(grumpAny.wakeWord.onDetected(() => setCurrentView('talkMode')));
    }

    // Tray quick actions: focus chat, settings, open workspace folder
    if (grump?.isElectron && grump.onAppCommand) {
      unsubs.push(grump.onAppCommand('app:focus-chat', () => setCurrentView('chat')));
      unsubs.push(grump.onAppCommand('app:focus-settings', () => setCurrentView('settings')));
      unsubs.push(
        grump.onAppCommand('app:open-workspace', () => {
          const root = get(workspaceStore).root;
          if (root && grump.openPath) grump.openPath(root).catch(() => {});
        })
      );
    }

    if (grump?.isElectron && grump.onProtocolUrl) {
      unsubs.push(
        grump.onProtocolUrl((url: string) => {
          if (url.startsWith('grump://auth/done')) {
            try {
              const parsed = new URL(url);
              const accessToken = parsed.searchParams.get('access_token');
              const userId = parsed.searchParams.get('user_id');
              const email = parsed.searchParams.get('email') ?? '';
              if (accessToken && userId) {
                setUserAndSession(
                  { id: userId, email, name: email.split('@')[0] },
                  { access_token: accessToken }
                );
              }
            } catch (_) {
              /* ignore parse errors */
            }
            return;
          }
          const path = url.replace(/^grump:\/\//i, '').split('/')[0] || '';
          if (path === 'settings') setCurrentView('settings');
          else if (path === 'chat' || !path) setCurrentView('chat');
        })
      );
    }

    return () => {
      window.removeEventListener('keydown', onKeydown);
      unsubTheme();
      if (mediaQuery) mediaQuery.removeEventListener('change', applyTheme);
      unsubs.forEach((u) => u());
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

<div class="app" data-density={densityValue}>
  <ConnectionStatusBanner />
  <ElectronTitleBar />
  <div class="app-body">
    {#if $isOnboardingComplete}
      <UnifiedSidebar />
    {/if}

    <div class="main-content" class:full-width={isFullWidthView}>
      {#key $currentView}
        <div class="main-content-view" transition:fade={{ duration: 200 }}>
          {#if $currentView === 'settings'}
            <SettingsScreen onBack={() => setCurrentView('chat')} />
          {:else if VIEW_REGISTRY[$currentView]}
            <LazyView definition={VIEW_REGISTRY[$currentView]} />
          {:else if !$isOnboardingComplete}
            <!-- New unified onboarding flow (auth, API setup, tech stack, preferences - all in one) -->
            <OnboardingFlow
              onComplete={() => {
                // New onboarding handles everything - mark setup complete for backwards compat
                preferencesStore.completeSetup();
                // Also mark old onboarding as seen for any legacy checks
                onboardingStore.markOnboardingSeenOnDevice();
              }}
              onSkip={() => {
                preferencesStore.completeSetup();
                onboardingStore.markOnboardingSeenOnDevice();
              }}
            />
          {:else}
            {#key $currentSession?.id ?? 'none'}
              <ChatInterface
                initialMessages={getInitialMessages()}
                onmessagesUpdated={handleMessagesUpdate}
              />
            {/key}
          {/if}
        </div>
      {/key}
    </div>
  </div>

  <Toast />
  <QuestionModal />
  <CommandPalette bind:open={commandPaletteOpen} onClose={() => (commandPaletteOpen = false)} />
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
    height: 100vh;
    width: 100%;
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

  /* Spacious layout: content padding */
  .app {
    --space-content: 24px;
  }

  /* Compact density: ~20% less padding */
  .app[data-density='compact'] {
    --space-content: 16px;
  }
  .app[data-density='compact'] .main-content {
    padding: var(--space-content);
  }
  .app[data-density='compact'] :global(.settings-btn),
  .app[data-density='compact'] :global(.session-item) {
    padding-top: 6px;
    padding-bottom: 6px;
  }

  /* Ensure background fills the "void" outside the app on large screens */
  :global(body) {
    background-color: var(--color-bg-subtle, #f0f2f5);
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

  /* Responsive adjustments (tablet: sidebar collapses to 64px via layout) */
  @media (max-width: 768px) {
    .app {
      height: 100dvh;
    }
  }

  @media (max-width: 480px) {
    .app {
      height: 100dvh;
    }
  }

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
