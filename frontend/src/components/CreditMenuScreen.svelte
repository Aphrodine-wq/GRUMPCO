<script lang="ts">
  /**
   * CreditMenuScreen - Credits view with usage, buy credits CTA, tier comparison
   */
  import { onMount } from 'svelte';
  import { ArrowLeft, Zap, TrendingUp } from 'lucide-svelte';
  import { Button, Card, Badge, Modal } from '../lib/design-system';
  import { fetchApi } from '../lib/api.js';
  import { setCurrentView, showPricing } from '../stores/uiStore';
  import { showToast } from '../stores/toastStore.js';

  interface BillingMe {
    tier?: string | null;
    usage?: number;
    limit?: number | string | null;
    computeMinutesUsed?: number;
    computeMinutesLimit?: number | null;
    storageGbUsed?: number;
    storageGbLimit?: number | null;
    overageRates?: Record<string, number>;
  }

  interface Tier {
    id: string;
    name: string;
    priceMonthlyCents: number;
    creditsPerMonth: number;
    features: string[];
  }

  interface TiersResponse {
    tiers: Tier[];
  }

  interface UsageResponse {
    byOperation: Record<string, number>;
  }

  const OPERATION_LABELS: Record<string, string> = {
    chat: 'Chat',
    architecture: 'Architecture',
    intent: 'Intent',
    prd: 'PRD',
    plan: 'Plan',
    ship: 'Ship',
    codegen: 'Codegen',
    swarm_run: 'Swarm',
    other: 'Other',
  };

  let { onBack }: { onBack?: () => void } = $props();

  let billingMe = $state<BillingMe | null>(null);
  let tiers = $state<Tier[]>([]);
  let byOperation = $state<Record<string, number>>({});
  let loading = $state(true);
  let error = $state<string | null>(null);
  let portalLoading = $state(false);
  let showAddonModal = $state(false);

  function getResetDate() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const resetDate = getResetDate();

  function formatCredits(u: number | null | undefined): string {
    const n = u ?? 0;
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(4).replace(/\.?0+$/, '');
  }

  const usagePercent = $derived.by(() => {
    const u = billingMe?.usage ?? 0;
    const l = billingMe?.limit;
    if (typeof l !== 'number' || l <= 0) return 0;
    return Math.min(100, Math.round((u / l) * 100));
  });

  const isLowCredits = $derived.by(() => {
    const u = billingMe?.usage ?? 0;
    const l = billingMe?.limit;
    if (typeof l !== 'number' || l <= 0) return false;
    return u >= l || u >= l * 0.8;
  });

  const isExhausted = $derived.by(() => {
    const u = billingMe?.usage ?? 0;
    const l = billingMe?.limit;
    if (typeof l !== 'number' || l <= 0) return false;
    return u >= l;
  });

  async function load() {
    loading = true;
    error = null;
    try {
      const [meRes, tiersRes, usageRes] = await Promise.all([
        fetchApi('/api/billing/me'),
        fetchApi('/api/billing/tiers'),
        fetchApi('/api/billing/usage'),
      ]);

      billingMe = (await meRes.json()) as BillingMe;
      const tiersData = (await tiersRes.json()) as TiersResponse;
      tiers = tiersData.tiers ?? [];
      const usageData = (await usageRes.json()) as UsageResponse;
      byOperation = usageData.byOperation ?? {};
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(() => load());

  function handleBack() {
    onBack?.() ?? setCurrentView('chat');
  }

  function handleBuyCredits() {
    showPricing.set(true);
  }

  async function handleManageSubscription() {
    portalLoading = true;
    try {
      const returnUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname || '/'}#credits`
          : undefined;
      const res = await fetchApi('/api/billing/portal-session', {
        method: 'POST',
        body: JSON.stringify({ returnUrl }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        showToast(data.error ?? 'Billing portal unavailable', 'error');
      }
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to open billing portal', 'error');
    } finally {
      portalLoading = false;
    }
  }

  function handleAddonPackClick() {
    showAddonModal = true;
  }
</script>

<div class="credit-menu-screen">
  <header class="credit-header">
    <Button variant="ghost" size="sm" onclick={handleBack} title="Back">
      <ArrowLeft size={16} />
      Back
    </Button>
    <div class="header-text">
      <h1>Credits</h1>
      <p class="subtitle">Track usage, buy more credits, and manage your plan</p>
    </div>
  </header>

  {#if loading}
    <div class="loading-state">
      <p>Loading credits…</p>
    </div>
  {:else if error}
    <Card padding="md">
      <p class="error-text">{error}</p>
      <Button variant="secondary" size="sm" onclick={load}>Retry</Button>
    </Card>
  {:else}
    <main class="credit-main">
      <section class="buy-credits-section" class:urgent={isExhausted}>
        <div class="buy-credits-card">
          <div class="buy-credits-icon">
            <Zap size={28} strokeWidth={2} />
          </div>
          <div class="buy-credits-content">
            <h2>
              {isExhausted
                ? "You're out of credits"
                : isLowCredits
                  ? 'Running low on credits'
                  : 'Buy additional credits'}
            </h2>
            <p>
              {isExhausted
                ? 'Upgrade your plan or add a credit pack to keep using G-Rump.'
                : isLowCredits
                  ? 'Consider upgrading to avoid interruption. Plans include more credits each month.'
                  : 'Need more capacity? View plans and credit packs.'}
            </p>
          </div>
          <div class="buy-credits-actions">
            <Button variant="primary" size="md" onclick={handleBuyCredits}>
              {isExhausted ? 'Buy Credits' : 'View Plans & Buy Credits'}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onclick={handleManageSubscription}
              disabled={portalLoading}
            >
              {portalLoading ? 'Opening…' : 'Manage subscription'}
            </Button>
          </div>
        </div>
      </section>

      <Card padding="md" class="usage-card">
        <h3 class="card-title">Current Usage</h3>
        {#if billingMe?.tier}
          <div class="usage-hero">
            <div class="usage-stats">
              <span class="usage-value">{formatCredits(billingMe?.usage)}</span>
              <span class="usage-sep">/</span>
              <span class="usage-limit">{billingMe.limit ?? '∞'}</span>
              <span class="usage-unit">credits</span>
            </div>
            {#if typeof billingMe.limit === 'number' && billingMe.limit > 0}
              <div class="usage-bar">
                <div
                  class="usage-bar-fill"
                  class:exhausted={isExhausted}
                  class:low={isLowCredits && !isExhausted}
                  style="width: {usagePercent}%"
                ></div>
              </div>
            {/if}
            <div class="usage-meta">
              <Badge variant="primary">{billingMe.tier}</Badge>
              <span class="reset-date">Resets {resetDate}</span>
            </div>
          </div>
        {:else}
          <p class="empty-text">Sign in to view usage.</p>
        {/if}
      </Card>

      <!-- Usage by operation -->
      {#if Object.keys(byOperation).length > 0}
        <Card padding="md">
          <h3 class="card-title">
            <TrendingUp size={18} strokeWidth={2} />
            Usage by Operation
          </h3>
          <div class="by-operation">
            {#each Object.entries(byOperation).sort((a, b) => b[1] - a[1]) as [op, count]}
              <div class="op-row">
                <span class="op-label">{OPERATION_LABELS[op] ?? op}</span>
                <span class="op-count">{count}</span>
              </div>
            {/each}
          </div>
        </Card>
      {/if}

      <!-- Add-on credit packs - pressable buttons -->
      <Card padding="md">
        <h3 class="card-title">Add-on credit packs</h3>
        <p class="addon-desc">Need extra credits when you run out of your monthly allocation?</p>
        <div class="addon-buttons">
          <Button variant="secondary" size="md" onclick={handleAddonPackClick}>
            100 credits – $10
          </Button>
          <Button variant="secondary" size="md" onclick={handleAddonPackClick}>
            500 credits – $40
          </Button>
          <Button variant="secondary" size="md" onclick={handleAddonPackClick}>
            1,000 credits – $70
          </Button>
        </div>
      </Card>

      <!-- Plans -->
      {#if tiers.length > 0}
        <Card padding="md">
          <h3 class="card-title">Plans</h3>
          <div class="tier-grid">
            {#each tiers.filter((t) => t.id !== 'enterprise') as tier}
              <div
                class="tier-card"
                class:current={billingMe?.tier?.toLowerCase() === tier.name.toLowerCase()}
              >
                <div class="tier-name">{tier.name}</div>
                <div class="tier-price">
                  {#if tier.priceMonthlyCents === 0}
                    Free
                  {:else}
                    ${(tier.priceMonthlyCents / 100).toFixed(2)}/mo
                  {/if}
                </div>
                <div class="tier-credits">{tier.creditsPerMonth} credits/mo</div>
                <ul class="tier-features">
                  {#each (tier.features ?? []).slice(0, 4) as feat}
                    <li>{feat}</li>
                  {/each}
                </ul>
                {#if tier.id !== 'free'}
                  <Button variant="primary" size="sm" onclick={handleBuyCredits}>Upgrade</Button>
                {/if}
              </div>
            {/each}
          </div>
        </Card>
      {/if}
    </main>

    <!-- Add-on packs modal: open billing portal -->
    <Modal
      bind:open={showAddonModal}
      title="Add-on credit packs"
      description="Buy 100, 500, or 1,000 credits on demand."
      size="sm"
    >
      <p class="addon-modal-text">
        Add-on packs are available in the billing portal. Open the portal to purchase credits when
        you need them.
      </p>
      {#snippet footer()}
        <Button
          variant="primary"
          size="sm"
          onclick={async () => {
            showAddonModal = false;
            await handleManageSubscription();
          }}
          disabled={portalLoading}
        >
          {portalLoading ? 'Opening…' : 'Open billing portal'}
        </Button>
        <Button variant="ghost" size="sm" onclick={() => (showAddonModal = false)}>Cancel</Button>
      {/snippet}
    </Modal>
  {/if}
</div>

<style>
  .credit-menu-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    padding: 1.5rem;
    width: 100%;
  }

  .credit-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .header-text {
    flex: 1;
  }

  .credit-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #111827);
    margin: 0 0 0.25rem;
  }

  .subtitle {
    font-size: 0.9375rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
  }

  .credit-main {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
    min-width: 0;
  }

  .buy-credits-section {
    flex-shrink: 0;
  }

  .buy-credits-section.urgent .buy-credits-card {
    border-color: var(--color-error, #ef4444);
    background: var(--color-error-subtle, rgba(239, 68, 68, 0.06));
  }

  .buy-credits-card {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.25rem 1.5rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.04), rgba(124, 58, 237, 0.02));
  }

  .buy-credits-icon {
    flex-shrink: 0;
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(124, 58, 237, 0.12);
    color: var(--color-primary, #7c3aed);
    border-radius: 12px;
  }

  .buy-credits-content {
    flex: 1;
    min-width: 0;
  }

  .buy-credits-content h2 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.25rem;
    color: var(--color-text, #111827);
  }

  .buy-credits-content p {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
  }

  .buy-credits-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .addon-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .addon-modal-text {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-text-muted, #6b7280);
  }

  @media (max-width: 768px) {
    .buy-credits-card {
      flex-direction: column;
      align-items: stretch;
    }
    .buy-credits-actions {
      flex-direction: column;
    }
  }

  .addon-desc {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0 0 1rem;
  }

  .card-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    margin: 0 0 1rem;
    color: var(--color-text, #111827);
  }

  .usage-hero {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .usage-stats {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #111827);
  }

  .usage-value {
    color: var(--color-primary, #7c3aed);
  }

  .usage-sep {
    color: var(--color-text-muted, #9ca3af);
    margin: 0 0.25rem;
  }

  .usage-unit {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-text-muted, #6b7280);
    margin-left: 0.25rem;
  }

  .usage-bar {
    height: 8px;
    background: var(--color-border, #e5e7eb);
    border-radius: 4px;
    overflow: hidden;
  }

  .usage-bar-fill {
    height: 100%;
    background: var(--color-primary, #7c3aed);
    border-radius: 4px;
    transition:
      width 0.3s ease,
      background 0.2s;
  }

  .usage-bar-fill.low {
    background: #f59e0b;
  }

  .usage-bar-fill.exhausted {
    background: #ef4444;
  }

  .usage-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .reset-date {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
  }

  .loading-state {
    padding: 2rem;
    text-align: center;
    color: var(--color-text-muted, #6b7280);
  }

  .error-text {
    color: var(--color-error, #dc2626);
    margin-bottom: 0.75rem;
  }

  .empty-text {
    color: var(--color-text-muted, #6b7280);
    margin: 0;
  }

  .by-operation {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .op-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
  }

  .op-row:last-child {
    border-bottom: none;
  }

  .op-label {
    font-size: 0.875rem;
    color: var(--color-text, #374151);
  }

  .op-count {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-primary, #7c3aed);
  }

  .tier-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1.25rem;
  }

  .tier-card {
    padding: 1.25rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tier-card.current {
    border-color: var(--color-primary, #7c3aed);
    background: rgba(124, 58, 237, 0.06);
  }

  .tier-name {
    font-weight: 600;
    font-size: 1rem;
    color: var(--color-text, #111827);
  }

  .tier-price {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-primary, #7c3aed);
  }

  .tier-credits {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
  }

  .tier-features {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0.5rem 0 0;
    padding-left: 1rem;
    list-style: disc;
  }

  .tier-features li {
    margin-bottom: 0.25rem;
  }
</style>
