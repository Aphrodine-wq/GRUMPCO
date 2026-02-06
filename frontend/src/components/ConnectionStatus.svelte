<script>
  /**
   * ConnectionStatus Component
   * Displays real-time connection quality with latency and provider info
   *
   * Features:
   * - Live latency monitoring
   * - Provider/model display
   * - Visual quality indicator
   * - Hover details
   */
  import { connectionStore } from '../stores/connectionStore.js';
  import { onMount, onDestroy } from 'svelte';
  import { fetchApi } from '$lib/api.js';

  // State
  let latency = $state(0);
  let provider = $state('');
  let model = $state('');
  let quality = $state('good'); // 'good' | 'fair' | 'poor' | 'offline'
  let isVisible = $state(false);
  let showDetails = $state(false);

  // Derived values
  let qualityClass = $derived(
    {
      good: 'quality-good',
      fair: 'quality-fair',
      poor: 'quality-poor',
      offline: 'quality-offline',
    }[quality]
  );

  let latencyDisplay = $derived(quality === 'offline' ? 'Offline' : `${Math.round(latency)}ms`);

  let intervalId = null;

  onMount(() => {
    // Subscribe to connection store
    const unsubscribe = connectionStore.subscribe((state) => {
      latency = state.latency;
      provider = state.provider;
      model = state.model;

      // Determine quality based on latency
      if (state.isOffline) {
        quality = 'offline';
      } else if (latency < 100) {
        quality = 'good';
      } else if (latency < 300) {
        quality = 'fair';
      } else {
        quality = 'poor';
      }

      isVisible = true;
    });

    // Ping server every 5 seconds to measure latency
    intervalId = setInterval(measureLatency, 5000);

    // Initial measurement
    measureLatency();

    return () => {
      unsubscribe();
      if (intervalId) clearInterval(intervalId);
    };
  });

  async function measureLatency() {
    const start = performance.now();

    try {
      const response = await fetchApi('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
      });

      const end = performance.now();
      const measuredLatency = end - start;

      connectionStore.updateConnection({
        latency: measuredLatency,
        isOffline: false,
        lastConnected: Date.now(),
      });
    } catch (error) {
      connectionStore.updateConnection({
        latency: 9999,
        isOffline: true,
      });
    }
  }
</script>

{#if isVisible}
  <div
    class="connection-status {qualityClass}"
    onmouseenter={() => (showDetails = true)}
    onmouseleave={() => (showDetails = false)}
    role="status"
    aria-label="Connection status: {quality}, latency {latencyDisplay}"
  >
    <span class="indicator" aria-hidden="true"></span>
    <span class="latency">{latencyDisplay}</span>

    {#if showDetails}
      <div class="details-popup" role="tooltip">
        <div class="detail-row">
          <span class="label">Provider:</span>
          <span class="value">{provider || 'Not connected'}</span>
        </div>
        <div class="detail-row">
          <span class="label">Model:</span>
          <span class="value">{model || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="label">Quality:</span>
          <span class="value quality-{quality}">{quality}</span>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .connection-status {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.3s ease;
    cursor: help;
    user-select: none;
  }

  /* Quality states */
  .quality-good {
    background: rgba(34, 197, 94, 0.15);
    color: #16a34a;
  }

  .quality-fair {
    background: rgba(234, 179, 8, 0.15);
    color: #ca8a04;
  }

  .quality-poor {
    background: rgba(239, 68, 68, 0.15);
    color: #dc2626;
  }

  .quality-offline {
    background: rgba(107, 114, 128, 0.15);
    color: #6b7280;
  }

  .indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    animation: pulse 2s infinite;
  }

  .quality-offline .indicator {
    animation: none;
    opacity: 0.5;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.1);
    }
  }

  .latency {
    font-variant-numeric: tabular-nums;
  }

  /* Details popup */
  .details-popup {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    min-width: 180px;
    padding: 12px;
    background: var(--bg-primary, #1a1a2e);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 0;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .detail-row:last-child {
    border-bottom: none;
  }

  .label {
    color: var(--text-secondary, #888);
    font-size: 11px;
  }

  .value {
    color: var(--text-primary, #fff);
    font-size: 11px;
    font-weight: 600;
  }

  .quality-good {
    color: #16a34a;
  }
  .quality-fair {
    color: #ca8a04;
  }
  .quality-poor {
    color: #dc2626;
  }
  .quality-offline {
    color: #6b7280;
  }

  /* Mobile optimization */
  @media (max-width: 640px) {
    .connection-status {
      padding: 3px 8px;
      font-size: 11px;
    }

    .indicator {
      width: 6px;
      height: 6px;
    }

    .details-popup {
      right: -10px;
      min-width: 160px;
    }
  }
</style>
