<script lang="ts">
  /**
   * G-Rump Design System - Toggle/Switch Component
   * Accessible toggle switch
   */

  interface Props {
    checked?: boolean;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
    label?: string;
    description?: string;
    onchange?: (checked: boolean) => void;
  }

  let {
    checked = $bindable(false),
    disabled = false,
    size = 'md',
    label,
    description,
    onchange,
  }: Props = $props();

  function toggle() {
    if (disabled) return;
    checked = !checked;
    onchange?.(checked);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  }

  const sizeClasses: Record<typeof size, string> = {
    sm: 'toggle-sm',
    md: 'toggle-md',
    lg: 'toggle-lg',
  };
</script>

<label class="toggle-container {sizeClasses[size]}" class:disabled>
  <button
    type="button"
    role="switch"
    class="toggle"
    class:checked
    aria-checked={checked}
    aria-label={label || (checked ? 'On' : 'Off')}
    {disabled}
    onclick={toggle}
    onkeydown={handleKeydown}
  >
    <span class="toggle-track">
      <span class="toggle-thumb"></span>
    </span>
  </button>

  {#if label || description}
    <div class="toggle-text">
      {#if label}
        <span class="toggle-label">{label}</span>
      {/if}
      {#if description}
        <span class="toggle-description">{description}</span>
      {/if}
    </div>
  {/if}
</label>

<style>
  .toggle-container {
    display: inline-flex;
    align-items: flex-start;
    gap: 12px;
    cursor: pointer;
  }

  .toggle-container.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .toggle {
    position: relative;
    display: inline-flex;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
  }

  .toggle:disabled {
    cursor: not-allowed;
  }

  .toggle-track {
    display: flex;
    align-items: center;
    background: var(--color-border, #e9d5ff);
    border-radius: 999px;
    transition: background 200ms ease;
  }

  .toggle.checked .toggle-track {
    background: var(--color-primary, #7c3aed);
  }

  .toggle-thumb {
    background: white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    transition: transform 200ms ease;
  }

  /* Sizes */
  .toggle-sm .toggle-track {
    width: 32px;
    height: 18px;
    padding: 2px;
  }

  .toggle-sm .toggle-thumb {
    width: 14px;
    height: 14px;
  }

  .toggle-sm .toggle.checked .toggle-thumb {
    transform: translateX(14px);
  }

  .toggle-md .toggle-track {
    width: 44px;
    height: 24px;
    padding: 2px;
  }

  .toggle-md .toggle-thumb {
    width: 20px;
    height: 20px;
  }

  .toggle-md .toggle.checked .toggle-thumb {
    transform: translateX(20px);
  }

  .toggle-lg .toggle-track {
    width: 56px;
    height: 30px;
    padding: 3px;
  }

  .toggle-lg .toggle-thumb {
    width: 24px;
    height: 24px;
  }

  .toggle-lg .toggle.checked .toggle-thumb {
    transform: translateX(26px);
  }

  .toggle:focus-visible {
    outline: none;
  }

  .toggle:focus-visible .toggle-track {
    box-shadow: 0 0 0 3px var(--color-primary-glow, rgba(124, 58, 237, 0.2));
  }

  .toggle-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 2px;
  }

  .toggle-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text, #1f1147);
  }

  .toggle-description {
    font-size: 13px;
    color: var(--color-text-muted, #6d28d9);
    line-height: 1.4;
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-track,
    .toggle-thumb {
      transition: none;
    }
  }
</style>
