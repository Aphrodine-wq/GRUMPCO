<script lang="ts">
  import { onMount } from 'svelte';
  import ChatInterface from './components/ChatInterface.svelte';
  import SessionsSidebar from './components/SessionsSidebar.svelte';
  import MobileNav from './components/MobileNav.svelte';
  import Toast from './components/Toast.svelte';
  import QuestionModal from './components/QuestionModal.svelte';
  import PricingModal from './components/PricingModal.svelte';
  import SettingsScreen from './components/SettingsScreen.svelte';
  import SetupScreen from './components/SetupScreen.svelte';
  import { OnboardingCarousel } from './components/onboarding';
  
  // Lazy load heavy components for better initial load performance
  const AskDocsScreen = () => import('./components/AskDocsScreen.svelte');
  const VoiceCodeScreen = () => import('./components/VoiceCodeScreen.svelte');
  const AgentSwarmVisualizer = () => import('./components/AgentSwarmVisualizer.svelte');
  const DesignToCodeScreen = () => import('./components/DesignToCodeScreen.svelte');
  const LazyCostDashboard = () => import('./components/LazyCostDashboard.svelte');
  
  // Integrations platform components - lazy loaded
  const IntegrationsHub = () => import('./components/IntegrationsHub.svelte');
  const ApprovalsCenter = () => import('./components/ApprovalsCenter.svelte');
  const HeartbeatsManager = () => import('./components/HeartbeatsManager.svelte');
  const MemoryManager = () => import('./components/MemoryManager.svelte');
  const AuditLogViewer = () => import('./components/AuditLogViewer.svelte');
  const AdvancedAIDashboard = () => import('./components/AdvancedAIDashboard.svelte');
  const TutorialOverlay = () => import('./components/TutorialOverlay.svelte');
  
  // Docker and Cloud components - lazy loaded
  const DockerPanel = () => import('./components/DockerPanel.svelte');
  const CloudDashboard = () => import('./components/CloudDashboard.svelte');
  
  import { sessionsStore, currentSession } from './stores/sessionsStore';
  import { settingsStore } from './stores/settingsStore';
  import { preferencesStore, setupComplete } from './stores/preferencesStore';
  import { showSettings, showAskDocs, showVoiceCode, showSwarm, showDesignToCode, showCostDashboard, showIntegrations, showApprovals, showHeartbeats, showMemory, showAuditLog, showAdvancedAI, showDocker, showCloudDashboard, sidebarCollapsed, focusChatTrigger } from './stores/uiStore';
  import { demoStore } from './stores/demoStore';
  import { isMobileDevice } from './utils/touchGestures';
  import type { Message } from './types';

  let isMobile = $state(false);
  let showPricing = $state(false);

  onMount(() => {
    localStorage.removeItem('mermaid-app-state');
    settingsStore.load().catch(() => {});

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
      if (mod && e.key === 'b') {
        e.preventDefault();
        sidebarCollapsed.update((v) => !v);
      }
      if ((mod && e.shiftKey && e.key === 'L') || (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        const target = e.target as HTMLElement;
        if (target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          focusChatTrigger.update((n) => n + 1);
        }
      }
    }
    window.addEventListener('keydown', onKeydown);

    // Signal readiness to Electron (close splash, show main window)
    const grump = (window as { grump?: { isElectron?: boolean; closeSplashShowMain?: () => Promise<void> } }).grump;
    if (grump?.isElectron && grump.closeSplashShowMain) {
      setTimeout(() => {
        grump.closeSplashShowMain!().catch((err: unknown) => console.error('[App] Failed to close splash:', err));
      }, 400);
    }

    return () => window.removeEventListener('keydown', onKeydown);
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

<div class="app">
  <SessionsSidebar />

  <div class="main-content">
    {#if $showSettings}
      <SettingsScreen onBack={() => showSettings.set(false)} />
    {:else if $showAskDocs}
      {#await AskDocsScreen() then { default: Component }}
        <Component onBack={() => showAskDocs.set(false)} />
      {/await}
    {:else if $showVoiceCode}
      {#await VoiceCodeScreen() then { default: Component }}
        <Component onBack={() => showVoiceCode.set(false)} />
      {/await}
    {:else if $showSwarm}
      {#await AgentSwarmVisualizer() then { default: Component }}
        <Component onBack={() => showSwarm.set(false)} />
      {/await}
    {:else if $showDesignToCode}
      {#await DesignToCodeScreen() then { default: Component }}
        <Component onBack={() => showDesignToCode.set(false)} />
      {/await}
    {:else if $showCostDashboard}
      {#await LazyCostDashboard() then { default: Component }}
        <Component onBack={() => showCostDashboard.set(false)} />
      {/await}
    {:else if $showIntegrations}
      {#await IntegrationsHub() then { default: Component }}
        <Component onBack={() => showIntegrations.set(false)} />
      {/await}
    {:else if $showApprovals}
      {#await ApprovalsCenter() then { default: Component }}
        <Component onBack={() => showApprovals.set(false)} />
      {/await}
    {:else if $showHeartbeats}
      {#await HeartbeatsManager() then { default: Component }}
        <Component onBack={() => showHeartbeats.set(false)} />
      {/await}
    {:else if $showMemory}
      {#await MemoryManager() then { default: Component }}
        <Component onBack={() => showMemory.set(false)} />
      {/await}
    {:else if $showAuditLog}
      {#await AuditLogViewer() then { default: Component }}
        <Component onBack={() => showAuditLog.set(false)} />
      {/await}
    {:else if $showAdvancedAI}
      {#await AdvancedAIDashboard() then { default: Component }}
        <Component onBack={() => showAdvancedAI.set(false)} />
      {/await}
    {:else if $showDocker}
      {#await DockerPanel() then { default: Component }}
        <Component onBack={() => showDocker.set(false)} />
      {/await}
    {:else if $showCloudDashboard}
      {#await CloudDashboard() then { default: Component }}
        <Component onBack={() => showCloudDashboard.set(false)} />
      {/await}
    {:else if !$setupComplete}
      <!-- iOS-style onboarding carousel -->
      <OnboardingCarousel
        onComplete={() => preferencesStore.completeSetup()}
        onSkip={() => preferencesStore.completeSetup()}
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

  <Toast />
  <QuestionModal />
  {#if showPricing}
    <PricingModal onClose={() => (showPricing = false)} />
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
  
  <!-- Mobile Navigation -->
  {#if isMobile}
    <MobileNav activeView={$showSettings ? 'settings' : 'chat'} />
  {/if}
</div>

<style>
  .app {
    display: flex;
    height: 100vh;
    width: 100%;
    /* Reverting centered container to full width to reduce "white space" on sides */
    /* max-width: 1400px; */
    /* margin: 0 auto; */

    background: linear-gradient(135deg, #fafafa 0%, #f5f7fa 100%);
    overflow: hidden;
    position: relative;
  }

  /* Ensure background fills the "void" outside the app on large screens */
  :global(body) {
    background-color: #f0f2f5;
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
  }

  /* Responsive adjustments */
  @media (max-width: 1024px) {
    .app {
      /* Sidebar will automatically collapse to 64px on smaller screens */
    }
  }

  @media (max-width: 768px) {
    .app {
      flex-direction: column;
      height: 100dvh;
    }
    
    .main-content {
      padding-bottom: 70px; /* Space for mobile nav */
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
    
    :global(input), :global(textarea) {
      font-size: 16px; /* Prevent zoom on iOS */
    }
  }

  /* Landscape mobile */
  @media (max-width: 768px) and (orientation: landscape) {
    .main-content {
      padding-bottom: 60px;
    }
  }
</style>