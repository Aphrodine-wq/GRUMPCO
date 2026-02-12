<script lang="ts">
  /**
   * KBMemoriesTab – Memories list, search, and filter for KnowledgeBase.
   */
  import { Brain, Plus, Search, Trash2, Star, Filter, X, Clock, Tag } from 'lucide-svelte';
  import { getTypeColor, MEMORY_TYPES } from './knowledgeUtils';
  import type { MemoryRecord, MemoryType } from '../../lib/integrationsApi';
  import { formatDate } from './knowledgeUtils';

  interface Props {
    filteredMemories: MemoryRecord[];
    memoriesLoading: boolean;
    memorySearch: string;
    memoryTypeFilter: MemoryType | 'all';
    onSearchMemories: () => void;
    onLoadMemories: () => void;
    onDeleteMemory: (id: string) => void;
    onOpenAddModal: () => void;
    onSearchChange: (val: string) => void;
    onFilterChange: (val: MemoryType | 'all') => void;
  }

  let {
    filteredMemories,
    memoriesLoading,
    memorySearch,
    memoryTypeFilter,
    onSearchMemories,
    onLoadMemories,
    onDeleteMemory,
    onOpenAddModal,
    onSearchChange,
    onFilterChange,
  }: Props = $props();

  const memoryTypes = MEMORY_TYPES;
</script>

<div class="toolbar">
  <div class="search-box">
    <Search size={16} />
    <input
      type="text"
      placeholder="Search memories..."
      value={memorySearch}
      oninput={(e) => onSearchChange(e.currentTarget.value)}
      onkeydown={(e) => e.key === 'Enter' && onSearchMemories()}
    />
    {#if memorySearch}
      <button
        class="clear-btn"
        onclick={() => {
          onSearchChange('');
          onLoadMemories();
        }}
      >
        <X size={14} />
      </button>
    {/if}
  </div>
  <div class="filter-group">
    <Filter size={14} />
    <select
      value={memoryTypeFilter}
      onchange={(e) => {
        onFilterChange(e.currentTarget.value as MemoryType | 'all');
        onLoadMemories();
      }}
    >
      <option value="all">All types</option>
      {#each memoryTypes as mt}
        <option value={mt.value}>{mt.label}</option>
      {/each}
    </select>
  </div>
  <button class="action-btn primary" onclick={onOpenAddModal}>
    <Plus size={16} /> Add Memory
  </button>
</div>

{#if memoriesLoading}
  <div class="loading-state">
    <div class="spinner"></div>
    <p>Loading memories...</p>
  </div>
{:else if filteredMemories.length === 0}
  <div class="empty-state">
    <Brain size={40} />
    <h3>No memories found</h3>
    <p>Add memories to help AI remember important context about you and your projects.</p>
    <button class="action-btn primary" onclick={onOpenAddModal}>
      <Plus size={16} /> Add Your First Memory
    </button>
  </div>
{:else}
  <div class="memory-list">
    {#each filteredMemories as memory (memory.id)}
      <div class="memory-card">
        <div class="memory-header">
          <span
            class="type-badge"
            style="background: {getTypeColor(memory.type)}20; color: {getTypeColor(memory.type)}"
          >
            {memory.type}
          </span>
          <div class="memory-meta">
            <span class="importance" title="Importance">
              <Star size={12} />
              {memory.importance}/10
            </span>
            <span class="date">
              <Clock size={12} />
              {formatDate(memory.createdAt)}
            </span>
          </div>
        </div>
        <p class="memory-content">{memory.content}</p>
        {#if memory.metadata?.tags && Array.isArray(memory.metadata.tags)}
          <div class="tags">
            {#each memory.metadata.tags as tag}
              <span class="tag"><Tag size={10} /> {tag}</span>
            {/each}
          </div>
        {/if}
        <div class="memory-actions">
          <button
            class="icon-btn danger"
            title="Delete memory"
            onclick={() => onDeleteMemory(memory.id)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  /* ── Toolbar ── */
  .toolbar {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 200px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    background: var(--color-bg-card, #fff);
  }

  .search-box input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 0.875rem;
    background: transparent;
    color: var(--color-text, #18181b);
  }

  .search-box input::placeholder {
    color: var(--color-text-muted, #a1a1aa);
  }

  .clear-btn {
    padding: 0.25rem;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--color-text-muted, #a1a1aa);
    border-radius: 4px;
  }

  .clear-btn:hover {
    color: var(--color-text, #18181b);
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--color-text-muted, #71717a);
  }

  .filter-group select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    font-size: 0.8125rem;
    background: var(--color-bg-card, #fff);
    color: var(--color-text, #18181b);
    cursor: pointer;
  }

  /* ── Buttons ── */
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

  /* ── Loading / Empty ── */
  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 0.75rem;
    text-align: center;
    color: var(--color-text-muted, #71717a);
  }

  .empty-state h3 {
    margin: 0;
    color: var(--color-text, #18181b);
    font-size: 1.125rem;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
    max-width: 360px;
  }

  .spinner {
    width: 28px;
    height: 28px;
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

  /* ── Memory card ── */
  .memory-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .memory-card {
    padding: 1rem 1.25rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: 10px;
    transition: border-color 0.15s;
  }

  .memory-card:hover {
    border-color: var(--color-border, #d4d4d8);
  }

  .memory-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .type-badge {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .memory-meta {
    display: flex;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: var(--color-text-muted, #a1a1aa);
  }

  .memory-meta span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .memory-content {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text, #18181b);
    line-height: 1.5;
  }

  .tags {
    display: flex;
    gap: 0.375rem;
    margin-top: 0.5rem;
    flex-wrap: wrap;
  }

  .tag {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    background: var(--color-bg-subtle, #f4f4f5);
    color: var(--color-text-muted, #71717a);
  }

  .memory-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }

  .icon-btn {
    padding: 0.375rem;
    border: none;
    background: transparent;
    border-radius: 6px;
    color: var(--color-text-muted, #71717a);
    cursor: pointer;
  }

  .icon-btn:hover {
    background: var(--color-bg-card-hover, #f0f0f5);
    color: var(--color-text, #18181b);
  }

  .icon-btn.danger:hover {
    color: #dc2626;
    background: #fef2f2;
  }
</style>
