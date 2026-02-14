<script lang="ts">
  /**
   * MemoryTab – Enhanced memory settings with auto-save, retention period,
   * context control, and simplified layout.
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
      Control what the agent remembers across sessions: auto-save behavior, retention, and search.
    </p>

    <!-- Auto-save -->
    <div class="field-group">
      <label class="toggle-row">
        <input
          type="checkbox"
          checked={settings?.memory?.autoSave ?? true}
          onchange={(e) =>
            saveMemory({
              ...settings?.memory,
              autoSave: (e.target as HTMLInputElement).checked,
            })}
        />
        <div class="toggle-content">
          <span class="toggle-title">Auto-save memories</span>
          <span class="toggle-desc"
            >Automatically save key facts and decisions during conversations.</span
          >
        </div>
      </label>
    </div>

    <!-- Large context -->
    <div class="field-group">
      <label class="toggle-row">
        <input
          type="checkbox"
          checked={settings?.guardRails?.useLargeContext ?? false}
          onchange={(e) =>
            saveGuardRails({
              ...settings?.guardRails,
              useLargeContext: (e.target as HTMLInputElement).checked,
            })}
        />
        <div class="toggle-content">
          <span class="toggle-title">Large context for memory search</span>
          <span class="toggle-desc"
            >Allow 200K+ context when searching memories. Uses more tokens.</span
          >
        </div>
      </label>
    </div>
  </Card>

  <Card title="Retention & Limits" padding="md">
    <p class="section-desc">Control how much memory the agent retains and for how long.</p>

    <!-- Max memories -->
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
      <p class="field-hint">Cap for stored memories. Leave empty for unlimited.</p>
    </div>

    <!-- Retention period -->
    <div class="field-group">
      <label class="field-label" for="retention-days">Retention period (days)</label>
      <input
        id="retention-days"
        type="number"
        min="0"
        max="365"
        step="7"
        value={settings?.memory?.retentionDays ?? ''}
        onchange={(e) => {
          const v = parseInt((e.target as HTMLInputElement).value, 10);
          if (!Number.isNaN(v) && v >= 0) saveMemory({ ...settings?.memory, retentionDays: v });
          else if ((e.target as HTMLInputElement).value === '')
            saveMemory({ ...settings?.memory, retentionDays: undefined });
        }}
        placeholder="Forever"
        class="settings-number-input"
      />
      <p class="field-hint">
        Automatically remove memories older than this. Leave empty to keep forever.
      </p>
    </div>
  </Card>

  <Card title="Memory Types" padding="md">
    <p class="section-desc">
      The agent stores different categories of memories. Manage individual entries in the Memory
      manager.
    </p>
    <div class="memory-types-grid">
      <div class="memory-type-chip">📝 Fact</div>
      <div class="memory-type-chip">⭐ Preference</div>
      <div class="memory-type-chip">📋 Task</div>
      <div class="memory-type-chip">🧩 Context</div>
      <div class="memory-type-chip">💬 Conversation</div>
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
    gap: 24px;
  }

  .tab-section :global(.card) {
    border: 1px solid var(--color-border, #e5e7eb);
  }

  .section-desc {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
    margin-bottom: 1.25rem;
    line-height: 1.5;
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

  .field-hint {
    font-size: 12px;
    color: var(--color-text-muted, #a1a1aa);
    margin-top: 6px;
  }

  .settings-number-input {
    max-width: 160px;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.5rem;
    background: var(--color-bg-card, #fff);
  }

  /* Toggle rows */
  .toggle-row {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--color-border, #e5e7eb);
    background: var(--color-bg-secondary, #f9fafb);
    cursor: pointer;
    user-select: none;
    transition: border-color 150ms;
  }

  .toggle-row:hover {
    border-color: var(--color-primary, #7c3aed);
  }

  .toggle-row input {
    margin-top: 2px;
    cursor: pointer;
  }

  .toggle-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toggle-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }

  .toggle-desc {
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
    line-height: 1.4;
  }

  /* Memory types */
  .memory-types-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .memory-type-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-secondary, #3f3f46);
    background: var(--color-bg-secondary, #f9fafb);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 2rem;
  }

  .memory-actions {
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border, #e5e7eb);
  }
</style>
