<script lang="ts">
  /**
   * G-Rump Design System - Input Component
   * Clean, professional light theme
   */
  import { colors } from '../../tokens/colors';

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
  let isFocused = $state(false);

  function handleFocus(e: FocusEvent) {
    isFocused = true;
    onfocus?.(e);
  }

  function handleBlur(e: FocusEvent) {
    isFocused = false;
    onblur?.(e);
  }
</script>

<div 
  class="input-wrapper" 
  class:input-full-width={fullWidth} 
  class:is-focused={isFocused}
  style:--primary-color={colors.accent.primary}
  style:--text-primary={colors.text.primary}
  style:--text-secondary={colors.text.secondary}
  style:--text-muted={colors.text.muted}
  style:--border-default={colors.border.default}
  style:--error-color={colors.status.error}
  style:--bg-input={colors.background.input}
>
  {#if label}
    <label class="input-label" for={inputId}>
      {label}
    </label>
  {/if}

  <div class="input-container" class:has-error={!!error}>
    <input
      id={inputId}
      {type}
      bind:value
      class="input input-{size}"
      {placeholder}
      {disabled}
      {oninput}
      {onkeydown}
      onfocus={handleFocus}
      onblur={handleBlur}
    />
  </div>

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
    gap: 6px;
    font-family: inherit;
  }

  .input-full-width {
    width: 100%;
  }

  .input-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .input-container {
    display: flex;
    align-items: center;
    background-color: var(--bg-input);
    border: 1px solid var(--border-default);
    border-radius: 6px;
    padding: 0 12px;
    transition: all 150ms ease;
  }

  .is-focused .input-container {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .has-error {
    border-color: var(--error-color) !important;
  }

  .input {
    background: transparent;
    color: var(--text-primary);
    border: none;
    width: 100%;
    outline: none;
    font-family: inherit;
  }

  .input::placeholder {
    color: var(--text-muted);
  }

  .input:disabled {
    background-color: #f9fafb;
    cursor: not-allowed;
  }

  /* Sizes */
  .input-sm {
    height: 32px;
    font-size: 13px;
  }

  .input-md {
    height: 40px;
    font-size: 14px;
  }

  .input-lg {
    height: 48px;
    font-size: 16px;
  }

  .input-error-text {
    font-size: 13px;
    color: var(--error-color);
  }

  .input-hint {
    font-size: 13px;
    color: var(--text-muted);
  }
</style>
