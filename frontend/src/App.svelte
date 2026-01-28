  import { showSettings } from './stores/uiStore';
  import SettingsScreen from './components/SettingsScreen.svelte';

  // ... (keeping existing imports)

  // ... (inside script)

<div class="main-content">
  {#if $showSettings}
    <SettingsScreen onBack={() => showSettings.set(false)} />
  {:else}
    {#key $currentSession?.id ?? 'none'}
      <ChatInterface
        initialMessages={getInitialMessages()}
        on:messages-updated={(e) => handleMessagesUpdate(e.detail)}
      />
    {/key}
  {/if}
</div>

  <Toast />
  <QuestionModal />
  {#if showPricing}
    <PricingModal onClose={() => (showPricing = false)} />
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
  }

  @media (max-width: 480px) {
    .app {
      height: 100dvh;
    }
  }
</style>
