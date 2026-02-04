<script lang="ts">
  import ViewLoading from './ViewLoading.svelte';
  import type { ViewDefinition } from '../lib/viewRegistry';
  import { setCurrentView } from '../stores/uiStore';

  interface Props {
    definition: ViewDefinition;
  }

  let { definition }: Props = $props();
</script>

{#await definition.loader()}
  <ViewLoading message={definition.loadingLabel} />
{:then { default: Component }}
  <Component
    onBack={() => setCurrentView(definition.backTo)}
    onComplete={definition.backTo === 'settings' ? () => setCurrentView('settings') : undefined}
    onReset={definition.backTo === 'settings' ? () => setCurrentView('chat') : undefined}
    {...definition.extraProps ?? {}}
  />
{/await}
