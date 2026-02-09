<script lang="ts">
  /**
   * MemoryTab – Extracted from TabbedSettingsScreen.svelte (tab: 'memory')
   * Phase 2 decomposition.
   *
   * TODO: Replace `any` props with explicit types for full type safety.
   */
  import { Card, Button } from '../../lib/design-system';

  interface Props {
    saveGuardRails: any;
    saveMemory: any;
    setCurrentView: any;
    settings: any;
  }

  let { saveGuardRails, saveMemory, setCurrentView, settings }: Props = $props();
</script>

<div class="tab-section memory-tab">
  <Card title="Memory Settings" padding="md">
    <p class="section-desc">
      Control what the agent remembers across sessions: limits, persistence, and search behavior.
    </p>
    <div class="field-group">
      <span class="field-label">Persistence</span>
      <p class="field-hint">
        Memories are stored locally per workspace. Clear data in Memory manager to reset.
      </p>
    </div>
    <div class="field-group">
      <label class="guard-rail-item">
        <input
          type="checkbox"
          checked={settings?.guardRails?.useLargeContext ?? false}
          onchange={(e) =>
            saveGuardRails({
              ...settings?.guardRails,
              useLargeContext: (e.target as HTMLInputElement).checked,
            })}
        />
        <span class="guard-rail-title">Large context (200K+) for memory search</span>
        <span class="guard-rail-desc"
          >Allow longer context when searching memories; uses more tokens.</span
        >
      </label>
    </div>
    <div class="field-group">
      <label class="field-label" for="max-memories">Max memories to keep</label>
      <input
        id="max-memories"
        type="number"
        min="0"
        max="10000"
        step="100"
        value={settings?.memory?.maxMemoriesToKeep ?? ''}
        onchange={(e) => {
          const v = parseInt((e.target as HTMLInputElement).value, 10);
          if (!Number.isNaN(v) && v >= 0) saveMemory({ ...settings?.memory, maxMemoriesToKeep: v });
          else if ((e.target as HTMLInputElement).value === '')
            saveMemory({ ...settings?.memory, maxMemoriesToKeep: undefined });
        }}
        placeholder="No limit"
        class="settings-number-input"
      />
      <p class="field-hint">
        Optional cap for stored memories. Leave empty for no limit. Manage in Memory manager.
      </p>
    </div>
    <div class="field-group">
      <span class="field-label">Default memory types</span>
      <p class="field-hint">
        Fact, Preference, Task, Context, Conversation. Add and manage in Memory manager.
      </p>
    </div>
    <div class="memory-actions">
      <Button variant="primary" size="sm" onclick={() => setCurrentView('memory')}>
        Open Memory manager
      </Button>
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

  .guard-rail-item {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    gap: 2px 12px;
    padding: 14px 0;
    border-bottom: 1px solid var(--color-border, #f4f4f5);
    cursor: pointer;
    user-select: none;
    align-items: start;
  }

  .guard-rail-item:last-child {
    border-bottom: none;
  }

  .guard-rail-item input {
    grid-row: 1 / -1;
    margin-top: 3px;
    cursor: pointer;
  }

  .guard-rail-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-secondary, #3f3f46);
  }

  .guard-rail-desc {
    font-size: 12px;
    color: var(--color-text-muted, #71717a);
    line-height: 1.4;
  }
</style>
