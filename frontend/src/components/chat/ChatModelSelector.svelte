<script lang="ts">
  /**
   * ChatModelSelector Component
   *
   * Model picker dropdown with selection handling.
   */
  import ModelPicker from '../ModelPicker.svelte';

  interface Props {
    currentModelKey: string;
    isOpen: boolean;
    onToggle: () => void;
    onSelect: (provider: string, modelId?: string) => void;
  }

  let { currentModelKey, isOpen, onToggle, onSelect }: Props = $props();
</script>

{#if isOpen}
  <div class="model-picker-dropdown">
    <ModelPicker
      value={currentModelKey}
      compact={false}
      showAuto={true}
      embedded={true}
      {onSelect}
    />
  </div>
{/if}

<style>
  .model-picker-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.25rem;
    min-width: 360px;
    max-width: 420px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    z-index: 100;
    padding: 0.5rem;
  }

  .model-picker-dropdown :global(.model-picker-trigger) {
    min-width: 100%;
  }

  .model-picker-dropdown :global(.model-picker-dropdown) {
    min-width: 100%;
    max-height: 420px;
  }
</style>
