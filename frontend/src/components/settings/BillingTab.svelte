<script lang="ts">
  /**
   * BillingTab - Subscription, usage, payment methods, and invoices.
   * Extracted from TabbedSettingsScreen.svelte (Phase 2 decomposition).
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
  <Card title="Subscription & Usage" padding="md">
    <div class="billing-status">
      {#if billingMe?.tier}
        <div class="billing-tier-row">
          <span class="status-label">Current plan</span>
          <Badge variant="primary">{billingMe.tier}</Badge>
        </div>
        <div class="billing-usage-dashboard">
          <div class="usage-item">
            <div class="usage-header">
              <span class="usage-label">API / AI calls</span>
              <span class="usage-value"
                >{formatCredits(billingMe.usage)} / {billingMe.limit ?? '∞'}</span
              >
            </div>
            {#if typeof billingMe.limit === 'number' && billingMe.limit > 0}
              <div class="usage-bar">
                <div
                  class="usage-bar-fill"
                  style="width: {Math.min(
                    100,
                    ((Number(billingMe.usage) ?? 0) / billingMe.limit) * 100
                  )}%"
                ></div>
              </div>
            {/if}
          </div>
          {#if billingMe.computeMinutesLimit != null && billingMe.computeMinutesLimit > 0}
            <div class="usage-item">
              <div class="usage-header">
                <span class="usage-label">Compute (min)</span>
                <span class="usage-value"
                  >{(billingMe.computeMinutesUsed ?? 0).toFixed(1)} / {billingMe.computeMinutesLimit}</span
                >
              </div>
              <div class="usage-bar">
                <div
                  class="usage-bar-fill"
                  style="width: {Math.min(
                    100,
                    ((billingMe.computeMinutesUsed ?? 0) / billingMe.computeMinutesLimit) * 100
                  )}%"
                ></div>
              </div>
            </div>
          {/if}
          {#if billingMe.storageGbLimit != null && billingMe.storageGbLimit > 0}
            <div class="usage-item">
              <div class="usage-header">
                <span class="usage-label">Storage (GB)</span>
                <span class="usage-value"
                  >{(billingMe.storageGbUsed ?? 0).toFixed(2)} / {billingMe.storageGbLimit}</span
                >
              </div>
              <div class="usage-bar">
                <div
                  class="usage-bar-fill"
                  style="width: {Math.min(
                    100,
                    ((billingMe.storageGbUsed ?? 0) / billingMe.storageGbLimit) * 100
                  )}%"
                ></div>
              </div>
            </div>
          {/if}
        </div>
        {#if billingMe.overageRates}
          <div class="billing-overages">
            <span class="status-label">Overage rates</span>
            <ul class="overage-list">
              <li>
                Storage: ${(billingMe.overageRates.storageGbMonthlyCents / 100).toFixed(2)}/GB
              </li>
              <li>
                Compute: ${(billingMe.overageRates.computeMinuteCents / 100).toFixed(2)}/min
              </li>
              <li>
                Extra slot: ${(
                  billingMe.overageRates.extraConcurrentAgentMonthlyCents / 100
                ).toFixed(2)}/slot
              </li>
            </ul>
          </div>
        {/if}
        {#if tiers.length > 0}
          <p class="billing-tiers-note">
            {tiers.length} plan(s) available. Upgrade for more.
          </p>
        {/if}
      {:else}
        <p class="billing-empty">Sign in to view your subscription details.</p>
      {/if}
    </div>
    <div class="field-group billing-alert-field">
      <label class="field-label" for="usage-alert-percent"
        >Alert when usage exceeds % of limit</label
      >
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
      <p class="field-hint">
        Show a warning when API/usage reaches this percent of your plan limit. Leave empty to
        disable.
      </p>
    </div>
    <div class="billing-actions">
      <Button variant="primary" size="sm" onclick={() => showPricing.set(true)}>Upgrade</Button>
      <Button
        variant="secondary"
        size="sm"
        onclick={() => {
          setCurrentView('cost');
        }}
      >
        Cost Dashboard
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onclick={() => window.open(billingUrl, '_blank')}
        title="Open external billing portal if configured"
      >
        Billing portal
      </Button>
    </div>
  </Card>

  <Card title="Payment methods" padding="md">
    <p class="section-desc">Manage payment methods for your subscription in the billing portal.</p>
    {#if billingPaymentMethods.length > 0}
      <ul class="billing-list">
        {#each billingPaymentMethods as pm}
          <li class="billing-list-item">
            <span>{pm.brand ?? 'Card'} •••• {pm.last4 ?? '----'}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="billing-empty">No payment methods on file. Add one when upgrading.</p>
    {/if}
    <Button
      variant="secondary"
      size="sm"
      onclick={handleBillingPortalClick}
      disabled={billingPortalLoading}
    >
      {billingPortalLoading ? 'Opening…' : 'Open billing portal'}
    </Button>
  </Card>

  <Card title="Invoices" padding="md">
    <p class="section-desc">Download past invoices from the billing portal.</p>
    {#if billingInvoices.length > 0}
      <ul class="billing-list">
        {#each billingInvoices as inv}
          <li class="billing-list-item">
            <span>{inv.date}</span>
            <span>${(inv.amount / 100).toFixed(2)}</span>
            <Badge variant={inv.status === 'paid' ? 'success' : 'default'}>{inv.status}</Badge>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="billing-empty">No invoices yet.</p>
    {/if}
    <Button
      variant="secondary"
      size="sm"
      onclick={handleBillingPortalClick}
      disabled={billingPortalLoading}
    >
      {billingPortalLoading ? 'Opening…' : 'Open billing portal'}
    </Button>
  </Card>

  <Card title="Add-On Credit Usage" padding="md">
    <p class="section-desc">
      Credits used by add-ons and platform features (AI calls, compute, storage).
    </p>
    <div class="billing-status">
      {#if billingMe?.tier}
        <div class="status-row">
          <span class="status-label">API / AI calls</span>
          <span class="status-value"
            >{formatCredits(billingMe.usage)} / {billingMe.limit ?? '∞'} credits</span
          >
        </div>
        {#if billingMe.computeMinutesLimit != null}
          <div class="status-row">
            <span class="status-label">Compute minutes</span>
            <span class="status-value"
              >{(billingMe.computeMinutesUsed ?? 0).toFixed(1)} / {billingMe.computeMinutesLimit}
              min</span
            >
          </div>
        {/if}
        {#if billingMe.storageGbLimit != null}
          <div class="status-row">
            <span class="status-label">Storage</span>
            <span class="status-value"
              >{(billingMe.storageGbUsed ?? 0).toFixed(2)} / {billingMe.storageGbLimit} GB</span
            >
          </div>
        {/if}
      {:else}
        <p class="billing-empty">Sign in to view add-on credit usage.</p>
      {/if}
    </div>
  </Card>
</div>

<style>

.tab-section {
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

.tab-section :global(.card) {
    border: 1px solid #e5e7eb;
  }

.default-model-row .field-label {
    flex-shrink: 0;
  }

.advanced-finetuning .field-label {
    display: block;
    margin-bottom: 0.5rem;
  }

.settings-number-input,
  .settings-text-input {
    max-width: 200px;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.5rem;
    background: var(--color-bg-card, #fff);
  }

.inline-config-input-group .field-label {
    margin-bottom: 0.5rem;
  }

.models-custom-inner .section-desc {
    margin-bottom: 0.75rem;
  }

.section-desc {
    font-size: 14px;
    color: var(--color-text-muted, #71717a);
    margin-bottom: 20px;
  }

.field-group {
    margin-bottom: 20px;
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

.field-label-row .field-label {
    margin-bottom: 0;
  }

.field-hint {
    font-size: 12px;
    color: var(--color-text-muted, #a1a1aa);
    margin-top: 6px;
  }

.field-hint code {
    font-size: 0.75em;
    padding: 0.1em 0.35em;
    background: var(--color-bg-card, #f4f4f5);
    border-radius: 4px;
  }

.billing-status {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }

.billing-tier-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 4px;
  }

.billing-usage-dashboard {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

.usage-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

.usage-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

.usage-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-muted, #71717a);
  }

.usage-value {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }

.usage-bar {
    height: 8px;
    background: var(--color-bg-subtle, #f3f4f6);
    border-radius: 4px;
    overflow: hidden;
  }

.usage-bar-fill {
    height: 100%;
    background: var(--color-primary, #7c3aed);
    border-radius: 4px;
    transition: width 0.2s ease;
  }

.billing-overages {
    margin-top: 4px;
  }

.billing-overages .status-label {
    display: block;
    margin-bottom: 6px;
  }

.overage-list {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
  }

.overage-list li {
    padding: 2px 0;
  }

.billing-tiers-note {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
    margin: 0;
  }

.status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background-color: var(--color-bg-card, #f9fafb);
    border-radius: 8px;
  }

.status-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-muted, #71717a);
  }

.status-value {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }

.billing-empty {
    font-size: 14px;
    color: var(--color-text-muted, #71717a);
    font-style: italic;
    margin-bottom: 16px;
  }

.billing-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

.billing-list-item {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: var(--color-text, #18181b);
  }

.billing-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

.billing-usage-dashboard {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
    margin: 1rem 0;
  }

.usage-item {
    background: var(--color-bg-secondary, #f9fafb);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.75rem;
    padding: 1rem;
  }

.usage-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

.usage-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-muted, #71717a);
  }

.usage-value {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-text, #18181b);
    font-variant-numeric: tabular-nums;
  }

.usage-bar {
    height: 6px;
    background: var(--color-border, #e5e7eb);
    border-radius: 3px;
    overflow: hidden;
  }

.usage-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-primary, #7c3aed), #a78bfa);
    border-radius: 3px;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

.billing-tier-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.25rem;
  }

.billing-overages {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: var(--color-bg-secondary, #f9fafb);
    border-radius: 0.5rem;
    border: 1px solid var(--color-border, #e5e7eb);
  }

.overage-list {
    margin: 0.375rem 0 0;
    padding-left: 1.25rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
    line-height: 1.6;
  }

.billing-tiers-note {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
    margin-top: 0.75rem;
  }

.billing-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border, #e5e7eb);
  }

.billing-alert-field {
    margin-top: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border, #e5e7eb);
  }

.billing-list {
    margin: 0.5rem 0;
    padding: 0;
    list-style: none;
  }

.billing-list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    font-size: 0.8125rem;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
  }

.billing-list-item:last-child {
    border-bottom: none;
  }

.billing-empty {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
    font-style: italic;
    padding: 0.5rem 0;
  }
</style>
