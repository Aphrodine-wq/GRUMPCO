<script lang="ts">
  /**
   * G-Rump Design System - Input Component
   * Text input with consistent styling
   */

  interface Props {
    value?: string;
    type?: 'text' | 'password' | 'email' | 'number' | 'search';
    placeholder?: string;
    disabled?: boolean;
    error?: string;
    label?: string;
    hint?: string;
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    oninput?: (e: Event) => void;
    onkeydown?: (e: KeyboardEvent) => void;
    onfocus?: (e: FocusEvent) => void;
    onblur?: (e: FocusEvent) => void;
  }

  let {
    value = $bindable(''),
    type = 'text',
    placeholder = '',
    disabled = false,
    error = '',
    label = '',
    hint = '',
    size = 'md',
    fullWidth = false,
    oninput,
    onkeydown,
    onfocus,
    onblur,
  }: Props = $props();

  let inputId = $state(`input-${Math.random().toString(36).slice(2, 9)}`);
</script>

<div class="input-wrapper" class:input-full-width={fullWidth}>
  {#if label}
    <label class="input-label" for={inputId}>{label}</label>
  {/if}

  <input
    id={inputId}
    {type}
    bind:value
    class="input input-{size}"
    class:input-error={!!error}
    {placeholder}
    {disabled}
    {oninput}
    {onkeydown}
    {onfocus}
    {onblur}
  />

  {#if error}
    <span class="input-error-text">{error}</span>
  {:else if hint}
    <span class="input-hint">{hint}</span>
  {/if}
</div>

<style>
  .input-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
  }

  .input-full-width {
    width: 100%;
  }

  .input-label {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm, 0.8rem);
    font-weight: 500;
    color: var(--color-text-primary, #000000);
  }

  .input {
    font-family: var(--font-mono);
    background-color: var(--color-bg-input, #F0F0F0);
    color: var(--color-text-primary, #000000);
    border: 1px solid transparent;
    border-radius: var(--radius-md, 0.375rem);
    transition: var(--transition-fast, 150ms ease-out);
    width: 100%;
  }

  .input::placeholder {
    color: var(--color-text-muted, #9CA3AF);
  }

  .input:focus {
    outline: none;
    border-color: var(--color-accent-primary, #0066FF);
    box-shadow: 0 0 0 2px var(--color-border-focus, rgba(0, 102, 255, 0.25));
  }

  .input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input-error {
    border-color: var(--color-status-error, #DC2626);
  }

  .input-error:focus {
    box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.25);
  }

  /* Sizes */
  .input-sm {
    height: var(--space-7, 1.75rem);
    padding: 0 var(--space-2, 0.5rem);
    font-size: var(--font-size-xs, 0.7rem);
  }

  .input-md {
    height: var(--space-9, 2.25rem);
    padding: 0 var(--space-3, 0.75rem);
    font-size: var(--font-size-sm, 0.8rem);
  }

  .input-lg {
    height: var(--space-11, 2.75rem);
    padding: 0 var(--space-4, 1rem);
    font-size: var(--font-size-base, 0.875rem);
  }

  .input-error-text {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs, 0.7rem);
    color: var(--color-status-error, #DC2626);
  }

  .input-hint {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs, 0.7rem);
    color: var(--color-text-muted, #9CA3AF);
  }
</style>
