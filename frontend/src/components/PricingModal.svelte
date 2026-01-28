<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { Button, Badge } from '../lib/design-system';
  import { fetchApi } from '../lib/api';

  let { onClose } = $props<{ onClose: () => void }>();

  let tiers: any[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);
  let processingPriceId: string | null = $state(null);

  onMount(async () => {
    try {
      const res = await fetchApi('/api/billing/tiers');
      const data = await res.json();
      if (data && data.tiers) {
        tiers = data.tiers;
      }
    } catch (e) {
      error = 'Failed to load pricing plans.';
      console.error(e);
    } finally {
      loading = false;
    }
  });

  async function handleUpgrade(priceId: string) {
    if (!priceId) return;
    processingPriceId = priceId;
    try {
      const res = await fetchApi('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data && data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'No checkout URL returned');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to initiate checkout. Please try again.');
      processingPriceId = null;
    }
  }
</script>

<div class="modal-backdrop" onclick={onClose} transition:fade={{ duration: 200 }}>
  <!-- stopPropagation on modal-content to prevent closing when clicking inside -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-content"
    onclick={(e) => e.stopPropagation()}
    transition:scale={{ duration: 200, start: 0.95 }}
  >
    <div class="header">
      <h2>Upgrade Your Plan</h2>
      <p>Unlock more power and capabilities.</p>
      <button class="close-btn" onclick={onClose}>&times;</button>
    </div>

    {#if loading}
      <div class="loading">Loading plans...</div>
    {:else if error}
      <div class="error">{error}</div>
    {:else}
      <div class="plans-grid">
        {#each tiers as tier}
          <div class="plan-card" class:highlight={tier.id === 'pro'}>
            <div class="plan-header">
              <h3>{tier.name}</h3>
              {#if tier.id === 'pro'}
                <Badge variant="info">Popular</Badge>
              {/if}
            </div>
            <div class="price">
              <span class="currency">$</span>
              <span class="amount">{tier.price}</span>
              <span class="period">/mo</span>
            </div>
            <ul class="features">
              <li>{tier.apiCallsPerMonth.toLocaleString()} API calls/mo</li>
              <!-- Add more hardcoded features or derived from tier object if available -->
              <li>Standard Support</li>
              {#if tier.id !== 'free'}
                <li>Priority Access</li>
              {/if}
            </ul>
            <div class="action">
              <Button
                variant={tier.id === 'pro' ? 'primary' : 'secondary'}
                disabled={!!processingPriceId}
                onclick={() => (tier.monthlyPriceId ? handleUpgrade(tier.monthlyPriceId) : null)}
              >
                {processingPriceId === tier.monthlyPriceId
                  ? 'Processing...'
                  : tier.price === 0
                    ? 'Current Plan'
                    : 'Upgrade'}
              </Button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    width: 90%;
    max-width: 900px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 32px;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    position: relative;
  }

  .header {
    text-align: center;
    margin-bottom: 32px;
  }

  .header h2 {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
    margin: 0 0 8px 0;
  }

  .header p {
    color: #6b7280;
    margin: 0;
  }

  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    border: none;
    background: none;
    font-size: 24px;
    cursor: pointer;
    color: #9ca3af;
  }

  .close-btn:hover {
    color: #4b5563;
    margin: 0;
  }

  .plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 24px;
  }

  .plan-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    transition: all 0.2s;
  }

  .plan-card.highlight {
    border-color: #3b82f6;
    box-shadow: 0 0 0 1px #3b82f6;
    background-color: #eff6ff;
  }

  .plan-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .plan-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .price {
    display: flex;
    align-items: baseline;
    margin-bottom: 24px;
  }

  .currency {
    font-size: 18px;
    font-weight: 500;
    color: #374151;
  }

  .amount {
    font-size: 36px;
    font-weight: 700;
    color: #111827;
  }

  .period {
    color: #6b7280;
    margin-left: 4px;
  }

  .features {
    list-style: none;
    padding: 0;
    margin: 0 0 24px 0;
    flex-grow: 1;
  }

  .features li {
    margin-bottom: 12px;
    color: #4b5563;
    display: flex;
    align-items: center;
  }

  .features li::before {
    content: '✓';
    color: #10b981;
    margin-right: 8px;
    font-weight: bold;
  }

  .loading,
  .error {
    text-align: center;
    padding: 40px;
    color: #6b7280;
  }
</style>
