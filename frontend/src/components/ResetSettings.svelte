<script lang="ts">
  /**
   * Factory reset: full reset with optional export before reset.
   */
  import { Button, Card } from '$lib/design-system';
  import { showToast } from '../stores/toastStore';

  interface Props {
    onBack?: () => void;
    onReset?: () => void;
  }

  let { onBack, onReset }: Props = $props();

  let confirmText = $state('');
  let exporting = $state(false);

  function handleExport() {
    exporting = true;
    try {
      const data = {
        preferences: localStorage.getItem('g-rump-preferences'),
        onboarding: localStorage.getItem('g-rump-onboarding-seen'),
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `grump-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('Backup exported', 'success');
    } finally {
      exporting = false;
    }
  }

  function handleReset() {
    if (confirmText !== 'RESET') return;
    try {
      localStorage.clear();
      sessionStorage.clear();
      showToast('Settings reset. Reloading.', 'success');
      onReset?.();
      setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }
</script>

<div class="reset-settings">
  <header class="reset-header">
    {#if onBack}
      <Button variant="ghost" size="sm" onclick={onBack}>Back</Button>
    {/if}
    <h2>Factory Reset</h2>
  </header>
  <div class="reset-body">
    <Card title="Reset all settings" padding="md">
      <p>
        This will clear all local preferences, onboarding state, and cached data. It cannot be
        undone.
      </p>
      <p class="reset-hint">Export a backup first if you want to restore later.</p>
      <div class="reset-actions">
        <Button variant="secondary" size="sm" onclick={handleExport} disabled={exporting}>
          Export backup
        </Button>
      </div>
      <p class="reset-confirm">Type <strong>RESET</strong> to confirm:</p>
      <input type="text" class="reset-input" bind:value={confirmText} placeholder="RESET" />
      <Button variant="primary" size="sm" onclick={handleReset} disabled={confirmText !== 'RESET'}>
        Reset everything
      </Button>
    </Card>
  </div>
</div>

<style>
  .reset-settings {
    display: flex;
    flex-direction: column;
    height: 100%;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
  }
  .reset-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border, #333);
  }
  .reset-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  .reset-body {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
  }
  .reset-hint {
    color: var(--text-secondary, #888);
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }
  .reset-actions {
    margin: 1rem 0;
  }
  .reset-confirm {
    margin-top: 1rem;
  }
  .reset-input {
    display: block;
    margin: 0.5rem 0 1rem;
    padding: 0.5rem;
    border: 1px solid var(--border, #333);
    border-radius: 0.25rem;
    font-size: 1rem;
    width: 100%;
    max-width: 200px;
  }
</style>
