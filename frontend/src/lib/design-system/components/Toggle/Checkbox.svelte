<script lang="ts">
  /**
   * G-Rump Design System - Checkbox Component
   * Accessible checkbox with custom styling
   */
  import { Check } from 'lucide-svelte';

  interface Props {
    checked?: boolean;
    indeterminate?: boolean;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
    label?: string;
    description?: string;
    onchange?: (checked: boolean) => void;
  }

  let {
    checked = $bindable(false),
    indeterminate = false,
    disabled = false,
    size = 'md',
    label,
    description,
    onchange,
  }: Props = $props();

  let inputRef: HTMLInputElement | null = $state(null);

  function handleChange() {
    if (disabled) return;
    checked = !checked;
    onchange?.(checked);
  }

  $effect(() => {
    if (inputRef) {
      inputRef.indeterminate = indeterminate;
    }
  });

  const sizeClasses: Record<typeof size, string> = {
    sm: 'checkbox-sm',
    md: 'checkbox-md',
    lg: 'checkbox-lg',
  };
</script>

<label class="checkbox-container {sizeClasses[size]}" class:disabled>
  <input
    bind:this={inputRef}
    type="checkbox"
    class="checkbox-input"
    {checked}
    {disabled}
    onchange={handleChange}
  />
  <span class="checkbox-box" class:checked class:indeterminate>
    {#if checked}
      <Check class="checkbox-icon" />
    {:else if indeterminate}
      <span class="checkbox-indeterminate"></span>
    {/if}
  </span>

  {#if label || description}
    <div class="checkbox-text">
      {#if label}
        <span class="checkbox-label">{label}</span>
      {/if}
      {#if description}
        <span class="checkbox-description">{description}</span>
      {/if}
    </div>
  {/if}
</label>

<style>
  .checkbox-container {
    display: inline-flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
  }

  .checkbox-container.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .checkbox-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .checkbox-box {
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border: 2px solid var(--color-border, #e9d5ff);
    border-radius: 6px;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .checkbox-box.checked,
  .checkbox-box.indeterminate {
    background: var(--color-primary, #7c3aed);
    border-color: var(--color-primary, #7c3aed);
  }

  .checkbox-box :global(.checkbox-icon) {
    color: white;
  }

  .checkbox-indeterminate {
    width: 50%;
    height: 2px;
    background: white;
    border-radius: 1px;
  }

  /* Sizes */
  .checkbox-sm .checkbox-box {
    width: 16px;
    height: 16px;
  }

  .checkbox-sm .checkbox-box :global(.checkbox-icon) {
    width: 12px;
    height: 12px;
  }

  .checkbox-md .checkbox-box {
    width: 20px;
    height: 20px;
  }

  .checkbox-md .checkbox-box :global(.checkbox-icon) {
    width: 14px;
    height: 14px;
  }

  .checkbox-lg .checkbox-box {
    width: 24px;
    height: 24px;
  }

  .checkbox-lg .checkbox-box :global(.checkbox-icon) {
    width: 18px;
    height: 18px;
  }

  .checkbox-input:focus-visible + .checkbox-box {
    box-shadow: 0 0 0 3px var(--color-primary-glow, rgba(124, 58, 237, 0.2));
  }

  .checkbox-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 1px;
  }

  .checkbox-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text, #1f1147);
  }

  .checkbox-description {
    font-size: 13px;
    color: var(--color-text-muted, #6d28d9);
    line-height: 1.4;
  }

  @media (prefers-reduced-motion: reduce) {
    .checkbox-box {
      transition: none;
    }
  }
</style>
