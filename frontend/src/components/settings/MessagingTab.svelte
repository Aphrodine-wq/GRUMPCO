<script lang="ts">
  /**
   * MessagingTab – Extracted from TabbedSettingsScreen.svelte (tab: 'messaging')
   * Phase 2 decomposition.
   *
   * TODO: Replace `any` props with explicit types for full type safety.
   */
  import { Card } from '../../lib/design-system';
  import { Link } from 'lucide-svelte';

  interface Props {
    addSubscription: any;
    loadMessagingChannels: any;
    loadMessagingSubscriptions: any;
    messagingChannels: any;
    messagingChannelsLoading: any;
    messagingEnabled: any;
    messagingPhoneNumber: any;
    messagingSaving: any;
    messagingSessionName: any;
    messagingSubscriptions: any;
    newSubPlatform: any;
    newSubUserId: any;
    removeSubscription: any;
    settings: any;
    showToast: any;
    subscribing: any;
  }

  let {
    addSubscription,
    loadMessagingChannels,
    loadMessagingSubscriptions,
    messagingChannels,
    messagingChannelsLoading,
    messagingEnabled,
    messagingPhoneNumber,
    messagingSaving,
    messagingSessionName,
    messagingSubscriptions,
    newSubPlatform,
    newSubUserId,
    removeSubscription,
    settings,
    showToast,
    subscribing,
  }: Props = $props();
</script>

<div class="tab-section messaging-tab">
  <Card title="G-CompN1 Session Messaging" padding="md">
    <p
      style="color: var(--color-text-muted); margin-bottom: 1.25rem; font-size: 0.9rem; line-height: 1.5;"
    >
      Text your G-CompN1 Session from anywhere. Connect via <strong
        >SMS, WhatsApp, Telegram, Discord,</strong
      >
      or <strong>Slack</strong>
      and receive AI-powered responses using your configured model mix.
      <strong style="color: var(--accent, #7c3aed);">Requires Pro tier or above.</strong>
    </p>

    <div class="setting-row" style="margin-bottom: 1.25rem;">
      <div class="setting-info">
        <span class="setting-label">Enable Multi-Channel Messaging</span>
        <span class="setting-desc"
          >Allow sending/receiving messages across all configured channels</span
        >
      </div>
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label class="toggle-switch">
        <input
          type="checkbox"
          bind:checked={messagingEnabled}
          onchange={() => {
            if (messagingEnabled) {
              loadMessagingChannels();
              loadMessagingSubscriptions();
            }
          }}
        />
        <span class="toggle-slider"></span>
      </label>
    </div>

    {#if messagingEnabled}
      <!-- Session Config -->
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div class="setting-row-vertical">
          <label class="setting-label" for="messaging-session-name">Session Name</label>
          <input
            id="messaging-session-name"
            type="text"
            bind:value={messagingSessionName}
            placeholder="G-CompN1 Assistant"
            class="settings-input"
            style="max-width: 400px;"
          />
          <span class="setting-desc">The name shown in messages from your session</span>
        </div>

        <!-- Channel Status Grid -->
        <div style="margin-top: 0.5rem;">
          <span class="setting-label" style="display: block; margin-bottom: 0.75rem;"
            >Available Channels</span
          >
          {#if messagingChannelsLoading}
            <p style="color: var(--color-text-muted); font-size: 0.85rem;">Loading channels…</p>
          {:else if messagingChannels.length === 0}
            <button class="channel-btn" onclick={loadMessagingChannels}>Load channel status</button>
          {:else}
            <div class="channel-grid">
              {#each messagingChannels as ch}
                <div class="channel-card" class:channel-configured={ch.configured}>
                  <div class="channel-card-header">
                    <span class="channel-card-icon">{ch.icon}</span>
                    <span class="channel-card-name">{ch.name}</span>
                    {#if ch.configured}
                      <span class="channel-status-dot configured" title="Connected"></span>
                    {:else}
                      <span class="channel-status-dot" title="Not configured"></span>
                    {/if}
                  </div>
                  <p class="channel-card-desc">{ch.description}</p>
                  {#if ch.configured}
                    <span class="channel-card-badge connected">Connected</span>
                  {:else}
                    <span class="channel-card-badge">Needs setup</span>
                  {/if}
                  <div class="channel-card-webhook">
                    <span class="setting-desc">Webhook: <code>{ch.webhookUrl}</code></span>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Quick Setup Guide -->
        <div style="margin-top: 0.5rem;">
          <span class="setting-label" style="display: block; margin-bottom: 0.5rem;"
            >Quick Setup</span
          >
          <div class="setup-guide">
            <div class="setup-item">
              <strong>SMS / WhatsApp</strong>
              <span
                >Set <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>, and
                <code>TWILIO_WHATSAPP_NUMBER</code>
                in your env. Point Twilio webhook to
                <code>/api/messaging/inbound</code>.</span
              >
            </div>
            <div class="setup-item">
              <strong>Telegram</strong>
              <span
                >Set <code>TELEGRAM_BOT_TOKEN</code> and point webhook to
                <code>/api/messaging/telegram</code>.</span
              >
            </div>
            <div class="setup-item">
              <strong>Discord</strong>
              <span
                >Set <code>DISCORD_BOT_TOKEN</code>. Add bot to server and point interactions URL to
                <code>/api/messaging/discord</code>.</span
              >
            </div>
            <div class="setup-item">
              <strong>Slack</strong>
              <span
                >Set <code>SLACK_BOT_TOKEN</code>. Subscribe to events at
                <code>/api/messaging/slack</code>.</span
              >
            </div>
          </div>
        </div>

        <!-- Subscriptions -->
        <div style="margin-top: 0.5rem;">
          <span class="setting-label" style="display: block; margin-bottom: 0.5rem;"
            >Linked Accounts</span
          >
          <span class="setting-desc" style="display: block; margin-bottom: 0.75rem;"
            >Pair your messaging accounts to receive proactive notifications from your G-CompN1
            Session.</span
          >

          {#if messagingSubscriptions.length > 0}
            <div class="sub-list">
              {#each messagingSubscriptions as sub}
                <div class="sub-item">
                  <span class="sub-platform">{sub.platform}</span>
                  <span class="sub-user-id">{sub.platform_user_id}</span>
                  <button
                    class="sub-remove"
                    onclick={() => removeSubscription(sub.platform, sub.platform_user_id)}>✕</button
                  >
                </div>
              {/each}
            </div>
          {/if}

          <div class="sub-add-row">
            <select class="settings-input" bind:value={newSubPlatform} style="max-width: 160px;">
              <option value="">Platform…</option>
              <option value="telegram">Telegram</option>
              <option value="discord">Discord</option>
              <option value="slack">Slack</option>
              <option value="twilio">SMS/WhatsApp</option>
            </select>
            <input
              type="text"
              class="settings-input"
              placeholder="Chat/User ID"
              bind:value={newSubUserId}
              style="max-width: 220px;"
            />
            <button
              class="save-btn"
              disabled={subscribing || !newSubPlatform || !newSubUserId}
              onclick={addSubscription}
            >
              {subscribing ? 'Linking…' : 'Link Account'}
            </button>
          </div>
        </div>

        <!-- Legacy phone config -->
        <div
          style="margin-top: 0.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border, rgba(255,255,255,0.08));"
        >
          <span class="setting-label" style="display: block; margin-bottom: 0.5rem;"
            >SMS Quick Setup</span
          >
          <div class="setting-row-vertical">
            <label class="setting-label" for="messaging-phone">Your Phone Number</label>
            <input
              id="messaging-phone"
              type="tel"
              bind:value={messagingPhoneNumber}
              placeholder="+1 (555) 123-4567"
              class="settings-input"
              style="max-width: 300px;"
            />
            <span class="setting-desc">The phone number authorized to text this session</span>
          </div>

          <div style="margin-top: 0.75rem;">
            <button
              class="save-btn"
              disabled={messagingSaving || !messagingPhoneNumber}
              onclick={async () => {
                messagingSaving = true;
                try {
                  showToast('Messaging settings saved', 'success');
                } catch {
                  showToast('Failed to save messaging settings', 'error');
                } finally {
                  messagingSaving = false;
                }
              }}
            >
              {messagingSaving ? 'Saving…' : 'Save Messaging Settings'}
            </button>
          </div>
        </div>
      </div>
    {/if}
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

  .messaging-tab .setting-row-vertical {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .messaging-tab .settings-input {
    padding: 0.6rem 0.85rem;
    border-radius: 0.5rem;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    background: var(--color-bg-secondary, #1a1a2e);
    color: var(--color-text, #e0e0e0);
    font-size: 0.9rem;
    outline: none;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
    width: 100%;
  }

  .messaging-tab .settings-input:focus {
    border-color: var(--accent, #7c3aed);
    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15);
  }

  .messaging-tab .channel-btn {
    padding: 0.5rem 1.25rem;
    border-radius: 0.5rem;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    background: var(--color-bg-secondary, #1a1a2e);
    color: var(--color-text-muted, #a0a0b0);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .messaging-tab .channel-btn:hover {
    border-color: var(--accent, #7c3aed);
    color: var(--color-text, #e0e0e0);
  }

  .messaging-tab .save-btn {
    padding: 0.6rem 1.5rem;
    border-radius: 0.5rem;
    border: none;
    background: var(--accent, #7c3aed);
    color: #fff;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      opacity 0.15s,
      transform 0.1s;
  }

  .messaging-tab .save-btn:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .messaging-tab .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .channel-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
  }

  .channel-card {
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    border-radius: 0.75rem;
    padding: 0.85rem;
    background: var(--color-bg-secondary, #1a1a2e);
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .channel-card.channel-configured {
    border-color: rgba(34, 197, 94, 0.3);
    box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.08);
  }

  .channel-card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
  }

  .channel-card-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .channel-card-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text, #e0e0e0);
    flex: 1;
  }

  .channel-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-text-muted, #6b7280);
    flex-shrink: 0;
  }

  .channel-status-dot.configured {
    background: #22c55e;
    box-shadow: 0 0 6px rgba(34, 197, 94, 0.4);
  }

  .channel-card-desc {
    font-size: 0.75rem;
    color: var(--color-text-muted, #a0a0b0);
    margin: 0 0 0.5rem;
    line-height: 1.3;
  }

  .channel-card-badge {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    background: var(--color-bg-card, #1e1e2e);
    color: var(--color-text-muted, #a0a0b0);
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
  }

  .channel-card-badge.connected {
    background: rgba(34, 197, 94, 0.12);
    color: #22c55e;
    border-color: rgba(34, 197, 94, 0.25);
  }

  .channel-card-webhook {
    margin-top: 0.4rem;
  }

  .channel-card-webhook code {
    font-size: 0.7rem;
    font-family: ui-monospace, SFMono-Regular, monospace;
    background: var(--color-bg-card, #1e1e2e);
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
  }

  .setup-guide {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .setup-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.6rem 0.75rem;
    border-radius: 0.5rem;
    background: var(--color-bg-secondary, #1a1a2e);
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.06));
    font-size: 0.8rem;
    color: var(--color-text-muted, #a0a0b0);
    line-height: 1.4;
  }

  .setup-item strong {
    color: var(--color-text, #e0e0e0);
    font-size: 0.85rem;
  }

  .setup-item code {
    font-size: 0.72rem;
    font-family: ui-monospace, SFMono-Regular, monospace;
    background: var(--color-bg-card, #1e1e2e);
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    color: var(--accent, #7c3aed);
  }

  .sub-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-bottom: 0.75rem;
  }

  .sub-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    border-radius: 0.5rem;
    background: var(--color-bg-secondary, #1a1a2e);
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.06));
    font-size: 0.8rem;
  }

  .sub-platform {
    font-weight: 600;
    color: var(--accent, #7c3aed);
    text-transform: capitalize;
    min-width: 80px;
  }

  .sub-user-id {
    flex: 1;
    color: var(--color-text-muted, #a0a0b0);
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub-remove {
    background: none;
    border: none;
    color: var(--color-text-muted, #6b7280);
    cursor: pointer;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-size: 0.8rem;
    transition:
      color 0.12s,
      background 0.12s;
  }

  .sub-remove:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .sub-add-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .sub-add-row select {
    appearance: auto;
  }
</style>
