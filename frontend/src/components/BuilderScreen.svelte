<script lang="ts">
  /**
   * BuilderScreen – multi-step Builder flow: landing → prompt → mermaid+cards → build stream → next/done → save/git.
   */
  import { onMount } from 'svelte';
  import { setCurrentView } from '../stores/uiStore';
  import { workspaceStore } from '../stores/workspaceStore';
  import {
    loadBuilderSessions,
    createBuilderSession,
    getBuilderSession,
    generateBuilderMermaid,
    buildBuilderSection,
    builderGit,
    builderSessions,
    builderCurrentSession,
    builderLoading,
    builderError,
    setBuilderCurrentSession,
    clearBuilderError,
    type BuilderDestination,
    type BuildStreamEvent,
  } from '../stores/builderStore';
  import { parseMermaidSections, type MermaidSection } from '../lib/mermaidParser';
  import { initializeMermaid, renderDiagram } from '../lib/mermaid';
  import FrownyFace from './FrownyFace.svelte';
  import { showToast } from '../stores/toastStore';
  import {
    ArrowLeft,
    FolderPlus,
    GitBranch,
    Lock,
    CheckCircle2,
    FolderOpen,
    Loader2,
  } from 'lucide-svelte';
  import { Button, Input } from '../lib/design-system';
  import { fetchApi } from '../lib/api.js';

  interface ModelListItem {
    id: string;
    provider: string;
    description?: string;
  }
  interface ModelListGroup {
    provider: string;
    displayName: string;
    models: ModelListItem[];
  }

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

  type Step = 'list' | 'landing' | 'prompt' | 'mermaid' | 'build' | 'done';
  let step = $state<Step>('list');
  let projectName = $state('');
  let destination = $state<BuilderDestination>('local');
  let projectProvider = $state<string>('');
  let projectModelId = $state<string>('');
  let sectionOverrideProvider = $state<string>('');
  let sectionOverrideModelId = $state<string>('');
  let modelGroups = $state<ModelListGroup[]>([]);
  let modelGroupsLoading = $state(false);
  let prompt = $state('');
  let refinementMessages = $state<string[]>([]);
  let refinementInput = $state('');
  let mermaidSvg = $state<string | null>(null);
  let mermaidId = $state(0);
  let sections = $state<MermaidSection[]>([]);
  let _selectedSectionId = $state<string | null>(null);
  let buildEvents = $state<BuildStreamEvent[]>([]);
  let building = $state(false);
  let buildDone = $state(false);
  let gitResult = $state<{ repoUrl?: string; pushed?: boolean } | null>(null);

  const session = $derived($builderCurrentSession);
  const workspaceRoot = $derived($workspaceStore?.root ?? null);

  function handleBack() {
    onBack?.() ?? setCurrentView('chat');
  }

  function goToList() {
    step = 'list';
    setBuilderCurrentSession(null);
  }

  function goToLanding() {
    step = 'landing';
    projectName = '';
    destination = 'local';
    setBuilderCurrentSession(null);
  }

  async function loadSessions() {
    await loadBuilderSessions();
  }

  onMount(() => {
    loadSessions();
    modelGroupsLoading = true;
    fetchApi('/api/models/list')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to fetch'))))
      .then((d: { groups?: ModelListGroup[] }) => {
        modelGroups = d.groups ?? [];
      })
      .catch(() => {
        modelGroups = [];
      })
      .finally(() => {
        modelGroupsLoading = false;
      });
  });

  async function handleCreateSession() {
    if (!workspaceRoot?.trim()) {
      showToast('Set a workspace folder first (Settings or open a folder)', 'error');
      return;
    }
    const name = projectName.trim() || 'builder-project';
    clearBuilderError();
    try {
      await createBuilderSession({
        projectName: name,
        workspaceRoot: workspaceRoot.trim(),
        destination,
        defaultProvider: projectProvider || undefined,
        defaultModelId: projectModelId || undefined,
      });
      step = 'prompt';
      prompt = '';
      refinementMessages = [];
      refinementInput = '';
    } catch (e) {
      showToast(($builderError ?? (e as Error).message) as string, 'error');
    }
  }

  async function handleGenerateMermaid() {
    if (!session?.id || !prompt.trim()) return;
    clearBuilderError();
    try {
      await generateBuilderMermaid(session.id, prompt.trim(), refinementMessages);
      step = 'mermaid';
      await renderMermaid();
    } catch (e) {
      showToast(($builderError ?? (e as Error).message) as string, 'error');
    }
  }

  async function handleAddRefinement() {
    if (!refinementInput.trim()) return;
    refinementMessages = [...refinementMessages, refinementInput.trim()];
    refinementInput = '';
    if (refinementMessages.length >= 2) return;
    clearBuilderError();
    try {
      await generateBuilderMermaid(session!.id, prompt.trim(), refinementMessages);
      await renderMermaid();
    } catch (e) {
      showToast(($builderError ?? (e as Error).message) as string, 'error');
    }
  }

  function handleLockDiagram() {
    step = 'mermaid';
    renderMermaid();
  }

  async function renderMermaid() {
    if (!session?.mermaid) return;
    initializeMermaid();
    const id = `builder-mermaid-${++mermaidId}`;
    try {
      const { svg } = await renderDiagram(id, session.mermaid);
      mermaidSvg = svg;
      sections = parseMermaidSections(session.mermaid);
    } catch {
      mermaidSvg = `<pre class="error">Failed to render diagram</pre>`;
      sections = [];
    }
  }

  async function handleSelectSection(sectionId: string) {
    const completed = session?.completedSectionIds ?? [];
    if (completed.includes(sectionId)) return;
    _selectedSectionId = sectionId;
    step = 'build';
    buildEvents = [];
    building = true;
    buildDone = false;
    if (!session?.id) return;
    const provider = sectionOverrideProvider || session.defaultProvider;
    const modelId = sectionOverrideModelId || session.defaultModelId;
    const opts = provider && modelId ? { provider, modelId } : undefined;
    try {
      await buildBuilderSection(
        session.id,
        sectionId,
        (event) => {
          buildEvents = [...buildEvents, event];
        },
        opts
      );
      building = false;
      buildDone = true;
      showToast('Section built', 'success');
    } catch (e) {
      building = false;
      showToast(($builderError ?? (e as Error).message) as string, 'error');
    }
  }

  function handleMoveToNext() {
    step = 'mermaid';
    _selectedSectionId = null;
    buildEvents = [];
    buildDone = false;
    getBuilderSession(session!.id).catch(() => {});
  }

  function handleImDone() {
    step = 'done';
    gitResult = null;
  }

  async function handleGitInit() {
    if (!session?.id) return;
    clearBuilderError();
    try {
      const result = await builderGit(session.id, { createRemote: false });
      gitResult = result;
      showToast('Git initialized and first commit created', 'success');
    } catch (e) {
      showToast(($builderError ?? (e as Error).message) as string, 'error');
    }
  }

  async function handleGitCreateAndPush() {
    if (!session?.id) return;
    clearBuilderError();
    try {
      const result = await builderGit(session.id, { createRemote: true });
      gitResult = result;
      showToast(result.pushed ? 'Pushed to GitHub' : 'Done', 'success');
    } catch (e) {
      showToast(($builderError ?? (e as Error).message) as string, 'error');
    }
  }

  function openFolder() {
    if (!session?.path) return;
    try {
      const w = window as unknown as { openPath?: (p: string) => void };
      if (typeof w.openPath === 'function') {
        w.openPath(session.path);
      } else {
        showToast('Open folder: ' + session.path, 'info');
      }
    } catch {
      showToast('Open folder: ' + session.path, 'info');
    }
  }

  async function handleResumeSession(s: { id: string }) {
    clearBuilderError();
    try {
      const sess = await getBuilderSession(s.id);
      setBuilderCurrentSession(sess);
      if (sess.mermaid) {
        step = 'mermaid';
        await renderMermaid();
      } else {
        step = 'prompt';
      }
    } catch (e) {
      showToast(($builderError ?? (e as Error).message) as string, 'error');
    }
  }

  const completedIds = $derived(session?.completedSectionIds ?? []);
  const allSectionsCompleted = $derived(
    sections.length > 0 && sections.every((s) => completedIds.includes(s.id))
  );
</script>

<div class="builder-screen">
  <header class="builder-header">
    <Button
      variant="ghost"
      size="sm"
      onclick={step === 'list' ? handleBack : goToList}
      title="Back"
    >
      <ArrowLeft size={16} />
      Back
    </Button>
    <div class="header-text">
      <h1>Builder</h1>
      <p class="subtitle">
        {#if step === 'list'}
          New project or resume
        {:else if step === 'landing'}
          Name your project
        {:else if step === 'prompt'}
          Describe your system
        {:else if step === 'mermaid'}
          What would you like to build first?
        {:else if step === 'build'}
          Building…
        {:else}
          Save or push to Git
        {/if}
      </p>
    </div>
  </header>

  <main class="builder-main">
    {#if step === 'list'}
      <div class="builder-list">
        <div class="builder-actions">
          <Button onclick={goToLanding}>
            <span class="new-btn">
              <FolderPlus size={18} />
              New project
            </span>
          </Button>
        </div>
        {#if $builderLoading}
          <p class="loading-text">Loading sessions…</p>
        {:else if $builderSessions?.length > 0}
          <div class="recent-list">
            <p class="recent-label">Recent</p>
            {#each $builderSessions as s (s.id)}
              <button type="button" class="recent-item" onclick={() => handleResumeSession(s)}>
                <span class="recent-name">{s.projectName}</span>
                <span class="recent-path">{s.path}</span>
              </button>
            {/each}
          </div>
        {:else}
          <p class="empty-hint">No Builder projects yet. Create one to get started.</p>
        {/if}
      </div>
    {:else if step === 'landing'}
      <div class="builder-landing">
        {#if !workspaceRoot}
          <p class="workspace-warn">
            Set a workspace folder first (e.g. in Settings) so we can create your project there.
          </p>
        {/if}
        <div class="landing-form">
          <Input
            type="text"
            placeholder="my-project"
            bind:value={projectName}
            label="Project name"
            fullWidth
          />
          <div class="destination-options">
            <span class="field-label">Destination</span>
            <div class="destination-btns">
              <button
                type="button"
                class="dest-btn"
                class:selected={destination === 'local'}
                onclick={() => (destination = 'local')}
              >
                <FolderPlus size={18} />
                Make a new folder (Local)
              </button>
              <button
                type="button"
                class="dest-btn"
                class:selected={destination === 'git'}
                onclick={() => (destination = 'git')}
              >
                <GitBranch size={18} />
                New Git repo
              </button>
            </div>
            <p class="field-hint">
              {destination === 'local'
                ? 'Files are written to your workspace. You can init Git later.'
                : 'We will create the folder, then you can init Git and optionally create a remote and push.'}
            </p>
          </div>
          {#if !modelGroupsLoading && modelGroups.length > 0}
            <div class="field-group model-picker-group">
              <label class="field-label" for="builder-project-provider"
                >Model for this project</label
              >
              <div class="model-picker-row">
                <select
                  id="builder-project-provider"
                  class="custom-select"
                  bind:value={projectProvider}
                  onchange={() => (projectModelId = '')}
                >
                  <option value="">— Use backend default —</option>
                  {#each modelGroups as group}
                    <option value={group.provider}>{group.displayName}</option>
                  {/each}
                </select>
                {#if projectProvider}
                  <select
                    id="builder-project-model"
                    class="custom-select"
                    bind:value={projectModelId}
                  >
                    <option value="">— Select model —</option>
                    {#each modelGroups.find((g) => g.provider === projectProvider)?.models ?? [] as model}
                      <option value={model.id}
                        >{model.id}{model.description && model.description !== model.id
                          ? ` — ${model.description}`
                          : ''}</option
                      >
                    {/each}
                  </select>
                {/if}
              </div>
              <p class="field-hint">Only providers you have configured (API keys) are shown.</p>
            </div>
          {/if}
          <Button onclick={handleCreateSession} disabled={!workspaceRoot || $builderLoading}>
            {#if $builderLoading}
              <span class="spin"><Loader2 size={16} /></span>
              Creating…
            {:else}
              Continue
            {/if}
          </Button>
        </div>
      </div>
    {:else if step === 'prompt'}
      <div class="builder-prompt">
        <p class="prompt-desc">
          Describe your system or product in one detailed prompt. We will generate a Mermaid
          architecture diagram (senior-engineer / CEO mindset).
        </p>
        <textarea
          class="prompt-input"
          placeholder="e.g. E-commerce platform with user auth, product catalog, cart, checkout, and admin dashboard. Microservices: auth, catalog, orders, payments."
          bind:value={prompt}
          rows="6"
        ></textarea>
        {#if refinementMessages.length > 0}
          <div class="refinements">
            <p class="field-label">Refinements applied ({refinementMessages.length}/2)</p>
            {#each refinementMessages as msg}
              <p class="refinement-msg">{msg}</p>
            {/each}
          </div>
        {/if}
        {#if session?.mermaid && refinementMessages.length < 2}
          <div class="refinement-input">
            <Input
              type="text"
              placeholder="e.g. Add a caching layer between catalog and DB"
              bind:value={refinementInput}
              label="Refine diagram (optional)"
              fullWidth
            />
            <Button
              variant="secondary"
              size="sm"
              onclick={handleAddRefinement}
              disabled={!refinementInput.trim() || $builderLoading}
            >
              Add refinement
            </Button>
          </div>
        {/if}
        <div class="prompt-actions">
          {#if session?.mermaid}
            <Button variant="secondary" onclick={handleLockDiagram}>
              <Lock size={16} />
              Lock diagram
            </Button>
          {/if}
          <Button onclick={handleGenerateMermaid} disabled={!prompt.trim() || $builderLoading}>
            {#if $builderLoading}
              <span class="spin"><Loader2 size={16} /></span>
              Generating…
            {:else}
              {session?.mermaid ? 'Regenerate' : 'Generate diagram'}
            {/if}
          </Button>
        </div>
      </div>
    {:else if step === 'mermaid'}
      <div class="builder-mermaid-view">
        {#if mermaidSvg}
          <div class="mermaid-container" class:error={mermaidSvg.includes('error')}>
            {@html mermaidSvg}
          </div>
        {/if}
        {#if modelGroups.length > 0}
          <div class="section-model-override">
            <label class="field-label" for="builder-section-provider"
              >Override model for next section (optional)</label
            >
            <div class="model-picker-row">
              <select
                id="builder-section-provider"
                class="custom-select"
                bind:value={sectionOverrideProvider}
                onchange={() => (sectionOverrideModelId = '')}
              >
                <option value="">Use project default</option>
                {#each modelGroups as group}
                  <option value={group.provider}>{group.displayName}</option>
                {/each}
              </select>
              {#if sectionOverrideProvider}
                <select
                  id="builder-section-model"
                  class="custom-select"
                  bind:value={sectionOverrideModelId}
                >
                  <option value="">— Select model —</option>
                  {#each modelGroups.find((g) => g.provider === sectionOverrideProvider)?.models ?? [] as model}
                    <option value={model.id}
                      >{model.id}{model.description && model.description !== model.id
                        ? ` — ${model.description}`
                        : ''}</option
                    >
                  {/each}
                </select>
              {/if}
            </div>
          </div>
        {/if}
        <p class="cards-label">What would you like to build first?</p>
        <div class="section-cards">
          {#each sections as sec (sec.id)}
            {@const done = completedIds.includes(sec.id)}
            <button
              type="button"
              class="section-card"
              class:completed={done}
              disabled={done}
              onclick={() => handleSelectSection(sec.id)}
            >
              {#if done}
                <span class="card-icon done"><CheckCircle2 size={20} /></span>
              {/if}
              <span class="card-title">{sec.title}</span>
            </button>
          {/each}
        </div>
        {#if allSectionsCompleted}
          <div class="done-actions">
            <Button onclick={handleImDone}>I'm done</Button>
          </div>
        {/if}
      </div>
    {:else if step === 'build'}
      <div class="builder-build-view">
        <div class="build-frowny">
          <FrownyFace size="lg" state={building ? 'thinking' : 'idle'} animated={building} />
        </div>
        <div class="build-stream">
          {#each buildEvents as ev}
            {#if ev.type === 'narrative' && ev.text}
              <p class="stream-narrative">{ev.text}</p>
            {:else if ev.type === 'file' && ev.path}
              <div class="stream-file">
                <span class="file-path">Writing {ev.path}</span>
                {#if ev.snippet}
                  <pre class="file-snippet">{ev.snippet}</pre>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
        {#if buildDone}
          <div class="build-done-actions">
            <p class="build-done-text">Section done.</p>
            <Button onclick={handleMoveToNext}>Move to next section</Button>
          </div>
        {/if}
      </div>
    {:else if step === 'done'}
      <div class="builder-done">
        <p class="done-summary">Files have been saved to your project folder after each section.</p>
        <div class="done-actions-grid">
          <Button variant="secondary" onclick={openFolder}>
            <FolderOpen size={16} />
            Open folder
          </Button>
          {#if session?.destination === 'git'}
            <Button variant="secondary" onclick={handleGitInit} disabled={$builderLoading}>
              {#if $builderLoading}
                <span class="spin"><Loader2 size={16} /></span>
              {:else}
                Initialize Git and first commit
              {/if}
            </Button>
            <Button onclick={handleGitCreateAndPush} disabled={$builderLoading}>
              {#if $builderLoading}
                <span class="spin"><Loader2 size={16} /></span>
              {:else}
                Create repo and push
              {/if}
            </Button>
          {:else}
            <Button variant="secondary" onclick={handleGitInit} disabled={$builderLoading}>
              {#if $builderLoading}
                <span class="spin"><Loader2 size={16} /></span>
              {:else}
                Initialize Git and first commit
              {/if}
            </Button>
          {/if}
        </div>
        {#if gitResult?.repoUrl}
          <p class="git-result">
            Repo: <a href={gitResult.repoUrl} target="_blank" rel="noopener noreferrer"
              >{gitResult.repoUrl}</a
            >
          </p>
        {/if}
      </div>
    {/if}
  </main>
</div>

<style>
  .builder-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    padding: 1.5rem 1.25rem 0;
  }
  .builder-header {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    gap: 12px;
    flex-shrink: 0;
    margin-bottom: 16px;
    padding-top: 2rem;
  }
  .builder-header :global(button:first-of-type) {
    position: absolute;
    left: 0;
  }
  .header-text {
    text-align: center;
  }
  .header-text h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  .subtitle {
    margin: 4px 0 0;
    font-size: 0.875rem;
    color: var(--color-text-muted, #64748b);
  }
  .builder-main {
    flex: 1;
    overflow: auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  .builder-list {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    text-align: center;
    min-height: 300px;
  }
  .builder-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  .new-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .card-icon.done {
    display: inline-flex;
    color: var(--color-success, #059669);
  }
  .loading-text,
  .empty-hint {
    color: var(--color-text-muted, #64748b);
    font-size: 0.875rem;
  }
  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    max-width: 480px;
  }
  .recent-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #64748b);
    margin-bottom: 4px;
  }
  .recent-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 12px 16px;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    background: var(--color-bg, #fff);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }
  .recent-item:hover {
    background: var(--color-bg-subtle, #f8fafc);
  }
  .recent-name {
    font-weight: 500;
  }
  .recent-path {
    font-size: 0.75rem;
    color: var(--color-text-muted, #64748b);
    margin-top: 2px;
  }
  .builder-landing {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    width: 100%;
  }
  .workspace-warn {
    color: var(--color-warning, #b45309);
    font-size: 0.875rem;
    margin-bottom: 16px;
    text-align: center;
  }
  .landing-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 400px;
    width: 100%;
    text-align: left;
  }
  .builder-landing .destination-options {
    text-align: left;
  }
  .field-group {
    margin-bottom: 1rem;
    text-align: left;
  }
  .field-group .field-label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .model-picker-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .model-picker-row .custom-select {
    min-width: 140px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    font-size: 0.875rem;
    background: var(--color-bg, #fff);
  }
  .section-model-override {
    margin-bottom: 1rem;
    padding: 0.75rem;
    background: var(--color-bg-subtle, #f8fafc);
    border-radius: 8px;
    text-align: left;
  }
  .section-model-override .field-label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .destination-options .field-label {
    display: block;
    margin-bottom: 8px;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .destination-btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .dest-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    background: var(--color-bg, #fff);
    cursor: pointer;
    font-size: 0.875rem;
    transition:
      border-color 0.15s,
      background 0.15s;
  }
  .dest-btn:hover {
    border-color: var(--color-primary, #7c3aed);
    background: var(--color-bg-subtle, #f8fafc);
  }
  .dest-btn.selected {
    border-color: var(--color-primary, #7c3aed);
    background: rgba(124, 58, 237, 0.08);
  }
  .field-hint {
    font-size: 0.75rem;
    color: var(--color-text-muted, #64748b);
    margin-top: 6px;
  }
  .builder-prompt {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 560px;
    width: 100%;
    align-self: center;
    margin: 0 auto;
  }
  .prompt-desc {
    font-size: 0.875rem;
    color: var(--color-text-muted, #64748b);
  }
  .prompt-input {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    resize: vertical;
  }
  .refinements,
  .refinement-input {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .refinement-msg {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #64748b);
    padding: 6px 10px;
    background: var(--color-bg-subtle, #f8fafc);
    border-radius: 6px;
  }
  .prompt-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .builder-mermaid-view {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .mermaid-container {
    padding: 16px;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    background: var(--color-bg, #fff);
    overflow: auto;
  }
  .mermaid-container :global(svg) {
    max-width: 100%;
    height: auto;
  }
  .mermaid-container.error :global(pre) {
    color: var(--color-error, #dc2626);
    font-size: 0.8125rem;
  }
  .cards-label {
    font-weight: 500;
    font-size: 0.9375rem;
  }
  .section-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }
  .section-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    background: var(--color-bg, #fff);
    cursor: pointer;
    text-align: left;
    font-size: 0.875rem;
    transition:
      border-color 0.15s,
      background 0.15s;
  }
  .section-card:not(.completed):hover {
    border-color: var(--color-primary, #7c3aed);
    background: var(--color-bg-subtle, #f8fafc);
  }
  .section-card.completed {
    cursor: default;
    opacity: 0.7;
    background: var(--color-bg-subtle, #f8fafc);
  }
  .card-title {
    flex: 1;
  }
  .done-actions {
    margin-top: 8px;
  }
  .builder-build-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 24px;
  }
  .build-frowny {
    flex-shrink: 0;
  }
  .build-stream {
    width: 100%;
    max-width: 560px;
    max-height: 320px;
    overflow: auto;
    padding: 16px;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    background: var(--color-bg-subtle, #f8fafc);
    font-size: 0.8125rem;
  }
  .stream-narrative {
    margin: 0 0 6px;
    color: var(--color-text, #0f172a);
  }
  .stream-file {
    margin: 8px 0 0;
  }
  .file-path {
    font-weight: 500;
  }
  .file-snippet {
    margin: 4px 0 0;
    padding: 8px;
    background: var(--color-bg, #fff);
    border-radius: 4px;
    font-size: 0.75rem;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .build-done-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .build-done-text {
    margin: 0;
    font-size: 0.9375rem;
  }
  .builder-done {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 480px;
  }
  .done-summary {
    font-size: 0.875rem;
    color: var(--color-text-muted, #64748b);
  }
  .done-actions-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .git-result {
    font-size: 0.8125rem;
  }
  .git-result a {
    color: var(--color-primary, #7c3aed);
  }
  .spin {
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
