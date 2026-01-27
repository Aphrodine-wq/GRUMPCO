<script lang="ts">
  interface Props {
    variant?: 'diagram' | 'text' | 'card';
    count?: number;
  }

  let {
    variant = $bindable('text'),
    count = $bindable(3)
  }: Props = $props();

  function getLineWidth(index: number): string {
    const widths = ['100%', '85%', '70%', '90%', '60%'];
    return widths[(index - 1) % widths.length];
  }
</script>

<div class="skeleton-loader skeleton-loader--{variant}">
  {#if variant === 'diagram'}
    <div class="skeleton-diagram">
      <div class="skeleton skeleton-header"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-node"></div>
        <div class="skeleton skeleton-connector"></div>
        <div class="skeleton skeleton-node"></div>
        <div class="skeleton skeleton-connector"></div>
        <div class="skeleton skeleton-node"></div>
      </div>
    </div>
  {:else if variant === 'text'}
    {#each Array(count) as _, i}
      <div class="skeleton-text">
        <div class="skeleton skeleton-line" style="width: {getLineWidth(i + 1)}"></div>
      </div>
    {/each}
  {:else if variant === 'card'}
    {#each Array(count) as _, i}
      <div class="skeleton-card">
        <div class="skeleton skeleton-card-header"></div>
        <div class="skeleton skeleton-card-body"></div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .skeleton-loader {
    width: 100%;
  }

  .skeleton {
    background: linear-gradient(
      90deg,
      #2a2a2a 0%,
      #3a3a3a 50%,
      #2a2a2a 100%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.5s infinite linear;
    border-radius: 4px;
  }

  @keyframes skeleton-shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  .skeleton-diagram {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .skeleton-header {
    height: 20px;
    width: 40%;
    margin: 0 auto;
  }

  .skeleton-body {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .skeleton-node {
    width: 100px;
    height: 60px;
    border-radius: 8px;
  }

  .skeleton-connector {
    width: 40px;
    height: 4px;
  }

  .skeleton-text {
    margin-bottom: 0.75rem;
  }

  .skeleton-text:last-child {
    margin-bottom: 0;
  }

  .skeleton-line {
    height: 16px;
  }

  .skeleton-card {
    padding: 1rem;
    border: 1px solid #2a2a2a;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .skeleton-card:last-child {
    margin-bottom: 0;
  }

  .skeleton-card-header {
    height: 20px;
    width: 60%;
    margin-bottom: 0.75rem;
  }

  .skeleton-card-body {
    height: 40px;
    width: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton {
      animation: none;
      background: #2a2a2a;
    }
  }
</style>
