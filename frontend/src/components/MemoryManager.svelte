<script lang="ts">
  import { onMount } from 'svelte';
  import {
    listMemories,
    createMemory,
    deleteMemory,
    searchMemories,
    type MemoryRecord,
    type MemoryType,
  } from '../lib/integrationsApi';
  import { showToast } from '../stores/toastStore';
  import EmptyState from './EmptyState.svelte';

  interface Props {
    onBack: () => void;
  }
  let { onBack }: Props = $props();

  let memories = $state<MemoryRecord[]>([]);
  let loading = $state(true);
  let searching = $state(false);
  let searchQuery = $state('');
  let filterType = $state<MemoryType | 'all'>('all');
  let showAddModal = $state(false);
  let processing = $state(false);

  // Form state
  let newType = $state<MemoryType>('fact');
  let newContent = $state('');
  let newImportance = $state(0.5);

  const memoryTypes: { value: MemoryType; label: string; icon: string; color: string }[] = [
    {
      value: 'fact',
      label: 'Fact',
      icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
      color: '#6366f1',
    },
    {
      value: 'preference',
      label: 'Preference',
      icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      color: '#ec4899',
    },
    {
      value: 'task',
      label: 'Task',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      color: '#10b981',
    },
    {
      value: 'context',
      label: 'Context',
      icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      color: '#f59e0b',
    },
    {
      value: 'conversation',
      label: 'Conversation',
      icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z',
      color: '#8b5cf6',
    },
  ];

  onMount(async () => {
    await loadMemories();
  });

  async function loadMemories() {
    loading = true;
    try {
      memories = await listMemories(filterType === 'all' ? undefined : filterType, 100);
    } catch (e) {
      memories = [];
      showToast('Memories unavailable', 'error');
    } finally {
      loading = false;
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      await loadMemories();
      return;
    }
    searching = true;
    try {
      memories = await searchMemories(searchQuery.trim(), 50);
    } catch (e) {
      showToast('Search failed', 'error');
      console.error(e);
    } finally {
      searching = false;
    }
  }

  function openAddModal() {
    newType = 'fact';
    newContent = '';
    newImportance = 0.5;
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
  }

  async function handleCreate() {
    if (!newContent.trim()) return;
    processing = true;
    try {
      await createMemory(newType, newContent.trim(), newImportance);
      showToast('Memory saved', 'success');
      closeAddModal();
      await loadMemories();
    } catch (e) {
      showToast('Failed to save memory', 'error');
      console.error(e);
    } finally {
      processing = false;
    }
  }

  async function handleDelete(memory: MemoryRecord) {
    if (!confirm('Delete this memory?')) return;
    try {
      await deleteMemory(memory.id);
      showToast('Memory deleted', 'success');
      await loadMemories();
    } catch (e) {
      showToast('Failed to delete', 'error');
      console.error(e);
    }
  }

  function getTypeInfo(type: MemoryType) {
    return memoryTypes.find((t) => t.value === type) || memoryTypes[0];
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }

  function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max) + '...';
  }

  $effect(() => {
    if (filterType) {
      loadMemories();
    }
  });
</script>

<div class="memory-manager">
  <header class="header">
    <button class="back-btn" onclick={onBack}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back
    </button>
    <div class="header-content">
      <h1>Memory Bank</h1>
      <p class="subtitle">Long-term knowledge that persists across conversations</p>
    </div>
    <button class="primary-btn" onclick={openAddModal}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      Add Memory
    </button>
  </header>

  <!-- Search and Filter -->
  <div class="controls">
    <div class="search-box">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        placeholder="Search memories..."
        bind:value={searchQuery}
        onkeydown={(e) => e.key === 'Enter' && handleSearch()}
      />
      {#if searchQuery}
        <button
          class="clear-btn"
          aria-label="Clear search"
          onclick={() => {
            searchQuery = '';
            loadMemories();
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      {/if}
    </div>

    <div class="type-filter">
      <button
        class="filter-btn"
        class:active={filterType === 'all'}
        onclick={() => (filterType = 'all')}
      >
        All
      </button>
      {#each memoryTypes as type}
        <button
          class="filter-btn"
          class:active={filterType === type.value}
          style="--color: {type.color}"
          onclick={() => (filterType = type.value)}
        >
          {type.label}
        </button>
      {/each}
    </div>
  </div>

  {#if loading || searching}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>{searching ? 'Searching...' : 'Loading memories...'}</p>
    </div>
  {:else if memories.length === 0}
    <EmptyState
      headline="No memories yet"
      description="Add facts, preferences, and context for the AI to remember."
    >
      <button class="primary-btn" onclick={openAddModal}>Add First Memory</button>
    </EmptyState>
  {:else}
    <div class="stats-bar">
      <span>{memories.length} memories</span>
      <span>|</span>
      <span>{memories.filter((m) => m.type === 'fact').length} facts</span>
      <span>{memories.filter((m) => m.type === 'preference').length} preferences</span>
    </div>

    <div class="memories-grid">
      {#each memories as memory}
        {@const typeInfo = getTypeInfo(memory.type)}
        <div class="memory-card">
          <div class="card-header">
            <div class="type-badge" style="background: {typeInfo.color}20; color: {typeInfo.color}">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d={typeInfo.icon} />
              </svg>
              {typeInfo.label}
            </div>
            <button class="delete-btn" onclick={() => handleDelete(memory)} title="Delete">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p class="content">{truncate(memory.content, 200)}</p>

          <div class="card-footer">
            <div class="importance">
              <span class="label">Importance</span>
              <div class="bar">
                <div class="fill" style="width: {memory.importance * 100}%"></div>
              </div>
            </div>
            <span class="date">{formatDate(memory.createdAt)}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Add Memory Modal -->
{#if showAddModal}
  <div
    class="modal-overlay"
    role="button"
    tabindex="-1"
    onclick={closeAddModal}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && closeAddModal()}
  >
    <div
      class="modal"
      role="dialog"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <h2>Add Memory</h2>

      <div class="form-group" role="group" aria-labelledby="memory-type-label">
        <span id="memory-type-label" class="form-label">Memory Type</span>
        <div class="type-selector">
          {#each memoryTypes as type}
            <button
              class="type-option"
              class:selected={newType === type.value}
              style="--color: {type.color}"
              onclick={() => (newType = type.value)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d={type.icon} />
              </svg>
              {type.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="form-group">
        <label for="content">Content</label>
        <textarea
          id="content"
          bind:value={newContent}
          rows="4"
          placeholder="What should the AI remember?"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="importance">Importance: {Math.round(newImportance * 100)}%</label>
        <input type="range" id="importance" bind:value={newImportance} min="0" max="1" step="0.1" />
        <p class="hint">Higher importance = more likely to be recalled</p>
      </div>

      <div class="modal-actions">
        <button class="cancel-btn" onclick={closeAddModal}>Cancel</button>
        <button
          class="submit-btn"
          onclick={handleCreate}
          disabled={!newContent.trim() || processing}
        >
          {processing ? 'Saving...' : 'Save Memory'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .memory-manager {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    height: 100%;
    overflow-y: auto;
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: #f9fafb;
  }

  .header-content {
    flex: 1;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 0.25rem;
  }

  .subtitle {
    color: #6b7280;
    margin: 0;
  }

  .primary-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 8px;
    background: #6366f1;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .primary-btn:hover {
    background: #4f46e5;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .search-box {
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
  }

  .search-box input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 0.875rem;
  }

  .clear-btn {
    padding: 0.25rem;
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
  }

  .clear-btn:hover {
    color: #374151;
  }

  .type-filter {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .filter-btn {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
  }

  .filter-btn:hover {
    border-color: #d1d5db;
  }

  .filter-btn.active {
    background: var(--color, #6366f1);
    border-color: var(--color, #6366f1);
    color: white;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    gap: 1rem;
    text-align: center;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e5e7eb;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .stats-bar {
    display: flex;
    gap: 0.75rem;
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 1rem;
  }

  .memories-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  .memory-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1rem;
    transition: all 0.2s;
  }

  .memory-card:hover {
    border-color: #d1d5db;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .type-badge {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .delete-btn {
    padding: 0.375rem;
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .delete-btn:hover {
    background: #fef2f2;
    color: #dc2626;
  }

  .content {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
    color: #374151;
    line-height: 1.5;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .importance {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .importance .label {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .importance .bar {
    width: 60px;
    height: 6px;
    background: #e5e7eb;
    border-radius: 3px;
    overflow: hidden;
  }

  .importance .fill {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: 3px;
  }

  .date {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  /* Modal */
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
    background: white;
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
    color: #111827;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label,
  .form-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .type-selector {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .type-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 0.75rem;
    background: #f9fafb;
    border: 2px solid transparent;
    border-radius: 8px;
    color: #6b7280;
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.2s;
  }

  .type-option:hover {
    background: #f3f4f6;
  }

  .type-option.selected {
    background: var(--color);
    border-color: var(--color);
    color: white;
  }

  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    resize: vertical;
  }

  .form-group textarea:focus {
    outline: none;
    border-color: #6366f1;
  }

  .form-group input[type='range'] {
    width: 100%;
  }

  .hint {
    font-size: 0.75rem;
    color: #9ca3af;
    margin: 0.5rem 0 0;
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .cancel-btn,
  .submit-btn {
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-btn {
    background: #f3f4f6;
    color: #374151;
  }

  .cancel-btn:hover {
    background: #e5e7eb;
  }

  .submit-btn {
    background: #6366f1;
    color: white;
  }

  .submit-btn:hover:not(:disabled) {
    background: #4f46e5;
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .memory-manager {
      padding: 1rem;
    }

    .header {
      flex-direction: column;
    }

    .type-selector {
      grid-template-columns: repeat(2, 1fr);
    }

    .memories-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
