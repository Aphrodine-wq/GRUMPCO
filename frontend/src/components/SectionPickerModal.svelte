<script lang="ts">
  /**
   * SectionPickerModal — Inline Chat Card
   *
   * Appears as a compact card in the chat flow after the user approves the architecture.
   * Parses the Mermaid chart into sections and displays them as selectable items.
   * Includes a folder picker for the workspace root.
   * Uses Lucide icons — no emojis.
   */
  import { createEventDispatcher } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
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
    Building2,
    FolderOpen,
    X,
    ChevronRight,
    Globe,
    Layers,
    Plug,
  } from 'lucide-svelte';

  interface MermaidSection {
    id: string;
    label: string;
    description: string;
    iconKey: string;
    complexity: 'low' | 'medium' | 'high';
  }

  interface Props {
    open?: boolean;
    mermaidCode?: string;
  }

  let { open = $bindable(false), mermaidCode = '' }: Props = $props();

  const dispatch = createEventDispatcher();
  let sections = $state<MermaidSection[]>([]);
  let hoveredSection = $state<string | null>(null);
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

  // Icon mapping — keyword to Lucide component key
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

      // Find best matching icon key
      let iconKey = 'package';
      for (const keyword of Object.keys(iconRegistry)) {
        if (lower.includes(keyword)) {
          iconKey = keyword;
          break;
        }
      }

      let complexity: 'low' | 'medium' | 'high' = 'medium';
      if (
        lower.includes('auth') ||
        lower.includes('database') ||
        lower.includes('payment') ||
        lower.includes('security')
      ) {
        complexity = 'high';
      } else if (
        lower.includes('config') ||
        lower.includes('env') ||
        lower.includes('static') ||
        lower.includes('user')
      ) {
        complexity = 'low';
      }

      parsed.push({
        id,
        label,
        description: currentSubgraph ? `Part of ${currentSubgraph}` : `${label} component`,
        iconKey,
        complexity,
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

      const nodeMatch = line.match(/^\s*(\w+)\s*[\[\({|]([^\]\)}\|]+)[\]\)}\|]/);
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
        description: 'Build the entire project from the architecture',
        iconKey: 'deploy',
        complexity: 'high',
      });
    }

    return parsed;
  }

  async function handleSelectFolder() {
    // Try native directory picker if available
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        workspacePath = dirHandle.name;
        // For Electron/Tauri we'd get the full path; browser only gets the name
        // Store it
        workspaceStore.setWorkspace(workspacePath);
      } catch {
        // User cancelled
      }
    } else {
      // Fallback: show text input
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
    // Require workspace path
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

  function getComplexityColor(complexity: 'low' | 'medium' | 'high'): string {
    switch (complexity) {
      case 'low':
        return '#10b981';
      case 'medium':
        return '#f59e0b';
      case 'high':
        return '#ef4444';
    }
  }

  function getComplexityLabel(complexity: 'low' | 'medium' | 'high'): string {
    switch (complexity) {
      case 'low':
        return 'Quick';
      case 'medium':
        return 'Medium';
      case 'high':
        return 'Complex';
    }
  }
</script>

{#if open}
  <div class="picker-card" transition:fly={{ y: 12, duration: 200 }}>
    <!-- Header -->
    <div class="card-header">
      <div class="card-icon">
        <Layers size={16} />
      </div>
      <div class="card-title">Select a Section</div>
      <span class="card-count">{sections.length}</span>
      <button class="close-btn" onclick={handleClose} aria-label="Close">
        <X size={14} />
      </button>
    </div>

    <!-- Folder picker -->
    <div class="folder-row">
      <button class="folder-btn" onclick={handleSelectFolder}>
        <FolderOpen size={14} />
        <span class="folder-path">{workspacePath || 'Choose project folder...'}</span>
      </button>
    </div>

    {#if showFolderInput}
      <div class="folder-input-row" transition:fly={{ y: 4, duration: 120 }}>
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

    <!-- Sections list -->
    <div class="sections-list">
      {#each sections as section, i (section.id)}
        <button
          class="section-row"
          class:hovered={hoveredSection === section.id}
          onmouseenter={() => (hoveredSection = section.id)}
          onmouseleave={() => (hoveredSection = null)}
          onclick={() => handleSelectSection(section)}
          animate:flip={{ duration: 180 }}
          style="animation-delay: {i * 30}ms"
        >
          <div class="section-icon">
            <svelte:component this={getIcon(section.iconKey)} size={16} />
          </div>
          <div class="section-info">
            <span class="section-label">{section.label}</span>
            <span class="section-desc">{section.description}</span>
          </div>
          <span
            class="complexity-tag"
            style="--tag-color: {getComplexityColor(section.complexity)}"
          >
            {getComplexityLabel(section.complexity)}
          </span>
          <ChevronRight size={14} class="row-arrow" />
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .picker-card {
    margin: 0.5rem 0;
    padding: 0.75rem;
    background: var(--color-bg-card, #1a1a2e);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 0.75rem;
    max-width: 520px;
    will-change: transform, opacity;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.375rem;
    background: rgba(124, 58, 237, 0.15);
    color: var(--color-primary, #7c3aed);
    flex-shrink: 0;
  }

  .card-title {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text, #e2e8f0);
    flex: 1;
  }

  .card-count {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.0625rem 0.4375rem;
    border-radius: 1rem;
    background: rgba(124, 58, 237, 0.12);
    color: var(--color-primary, #7c3aed);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    background: none;
    border: none;
    border-radius: 0.25rem;
    color: var(--color-text-muted, #64748b);
    cursor: pointer;
    padding: 0;
    transition: color 0.12s;
  }
  .close-btn:hover {
    color: var(--color-text, #e2e8f0);
  }

  /* Folder picker */
  .folder-row {
    margin-bottom: 0.5rem;
  }

  .folder-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    padding: 0.375rem 0.5rem;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    color: var(--color-text-secondary, #94a3b8);
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.6875rem;
    cursor: pointer;
    text-align: left;
    transition:
      border-color 0.12s,
      background 0.12s;
  }
  .folder-btn:hover {
    border-color: rgba(124, 58, 237, 0.3);
    background: rgba(255, 255, 255, 0.04);
  }

  .folder-path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .folder-input-row {
    display: flex;
    gap: 0.375rem;
    margin-bottom: 0.5rem;
  }

  .folder-input {
    flex: 1;
    padding: 0.375rem 0.5rem;
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
    padding: 0.375rem 0.625rem;
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

  /* Sections */
  .sections-list {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    max-height: 280px;
    overflow-y: auto;
  }

  .section-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.625rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 0.5rem;
    cursor: pointer;
    text-align: left;
    font-family: 'Inter', system-ui, sans-serif;
    color: var(--color-text, #e2e8f0);
    transition:
      background 0.1s,
      border-color 0.1s;
    animation: row-in 0.2s ease-out backwards;
  }

  @keyframes row-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .section-row:hover,
  .section-row.hovered {
    background: rgba(124, 58, 237, 0.06);
    border-color: rgba(124, 58, 237, 0.15);
  }

  .section-row:active {
    transform: scale(0.99);
  }

  .section-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.375rem;
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-text-secondary, #94a3b8);
    flex-shrink: 0;
  }

  .section-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.0625rem;
    min-width: 0;
  }

  .section-label {
    font-weight: 600;
    font-size: 0.8125rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .section-desc {
    font-size: 0.6875rem;
    color: var(--color-text-muted, #64748b);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .complexity-tag {
    font-size: 0.625rem;
    font-weight: 600;
    padding: 0.0625rem 0.375rem;
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--tag-color, #f59e0b) 12%, transparent);
    color: var(--tag-color, #f59e0b);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    flex-shrink: 0;
  }

  :global(.row-arrow) {
    color: var(--color-text-muted, #64748b);
    flex-shrink: 0;
    transition: transform 0.1s;
  }

  .section-row:hover :global(.row-arrow) {
    transform: translateX(2px);
    color: var(--color-primary, #7c3aed);
  }

  @media (prefers-reduced-motion: reduce) {
    .section-row {
      transition: none;
      animation: none;
    }
  }
</style>
