<script lang="ts">
  /**
   * G-Rump Design System - Radio Component
   * Accessible radio button with custom styling
   */

  interface Props {
    checked?: boolean;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
    name?: string;
    value?: string;
    label?: string;
    description?: string;
    onchange?: (value: string) => void;
  }

  let {
    checked = $bindable(false),
    disabled = false,
    size = 'md',
    name = '',
    value = '',
    label,
    description,
    onchange,
  }: Props = $props();

  function handleChange() {
    if (disabled) return;
    checked = true;
    onchange?.(value);
  }

  const sizeClasses: Record<typeof size, string> = {
    sm: 'radio-sm',
    md: 'radio-md',
    lg: 'radio-lg',
  };
</script>

<label class="radio-container {sizeClasses[size]}" class:disabled>
  <input
    type="radio"
    class="radio-input"
    {name}
    {value}
    {checked}
    {disabled}
    onchange={handleChange}
  />
  <span class="radio-circle" class:checked>
    <span class="radio-dot"></span>
  </span>

  {#if label || description}
    <div class="radio-text">
      {#if label}
        <span class="radio-label">{label}</span>
      {/if}
      {#if description}
        <span class="radio-description">{description}</span>
      {/if}
    </div>
  {/if}
</label>

<style>
  .radio-container {
    display: inline-flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
  }

  .radio-container.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .radio-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .radio-circle {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-elevated, #ffffff);
    border: 2px solid var(--color-border, #e9d5ff);
    border-radius: 50%;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .radio-circle.checked {
    border-color: var(--color-primary, #7c3aed);
  }

  .radio-dot {
    background: var(--color-primary, #7c3aed);
    border-radius: 50%;
    transform: scale(0);
    transition: transform 150ms ease;
  }

  .radio-circle.checked .radio-dot {
    transform: scale(1);
  }

  /* Sizes */
  .radio-sm .radio-circle {
    width: 16px;
    height: 16px;
  }

  .radio-sm .radio-dot {
    width: 8px;
    height: 8px;
  }

  .radio-md .radio-circle {
    width: 20px;
    height: 20px;
  }

  .radio-md .radio-dot {
    width: 10px;
    height: 10px;
  }

  .radio-lg .radio-circle {
    width: 24px;
    height: 24px;
  }

  .radio-lg .radio-dot {
    width: 12px;
    height: 12px;
  }

  .radio-input:focus-visible + .radio-circle {
    box-shadow: 0 0 0 3px var(--color-primary-glow, rgba(124, 58, 237, 0.2));
  }

  .radio-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 1px;
  }

  .radio-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text, #1f1147);
  }

  .radio-description {
    font-size: 13px;
    color: var(--color-text-muted, #6d28d9);
    line-height: 1.4;
  }

  @media (prefers-reduced-motion: reduce) {
    .radio-circle,
    .radio-dot {
      transition: none;
    }
  }
</style>
