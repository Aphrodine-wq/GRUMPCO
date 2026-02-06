<script lang="ts">
  /**
   * IntegrationsScreen - Dedicated full-screen Integrations view
   * Opened when user clicks Integrations in the sidebar (separate from Settings)
   */
  import IntegrationsHub from './IntegrationsHub.svelte';
  import { setCurrentView } from '../stores/uiStore';

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

  function handleBack() {
    onBack?.() ?? setCurrentView('chat');
  }
</script>

<div class="integrations-screen">
  <IntegrationsHub onBack={handleBack} embedInTab={false} />
</div>

<style>
  .integrations-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--color-bg-app, #fafafa);
  }

  .integrations-screen :global(.integrations-hub) {
    flex: 1;
    min-height: 0;
  }
</style>
