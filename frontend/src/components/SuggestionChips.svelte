<script lang="ts">
  import { templates } from '../data/templates.js';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
</script>

<div class="suggestion-chips">
  {#each templates as template (template.id)}
    <button
      on:click={() => dispatch('select', template)}
      class="chip"
    >
      <svg class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d={template.icon} />
      </svg>
      <span class="chip-label">{template.label}</span>
    </button>
  {/each}
</div>

<style>
  .suggestion-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.75rem 0;
  }

  .chip {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: #FFFFFF;
    border: 1px solid #000000;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: #000000;
    cursor: pointer;
    transition: all 0.15s;
  }

  .chip:hover {
    background: #000000;
    color: #FFFFFF;
  }

  .chip-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .chip-label {
    white-space: nowrap;
  }
</style>
