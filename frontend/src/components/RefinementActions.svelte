<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
</script>

<div class="refinement-actions">
  <button class="refine-btn" onclick={() => dispatch('refine')}> Refine Diagram </button>
</div>

<style>
  .refinement-actions {
    padding: 1rem;
    display: flex;
    gap: 0.5rem;
  }

  .refine-btn {
    padding: 0.5rem 1rem;
    background: var(--color-primary);
    color: #ffffff;
    border: none;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    cursor: pointer;
  }
</style>
