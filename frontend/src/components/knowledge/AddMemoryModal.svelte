<script lang="ts">
  /**
   * AddMemoryModal – Modal dialog for creating a new memory in KnowledgeBase.
   */
  import type { MemoryType } from '../../lib/integrationsApi';
  import { MEMORY_TYPES } from './knowledgeUtils';

  interface Props {
    newMemoryContent: string;
    newMemoryType: MemoryType;
    newMemoryImportance: number;
    newMemoryTags: string;
    memoryProcessing: boolean;
    onClose: () => void;
    onCreate: () => void;
    onContentChange: (val: string) => void;
    onTypeChange: (val: MemoryType) => void;
    onImportanceChange: (val: number) => void;
    onTagsChange: (val: string) => void;
  }

  let {
    newMemoryContent,
    newMemoryType,
    newMemoryImportance,
    newMemoryTags,
    memoryProcessing,
    onClose,
    onCreate,
    onContentChange,
    onTypeChange,
    onImportanceChange,
    onTagsChange,
  }: Props = $props();

  const memoryTypes = MEMORY_TYPES;
</script>

<div
  class="modal-overlay"
  role="button"
  tabindex="-1"
  onclick={onClose}
  onkeydown={(e) => e.key === 'Escape' && onClose()}
>
  <div
    class="modal"
    role="dialog"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <h2>Add Memory</h2>

    <div class="form-group">
      <label for="memory-type">Type</label>
      <div class="type-pills">
        {#each memoryTypes as mt}
          <button
            class="type-pill"
            class:active={newMemoryType === mt.value}
            style="--pill-color: {mt.color}"
            onclick={() => onTypeChange(mt.value)}
          >
            {mt.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="form-group">
      <label for="memory-content">Content</label>
      <textarea
        id="memory-content"
        value={newMemoryContent}
        oninput={(e) => onContentChange(e.currentTarget.value)}
        placeholder="What should the AI remember?"
        rows="4"
      ></textarea>
    </div>

    <div class="form-group">
      <label for="memory-importance">Importance: {newMemoryImportance}/10</label>
      <input
        type="range"
        id="memory-importance"
        min="1"
        max="10"
        value={newMemoryImportance}
        oninput={(e) => onImportanceChange(Number(e.currentTarget.value))}
      />
    </div>

    <div class="form-group">
      <label for="memory-tags">Tags (comma-separated)</label>
      <input
        type="text"
        id="memory-tags"
        value={newMemoryTags}
        oninput={(e) => onTagsChange(e.currentTarget.value)}
        placeholder="e.g., coding, preferences, project-x"
      />
    </div>

    <div class="modal-actions">
      <button class="action-btn secondary" onclick={onClose}>Cancel</button>
      <button
        class="action-btn primary"
        onclick={onCreate}
        disabled={!newMemoryContent.trim() || memoryProcessing}
      >
        {memoryProcessing ? 'Creating...' : 'Add Memory'}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal {
    background: var(--color-bg-card, #fff);
    border-radius: 16px;
    padding: 1.5rem;
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal h2 {
    margin: 0 0 1.25rem;
    font-size: 1.25rem;
    color: var(--color-text, #18181b);
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-secondary, #52525b);
    margin-bottom: 0.375rem;
  }

  .form-group input[type='text'],
  .form-group textarea {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--color-text, #18181b);
    background: var(--color-bg-card, #fff);
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--color-primary, #7c3aed);
  }

  .form-group input[type='range'] {
    width: 100%;
    accent-color: var(--color-primary, #7c3aed);
  }

  .type-pills {
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .type-pill {
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 20px;
    font-size: 0.8125rem;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s;
    color: var(--color-text, #18181b);
  }

  .type-pill:hover {
    border-color: var(--pill-color);
  }

  .type-pill.active {
    background: var(--pill-color);
    color: white;
    border-color: var(--pill-color);
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1.25rem;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .action-btn.primary {
    background: var(--color-primary, #7c3aed);
    color: white;
  }

  .action-btn.primary:hover:not(:disabled) {
    background: var(--color-primary-hover, #6d28d9);
  }

  .action-btn.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.secondary {
    background: var(--color-bg-card, #fff);
    color: var(--color-text, #374151);
    border: 1px solid var(--color-border, #e5e7eb);
  }

  .action-btn.secondary:hover {
    background: var(--color-bg-card-hover, #f9fafb);
  }
</style>
