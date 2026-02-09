<script lang="ts">
  /**
   * KnowledgeBase – Unified Knowledge screen.
   * Combines Memory, Documents (RAG), Skills, and MCP Servers into a single tabbed interface.
   */
  import { onMount } from 'svelte';
  import {
    ArrowLeft,
    Brain,
    Database,
    Plus,
    Search,
    Trash2,
    Upload,
    RefreshCw,
    FileText,
    Tag,
    Star,
    Filter,
    X,
    CheckCircle,
    AlertCircle,
    Clock,
    BookOpen,
    Server,
  } from 'lucide-svelte';
  import {
    listMemories,
    createMemory,
    deleteMemory,
    searchMemories,
    type MemoryRecord,
    type MemoryType,
  } from '../lib/integrationsApi';
  import {
    getSkills,
    getSkill,
    generateSkillMd,
    createUserSkill,
    type SkillSummary,
  } from '../lib/api';
  import { settingsStore } from '../stores/settingsStore';
  import { showToast } from '../stores/toastStore';
  import { Button } from '../lib/design-system';
  import McpServersCard from './McpServersCard.svelte';

  interface Props {
    onBack: () => void;
    initialTab?: Tab;
  }
  let { onBack, initialTab }: Props = $props();

  // ── Tab state ──────────────────────────────────────────────────────────────
  type Tab = 'memories' | 'documents' | 'skills' | 'mcp';
  let activeTab = $state<Tab>(initialTab ?? 'memories');

  // ── Memories state ─────────────────────────────────────────────────────────
  let memories = $state<MemoryRecord[]>([]);
  let memoriesLoading = $state(true);
  let memorySearch = $state('');
  let memoryTypeFilter = $state<MemoryType | 'all'>('all');
  let showAddMemoryModal = $state(false);
  let memoryProcessing = $state(false);

  // Add memory form
  let newMemoryContent = $state('');
  let newMemoryType = $state<MemoryType>('fact');
  let newMemoryImportance = $state(5);
  let newMemoryTags = $state('');

  const memoryTypes: { value: MemoryType; label: string; color: string }[] = [
    { value: 'fact', label: 'Fact', color: '#6366f1' },
    { value: 'preference', label: 'Preference', color: '#ec4899' },
    { value: 'task', label: 'Task', color: '#10b981' },
    { value: 'context', label: 'Context', color: '#f59e0b' },
    { value: 'conversation', label: 'Conversation', color: '#8b5cf6' },
  ];

  // ── Documents (RAG) state ──────────────────────────────────────────────────
  interface DocCollection {
    id: string;
    name: string;
    documentCount: number;
    totalSize: string;
    status: 'indexed' | 'indexing' | 'error';
    lastUpdated: string;
  }

  let collections = $state<DocCollection[]>([
    {
      id: '1',
      name: 'Project Documentation',
      documentCount: 24,
      totalSize: '2.4 MB',
      status: 'indexed',
      lastUpdated: '2 hours ago',
    },
    {
      id: '2',
      name: 'API References',
      documentCount: 12,
      totalSize: '1.1 MB',
      status: 'indexed',
      lastUpdated: '1 day ago',
    },
    {
      id: '3',
      name: 'Meeting Notes',
      documentCount: 8,
      totalSize: '640 KB',
      status: 'indexing',
      lastUpdated: '5 minutes ago',
    },
  ]);
  let documentsLoading = $state(false);
  let docSearch = $state('');
  let docSearchResults = $state<{ content: string; source: string; score: number }[]>([]);
  let docSearching = $state(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredMemories = $derived(
    memories.filter((m) => {
      if (memoryTypeFilter !== 'all' && m.type !== memoryTypeFilter) return false;
      if (memorySearch.trim()) {
        return m.content.toLowerCase().includes(memorySearch.toLowerCase());
      }
      return true;
    })
  );

  const totalDocuments = $derived(collections.reduce((sum, c) => sum + c.documentCount, 0));
  const indexedCollections = $derived(collections.filter((c) => c.status === 'indexed').length);

  // ── Memory actions ─────────────────────────────────────────────────────────
  onMount(async () => {
    await Promise.all([loadMemories(), loadSkills()]);
  });

  async function loadMemories() {
    memoriesLoading = true;
    try {
      const typeArg = memoryTypeFilter !== 'all' ? memoryTypeFilter : undefined;
      memories = await listMemories(typeArg);
    } catch {
      showToast('Failed to load memories', 'error');
    } finally {
      memoriesLoading = false;
    }
  }

  async function handleSearchMemories() {
    if (!memorySearch.trim()) {
      await loadMemories();
      return;
    }
    memoriesLoading = true;
    try {
      memories = await searchMemories(memorySearch.trim());
    } catch {
      showToast('Search failed', 'error');
    } finally {
      memoriesLoading = false;
    }
  }

  async function handleCreateMemory() {
    if (!newMemoryContent.trim()) return;
    memoryProcessing = true;
    try {
      const tags = newMemoryTags.trim() ? newMemoryTags.split(',').map((t) => t.trim()) : [];
      await createMemory(newMemoryType, newMemoryContent.trim(), newMemoryImportance, { tags });
      showToast('Memory created', 'success');
      showAddMemoryModal = false;
      newMemoryContent = '';
      newMemoryTags = '';
      newMemoryImportance = 5;
      await loadMemories();
    } catch {
      showToast('Failed to create memory', 'error');
    } finally {
      memoryProcessing = false;
    }
  }

  async function handleDeleteMemory(id: string) {
    try {
      await deleteMemory(id);
      showToast('Memory deleted', 'success');
      memories = memories.filter((m) => m.id !== id);
    } catch {
      showToast('Failed to delete memory', 'error');
    }
  }

  // ── Document actions (mock – no backend yet) ──────────────────────────────
  async function handleDocSearch() {
    if (!docSearch.trim()) return;
    docSearching = true;
    docSearchResults = [];
    // Simulate search
    await new Promise((r) => setTimeout(r, 800));
    docSearchResults = [
      {
        content: `Result for "${docSearch}" from Project Documentation...`,
        source: 'Project Documentation',
        score: 0.92,
      },
      {
        content: `Related content found in API References...`,
        source: 'API References',
        score: 0.78,
      },
    ];
    docSearching = false;
  }

  async function handleReindex(id: string) {
    collections = collections.map((c) => (c.id === id ? { ...c, status: 'indexing' as const } : c));
    showToast('Re-indexing started', 'success');
    await new Promise((r) => setTimeout(r, 2000));
    collections = collections.map((c) =>
      c.id === id ? { ...c, status: 'indexed' as const, lastUpdated: 'Just now' } : c
    );
  }

  async function handleDeleteCollection(id: string) {
    if (!confirm('Delete this collection? This cannot be undone.')) return;
    collections = collections.filter((c) => c.id !== id);
    showToast('Collection deleted', 'success');
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getTypeColor(type: MemoryType): string {
    return memoryTypes.find((t) => t.value === type)?.color ?? '#6b7280';
  }
  // ── Skills state ──────────────────────────────────────────────────────────
  let skills = $state<SkillSummary[]>([]);
  let skillsLoading = $state(true);
  let skillsError = $state<string | null>(null);
  let enabledIds = $state<Set<string>>(new Set());
  let skillsSaving = $state(false);
  let showAddCustom = $state(false);
  let customDescription = $state('');
  let generatingMd = $state(false);
  let generatedMd = $state('');
  let expandedSkillId = $state<string | null>(null);
  let expandedSkillDetail = $state<{ tools?: string[] } | null>(null);
  let showCreateInHouse = $state(false);
  let createName = $state('');
  let createDescription = $state('');
  let creating = $state(false);
  let createError = $state<string | null>(null);

  // ── Skills actions ──────────────────────────────────────────────────────
  async function loadSkills() {
    skillsLoading = true;
    skillsError = null;
    try {
      const [skillsList, settings] = await Promise.all([getSkills(), settingsStore.load()]);
      skills = skillsList;
      const ids = settings?.skills?.enabledIds;
      if (ids && ids.length > 0) {
        const filtered = new Set(ids.filter((id) => skillsList.some((s) => s.id === id)));
        enabledIds = filtered.size > 0 ? filtered : new Set(skillsList.map((s) => s.id));
      } else {
        enabledIds = new Set(skillsList.map((s) => s.id));
      }
    } catch (e) {
      skillsError = (e as Error).message;
      showToast('Failed to load skills', 'error');
    } finally {
      skillsLoading = false;
    }
  }

  async function toggleSkill(id: string) {
    const next = new Set(enabledIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    enabledIds = next;
    await saveEnabledIds(Array.from(next));
  }

  async function saveEnabledIds(ids: string[]) {
    skillsSaving = true;
    try {
      const ok = await settingsStore.save({ skills: { enabledIds: ids } });
      if (ok) showToast('Skills updated', 'success');
      else {
        showToast('Failed to save skills', 'error');
        await loadSkills();
      }
    } catch {
      showToast('Failed to save skills', 'error');
      await loadSkills();
    } finally {
      skillsSaving = false;
    }
  }

  async function generateCustomSkill() {
    if (!customDescription.trim()) return;
    generatingMd = true;
    generatedMd = '';
    try {
      const content = await generateSkillMd(customDescription.trim());
      generatedMd = content;
      showToast('Skill template generated', 'success');
    } catch {
      showToast('Failed to generate skill', 'error');
    } finally {
      generatingMd = false;
    }
  }

  function copyGeneratedMd() {
    if (!generatedMd) return;
    navigator.clipboard
      .writeText(generatedMd)
      .then(() => showToast('Copied to clipboard', 'success'));
  }

  function closeAddCustom() {
    showAddCustom = false;
    customDescription = '';
    generatedMd = '';
  }

  async function toggleExpand(id: string) {
    if (expandedSkillId === id) {
      expandedSkillId = null;
      expandedSkillDetail = null;
      return;
    }
    expandedSkillId = id;
    expandedSkillDetail = null;
    try {
      expandedSkillDetail = await getSkill(id);
    } catch {
      expandedSkillDetail = {};
    }
  }

  async function handleCreateInHouse() {
    if (!createName.trim() || !createDescription.trim()) return;
    creating = true;
    createError = null;
    try {
      const result = await createUserSkill({
        name: createName.trim(),
        description: createDescription.trim(),
      });
      if (result.success) {
        showToast('In-house skill created', 'success');
        showCreateInHouse = false;
        createName = '';
        createDescription = '';
        await loadSkills();
      } else {
        createError = result.error ?? 'Failed to create skill';
        showToast(createError, 'error');
      }
    } catch (e) {
      createError = (e as Error).message;
      showToast(createError, 'error');
    } finally {
      creating = false;
    }
  }

  function closeCreateInHouse() {
    showCreateInHouse = false;
    createName = '';
    createDescription = '';
    createError = null;
  }
</script>

<div class="knowledge-base">
  <!-- Header -->
  <header class="header">
    <button class="back-btn" onclick={onBack} type="button">
      <ArrowLeft size={20} /> Back
    </button>
    <div class="header-content">
      <h1>Knowledge Base</h1>
      <p class="subtitle">Memories, documents, skills, and MCP servers</p>
    </div>
  </header>

  <!-- Tabs -->
  <div class="tab-bar">
    <button
      class="tab-btn"
      class:active={activeTab === 'memories'}
      onclick={() => (activeTab = 'memories')}
    >
      <Brain size={16} /> Memories
      <span class="tab-count">{memories.length}</span>
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === 'documents'}
      onclick={() => (activeTab = 'documents')}
    >
      <Database size={16} /> Documents
      <span class="tab-count">{totalDocuments}</span>
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === 'skills'}
      onclick={() => {
        activeTab = 'skills';
        if (skills.length === 0 && skillsLoading) loadSkills();
      }}
    >
      <BookOpen size={16} /> Skills
      <span class="tab-count">{skills.length}</span>
    </button>
    <button class="tab-btn" class:active={activeTab === 'mcp'} onclick={() => (activeTab = 'mcp')}>
      <Server size={16} /> MCP
    </button>
  </div>

  <!-- Tab content -->
  <div class="tab-content">
    {#if activeTab === 'memories'}
      <!-- ─── MEMORIES TAB ─── -->
      <div class="toolbar">
        <div class="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search memories..."
            bind:value={memorySearch}
            onkeydown={(e) => e.key === 'Enter' && handleSearchMemories()}
          />
          {#if memorySearch}
            <button
              class="clear-btn"
              onclick={() => {
                memorySearch = '';
                loadMemories();
              }}
            >
              <X size={14} />
            </button>
          {/if}
        </div>
        <div class="filter-group">
          <Filter size={14} />
          <select bind:value={memoryTypeFilter} onchange={() => loadMemories()}>
            <option value="all">All types</option>
            {#each memoryTypes as mt}
              <option value={mt.value}>{mt.label}</option>
            {/each}
          </select>
        </div>
        <button class="action-btn primary" onclick={() => (showAddMemoryModal = true)}>
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
          <button class="action-btn primary" onclick={() => (showAddMemoryModal = true)}>
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
                  style="background: {getTypeColor(memory.type)}20; color: {getTypeColor(
                    memory.type
                  )}"
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
                  onclick={() => handleDeleteMemory(memory.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {:else if activeTab === 'skills'}
      <!-- ─── SKILLS TAB ─── -->
      {#if skillsLoading}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading skills...</p>
        </div>
      {:else if skillsError}
        <div class="empty-state">
          <BookOpen size={40} />
          <h3>Could not load skills</h3>
          <p>{skillsError}</p>
          <button class="action-btn primary" onclick={loadSkills}>Retry</button>
        </div>
      {:else}
        <div class="skills-content">
          <section class="skills-section">
            <h2>Built-in Skills</h2>
            <p class="section-desc">
              These skills extend your AI's capabilities. Toggle to enable or disable.
            </p>
            <div class="skills-list">
              {#each skills as skill (skill.id)}
                <div class="skill-card" class:enabled={enabledIds.has(skill.id)}>
                  <div class="skill-header">
                    <button
                      type="button"
                      class="skill-toggle"
                      role="switch"
                      aria-checked={enabledIds.has(skill.id)}
                      onclick={() => toggleSkill(skill.id)}
                      disabled={skillsSaving}
                      title={enabledIds.has(skill.id) ? 'Disable' : 'Enable'}
                    >
                      <span class="toggle-track"><span class="toggle-thumb"></span></span>
                    </button>
                    <div class="skill-info">
                      <h3 class="skill-name">{skill.name}</h3>
                      {#if skill.description}
                        <p class="skill-desc">{skill.description}</p>
                      {/if}
                      {#if skill.category}
                        <span class="skill-category">{skill.category}</span>
                      {/if}
                    </div>
                    <button
                      type="button"
                      class="expand-btn"
                      onclick={() => toggleExpand(skill.id)}
                      aria-expanded={expandedSkillId === skill.id}
                    >
                      {expandedSkillId === skill.id ? '−' : '+'}
                    </button>
                  </div>
                  {#if expandedSkillId === skill.id}
                    <div class="skill-details">
                      {#if expandedSkillDetail === null}
                        <p class="detail-row">Loading...</p>
                      {:else}
                        {#if skill.version}
                          <p class="detail-row"><strong>Version:</strong> {skill.version}</p>
                        {/if}
                        {#if skill.tags && skill.tags.length > 0}
                          <p class="detail-row"><strong>Tags:</strong> {skill.tags.join(', ')}</p>
                        {/if}
                        {#if skill.capabilities && skill.capabilities.length > 0}
                          <p class="detail-row">
                            <strong>Capabilities:</strong>
                            {skill.capabilities.join(', ')}
                          </p>
                        {/if}
                        {#if expandedSkillDetail?.tools && expandedSkillDetail.tools.length > 0}
                          <p class="detail-row">
                            <strong>Tools:</strong>
                            {expandedSkillDetail.tools.join(', ')}
                          </p>
                        {/if}
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </section>

          <section class="skills-section">
            <h2>Add Custom Skill</h2>
            <p class="section-desc">Generate a SKILL.md template from a description.</p>
            {#if !showAddCustom}
              <button class="action-btn secondary" onclick={() => (showAddCustom = true)}
                >Add custom skill</button
              >
            {:else}
              <div class="add-custom-form">
                <label for="skill-desc">Describe the skill</label>
                <textarea
                  id="skill-desc"
                  bind:value={customDescription}
                  placeholder="Describe what the skill should do..."
                  rows="3"
                  disabled={generatingMd}
                ></textarea>
                <div class="add-custom-actions">
                  <button
                    class="action-btn primary"
                    onclick={generateCustomSkill}
                    disabled={generatingMd || !customDescription.trim()}
                  >
                    {generatingMd ? 'Generating...' : 'Generate SKILL.md'}
                  </button>
                  <button class="action-btn secondary" onclick={closeAddCustom}>Cancel</button>
                </div>
                {#if generatedMd}
                  <div class="generated-md">
                    <span class="generated-label">Generated content</span>
                    <pre>{generatedMd}</pre>
                    <button class="action-btn secondary" onclick={copyGeneratedMd}
                      >Copy to clipboard</button
                    >
                  </div>
                {/if}
              </div>
            {/if}
          </section>

          <section class="skills-section">
            <h2>Create in-house skill</h2>
            <p class="section-desc">Add a custom skill that lives on the backend.</p>
            {#if !showCreateInHouse}
              <button class="action-btn secondary" onclick={() => (showCreateInHouse = true)}
                >Create in-house skill</button
              >
            {:else}
              <div class="add-custom-form">
                <label for="create-name">Name</label>
                <input
                  id="create-name"
                  type="text"
                  bind:value={createName}
                  placeholder="e.g. Code review for Python"
                  disabled={creating}
                />
                <label for="create-desc">Description</label>
                <textarea
                  id="create-desc"
                  bind:value={createDescription}
                  placeholder="What does this skill do?"
                  rows="3"
                  disabled={creating}
                ></textarea>
                {#if createError}
                  <p class="create-error">{createError}</p>
                {/if}
                <div class="add-custom-actions">
                  <button
                    class="action-btn primary"
                    onclick={handleCreateInHouse}
                    disabled={creating || !createName.trim() || !createDescription.trim()}
                  >
                    {creating ? 'Creating...' : 'Create skill'}
                  </button>
                  <button
                    class="action-btn secondary"
                    onclick={closeCreateInHouse}
                    disabled={creating}>Cancel</button
                  >
                </div>
              </div>
            {/if}
          </section>

          <div class="assignment-note">
            <span class="note-icon">ℹ</span>
            <span>Currently {enabledIds.size} of {skills.length} skills are enabled.</span>
          </div>
        </div>
      {/if}
    {:else if activeTab === 'mcp'}
      <!-- ─── MCP TAB ─── -->
      <div class="mcp-tab-content">
        <McpServersCard />
      </div>
    {/if}
  </div>
</div>

<!-- Add Memory Modal -->
{#if showAddMemoryModal}
  <div
    class="modal-overlay"
    role="button"
    tabindex="-1"
    onclick={() => (showAddMemoryModal = false)}
    onkeydown={(e) => e.key === 'Escape' && (showAddMemoryModal = false)}
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
              onclick={() => (newMemoryType = mt.value)}
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
          bind:value={newMemoryContent}
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
          bind:value={newMemoryImportance}
        />
      </div>

      <div class="form-group">
        <label for="memory-tags">Tags (comma-separated)</label>
        <input
          type="text"
          id="memory-tags"
          bind:value={newMemoryTags}
          placeholder="e.g., coding, preferences, project-x"
        />
      </div>

      <div class="modal-actions">
        <button class="action-btn secondary" onclick={() => (showAddMemoryModal = false)}
          >Cancel</button
        >
        <button
          class="action-btn primary"
          onclick={handleCreateMemory}
          disabled={!newMemoryContent.trim() || memoryProcessing}
        >
          {memoryProcessing ? 'Creating...' : 'Add Memory'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .knowledge-base {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  /* ── Header ── */
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

  /* ── Tabs ── */
  .tab-bar {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem 1.5rem;
    border-bottom: 1px solid var(--color-border-light, #e5e7eb);
    background: var(--color-bg-subtle, #fafafa);
    flex-shrink: 0;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border: none;
    background: transparent;
    border-radius: 8px 8px 0 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-muted, #71717a);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
  }

  .tab-btn:hover {
    color: var(--color-text, #18181b);
  }

  .tab-btn.active {
    color: var(--color-primary, #7c3aed);
    border-bottom-color: var(--color-primary, #7c3aed);
    background: var(--color-bg-card, #fff);
  }

  .tab-count {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    border-radius: 10px;
    background: var(--color-bg-subtle, #f4f4f5);
  }

  .tab-btn.active .tab-count {
    background: var(--color-primary, #7c3aed);
    color: white;
  }

  /* ── Tab content ── */
  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

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

  .action-btn.secondary {
    background: var(--color-bg-card, #fff);
    color: var(--color-text, #374151);
    border: 1px solid var(--color-border, #e5e7eb);
  }

  .action-btn.secondary:hover {
    background: var(--color-bg-card-hover, #f9fafb);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  /* ── Documents ── */
  .doc-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
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

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #18181b);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
    margin-top: 0.25rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-header h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }

  .collections-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .collection-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: 10px;
  }

  .collection-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }

  .collection-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: var(--color-bg-subtle, #f4f4f5);
    color: var(--color-primary, #7c3aed);
  }

  .collection-details h3 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }

  .collection-meta {
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .status-badge.indexed {
    background: #dcfce7;
    color: #15803d;
  }
  .status-badge.indexing {
    background: #fef3c7;
    color: #b45309;
  }
  .status-badge.error {
    background: #fee2e2;
    color: #b91c1c;
  }

  .collection-actions {
    display: flex;
    gap: 0.25rem;
  }

  /* ── Search test ── */
  .search-test {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .search-test .search-box {
    flex: 1;
  }

  .search-results {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .result-card {
    padding: 0.75rem 1rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: 8px;
  }

  .result-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
    font-size: 0.75rem;
  }

  .result-rank {
    font-weight: 700;
    color: var(--color-primary, #7c3aed);
  }

  .result-source {
    color: var(--color-text-muted, #71717a);
  }

  .result-score {
    margin-left: auto;
    font-weight: 500;
    color: #15803d;
  }

  .result-content {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-text, #18181b);
    line-height: 1.5;
  }

  /* ── Modal ── */
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

  :global(.spinning) {
    animation: spin 0.8s linear infinite;
  }

  /* ── Skills tab ── */
  .skills-content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .skills-section h2 {
    margin: 0 0 0.5rem;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }

  .section-desc {
    margin: 0 0 1rem;
    font-size: 0.875rem;
    color: var(--color-text-muted, #71717a);
  }

  .skills-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .skill-card {
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: 10px;
    padding: 1rem 1.25rem;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .skill-card.enabled {
    border-color: rgba(124, 58, 237, 0.4);
  }

  .skill-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .skill-toggle {
    flex-shrink: 0;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    margin-top: 2px;
  }

  .skill-toggle:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .toggle-track {
    display: block;
    width: 40px;
    height: 22px;
    background: var(--color-border, #d4d4d8);
    border-radius: 11px;
    position: relative;
    transition: background 0.2s;
  }

  .skill-card.enabled .toggle-track {
    background: var(--color-primary, #7c3aed);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s;
  }

  .skill-card.enabled .toggle-thumb {
    transform: translateX(18px);
  }

  .skill-info {
    flex: 1;
    min-width: 0;
  }

  .skill-name {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }

  .skill-desc {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--color-text-muted, #71717a);
    line-height: 1.4;
  }

  .skill-category {
    display: inline-block;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-primary, #7c3aed);
    background: rgba(124, 58, 237, 0.1);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .expand-btn {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-border, #d4d4d8);
    background: var(--color-bg-subtle, #f4f4f5);
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    color: var(--color-text-muted, #71717a);
  }

  .expand-btn:hover {
    background: var(--color-bg-card-hover, #e4e4e7);
  }

  .skill-details {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border-light, #e5e7eb);
  }

  .detail-row {
    margin: 0.25rem 0;
    font-size: 0.8rem;
    color: var(--color-text-muted, #71717a);
  }

  .add-custom-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 500px;
  }

  .add-custom-form label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text, #18181b);
  }

  .add-custom-form textarea,
  .add-custom-form input[type='text'] {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--color-border, #d4d4d8);
    border-radius: 8px;
    font-size: 0.9rem;
    resize: vertical;
    background: var(--color-bg-card, #fff);
    color: var(--color-text, #18181b);
  }

  .add-custom-form textarea:focus,
  .add-custom-form input[type='text']:focus {
    outline: none;
    border-color: var(--color-primary, #7c3aed);
  }

  .add-custom-actions {
    display: flex;
    gap: 0.75rem;
  }

  .generated-md {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--color-bg-subtle, #f4f4f5);
    border-radius: 8px;
  }

  .generated-md .generated-label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text, #18181b);
  }

  .generated-md pre {
    margin: 0 0 1rem;
    padding: 1rem;
    background: #fff;
    border: 1px solid var(--color-border, #d4d4d8);
    border-radius: 6px;
    font-size: 0.8rem;
    overflow-x: auto;
    white-space: pre-wrap;
  }

  .create-error {
    font-size: 0.875rem;
    color: var(--color-error, #dc2626);
    margin: 0;
  }

  .assignment-note {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(124, 58, 237, 0.08);
    border-radius: 8px;
    font-size: 0.875rem;
    color: var(--color-text-muted, #71717a);
  }

  .note-icon {
    font-size: 1.1rem;
  }

  /* ── MCP tab ── */
  .mcp-tab-content {
    padding: 0;
  }
</style>
