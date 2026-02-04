<script lang="ts">
  /**
   * @deprecated Use GAgentScreen.svelte instead.
   * This component is kept for backward compatibility and re-exports GAgentScreen.
   */
  import GAgentScreen from './GAgentScreen.svelte';

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();
</script>

<GAgentScreen {onBack} />
