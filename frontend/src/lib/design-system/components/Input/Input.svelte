<script lang="ts">
  /**
   * G-Rump Design System - Input Component
   * Dark terminal/Claude Code aesthetic - Command prompt style
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

<div class="input-wrapper" class:input-full-width={fullWidth} class:is-focused={isFocused}>
  {#if label}
    <label class="input-label" for={inputId}>
      <span class="label-prefix">#</span> {label}
    </label>
  {/if}

  <div class="input-container" class:has-error={!!error}>
    <span class="prompt-arrow">&gt;</span>
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
    {#if isFocused}
      <span class="terminal-cursor"></span>
    {/if}
  </div>

  {#if error}
    <span class="input-error-text">! ERROR: {error}</span>
  {:else if hint}
    <span class="input-hint">// {hint}</span>
  {/if}
</div>

<style>
  .input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: 'JetBrains Mono', monospace;
  }

  .input-full-width {
    width: 100%;
  }

  .input-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-accent-secondary, #00E5FF);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .label-prefix {
    opacity: 0.5;
  }

  .input-container {
    display: flex;
    align-items: center;
    background-color: #000;
    border: 1px solid #333;
    padding: 0 12px;
    position: relative;
    transition: border-color 100ms ease;
  }

  .input-wrapper.is-focused .input-container {
    border-color: var(--color-accent-primary, #00FF41);
    box-shadow: 0 0 10px rgba(0, 255, 65, 0.1);
  }

  .has-error {
    border-color: #FF3131 !important;
  }

  .prompt-arrow {
    color: var(--color-accent-primary, #00FF41);
    margin-right: 8px;
    font-weight: bold;
    user-select: none;
  }

  .input {
    background: transparent;
    color: #E5E5E5;
    border: none;
    width: 100%;
    outline: none;
    font-family: inherit;
  }

  .input::placeholder {
    color: #444;
  }

  .input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .terminal-cursor {
    width: 8px;
    height: 1.2em;
    background-color: var(--color-accent-primary, #00FF41);
    display: inline-block;
    animation: blink 1s step-end infinite;
    margin-left: 2px;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  /* Sizes */
  .input-sm {
    height: 32px;
    font-size: 12px;
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
    font-size: 11px;
    color: #FF3131;
    font-weight: 600;
  }

  .input-hint {
    font-size: 11px;
    color: #666;
    font-style: italic;
  }
</style>
