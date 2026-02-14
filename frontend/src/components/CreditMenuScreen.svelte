<script lang="ts">
  /**
   * CreditMenuScreen - Premium Credits & Pricing dashboard
   * Complete redesign with spread-out tier cards and modern pricing layout
   */
  import { onMount } from 'svelte';
  import {
    ArrowLeft,
    Zap,
    TrendingUp,
    Shield,
    Gem,
    Building2,
    Sparkles,
    Check,
    ExternalLink,
    CreditCard,
  } from 'lucide-svelte';
  import { Button, Card, Badge, Modal } from '../lib/design-system';
  import { fetchApi } from '../lib/api.js';
  import { setCurrentView, showPricing } from '../stores/uiStore';
  import { showToast } from '../stores/toastStore.js';

  interface BillingMe {
    tier?: string | null;
    usage?: number;
    limit?: number | string | null;
    costUsedUsd?: number;
    costLimitUsd?: number | null;
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

  const TIER_THEMES: Record<
    string,
    { gradient: string; icon: typeof Sparkles; accent: string; glow: string }
  > = {
    free: {
      gradient: 'linear-gradient(135deg, #4338ca, #6366f1)',
      icon: Sparkles,
      accent: '#818cf8',
      glow: 'rgba(129, 140, 248, 0.15)',
    },
    starter: {
      gradient: 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
      icon: Gem,
      accent: '#a78bfa',
      glow: 'rgba(167, 139, 250, 0.15)',
    },
    pro: {
      gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)',
      icon: Shield,
      accent: '#c084fc',
      glow: 'rgba(192, 132, 252, 0.2)',
    },
    business: {
      gradient: 'linear-gradient(135deg, #5b21b6, #7c3aed)',
      icon: Building2,
      accent: '#a78bfa',
      glow: 'rgba(167, 139, 250, 0.15)',
    },
    team: {
      gradient: 'linear-gradient(135deg, #4c1d95, #6d28d9)',
      icon: Building2,
      accent: '#8b5cf6',
      glow: 'rgba(139, 92, 246, 0.15)',
    },
  };

  function getTierTheme(tierId: string) {
    return TIER_THEMES[tierId] ?? TIER_THEMES.free;
  }

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
    const u = billingMe?.costUsedUsd ?? billingMe?.usage ?? 0;
    const l = billingMe?.costLimitUsd ?? billingMe?.limit;
    if (typeof l !== 'number' || l <= 0) return 0;
    return Math.min(100, Math.round((u / l) * 100));
  });

  const isLowCredits = $derived.by(() => {
    const u = billingMe?.costUsedUsd ?? billingMe?.usage ?? 0;
    const l = billingMe?.costLimitUsd ?? billingMe?.limit;
    if (typeof l !== 'number' || l <= 0) return false;
    return u >= l || u >= l * 0.8;
  });

  const isExhausted = $derived.by(() => {
    const u = billingMe?.costUsedUsd ?? billingMe?.usage ?? 0;
    const l = billingMe?.costLimitUsd ?? billingMe?.limit;
    if (typeof l !== 'number' || l <= 0) return false;
    return u >= l;
  });

  const useCostDisplay = $derived.by(
    () => typeof billingMe?.costUsedUsd === 'number' || typeof billingMe?.costLimitUsd === 'number'
  );
  const displayUsed = $derived.by(() => {
    if (useCostDisplay && typeof billingMe?.costUsedUsd === 'number') {
      return `$${billingMe.costUsedUsd.toFixed(2)}`;
    }
    return formatCredits(billingMe?.usage);
  });
  const displayLimit = $derived.by(() => {
    if (useCostDisplay && typeof billingMe?.costLimitUsd === 'number') {
      return `$${billingMe.costLimitUsd.toFixed(2)}`;
    }
    if (billingMe?.costLimitUsd == null && billingMe?.limit == null) return '∞';
    return billingMe?.limit ?? '∞';
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

<div class="credit-screen">
  <!-- Header -->
  <header class="credit-header">
    <Button variant="ghost" size="sm" onclick={handleBack} title="Back">
      <ArrowLeft size={16} />
      Back
    </Button>
    <div class="header-content">
      <div class="header-icon">
        <CreditCard size={24} />
      </div>
      <div class="header-text">
        <h1>Credits & Pricing</h1>
        <p class="subtitle">Track usage, manage your plan, and buy more credits</p>
      </div>
    </div>
  </header>

  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading credits…</p>
    </div>
  {:else if error}
    <Card padding="md">
      <p class="error-text">{error}</p>
      <Button variant="secondary" size="sm" onclick={load}>Retry</Button>
    </Card>
  {:else}
    <main class="credit-body">
      <!-- Usage Overview Row -->
      <div class="usage-row">
        <!-- Current Usage Card -->
        <div class="usage-card">
          <div class="usage-card-header">
            <div class="usage-card-icon">
              <Zap size={20} />
            </div>
            <div class="usage-card-title">
              <h3>Current Usage</h3>
              {#if billingMe?.tier}
                <Badge variant="primary">{billingMe.tier}</Badge>
              {/if}
            </div>
          </div>
          {#if billingMe?.tier}
            <div class="usage-stats">
              <div class="usage-numbers">
                <span class="usage-current">{displayUsed}</span>
                <span class="usage-sep">/</span>
                <span class="usage-total">{displayLimit}</span>
                <span class="usage-label"
                  >{useCostDisplay ? 'Usage this month' : 'credits used'}</span
                >
              </div>
              {#if (typeof billingMe?.costLimitUsd === 'number' && billingMe.costLimitUsd > 0) || (typeof billingMe?.limit === 'number' && (billingMe?.limit ?? 0) > 0)}
                <div class="usage-bar-container">
                  <div class="usage-bar">
                    <div
                      class="usage-bar-fill"
                      class:exhausted={isExhausted}
                      class:low={isLowCredits && !isExhausted}
                      style="width: {usagePercent}%"
                    ></div>
                  </div>
                  <span class="usage-percent">{usagePercent}%</span>
                </div>
              {/if}
              <div class="usage-footer">
                <span class="reset-info">Resets {resetDate}</span>
                {#if isExhausted}
                  <span class="exhausted-badge">Exhausted</span>
                {:else if isLowCredits}
                  <span class="low-badge">Running Low</span>
                {/if}
              </div>
            </div>
          {:else}
            <p class="empty-text">Sign in to view usage.</p>
          {/if}
        </div>

        <!-- Quick Actions Card -->
        <div class="quick-actions-card">
          <h3>Quick Actions</h3>
          <div class="quick-actions">
            <Button variant="primary" size="md" onclick={handleBuyCredits}>
              <Zap size={16} />
              {isExhausted ? 'Buy Credits Now' : 'View Plans & Buy Credits'}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onclick={handleManageSubscription}
              disabled={portalLoading}
            >
              <ExternalLink size={16} />
              {portalLoading ? 'Opening…' : 'Manage Subscription'}
            </Button>
          </div>

          <!-- Add-on packs -->
          <div class="addon-section">
            <h4>Add-on Credit Packs</h4>
            <div class="addon-chips">
              <button class="addon-chip" onclick={handleAddonPackClick}>
                <span class="addon-amount">100</span>
                <span class="addon-price">$10</span>
              </button>
              <button class="addon-chip" onclick={handleAddonPackClick}>
                <span class="addon-amount">500</span>
                <span class="addon-price">$40</span>
              </button>
              <button class="addon-chip featured" onclick={handleAddonPackClick}>
                <span class="addon-save">Best Value</span>
                <span class="addon-amount">1,000</span>
                <span class="addon-price">$70</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Usage by Operation -->
      {#if Object.keys(byOperation).length > 0}
        <div class="operations-card">
          <h3>
            <TrendingUp size={18} />
            Usage Breakdown
          </h3>
          <div class="operations-grid">
            {#each Object.entries(byOperation).sort((a, b) => b[1] - a[1]) as [op, count]}
              {@const total = Object.values(byOperation).reduce((s, c) => s + c, 0)}
              {@const pct = total > 0 ? Math.round((count / total) * 100) : 0}
              <div class="op-item">
                <div class="op-header">
                  <span class="op-name">{OPERATION_LABELS[op] ?? op}</span>
                  <span class="op-count">{count} credits</span>
                </div>
                <div class="op-bar">
                  <div class="op-bar-fill" style="width: {pct}%"></div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Pricing Plans -->
      {#if tiers.length > 0}
        <section class="plans-section">
          <div class="plans-header">
            <h2>Choose Your Plan</h2>
            <p>Scale your AI-powered development workflow</p>
          </div>
          <div class="plans-grid">
            {#each tiers.filter((t) => t.id !== 'enterprise') as tier}
              {@const theme = getTierTheme(tier.id)}
              {@const TierIcon = theme.icon}
              {@const isCurrent = billingMe?.tier?.toLowerCase() === tier.name.toLowerCase()}
              {@const isRecommended = tier.id === 'pro'}
              <div
                class="plan-card"
                class:current={isCurrent}
                class:recommended={isRecommended}
                style="--plan-accent: {theme.accent}; --plan-glow: {theme.glow}"
              >
                {#if isRecommended}
                  <div class="plan-badge">Most Popular</div>
                {/if}
                {#if isCurrent}
                  <div class="plan-badge current-badge">Current Plan</div>
                {/if}
                <div class="plan-icon-row">
                  <div class="plan-icon" style="background: {theme.gradient}">
                    <TierIcon size={24} color="white" />
                  </div>
                </div>
                <h3 class="plan-name">{tier.name}</h3>
                <div class="plan-price">
                  {#if tier.priceMonthlyCents === 0}
                    <span class="price-amount">Free</span>
                    <span class="price-note">Forever</span>
                  {:else}
                    <span class="price-currency">$</span>
                    <span class="price-amount">{(tier.priceMonthlyCents / 100).toFixed(0)}</span>
                    <span class="price-period">/mo</span>
                  {/if}
                </div>
                <div class="plan-credits">
                  <Zap size={14} />
                  <span>{tier.creditsPerMonth.toLocaleString()} credits/month</span>
                </div>
                <div class="plan-divider"></div>
                <ul class="plan-features">
                  {#each (tier.features ?? []).slice(0, 6) as feat}
                    <li>
                      <Check size={14} />
                      <span>{feat}</span>
                    </li>
                  {/each}
                </ul>
                <div class="plan-action">
                  {#if isCurrent}
                    <Button variant="secondary" size="md" disabled>Current Plan</Button>
                  {:else if tier.id === 'free'}
                    <Button variant="ghost" size="md" disabled>Free Forever</Button>
                  {:else}
                    <Button
                      variant={isRecommended ? 'primary' : 'secondary'}
                      size="md"
                      onclick={handleBuyCredits}
                    >
                      {isRecommended ? 'Upgrade Now' : 'Select Plan'}
                    </Button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}
    </main>

    <!-- Add-on packs modal -->
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
  .credit-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    padding: 1.5rem;
    width: 100%;
    background: var(--color-bg-app, #fafafa);
  }

  .credit-header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-shrink: 0;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(124, 58, 237, 0.05));
    color: var(--color-primary, #7c3aed);
    border-radius: 12px;
    flex-shrink: 0;
  }

  .credit-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #111827);
    margin: 0;
  }

  .subtitle {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0.125rem 0 0;
  }

  .credit-body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding-bottom: 2rem;
  }

  /* Usage Row */
  .usage-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }

  .usage-card,
  .quick-actions-card {
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 14px;
    padding: 1.25rem;
  }

  .usage-card-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .usage-card-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(124, 58, 237, 0.1);
    color: var(--color-primary, #7c3aed);
    border-radius: 10px;
  }

  .usage-card-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .usage-card-title h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text, #111827);
    margin: 0;
  }

  .usage-stats {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .usage-numbers {
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
  }

  .usage-current {
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-primary, #7c3aed);
    line-height: 1;
  }

  .usage-sep {
    font-size: 1.5rem;
    color: var(--color-text-muted, #9ca3af);
  }

  .usage-total {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-text, #111827);
  }

  .usage-label {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    margin-left: 0.5rem;
  }

  .usage-bar-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .usage-bar {
    flex: 1;
    height: 10px;
    background: var(--color-border, #e5e7eb);
    border-radius: 5px;
    overflow: hidden;
  }

  .usage-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-primary, #7c3aed), #a855f7);
    border-radius: 5px;
    transition: width 0.5s ease;
  }

  .usage-bar-fill.low {
    background: linear-gradient(90deg, #f59e0b, #fbbf24);
  }

  .usage-bar-fill.exhausted {
    background: linear-gradient(90deg, #ef4444, #f87171);
  }

  .usage-percent {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text, #111827);
    min-width: 36px;
    text-align: right;
  }

  .usage-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .reset-info {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
  }

  .exhausted-badge,
  .low-badge {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
  }

  .exhausted-badge {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .low-badge {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
  }

  /* Quick Actions */
  .quick-actions-card h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text, #111827);
    margin: 0 0 1rem;
  }

  .quick-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }

  .addon-section h4 {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    margin: 0 0 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .addon-chips {
    display: flex;
    gap: 0.5rem;
  }

  .addon-chip {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    padding: 0.625rem 0.5rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 10px;
    background: var(--color-bg, #fff);
    cursor: pointer;
    transition: all 0.15s;
    position: relative;
  }

  .addon-chip:hover {
    border-color: var(--color-primary, #7c3aed);
    background: rgba(124, 58, 237, 0.04);
  }

  .addon-chip.featured {
    border-color: var(--color-primary, #7c3aed);
    background: rgba(124, 58, 237, 0.04);
  }

  .addon-save {
    position: absolute;
    top: -8px;
    font-size: 0.5625rem;
    font-weight: 700;
    background: var(--color-primary, #7c3aed);
    color: white;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .addon-amount {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-text, #111827);
  }

  .addon-price {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
  }

  /* Operations */
  .operations-card {
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 14px;
    padding: 1.25rem;
  }

  .operations-card h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text, #111827);
    margin: 0 0 1rem;
  }

  .operations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
  }

  .op-item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .op-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .op-name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text, #374151);
  }

  .op-count {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-primary, #7c3aed);
  }

  .op-bar {
    height: 4px;
    background: var(--color-border, #e5e7eb);
    border-radius: 2px;
    overflow: hidden;
  }

  .op-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-primary, #7c3aed), #a855f7);
    border-radius: 2px;
    transition: width 0.3s;
  }

  /* Plans Section */
  .plans-section {
    padding-top: 0.5rem;
  }

  .plans-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .plans-header h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #111827);
    margin: 0 0 0.25rem;
  }

  .plans-header p {
    font-size: 0.9375rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
  }

  .plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.25rem;
  }

  .plan-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 1.5rem 1.5rem;
    border: 2px solid var(--color-border, #e5e7eb);
    border-radius: 18px;
    background: var(--color-bg, #fff);
    transition: all 0.25s;
  }

  .plan-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px var(--plan-glow, rgba(0, 0, 0, 0.08));
    border-color: var(--plan-accent, #7c3aed);
  }

  .plan-card.recommended {
    border-color: var(--plan-accent, #7c3aed);
    box-shadow: 0 8px 24px var(--plan-glow, rgba(124, 58, 237, 0.15));
  }

  .plan-card.current {
    border-color: var(--plan-accent, #7c3aed);
    background: rgba(124, 58, 237, 0.02);
  }

  .plan-badge {
    position: absolute;
    top: -12px;
    padding: 0.3rem 1rem;
    background: linear-gradient(135deg, var(--plan-accent, #7c3aed), rgba(168, 85, 247, 0.9));
    color: white;
    font-size: 0.6875rem;
    font-weight: 700;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .plan-badge.current-badge {
    background: linear-gradient(135deg, #059669, #10b981);
  }

  .plan-icon-row {
    margin-bottom: 1rem;
  }

  .plan-icon {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .plan-name {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-text, #111827);
    margin: 0 0 0.75rem;
  }

  .plan-price {
    display: flex;
    align-items: baseline;
    gap: 0.125rem;
    margin-bottom: 0.5rem;
  }

  .price-currency {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--plan-accent, #7c3aed);
  }

  .price-amount {
    font-size: 2.5rem;
    font-weight: 800;
    color: var(--plan-accent, #7c3aed);
    line-height: 1;
  }

  .price-period {
    font-size: 1rem;
    font-weight: 500;
    color: var(--color-text-muted, #6b7280);
  }

  .price-note {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    margin-left: 0.25rem;
  }

  .plan-credits {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--plan-accent, #7c3aed);
    margin-bottom: 1rem;
  }

  .plan-divider {
    width: 100%;
    height: 1px;
    background: var(--color-border, #e5e7eb);
    margin-bottom: 1rem;
  }

  .plan-features {
    list-style: none;
    margin: 0 0 1.25rem;
    padding: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .plan-features li {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--color-text, #374151);
  }

  .plan-features li :global(svg) {
    flex-shrink: 0;
    margin-top: 0.125rem;
    color: var(--plan-accent, #059669);
  }

  .plan-action {
    margin-top: auto;
    width: 100%;
  }

  .plan-action :global(button) {
    width: 100%;
  }

  /* Loading */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    gap: 1rem;
    color: var(--color-text-muted, #6b7280);
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border, #e5e7eb);
    border-top-color: var(--color-primary, #7c3aed);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-text {
    color: var(--color-error, #dc2626);
    margin-bottom: 0.75rem;
  }

  .empty-text {
    color: var(--color-text-muted, #6b7280);
    margin: 0;
  }

  .addon-modal-text {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-text-muted, #6b7280);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .usage-row {
      grid-template-columns: 1fr;
    }
    .plans-grid {
      grid-template-columns: 1fr;
      max-width: 360px;
      margin: 0 auto;
    }
  }
</style>
