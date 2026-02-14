<script lang="ts">
  /**
   * SectionPickerModal — Inline Chat Card (Optimized)
   *
   * Lightweight card shown after architecture approval.
   * Parses Mermaid chart into selectable sections.
   * No heavy animations — instant rendering for speed.
   */
  import { createEventDispatcher } from 'svelte';
  import { workspaceStore } from '../stores/workspaceStore';
  import {
    Database,
    Server,
    Shield,
    Palette,
    Cog,
    Zap,
    TestTube,
    Rocket,
    Bell,
    Mail,
    Link,
    BarChart3,
    User,
    MessageCircle,
    Package,
    FolderOpen,
    X,
    ChevronRight,
    Layers,
    Plug,
  } from 'lucide-svelte';

  interface MermaidSection {
    id: string;
    label: string;
    description: string;
    iconKey: string;
  }

  interface Props {
    open?: boolean;
    mermaidCode?: string;
  }

  let { open = $bindable(false), mermaidCode = '' }: Props = $props();

  const dispatch = createEventDispatcher();
  let sections = $state<MermaidSection[]>([]);
  let workspacePath = $state('');
  let showFolderInput = $state(false);

  // Load stored workspace path
  $effect(() => {
    const unsub = workspaceStore.subscribe((v) => {
      workspacePath = v.root || '';
    });
    return unsub;
  });

  // Parse mermaid code into sections when modal opens
  $effect(() => {
    if (open && mermaidCode) {
      sections = parseMermaidSections(mermaidCode);
    }
  });

  // Icon mapping — keyword to Lucide component
  const iconRegistry: Record<string, typeof Database> = {
    database: Database,
    db: Database,
    storage: Database,
    postgres: Database,
    mysql: Database,
    mongo: Database,
    api: Plug,
    gateway: Plug,
    endpoint: Plug,
    route: Plug,
    rest: Plug,
    auth: Shield,
    login: Shield,
    security: Shield,
    jwt: Shield,
    oauth: Shield,
    ui: Palette,
    frontend: Palette,
    client: Palette,
    view: Palette,
    react: Palette,
    server: Server,
    backend: Server,
    service: Cog,
    worker: Cog,
    cache: Zap,
    redis: Zap,
    queue: Zap,
    websocket: Zap,
    ws: Zap,
    socket: Zap,
    test: TestTube,
    spec: TestTube,
    deploy: Rocket,
    ci: Rocket,
    docker: Rocket,
    config: Cog,
    env: Cog,
    settings: Cog,
    notification: Bell,
    email: Mail,
    webhook: Link,
    monitor: BarChart3,
    log: BarChart3,
    analytics: BarChart3,
    user: User,
    message: MessageCircle,
    chat: MessageCircle,
  };

  function getIcon(key: string): typeof Database {
    return iconRegistry[key] || Package;
  }

  function parseMermaidSections(code: string): MermaidSection[] {
    const parsed: MermaidSection[] = [];
    const lines = code.split('\n');
    const subgraphRegex = /^\s*subgraph\s+(.+)/i;
    const participantRegex = /^\s*(?:participant|actor)\s+(\w+)(?:\s+as\s+(.+))?/i;
    const arrowRegex = /^\s*(\w+)\s*[-=.]+>+\|?\s*(\w+)/;
    let currentSubgraph = '';
    const seenIds = new Set<string>();

    function addSection(id: string, label: string) {
      if (seenIds.has(id)) return;
      seenIds.add(id);
      const lower = label.toLowerCase();

      let iconKey = 'package';
      for (const keyword of Object.keys(iconRegistry)) {
        if (lower.includes(keyword)) {
          iconKey = keyword;
          break;
        }
      }

      // Simplify label to a single primary word
      const singleWord = label.replace(/[\[\](){}"']/g, '').split(/[\s_-]+/)[0] || label;

      parsed.push({
        id,
        label: singleWord,
        description: '',
        iconKey,
      });
    }

    for (const line of lines) {
      if (
        /^\s*(sequenceDiagram|graph|flowchart|classDiagram|stateDiagram|erDiagram|gantt|pie)/i.test(
          line
        )
      )
        continue;
      if (/^\s*%%/.test(line)) continue;

      const subgraphMatch = line.match(subgraphRegex);
      if (subgraphMatch) {
        currentSubgraph = subgraphMatch[1].replace(/["']/g, '').trim();
        continue;
      }
      if (line.trim() === 'end') {
        currentSubgraph = '';
        continue;
      }

      const participantMatch = line.match(participantRegex);
      if (participantMatch) {
        const id = participantMatch[1].trim();
        const label = (participantMatch[2] || participantMatch[1]).replace(/["']/g, '').trim();
        addSection(id, label);
        continue;
      }

      const nodeMatch = line.match(/^\s*(\w+)\s*[\[({|]([^\])}|]+)[\])}|]/);
      if (nodeMatch) {
        addSection(nodeMatch[1].trim(), nodeMatch[2].trim().replace(/["']/g, ''));
        continue;
      }

      const arrowMatch = line.match(arrowRegex);
      if (arrowMatch) {
        if (!seenIds.has(arrowMatch[1].trim()))
          addSection(arrowMatch[1].trim(), arrowMatch[1].trim());
        if (!seenIds.has(arrowMatch[2].trim()))
          addSection(arrowMatch[2].trim(), arrowMatch[2].trim());
      }
    }

    if (parsed.length === 0) {
      parsed.push({
        id: 'full-project',
        label: 'Full Project',
        description: 'Build the entire project',
        iconKey: 'deploy',
      });
    }

    return parsed;
  }

  async function handleSelectFolder() {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        workspacePath = dirHandle.name;
        workspaceStore.setWorkspace(workspacePath);
      } catch {
        // User cancelled
      }
    } else {
      showFolderInput = !showFolderInput;
    }
  }

  function handleFolderInputSubmit() {
    if (workspacePath.trim()) {
      workspaceStore.setWorkspace(workspacePath.trim());
      showFolderInput = false;
    }
  }

  function handleSelectSection(section: MermaidSection) {
    if (!workspacePath.trim()) {
      showFolderInput = true;
      return;
    }
    workspaceStore.setWorkspace(workspacePath.trim());
    dispatch('select-section', {
      sectionId: section.id,
      sectionLabel: section.label,
      mermaidCode,
      allSections: sections,
    });
    open = false;
  }

  function handleClose() {
    open = false;
    dispatch('close');
  }
</script>

{#if open}
  <div class="picker-card">
    <!-- Header -->
    <div class="card-header">
      <div class="card-icon">
        <Layers size={16} />
      </div>
      <div class="card-title-group">
        <div class="card-title">Sections</div>
      </div>
      <span class="card-count">{sections.length}</span>
      <button class="close-btn" onclick={handleClose} aria-label="Close">
        <X size={14} />
      </button>
    </div>

    <!-- Folder picker -->
    <div class="folder-row">
      <button class="folder-btn" onclick={handleSelectFolder}>
        <FolderOpen size={14} />
        <span class="folder-path">{workspacePath || 'Set workspace folder...'}</span>
      </button>
      {#if showFolderInput}
        <div class="folder-input-row">
          <input
            type="text"
            class="folder-input"
            bind:value={workspacePath}
            placeholder="C:\Users\...\my-project"
            onkeydown={(e) => {
              if (e.key === 'Enter') handleFolderInputSubmit();
            }}
          />
          <button class="folder-save-btn" onclick={handleFolderInputSubmit}>Set</button>
        </div>
      {/if}
    </div>

    <!-- Sections list -->
    <div class="sections-list">
      {#each sections as section (section.id)}
        {@const SectionIcon = getIcon(section.iconKey)}
        <button class="section-row" onclick={() => handleSelectSection(section)}>
          <div class="section-icon">
            <SectionIcon size={14} />
          </div>
          <span class="section-label">{section.label}</span>
          <ChevronRight size={12} class="row-arrow" />
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  /* ── Picker card: lightweight inline card ── */
  .picker-card {
    margin: 0.25rem 0;
    padding: 0;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-left: 3px solid var(--color-primary, #7c3aed);
    border-radius: 0 0.5rem 0.5rem 0;
    width: 100%;
    overflow: hidden;
    contain: content;
  }

  /* ── Header ── */
  .card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.25rem;
    background: rgba(124, 58, 237, 0.08);
    color: var(--color-primary, #7c3aed);
    flex-shrink: 0;
  }

  .card-title-group {
    flex: 1;
    min-width: 0;
  }

  .card-title {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
  }

  .card-count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.625rem;
    font-weight: 600;
    padding: 0.0625rem 0.375rem;
    border-radius: 1rem;
    background: rgba(124, 58, 237, 0.1);
    color: var(--color-primary, #7c3aed);
    flex-shrink: 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 0.25rem;
    color: #9ca3af;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
  }
  .close-btn:hover {
    color: #374151;
    background: #f9fafb;
  }

  /* ── Folder picker ── */
  .folder-row {
    padding: 0 1rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .folder-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.2rem 0.4rem;
    background: #fafafa;
    border: 1px dashed #d1d5db;
    border-radius: 0.25rem;
    color: #6b7280;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.625rem;
    cursor: pointer;
    text-align: left;
    width: fit-content;
  }
  .folder-btn:hover {
    border-color: rgba(124, 58, 237, 0.3);
    background: #f3f4f6;
  }

  .folder-path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 280px;
  }

  .folder-input-row {
    display: flex;
    gap: 0.375rem;
  }

  .folder-input {
    flex: 1;
    max-width: 320px;
    padding: 0.25rem 0.5rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.375rem;
    color: var(--color-text, #e2e8f0);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6875rem;
    outline: none;
  }
  .folder-input:focus {
    border-color: rgba(124, 58, 237, 0.4);
  }

  .folder-save-btn {
    padding: 0.25rem 0.5rem;
    background: rgba(124, 58, 237, 0.12);
    border: 1px solid rgba(124, 58, 237, 0.2);
    border-radius: 0.375rem;
    color: var(--color-primary, #7c3aed);
    font-size: 0.6875rem;
    font-weight: 600;
    cursor: pointer;
  }
  .folder-save-btn:hover {
    background: rgba(124, 58, 237, 0.2);
  }

  /* ── Sections list (vertical, no grid) ── */
  .sections-list {
    display: flex;
    flex-direction: column;
    padding: 0.25rem 0.5rem 0.375rem;
    max-height: 200px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(124, 58, 237, 0.2) transparent;
  }

  /* ── Section row ── */
  .section-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    text-align: left;
    font-family: 'Inter', system-ui, sans-serif;
    color: #374151;
    width: 100%;
  }

  .section-row:hover {
    background: rgba(124, 58, 237, 0.06);
  }

  .section-row:active {
    background: rgba(124, 58, 237, 0.1);
  }

  .section-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.25rem;
    background: #f3f4f6;
    color: #6b7280;
    flex-shrink: 0;
  }

  .section-row:hover .section-icon {
    background: rgba(124, 58, 237, 0.08);
    color: var(--color-primary, #7c3aed);
  }

  .section-label {
    font-weight: 500;
    font-size: 0.75rem;
    flex: 1;
  }

  :global(.row-arrow) {
    color: var(--color-text-muted, #64748b);
    flex-shrink: 0;
    opacity: 0;
  }

  .section-row:hover :global(.row-arrow) {
    opacity: 1;
    color: var(--color-primary, #7c3aed);
  }

  @media (max-width: 640px) {
    .folder-path {
      max-width: 180px;
    }
  }
</style>
