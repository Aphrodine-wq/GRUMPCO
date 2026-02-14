<script lang="ts">
  /**
   * BillingTab - Subscription, usage, payment methods, and invoices.
   * Professional redesign with premium plan banner, polished stat cards,
   * formatted payment method cards, and invoice tables.
   */
  import { Card, Badge, Button } from '../../lib/design-system';
  import { showPricing } from '../../stores/uiStore';
  import { setCurrentView } from '../../stores/uiStore';
  import { showToast } from '../../stores/toastStore';
  import { fetchApi } from '../../lib/api.js';
  import {
    formatCredits,
    type BillingMe,
    type Tier,
    type PaymentMethod,
    type Invoice,
  } from './settingsTypes';
  import type { Settings } from '../../types/settings';

  interface Props {
    billingMe: BillingMe | null;
    tiers: Tier[];
    billingPaymentMethods: PaymentMethod[];
    billingInvoices: Invoice[];
    billingUrl: string;
    settings: Settings | null;
    savePreferences: (next: import('../../types/settings').SettingsPreferences) => Promise<void>;
  }

  let {
    billingMe,
    tiers,
    billingPaymentMethods,
    billingInvoices,
    billingUrl,
    settings,
    savePreferences,
  }: Props = $props();

  let billingPortalLoading = $state(false);

  function getUsagePercent(used: number, limit: number): number {
    if (limit <= 0) return 0;
    return Math.min(100, (used / limit) * 100);
  }

  function getBarColor(pct: number): string {
    if (pct >= 90) return '#ef4444';
    if (pct >= 70) return '#f59e0b';
    return 'var(--color-primary, #7c3aed)';
  }

  async function handleBillingPortalClick() {
    billingPortalLoading = true;
    try {
      const returnUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname || '/'}#settings`
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
        if (billingUrl && billingUrl !== '#') window.open(billingUrl, '_blank');
      }
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to open billing portal', 'error');
      if (billingUrl && billingUrl !== '#') window.open(billingUrl, '_blank');
    } finally {
      billingPortalLoading = false;
    }
  }
</script>

<div class="tab-section billing-tab">
  <!-- Premium Plan Banner -->
  <div class="plan-banner">
    <div class="plan-banner-content">
      <div class="plan-banner-left">
        <div class="plan-badge-row">
          <span class="plan-icon">⚡</span>
          <span class="plan-name">{billingMe?.tier ?? 'Free'}</span>
          {#if billingMe?.tier}
            <Badge variant="primary">Active</Badge>
          {:else}
            <Badge variant="default">No plan</Badge>
          {/if}
        </div>
        <p class="plan-tagline">
          {#if billingMe?.tier === 'pro' || billingMe?.tier === 'enterprise'}
            Full access to all AI models, unlimited compute, and priority support.
          {:else}
            Upgrade to unlock unlimited AI calls, compute, and premium features.
          {/if}
        </p>
      </div>
      <div class="plan-banner-actions">
        <Button variant="primary" size="sm" onclick={() => showPricing.set(true)}>
          {billingMe?.tier ? 'Change plan' : 'Upgrade now'}
        </Button>
        <Button variant="ghost" size="sm" onclick={() => setCurrentView('cost')}>
          Cost Dashboard
        </Button>
      </div>
    </div>
  </div>

  <!-- Usage Stats Grid -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-icon">🤖</span>
        <span class="stat-title">AI Calls</span>
      </div>
      <div class="stat-value">{formatCredits(billingMe?.usage ?? 0)}</div>
      <div class="stat-limit">of {billingMe?.limit ?? '∞'} credits</div>
      {#if typeof billingMe?.limit === 'number' && billingMe.limit > 0}
        {@const pct = getUsagePercent(Number(billingMe.usage ?? 0), billingMe.limit)}
        <div class="stat-bar">
          <div class="stat-bar-fill" style="width: {pct}%; background: {getBarColor(pct)}"></div>
        </div>
      {/if}
    </div>
    {#if billingMe?.computeMinutesLimit != null && billingMe.computeMinutesLimit > 0}
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-icon">⏱️</span>
          <span class="stat-title">Compute</span>
        </div>
        <div class="stat-value">{(billingMe.computeMinutesUsed ?? 0).toFixed(1)} min</div>
        <div class="stat-limit">of {billingMe.computeMinutesLimit} min</div>
        <div class="stat-bar">
          <div
            class="stat-bar-fill"
            style="width: {getUsagePercent(
              billingMe.computeMinutesUsed ?? 0,
              billingMe.computeMinutesLimit
            )}%; background: {getBarColor(
              getUsagePercent(billingMe.computeMinutesUsed ?? 0, billingMe.computeMinutesLimit)
            )}"
          ></div>
        </div>
      </div>
    {/if}
    {#if billingMe?.storageGbLimit != null && billingMe.storageGbLimit > 0}
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-icon">💾</span>
          <span class="stat-title">Storage</span>
        </div>
        <div class="stat-value">{(billingMe.storageGbUsed ?? 0).toFixed(2)} GB</div>
        <div class="stat-limit">of {billingMe.storageGbLimit} GB</div>
        <div class="stat-bar">
          <div
            class="stat-bar-fill"
            style="width: {getUsagePercent(
              billingMe.storageGbUsed ?? 0,
              billingMe.storageGbLimit
            )}%; background: {getBarColor(
              getUsagePercent(billingMe.storageGbUsed ?? 0, billingMe.storageGbLimit)
            )}"
          ></div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Usage Alert Setting -->
  <Card title="Usage Alerts" padding="md">
    <div class="field-group">
      <label class="field-label" for="usage-alert-percent"> Warn when usage exceeds </label>
      <div class="alert-input-row">
        <input
          id="usage-alert-percent"
          type="number"
          min="0"
          max="100"
          step="5"
          class="settings-number-input"
          value={settings?.preferences?.usageAlertPercent ?? ''}
          onchange={(e) => {
            const v = parseInt((e.target as HTMLInputElement).value, 10);
            if (!Number.isNaN(v) && v >= 0 && v <= 100) savePreferences({ usageAlertPercent: v });
            else if ((e.target as HTMLInputElement).value === '')
              savePreferences({ usageAlertPercent: undefined });
          }}
          placeholder="80"
        />
        <span class="alert-suffix">% of plan limit</span>
      </div>
      <p class="field-hint">
        Show a warning when API/usage reaches this percent of your plan limit. Leave empty to
        disable.
      </p>
    </div>
  </Card>

  <!-- Overage Rates -->
  {#if billingMe?.overageRates}
    <Card title="Overage Rates" padding="md">
      <p class="section-desc">Charges applied when you exceed your plan limits.</p>
      <div class="overage-grid">
        <div class="overage-item">
          <span class="overage-label">Storage</span>
          <span class="overage-price"
            >${(billingMe.overageRates.storageGbMonthlyCents / 100).toFixed(2)}<span
              class="overage-unit">/GB/mo</span
            ></span
          >
        </div>
        <div class="overage-item">
          <span class="overage-label">Compute</span>
          <span class="overage-price"
            >${(billingMe.overageRates.computeMinuteCents / 100).toFixed(2)}<span
              class="overage-unit">/min</span
            ></span
          >
        </div>
        <div class="overage-item">
          <span class="overage-label">Extra agent slot</span>
          <span class="overage-price"
            >${(billingMe.overageRates.extraConcurrentAgentMonthlyCents / 100).toFixed(2)}<span
              class="overage-unit">/slot/mo</span
            ></span
          >
        </div>
      </div>
    </Card>
  {/if}

  <!-- Payment Methods -->
  <Card title="Payment Methods" padding="md">
    {#if billingPaymentMethods.length > 0}
      <div class="payment-cards">
        {#each billingPaymentMethods as pm}
          <div class="payment-card">
            <div class="card-brand-icon">
              {#if pm.brand?.toLowerCase() === 'visa'}💳
              {:else if pm.brand?.toLowerCase() === 'mastercard'}💳
              {:else}💳{/if}
            </div>
            <div class="card-details">
              <span class="card-brand">{pm.brand ?? 'Card'}</span>
              <span class="card-last4">•••• •••• •••• {pm.last4 ?? '----'}</span>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="billing-empty">No payment methods on file. Add one when upgrading.</p>
    {/if}
    <div class="card-action-row">
      <Button
        variant="secondary"
        size="sm"
        onclick={handleBillingPortalClick}
        disabled={billingPortalLoading}
      >
        {billingPortalLoading ? 'Opening…' : 'Manage in billing portal'}
      </Button>
    </div>
  </Card>

  <!-- Invoices -->
  <Card title="Invoices" padding="md">
    {#if billingInvoices.length > 0}
      <div class="invoice-table-wrap">
        <table class="invoice-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {#each billingInvoices as inv}
              <tr>
                <td>{inv.date}</td>
                <td class="amount-cell">${(inv.amount / 100).toFixed(2)}</td>
                <td>
                  <Badge variant={inv.status === 'paid' ? 'success' : 'default'}>{inv.status}</Badge
                  >
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="billing-empty">No invoices yet.</p>
    {/if}
    <div class="card-action-row">
      <Button
        variant="secondary"
        size="sm"
        onclick={handleBillingPortalClick}
        disabled={billingPortalLoading}
      >
        {billingPortalLoading ? 'Opening…' : 'View all in billing portal'}
      </Button>
    </div>
  </Card>
</div>

<style>
  .tab-section {
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .tab-section :global(.card) {
    border: 1px solid var(--color-border, #e5e7eb);
  }

  /* ---- Plan Banner ---- */
  .plan-banner {
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4c1d95 100%);
    border-radius: 1rem;
    padding: 1.5rem;
    color: white;
  }

  .plan-banner-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .plan-badge-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .plan-icon {
    font-size: 1.25rem;
  }

  .plan-name {
    font-size: 1.25rem;
    font-weight: 700;
    text-transform: capitalize;
  }

  .plan-tagline {
    font-size: 0.8125rem;
    opacity: 0.85;
    margin: 0;
  }

  .plan-banner-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .plan-banner-actions :global(.btn) {
    border-color: rgba(255, 255, 255, 0.3) !important;
  }

  .plan-banner-actions :global(.btn-ghost) {
    color: white !important;
  }

  /* ---- Stats Grid ---- */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }

  .stat-card {
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.75rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .stat-icon {
    font-size: 1rem;
  }

  .stat-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #71717a);
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #18181b);
    font-variant-numeric: tabular-nums;
  }

  .stat-limit {
    font-size: 0.75rem;
    color: var(--color-text-muted, #a1a1aa);
  }

  .stat-bar {
    height: 6px;
    background: var(--color-border, #e5e7eb);
    border-radius: 3px;
    margin-top: 0.5rem;
    overflow: hidden;
  }

  .stat-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* ---- Fields ---- */
  .field-group {
    margin-bottom: 16px;
  }

  .field-group:last-child {
    margin-bottom: 0;
  }

  .field-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary, #3f3f46);
    margin-bottom: 8px;
  }

  .field-hint {
    font-size: 12px;
    color: var(--color-text-muted, #a1a1aa);
    margin-top: 6px;
  }

  .settings-number-input {
    max-width: 100px;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.5rem;
    background: var(--color-bg-card, #fff);
  }

  .alert-input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .alert-suffix {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
  }

  .section-desc {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
    margin-bottom: 1rem;
  }

  /* ---- Overage Grid ---- */
  .overage-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.75rem;
  }

  .overage-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: var(--color-bg-secondary, #f9fafb);
    border-radius: 0.5rem;
    border: 1px solid var(--color-border, #e5e7eb);
  }

  .overage-label {
    font-size: 0.8125rem;
    color: var(--color-text-secondary, #3f3f46);
    font-weight: 500;
  }

  .overage-price {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-text, #18181b);
    font-variant-numeric: tabular-nums;
  }

  .overage-unit {
    font-weight: 400;
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
  }

  /* ---- Payment Cards ---- */
  .payment-cards {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .payment-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--color-bg-secondary, #f9fafb);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.5rem;
  }

  .card-brand-icon {
    font-size: 1.25rem;
  }

  .card-details {
    display: flex;
    flex-direction: column;
  }

  .card-brand {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
    text-transform: capitalize;
  }

  .card-last4 {
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
    font-family: ui-monospace, monospace;
    letter-spacing: 0.05em;
  }

  .card-action-row {
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border, #e5e7eb);
  }

  /* ---- Invoice Table ---- */
  .invoice-table-wrap {
    overflow-x: auto;
    margin-bottom: 0.5rem;
  }

  .invoice-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }

  .invoice-table th {
    text-align: left;
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #71717a);
    padding: 0.625rem 0.75rem;
    border-bottom: 2px solid var(--color-border, #e5e7eb);
  }

  .invoice-table td {
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid var(--color-border, #f4f4f5);
    color: var(--color-text, #18181b);
  }

  .invoice-table tbody tr:hover {
    background: var(--color-bg-secondary, #f9fafb);
  }

  .amount-cell {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .billing-empty {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
    font-style: italic;
    padding: 0.5rem 0;
  }
</style>
