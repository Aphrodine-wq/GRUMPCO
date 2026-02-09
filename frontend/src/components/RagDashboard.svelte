<script lang="ts">
  /**
   * RagDashboard – Retrieval-Augmented Generation management.
   * Shows document collections, indexing status, and search testing.
   */
  import { onMount } from 'svelte';
  import { showToast } from '../stores/toastStore';
  import {
    ArrowLeft,
    Database,
    FileText,
    Upload,
    Search,
    Trash2,
    RefreshCw,
    CheckCircle,
    AlertCircle,
    Clock,
  } from 'lucide-svelte';

  interface Props {
    onBack: () => void;
  }

  let { onBack }: Props = $props();

  interface Collection {
    id: string;
    name: string;
    docCount: number;
    chunkCount: number;
    status: 'indexed' | 'indexing' | 'error';
    lastIndexed: string;
    sizeKb: number;
  }

  interface SearchResult {
    content: string;
    source: string;
    score: number;
    collection: string;
  }

  let loading = $state(true);
  let collections = $state<Collection[]>([]);
  let searchQuery = $state('');
  let searchResults = $state<SearchResult[]>([]);
  let searching = $state(false);
  let showUpload = $state(false);

  const MOCK_COLLECTIONS: Collection[] = [
    {
      id: '1',
      name: 'Project Documentation',
      docCount: 24,
      chunkCount: 482,
      status: 'indexed',
      lastIndexed: '2 hours ago',
      sizeKb: 1240,
    },
    {
      id: '2',
      name: 'API References',
      docCount: 12,
      chunkCount: 198,
      status: 'indexed',
      lastIndexed: '1 day ago',
      sizeKb: 560,
    },
    {
      id: '3',
      name: 'Codebase Context',
      docCount: 156,
      chunkCount: 3201,
      status: 'indexing',
      lastIndexed: 'In progress',
      sizeKb: 8900,
    },
    {
      id: '4',
      name: 'Meeting Notes',
      docCount: 8,
      chunkCount: 64,
      status: 'error',
      lastIndexed: 'Failed',
      sizeKb: 120,
    },
  ];

  onMount(() => {
    setTimeout(() => {
      collections = MOCK_COLLECTIONS;
      loading = false;
    }, 400);
  });

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    searching = true;
    await new Promise((r) => setTimeout(r, 600));
    searchResults = [
      {
        content: 'The authentication module uses JWT tokens with a 24-hour expiry...',
        source: 'auth.md',
        score: 0.94,
        collection: 'Project Documentation',
      },
      {
        content: 'POST /api/auth/login accepts email and password fields...',
        source: 'api-reference.md',
        score: 0.87,
        collection: 'API References',
      },
      {
        content: 'Token refresh endpoint returns a new access token when...',
        source: 'auth.md',
        score: 0.82,
        collection: 'Project Documentation',
      },
    ];
    searching = false;
  }

  function handleReindex(id: string) {
    const col = collections.find((c) => c.id === id);
    if (col) {
      col.status = 'indexing';
      col.lastIndexed = 'In progress';
      collections = [...collections];
      showToast(`Re-indexing "${col.name}"`, 'info');
    }
  }

  function handleDelete(id: string) {
    collections = collections.filter((c) => c.id !== id);
    showToast('Collection deleted', 'success');
  }

  function getStatusIcon(status: string) {
    if (status === 'indexed') return CheckCircle;
    if (status === 'indexing') return Clock;
    return AlertCircle;
  }

  function getStatusColor(status: string) {
    if (status === 'indexed') return '#10b981';
    if (status === 'indexing') return '#f59e0b';
    return '#ef4444';
  }

  function formatSize(kb: number): string {
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
  }
</script>

<div class="rag-dashboard">
  <header class="header">
    <button class="back-btn" onclick={onBack} type="button"><ArrowLeft size={20} /> Back</button>
    <div class="header-content">
      <h1>RAG Knowledge Base</h1>
      <p class="subtitle">Manage document collections for retrieval-augmented generation</p>
    </div>
    <button type="button" class="upload-btn" onclick={() => (showUpload = !showUpload)}>
      <Upload size={16} /> Add documents
    </button>
  </header>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading knowledge base...</p>
    </div>
  {:else}
    <div class="content">
      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-value">{collections.length}</span><span class="stat-label"
            >Collections</span
          >
        </div>
        <div class="stat-card">
          <span class="stat-value">{collections.reduce((s, c) => s + c.docCount, 0)}</span><span
            class="stat-label">Documents</span
          >
        </div>
        <div class="stat-card">
          <span class="stat-value"
            >{collections.reduce((s, c) => s + c.chunkCount, 0).toLocaleString()}</span
          ><span class="stat-label">Chunks</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{formatSize(collections.reduce((s, c) => s + c.sizeKb, 0))}</span
          ><span class="stat-label">Total Size</span>
        </div>
      </div>

      {#if showUpload}
        <div class="upload-area">
          <Upload size={32} />
          <p>Drag & drop files here, or click to browse</p>
          <span class="upload-hint">Supports PDF, Markdown, TXT, and code files</span>
          <button type="button" class="browse-btn">Browse Files</button>
        </div>
      {/if}

      <!-- Collections -->
      <section class="section">
        <h2>Collections</h2>
        <div class="collections-list">
          {#each collections as col (col.id)}
            <div class="collection-card">
              <div class="col-icon"><Database size={20} /></div>
              <div class="col-body">
                <h3>{col.name}</h3>
                <div class="col-meta">
                  <span><FileText size={12} /> {col.docCount} docs</span>
                  <span>{col.chunkCount.toLocaleString()} chunks</span>
                  <span>{formatSize(col.sizeKb)}</span>
                </div>
              </div>
              <div class="col-status" style:color={getStatusColor(col.status)}>
                <svelte:component this={getStatusIcon(col.status)} size={14} />
                <span>{col.lastIndexed}</span>
              </div>
              <div class="col-actions">
                <button
                  type="button"
                  class="action-icon"
                  title="Re-index"
                  onclick={() => handleReindex(col.id)}><RefreshCw size={14} /></button
                >
                <button
                  type="button"
                  class="action-icon danger"
                  title="Delete"
                  onclick={() => handleDelete(col.id)}><Trash2 size={14} /></button
                >
              </div>
            </div>
          {/each}
        </div>
      </section>

      <!-- Search test -->
      <section class="section">
        <h2>Test Search</h2>
        <div class="search-area">
          <div class="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Test a query against your knowledge base..."
              bind:value={searchQuery}
              class="search-input"
              onkeydown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              type="button"
              class="search-btn"
              onclick={handleSearch}
              disabled={searching || !searchQuery.trim()}
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
          {#if searchResults.length > 0}
            <div class="results-list">
              {#each searchResults as result, i}
                <div class="result-card">
                  <div class="result-rank">#{i + 1}</div>
                  <div class="result-body">
                    <p class="result-content">{result.content}</p>
                    <div class="result-meta">
                      <span class="result-source">{result.source}</span>
                      <span class="result-collection">{result.collection}</span>
                      <span class="result-score">{(result.score * 100).toFixed(0)}% match</span>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </section>
    </div>
  {/if}
</div>

<style>
  .rag-dashboard {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-border-light, #e5e7eb);
    flex-shrink: 0;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-subtle, #f4f4f5);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: var(--color-text, #18181b);
    font-size: 0.875rem;
  }
  .back-btn:hover {
    background: var(--color-bg-card-hover, #e4e4e7);
  }

  .header-content {
    flex: 1;
  }
  .header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #18181b);
  }
  .subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
    color: var(--color-text-muted, #71717a);
  }

  .upload-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-primary, #7c3aed);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }
  .upload-btn:hover {
    background: var(--color-primary-hover, #6d28d9);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 4rem;
    color: var(--color-text-muted, #71717a);
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border, #e4e4e7);
    border-top-color: var(--color-primary, #7c3aed);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: 10px;
  }
  .stat-card .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-primary, #7c3aed);
  }
  .stat-card .stat-label {
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
    margin-top: 0.25rem;
  }

  .upload-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem;
    margin-bottom: 1.5rem;
    border: 2px dashed var(--color-border, #e5e7eb);
    border-radius: 12px;
    color: var(--color-text-muted, #71717a);
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s;
  }
  .upload-area:hover {
    border-color: var(--color-primary, #7c3aed);
  }
  .upload-area p {
    margin: 0;
    font-size: 0.9375rem;
  }
  .upload-hint {
    font-size: 0.8125rem;
  }
  .browse-btn {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-bg-subtle, #f4f4f5);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--color-text, #18181b);
  }

  .section {
    margin-bottom: 1.5rem;
  }
  .section h2 {
    margin: 0 0 0.75rem;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }

  .collections-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .collection-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: 10px;
    transition: border-color 0.15s;
  }
  .collection-card:hover {
    border-color: rgba(124, 58, 237, 0.3);
  }
  .col-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(124, 58, 237, 0.1);
    border-radius: 10px;
    color: var(--color-primary, #7c3aed);
  }
  .col-body {
    flex: 1;
    min-width: 0;
  }
  .col-body h3 {
    margin: 0 0 0.25rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }
  .col-meta {
    display: flex;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
    align-items: center;
  }
  .col-meta span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .col-status {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
  }
  .col-actions {
    display: flex;
    gap: 0.25rem;
  }
  .action-icon {
    padding: 0.375rem;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    color: var(--color-text-muted, #71717a);
  }
  .action-icon:hover {
    color: var(--color-primary, #7c3aed);
    background: var(--color-bg-card-hover, #f0f0f5);
  }
  .action-icon.danger:hover {
    color: #ef4444;
  }

  .search-area {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .search-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 10px;
  }
  .search-box:focus-within {
    border-color: var(--color-primary, #7c3aed);
  }
  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 0.875rem;
    color: var(--color-text, #18181b);
    outline: none;
  }
  .search-input::placeholder {
    color: var(--color-text-muted, #71717a);
  }
  .search-btn {
    padding: 0.375rem 0.75rem;
    background: var(--color-primary, #7c3aed);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    cursor: pointer;
    white-space: nowrap;
  }
  .search-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .result-card {
    display: flex;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: 8px;
  }
  .result-rank {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(124, 58, 237, 0.1);
    color: var(--color-primary, #7c3aed);
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
  }
  .result-body {
    flex: 1;
    min-width: 0;
  }
  .result-content {
    margin: 0 0 0.375rem;
    font-size: 0.875rem;
    color: var(--color-text, #18181b);
    line-height: 1.4;
  }
  .result-meta {
    display: flex;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
  }
  .result-source {
    font-weight: 500;
  }
  .result-score {
    color: #10b981;
    font-weight: 600;
  }
</style>
