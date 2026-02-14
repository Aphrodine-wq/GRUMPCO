<script lang="ts">
  /**
   * KnowledgeBase – Unified Knowledge screen.
   * Combines Memory, Documents (RAG), Skills, and MCP Servers into a single tabbed interface.
   */
  import { onMount } from 'svelte';
  import { ArrowLeft, Brain, Database, BookOpen, Server } from 'lucide-svelte';
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
  import KBMemoriesTab from './knowledge/KBMemoriesTab.svelte';
  import KBSkillsTab from './knowledge/KBSkillsTab.svelte';
  import AddMemoryModal from './knowledge/AddMemoryModal.svelte';
  import {
    MEMORY_TYPES,
    INITIAL_COLLECTIONS,
    type DocCollection,
  } from './knowledge/knowledgeUtils';

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

  const memoryTypes = MEMORY_TYPES;

  let collections = $state<DocCollection[]>(INITIAL_COLLECTIONS);
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
      <KBMemoriesTab
        {filteredMemories}
        {memoriesLoading}
        {memorySearch}
        {memoryTypeFilter}
        onSearchMemories={handleSearchMemories}
        onLoadMemories={loadMemories}
        onDeleteMemory={handleDeleteMemory}
        onOpenAddModal={() => (showAddMemoryModal = true)}
        onSearchChange={(val) => (memorySearch = val)}
        onFilterChange={(val) => (memoryTypeFilter = val)}
      />
    {:else if activeTab === 'skills'}
      <KBSkillsTab
        {skills}
        {skillsLoading}
        {skillsError}
        {enabledIds}
        {skillsSaving}
        {expandedSkillId}
        {expandedSkillDetail}
        {showAddCustom}
        {customDescription}
        {generatingMd}
        {generatedMd}
        {showCreateInHouse}
        {createName}
        {createDescription}
        {creating}
        {createError}
        onLoadSkills={loadSkills}
        onToggleSkill={toggleSkill}
        onToggleExpand={toggleExpand}
        onGenerateCustomSkill={generateCustomSkill}
        onCopyGeneratedMd={copyGeneratedMd}
        onCloseAddCustom={closeAddCustom}
        onHandleCreateInHouse={handleCreateInHouse}
        onCloseCreateInHouse={closeCreateInHouse}
        onSetShowAddCustom={(val) => (showAddCustom = val)}
        onSetShowCreateInHouse={(val) => (showCreateInHouse = val)}
        onSetCustomDescription={(val) => (customDescription = val)}
        onSetCreateName={(val) => (createName = val)}
        onSetCreateDescription={(val) => (createDescription = val)}
      />
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
  <AddMemoryModal
    {newMemoryContent}
    {newMemoryType}
    {newMemoryImportance}
    {newMemoryTags}
    {memoryProcessing}
    onClose={() => (showAddMemoryModal = false)}
    onCreate={handleCreateMemory}
    onContentChange={(val) => (newMemoryContent = val)}
    onTypeChange={(val) => (newMemoryType = val)}
    onImportanceChange={(val) => (newMemoryImportance = val)}
    onTagsChange={(val) => (newMemoryTags = val)}
  />
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

  :global(.spinning) {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── MCP tab ── */
  .mcp-tab-content {
    padding: 0;
  }
</style>
