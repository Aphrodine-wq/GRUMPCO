<script lang="ts">
  /**
   * GRumpBlob - Professional light theme avatar
   */
  import { onMount } from 'svelte';
  import { colors } from '../lib/design-system/tokens/colors';

  type BlobState = 'idle' | 'thinking' | 'speaking' | 'success' | 'error';
  type BlobSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  interface Props {
    state?: BlobState;
    size?: BlobSize;
    animated?: boolean;
  }

  let {
    state: blobState = $bindable('idle'),
    size = $bindable('md'),
    animated = $bindable(true)
  }: Props = $props();

  const sizeMap: Record<BlobSize, number> = {
    xs: 16,
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96
  };

  const ariaLabel =
    blobState === 'thinking'
      ? 'G-Rump is thinking'
      : blobState === 'speaking'
        ? 'G-Rump is speaking'
        : blobState === 'success'
          ? 'G-Rump succeeded'
          : blobState === 'error'
            ? 'G-Rump encountered an error'
            : 'G-Rump';
</script>

<div 
  class="grump-avatar grump-avatar--{size} grump-avatar--{blobState}"
  class:is-animated={animated}
  style="--avatar-size: {sizeMap[size]}px"
  style:--primary-color={colors.accent.primary}
  style:--success-color={colors.status.success}
  style:--error-color={colors.status.error}
  role="img"
  aria-label={ariaLabel}
>
  <div class="avatar-ring"></div>
  <div class="avatar-circle">
    {#if blobState === 'thinking'}
      <div class="thinking-dots">
        <span></span><span></span><span></span>
      </div>
    {:else}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    {/if}
  </div>
</div>

<style>
  .grump-avatar {
    width: var(--avatar-size);
    height: var(--avatar-size);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .avatar-ring {
    position: absolute;
    inset: -2px;
    border-radius: 50%;
    border: 2px solid transparent;
    transition: all 300ms ease;
  }

  .grump-avatar--thinking .avatar-ring {
    border-color: var(--primary-color);
    border-top-color: transparent;
    animation: rotate 1s linear infinite;
  }

  .grump-avatar--success .avatar-ring {
    border-color: var(--success-color);
    transform: scale(1.1);
    opacity: 0;
    animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  .grump-avatar--error .avatar-ring {
    border-color: var(--error-color);
  }

  .avatar-circle {
    width: 100%;
    height: 100%;
    background-color: var(--primary-color);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    z-index: 1;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    transition: all 300ms ease;
  }

  .grump-avatar--success .avatar-circle {
    background-color: var(--success-color);
  }

  .grump-avatar--error .avatar-circle {
    background-color: var(--error-color);
  }

  .avatar-circle svg {
    width: 50%;
    height: 50%;
  }

  .thinking-dots {
    display: flex;
    gap: 3px;
  }

  .thinking-dots span {
    width: 4px;
    height: 4px;
    background-color: currentColor;
    border-radius: 50%;
    animation: bounce 0.6s infinite alternate;
  }

  .thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
  .thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes rotate {
    to { transform: rotate(360deg); }
  }

  @keyframes bounce {
    to { transform: translateY(-4px); }
  }

  @keyframes ping {
    75%, 100% {
      transform: scale(1.5);
      opacity: 0;
    }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
  }

  .grump-avatar--error.is-animated .avatar-circle {
    animation: shake 0.2s ease-in-out 0s 2;
  }
</style>
