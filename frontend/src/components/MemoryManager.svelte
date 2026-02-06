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
  import { Modal, Button } from '../lib/design-system';

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
  let newTags = $state<string[]>([]);
  let contentTouched = $state(false);
  let contentError = $state('');
  let customTagInput = $state('');

  const PREDEFINED_TAGS = ['work', 'personal', 'project-x'];
  const MAX_CONTENT_LENGTH = 10000;
  const MAX_ATTACHMENT_SIZE = 500 * 1024; // 500KB per file
  const MAX_ATTACHMENTS_TOTAL = 2 * 1024 * 1024; // 2MB total
  const ACCEPT_ATTACHMENTS = 'image/*,.pdf,.txt,.md,.doc,.docx';

  let attachmentFiles = $state<Array<{ file: File; id: string }>>([]);
  let attachmentError = $state<string | null>(null);
  let attachmentInputEl = $state<HTMLInputElement | null>(null);

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

  function validateContent(): string {
    const t = newContent.trim();
    if (!t) return 'Content is required';
    if (t.length > MAX_CONTENT_LENGTH)
      return `Content must be at most ${MAX_CONTENT_LENGTH.toLocaleString()} characters`;
    return '';
  }

  function onContentBlur() {
    contentTouched = true;
    contentError = validateContent();
  }

  function openAddModal() {
    newType = 'fact';
    newContent = '';
    newImportance = 0.5;
    newTags = [];
    contentTouched = false;
    contentError = '';
    customTagInput = '';
    attachmentFiles = [];
    attachmentError = null;
    showAddModal = true;
  }

  function addAttachmentFiles(files: FileList | null) {
    if (!files?.length) return;
    attachmentError = null;
    const next: Array<{ file: File; id: string }> = [...attachmentFiles];
    let totalBytes = next.reduce((s, { file }) => s + file.size, 0);
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        attachmentError = `"${file.name}" is too large (max ${MAX_ATTACHMENT_SIZE / 1024}KB per file)`;
        continue;
      }
      if (totalBytes + file.size > MAX_ATTACHMENTS_TOTAL) {
        attachmentError = `Total attachments exceed ${MAX_ATTACHMENTS_TOTAL / 1024 / 1024}MB`;
        break;
      }
      next.push({ file, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
      totalBytes += file.size;
    }
    attachmentFiles = next;
    if (attachmentInputEl) attachmentInputEl.value = '';
  }

  function removeAttachment(id: string) {
    attachmentFiles = attachmentFiles.filter((a) => a.id !== id);
    attachmentError = null;
  }

  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64 ?? '');
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function closeAddModal() {
    showAddModal = false;
  }

  function addTag(tag: string) {
    const t = tag.trim().toLowerCase();
    if (t && !newTags.includes(t)) newTags = [...newTags, t];
  }

  function removeTag(tag: string) {
    newTags = newTags.filter((t) => t !== tag);
  }

  async function handleCreate() {
    contentTouched = true;
    const err = validateContent();
    contentError = err;
    if (err || !newContent.trim()) return;
    processing = true;
    try {
      const metadata: Record<string, unknown> = newTags.length ? { tags: newTags } : {};
      if (attachmentFiles.length > 0) {
        const attachments: Array<{
          name: string;
          mimeType: string;
          size: number;
          dataBase64?: string;
        }> = [];
        for (const { file } of attachmentFiles) {
          const dataBase64 =
            file.size <= MAX_ATTACHMENT_SIZE ? await readFileAsBase64(file) : undefined;
          attachments.push({
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            ...(dataBase64 ? { dataBase64 } : {}),
          });
        }
        metadata.attachments = attachments;
      }
      await createMemory(
        newType,
        newContent.trim(),
        newImportance,
        Object.keys(metadata).length ? metadata : undefined
      );
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
      <h1>Memory</h1>
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
    />
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

<!-- Add Memory Modal (wizard-style: same shell as New Project / onboarding modals) -->
<Modal
  bind:open={showAddModal}
  onClose={closeAddModal}
  title="Add Memory"
  description="Store a fact, preference, task, or context for G-Agent to recall."
  size="lg"
  closeOnBackdrop={true}
  closeOnEscape={true}
  showCloseButton={true}
  footer={addMemoryModalFooter}
>
  <div class="add-memory-form">
    <!-- Section: Type -->
    <section class="form-section" role="group" aria-labelledby="memory-type-label">
      <span id="memory-type-label" class="form-section-label">Type</span>
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
    </section>

    <!-- Section: Content -->
    <section class="form-section" role="group" aria-labelledby="content-label">
      <label id="content-label" class="form-section-label" for="content">Content</label>
      <textarea
        id="content"
        bind:value={newContent}
        onblur={onContentBlur}
        rows="4"
        placeholder="What should the AI remember?"
        class:has-error={contentTouched && contentError}
        aria-invalid={contentTouched && !!contentError}
        aria-describedby={contentTouched && contentError ? 'content-error' : undefined}
      ></textarea>
      {#if contentTouched && contentError}
        <p id="content-error" class="field-error" role="alert">{contentError}</p>
      {/if}
      <p class="hint">Required. Max {MAX_CONTENT_LENGTH.toLocaleString()} characters.</p>
    </section>

    <!-- Section: Importance -->
    <section class="form-section" role="group" aria-labelledby="importance-label">
      <label id="importance-label" class="form-section-label" for="importance"
        >Importance: {Math.round(newImportance * 100)}%</label
      >
      <input type="range" id="importance" bind:value={newImportance} min="0" max="1" step="0.1" />
      <p class="hint">Higher importance = more likely to be recalled</p>
    </section>

    <!-- Section: Attachments (optional) -->
    <section class="form-section" role="group" aria-labelledby="attachments-label">
      <span id="attachments-label" class="form-section-label">Attachments (optional)</span>
      <p class="hint">
        Documents or images for AI to consider with this memory. Max 500KB per file, 2MB total.
      </p>
      <input
        type="file"
        bind:this={attachmentInputEl}
        accept={ACCEPT_ATTACHMENTS}
        multiple
        class="attachment-input"
        onchange={(e) => addAttachmentFiles((e.target as HTMLInputElement)?.files ?? null)}
        aria-label="Add documents or images"
      />
      {#if attachmentError}
        <p class="field-error" role="alert">{attachmentError}</p>
      {/if}
      {#if attachmentFiles.length > 0}
        <ul class="attachment-list">
          {#each attachmentFiles as { file, id }}
            <li class="attachment-item">
              <span class="attachment-name" title={file.name}>{file.name}</span>
              <span class="attachment-size">({(file.size / 1024).toFixed(1)} KB)</span>
              <button
                type="button"
                class="attachment-remove"
                onclick={() => removeAttachment(id)}
                aria-label="Remove {file.name}">×</button
              >
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Section: Tags -->
    <section class="form-section" role="group" aria-labelledby="tags-label">
      <span id="tags-label" class="form-section-label">Tags</span>
      <div class="tags-row">
        <select
          class="tags-select"
          onchange={(e) => {
            const el = e.currentTarget as HTMLSelectElement;
            const v = el.value;
            el.value = '';
            if (v && v !== '__custom__') addTag(v);
            else if (v === '__custom__') document.getElementById('custom-tag-input')?.focus();
          }}
          aria-label="Add predefined tag"
        >
          <option value="">Add tag…</option>
          {#each PREDEFINED_TAGS as tag}
            <option value={tag} disabled={newTags.includes(tag)}>{tag}</option>
          {/each}
          <option value="__custom__">Custom…</option>
        </select>
        <div class="custom-tag-row">
          <input
            id="custom-tag-input"
            type="text"
            class="custom-tag-input"
            placeholder="Custom tag"
            bind:value={customTagInput}
            onkeydown={(e) => e.key === 'Enter' && (addTag(customTagInput), (customTagInput = ''))}
          />
          <button
            type="button"
            class="tag-add-btn"
            onclick={() => (addTag(customTagInput), (customTagInput = ''))}>Add</button
          >
        </div>
      </div>
      {#if newTags.length > 0}
        <div class="tag-pills">
          {#each newTags as tag}
            <span class="tag-pill">
              {tag}
              <button
                type="button"
                class="tag-remove"
                onclick={() => removeTag(tag)}
                aria-label="Remove {tag}">×</button
              >
            </span>
          {/each}
        </div>
      {/if}
    </section>
  </div>
</Modal>

{#snippet addMemoryModalFooter()}
  <Button variant="ghost" onclick={closeAddModal}>Cancel</Button>
  <Button
    variant="primary"
    onclick={handleCreate}
    disabled={processing || !newContent.trim() || !!validateContent()}
  >
    {processing ? 'Saving...' : 'Save Memory'}
  </Button>
{/snippet}

<style>
  .memory-manager {
    padding: 2rem;
    width: 100%;
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
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: var(--color-bg-secondary);
  }

  .header-content {
    flex: 1;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0 0 0.25rem;
  }

  .subtitle {
    color: var(--color-text-muted);
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
    background: var(--color-primary, #7c3aed);
    color: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .primary-btn:hover {
    background: var(--color-primary-hover, #6d28d9);
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
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
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
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .clear-btn:hover {
    color: var(--color-text-secondary);
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
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .filter-btn:hover {
    border-color: var(--color-border);
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
    border: 3px solid var(--color-border);
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
    color: var(--color-text-muted);
    margin-bottom: 1rem;
  }

  .memories-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  .memory-card {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 1rem;
    transition: all 0.2s;
  }

  .memory-card:hover {
    border-color: var(--color-border);
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
    color: var(--color-text-muted);
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
    color: var(--color-text-secondary);
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
    color: var(--color-text-muted);
  }

  .importance .bar {
    width: 60px;
    height: 6px;
    background: var(--color-bg-secondary);
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
    color: var(--color-text-muted);
  }

  /* Modal */
  .add-memory-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-section-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
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
    background: var(--color-bg-secondary);
    border: 2px solid transparent;
    border-radius: 8px;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.2s;
  }

  .type-option:hover {
    background: var(--color-bg-secondary);
  }

  .type-option:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: 2px;
  }

  .type-option.selected {
    background: var(--color);
    border-color: var(--color);
    color: white;
  }

  .form-section textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    resize: vertical;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .form-section textarea:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  .form-section textarea.has-error {
    border-color: #dc2626;
  }

  .form-section textarea.has-error:focus {
    border-color: #dc2626;
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15);
  }

  .field-error {
    font-size: 0.8125rem;
    color: #dc2626;
    margin: 0.25rem 0 0;
  }

  .form-section input[type='range'] {
    width: 100%;
  }

  .attachment-input {
    font-size: 0.875rem;
    max-width: 100%;
  }

  .attachment-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .attachment-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-subtle, #f4f4f5);
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .attachment-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .attachment-size {
    color: var(--color-text-muted, #71717a);
    flex-shrink: 0;
  }

  .attachment-remove {
    flex-shrink: 0;
    padding: 0.2rem 0.4rem;
    border: none;
    background: transparent;
    color: var(--color-text-muted, #71717a);
    cursor: pointer;
    font-size: 1.1rem;
    line-height: 1;
    border-radius: 4px;
  }

  .attachment-remove:hover {
    background: rgba(220, 38, 38, 0.1);
    color: #dc2626;
  }

  .hint {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin: 0.25rem 0 0;
  }

  .tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .tags-select {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-card);
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .tags-select:focus {
    outline: none;
    border-color: #6366f1;
  }

  .custom-tag-row {
    display: flex;
    gap: 0.5rem;
  }

  .custom-tag-input {
    width: 120px;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }

  .custom-tag-input:focus {
    outline: none;
    border-color: #6366f1;
  }

  .tag-add-btn {
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .tag-add-btn:hover {
    background: var(--color-bg-secondary);
  }

  .tag-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.25rem;
  }

  .tag-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    background: #e0e7ff;
    color: #4338ca;
    border-radius: 6px;
  }

  .tag-remove {
    padding: 0 0.125rem;
    background: none;
    border: none;
    color: #6366f1;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
  }

  .tag-remove:hover {
    color: #dc2626;
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
