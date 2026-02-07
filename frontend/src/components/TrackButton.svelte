<script lang="ts">
  /**
   * TrackButton Component
   *
   * A wrapper button that automatically tracks clicks
   *
   * ```svelte
   * <TrackButton
   *   name="submit_intent"
   *   on:click={handleClick}
   *   properties={{ intent_type: 'feature' }}
   * >
   *   Submit
   * </TrackButton>
   * ```
   */
  import { track } from '../lib/analytics';
  import { createEventDispatcher } from 'svelte';

  export let name: string;
  export let properties: Record<string, unknown> = {};
  export let disabled: boolean = false;
  export let variant: 'primary' | 'secondary' | 'outline' | 'ghost' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let type: 'button' | 'submit' = 'button';

  const dispatch = createEventDispatcher();

  function handleClick(event: MouseEvent) {
    // Track the button click
    track('button_click', {
      name,
      ...properties,
      variant,
      size,
    });

    // Dispatch the click event
    dispatch('click', event);
  }

  // Variant classes
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50',
    ghost: 'text-blue-600 hover:bg-blue-50',
  };

  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
</script>

<button
  {type}
  {disabled}
  on:click={handleClick}
  class="{variantClasses[variant]} {sizeClasses[
    size
  ]} rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  {...$$restProps}
>
  <slot />
</button>
