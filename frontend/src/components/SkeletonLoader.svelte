<script lang="ts">
  interface Props {
    variant?: 'diagram' | 'text' | 'card' | 'message' | 'table' | 'code';
    count?: number;
    animated?: boolean;
  }

  let {
    variant = $bindable('text'),
    count = $bindable(3),
    animated = $bindable(true)
  }: Props = $props();

  function getLineWidth(index: number): string {
    const widths = ['100%', '85%', '70%', '90%', '60%'];
    return widths[(index - 1) % widths.length];
  }
</script>

<div class="skeleton-loader skeleton-loader--{variant}" class:animated>
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
    {#each Array(count) as _, i (i)}
      <div class="skeleton-card">
        <div class="skeleton skeleton-card-header"></div>
        <div class="skeleton skeleton-card-body"></div>
      </div>
    {/each}
  {:else if variant === 'message'}
    {#each Array(count) as _, i (i)}
      <div class="skeleton-message">
        <div class="skeleton skeleton-avatar"></div>
        <div class="skeleton-message-content">
          <div class="skeleton skeleton-line" style="width: 30%"></div>
          <div class="skeleton skeleton-line" style="width: 100%"></div>
          <div class="skeleton skeleton-line" style="width: 85%"></div>
        </div>
      </div>
    {/each}
  {:else if variant === 'table'}
    <div class="skeleton-table">
      <div class="skeleton-table-header">
        {#each Array(4) as _}
          <div class="skeleton skeleton-table-cell"></div>
        {/each}
      </div>
      {#each Array(count) as _}
        <div class="skeleton-table-row">
          {#each Array(4) as _}
            <div class="skeleton skeleton-table-cell"></div>
          {/each}
        </div>
      {/each}
    </div>
  {:else if variant === 'code'}
    <div class="skeleton-code">
      {#each Array(count) as _, i}
        <div class="skeleton-code-line">
          <div class="skeleton skeleton-line-number"></div>
          <div class="skeleton skeleton-line" style="width: {getLineWidth(i + 1)}"></div>
        </div>
      {/each}
    </div>
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
    border-radius: 4px;
  }

  .skeleton-loader.animated .skeleton {
    animation: skeleton-shimmer 1.5s infinite linear;
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

  .skeleton-message {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    padding: 1rem;
  }

  .skeleton-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .skeleton-message-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .skeleton-table {
    border: 1px solid #2a2a2a;
    border-radius: 4px;
    overflow: hidden;
  }

  .skeleton-table-header {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    padding: 1rem;
    background: #1a1a1a;
    border-bottom: 1px solid #2a2a2a;
  }

  .skeleton-table-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    padding: 1rem;
    border-bottom: 1px solid #2a2a2a;
  }

  .skeleton-table-row:last-child {
    border-bottom: none;
  }

  .skeleton-table-cell {
    height: 16px;
  }

  .skeleton-code {
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 4px;
    padding: 1rem;
    font-family: 'JetBrains Mono', monospace;
  }

  .skeleton-code-line {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .skeleton-code-line:last-child {
    margin-bottom: 0;
  }

  .skeleton-line-number {
    width: 30px;
    height: 16px;
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton {
      animation: none !important;
      background: #2a2a2a;
    }
  }
</style>
