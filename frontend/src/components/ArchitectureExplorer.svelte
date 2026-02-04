<script lang="ts">
  import { onMount } from 'svelte';
  import {
    X,
    Info,
    Layers,
    Package,
    Server,
    Monitor,
    Cpu,
    BookOpen,
    HelpCircle,
    ChevronRight,
    ChevronDown,
    Cloud,
    Sparkles,
  } from 'lucide-svelte';

  export let isOpen = false;
  export let onClose = () => {};

  interface Node {
    id: string;
    label: string;
    type: 'frontend' | 'backend' | 'package' | 'external' | 'feature';
    description: string;
    files?: number;
    lines?: number;
    dependencies: string[];
    status: 'active' | 'optional' | 'disabled';
    x: number;
    y: number;
  }

  interface Connection {
    from: string;
    to: string;
    label?: string;
    type: 'data' | 'api' | 'dep';
  }

  let selectedNode: Node | null = null;
  let hoveredNode: string | null = null;
  let expandedCategories: Set<string> = new Set(['core']);
  let searchQuery = '';

  // Architecture nodes representing the actual project structure
  const nodes: Node[] = [
    // Frontend
    {
      id: 'frontend',
      label: 'Frontend',
      type: 'frontend',
      description: 'Svelte 5 + Electron desktop/web app',
      files: 209,
      dependencies: ['ai-core', 'shared-types'],
      status: 'active',
      x: 100,
      y: 100,
    },
    {
      id: 'svelte',
      label: 'Svelte 5 UI',
      type: 'frontend',
      description: 'Reactive UI components with Svelte 5 runes',
      dependencies: ['frontend'],
      status: 'active',
      x: 50,
      y: 150,
    },
    {
      id: 'electron',
      label: 'Electron Shell',
      type: 'frontend',
      description: 'Desktop app wrapper for Windows/Mac/Linux',
      dependencies: ['frontend'],
      status: 'active',
      x: 150,
      y: 150,
    },

    // Backend
    {
      id: 'backend',
      label: 'Backend API',
      type: 'backend',
      description: 'Express 5 API server with agents',
      files: 357,
      dependencies: ['ai-core', 'shared-types'],
      status: 'active',
      x: 500,
      y: 100,
    },
    {
      id: 'agents',
      label: 'Multi-Agent System',
      type: 'backend',
      description: 'Orchestrates specialized AI agents',
      dependencies: ['backend'],
      status: 'active',
      x: 450,
      y: 180,
    },
    {
      id: 'tools',
      label: 'Tool Execution',
      type: 'backend',
      description: 'Bash, file ops, git commands',
      dependencies: ['backend'],
      status: 'active',
      x: 550,
      y: 180,
    },
    {
      id: 'rag',
      label: 'RAG Engine',
      type: 'backend',
      description: 'Document search with Pinecone',
      dependencies: ['backend'],
      status: 'optional',
      x: 500,
      y: 260,
    },

    // Shared Packages
    {
      id: 'ai-core',
      label: 'AI Core',
      type: 'package',
      description: 'Model router & provider registry',
      dependencies: [],
      status: 'active',
      x: 300,
      y: 50,
    },
    {
      id: 'shared-types',
      label: 'Shared Types',
      type: 'package',
      description: 'TypeScript types shared across packages',
      dependencies: [],
      status: 'active',
      x: 300,
      y: 150,
    },
    {
      id: 'cli',
      label: 'CLI Tool',
      type: 'package',
      description: 'grump command-line interface',
      dependencies: ['ai-core', 'shared-types'],
      status: 'active',
      x: 300,
      y: 250,
    },
    {
      id: 'compiler',
      label: 'Intent Compiler',
      type: 'package',
      description: 'Rust-based NL→JSON parser',
      dependencies: [],
      status: 'optional',
      x: 150,
      y: 250,
    },

    // External Services
    {
      id: 'nim',
      label: 'NVIDIA NIM',
      type: 'external',
      description: 'Primary AI provider (GPU-accelerated)',
      dependencies: ['ai-core'],
      status: 'optional',
      x: 700,
      y: 50,
    },
    {
      id: 'openrouter',
      label: 'OpenRouter',
      type: 'external',
      description: 'Multi-model fallback access',
      dependencies: ['ai-core'],
      status: 'optional',
      x: 700,
      y: 120,
    },
    {
      id: 'groq',
      label: 'Groq',
      type: 'external',
      description: 'Fast inference provider',
      dependencies: ['ai-core'],
      status: 'optional',
      x: 700,
      y: 190,
    },
    {
      id: 'ollama',
      label: 'Ollama',
      type: 'external',
      description: 'Local/offline AI models',
      dependencies: ['ai-core'],
      status: 'optional',
      x: 700,
      y: 260,
    },
    {
      id: 'pinecone',
      label: 'Pinecone',
      type: 'external',
      description: 'Vector database for RAG',
      dependencies: ['rag'],
      status: 'optional',
      x: 600,
      y: 320,
    },
    {
      id: 'supabase',
      label: 'Supabase',
      type: 'external',
      description: 'PostgreSQL for production',
      dependencies: ['backend'],
      status: 'optional',
      x: 400,
      y: 320,
    },

    // Features
    {
      id: 'mock-mode',
      label: 'Mock Mode',
      type: 'feature',
      description: 'Zero-config demo mode - no API keys',
      dependencies: ['ai-core'],
      status: 'active',
      x: 800,
      y: 350,
    },
    {
      id: 'chat',
      label: 'Chat Mode',
      type: 'feature',
      description: 'AI-powered chat with tools',
      dependencies: ['frontend', 'backend'],
      status: 'active',
      x: 100,
      y: 350,
    },
    {
      id: 'arch-mode',
      label: 'Architecture Mode',
      type: 'feature',
      description: 'Design-first with diagrams',
      dependencies: ['frontend', 'backend', 'agents'],
      status: 'active',
      x: 250,
      y: 350,
    },
    {
      id: 'ship-mode',
      label: 'Ship Mode',
      type: 'feature',
      description: 'Deploy to Docker/K8s',
      dependencies: ['frontend', 'backend', 'tools'],
      status: 'active',
      x: 400,
      y: 350,
    },
  ];

  const connections: Connection[] = [
    { from: 'frontend', to: 'backend', type: 'api', label: '/api' },
    { from: 'frontend', to: 'ai-core', type: 'dep' },
    { from: 'frontend', to: 'shared-types', type: 'dep' },
    { from: 'backend', to: 'ai-core', type: 'dep' },
    { from: 'backend', to: 'shared-types', type: 'dep' },
    { from: 'agents', to: 'tools', type: 'data' },
    { from: 'backend', to: 'rag', type: 'data', label: 'optional' },
    { from: 'rag', to: 'pinecone', type: 'api', label: 'vectors' },
    { from: 'ai-core', to: 'nim', type: 'api', label: 'LLM' },
    { from: 'ai-core', to: 'openrouter', type: 'api', label: 'LLM' },
    { from: 'ai-core', to: 'groq', type: 'api', label: 'LLM' },
    { from: 'ai-core', to: 'ollama', type: 'api', label: 'LLM' },
    { from: 'backend', to: 'supabase', type: 'api', label: 'DB' },
    { from: 'svelte', to: 'electron', type: 'dep' },
    { from: 'cli', to: 'backend', type: 'api' },
    { from: 'compiler', to: 'backend', type: 'data' },
    { from: 'chat', to: 'frontend', type: 'data' },
    { from: 'chat', to: 'backend', type: 'api' },
    { from: 'arch-mode', to: 'frontend', type: 'data' },
    { from: 'arch-mode', to: 'backend', type: 'api' },
    { from: 'ship-mode', to: 'frontend', type: 'data' },
    { from: 'ship-mode', to: 'backend', type: 'api' },
    { from: 'mock-mode', to: 'ai-core', type: 'dep' },
  ];

  const categories = {
    core: { label: 'Core System', nodes: ['frontend', 'backend', 'ai-core', 'shared-types'] },
    frontend: { label: 'Frontend Stack', nodes: ['svelte', 'electron'] },
    backend: { label: 'Backend Services', nodes: ['agents', 'tools', 'rag'] },
    packages: { label: 'Shared Packages', nodes: ['cli', 'compiler'] },
    external: {
      label: 'External Providers',
      nodes: ['nim', 'openrouter', 'groq', 'ollama', 'pinecone', 'supabase'],
    },
    features: { label: 'Features', nodes: ['chat', 'arch-mode', 'ship-mode', 'mock-mode'] },
  };

  function getNodeIcon(type: string) {
    switch (type) {
      case 'frontend':
        return Monitor;
      case 'backend':
        return Server;
      case 'package':
        return Package;
      case 'external':
        return Cloud;
      case 'feature':
        return Sparkles;
      default:
        return Cpu;
    }
  }

  function getNodeColor(type: string) {
    switch (type) {
      case 'frontend':
        return '#3b82f6'; // blue
      case 'backend':
        return '#22c55e'; // green
      case 'package':
        return '#f59e0b'; // amber
      case 'external':
        return '#8b5cf6'; // purple
      case 'feature':
        return '#ec4899'; // pink
      default:
        return '#6b7280'; // gray
    }
  }

  function getConnectionPath(from: Node, to: Node): string {
    const midX = (from.x + to.x) / 2;

    // Curved path
    return `M ${from.x} ${from.y} Q ${midX} ${from.y} ${midX} ${(from.y + to.y) / 2} T ${to.x} ${to.y}`;
  }

  function toggleCategory(category: string) {
    if (expandedCategories.has(category)) {
      expandedCategories.delete(category);
    } else {
      expandedCategories.add(category);
    }
    expandedCategories = expandedCategories;
  }

  function filterNodes(query: string) {
    if (!query) return nodes;
    const lower = query.toLowerCase();
    return nodes.filter(
      (n) => n.label.toLowerCase().includes(lower) || n.description.toLowerCase().includes(lower)
    );
  }

  $: filteredNodes = filterNodes(searchQuery);
  $: filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

  onMount(() => {
    // Auto-expand all on first open
    if (isOpen) {
      expandedCategories = new Set(Object.keys(categories));
    }
  });
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div
      class="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col overflow-hidden"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200">
        <div class="flex items-center gap-3">
          <Layers class="w-6 h-6 text-blue-500" />
          <div>
            <h2 class="text-xl font-semibold">G-Rump Architecture Explorer</h2>
            <p class="text-sm text-gray-500">Visual guide to all 566+ files and 12 workspaces</p>
          </div>
        </div>
        <button on:click={onClose} class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="flex flex-1 overflow-hidden">
        <!-- Left Sidebar: Categories -->
        <div class="w-64 border-r border-gray-200 overflow-y-auto p-4 space-y-2">
          <div class="mb-4">
            <input
              type="text"
              placeholder="Search components..."
              bind:value={searchQuery}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-transparent"
            />
          </div>

          {#each Object.entries(categories) as [key, category]}
            <div class="border border-gray-200 rounded-lg overflow-hidden">
              <button
                on:click={() => toggleCategory(key)}
                class="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
              >
                <span class="font-medium text-sm">{category.label}</span>
                {#if expandedCategories.has(key)}
                  <ChevronDown class="w-4 h-4" />
                {:else}
                  <ChevronRight class="w-4 h-4" />
                {/if}
              </button>

              {#if expandedCategories.has(key)}
                <div class="border-t border-gray-200">
                  {#each category.nodes as nodeId}
                    {@const node = nodes.find((n) => n.id === nodeId)}
                    {#if node && (!searchQuery || filteredNodeIds.has(nodeId))}
                      <button
                        on:click={() => (selectedNode = node)}
                        on:mouseenter={() => (hoveredNode = nodeId)}
                        on:mouseleave={() => (hoveredNode = null)}
                        class="w-full flex items-center gap-2 p-2 px-3 text-left text-sm hover:bg-gray-50 transition-colors {selectedNode?.id ===
                        nodeId
                          ? 'bg-blue-50 border-l-2 border-blue-500'
                          : ''}"
                      >
                        {#if getNodeIcon(node.type)}
                          {@const NodeIcon = getNodeIcon(node.type)}
                          <NodeIcon class="w-4 h-4" style="color: {getNodeColor(node.type)}" />
                        {/if}
                        <span class="truncate">{node.label}</span>
                        {#if node.status === 'optional'}
                          <span class="ml-auto text-xs text-gray-400">opt</span>
                        {/if}
                      </button>
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>
          {/each}

          <!-- Legend -->
          <div class="mt-6 pt-4 border-t border-gray-200">
            <h4 class="text-xs font-semibold text-gray-500 uppercase mb-2">Legend</h4>
            <div class="space-y-1 text-xs">
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>Frontend</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Backend</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full bg-amber-500"></div>
                <span>Package</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full bg-purple-500"></div>
                <span>External</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full bg-pink-500"></div>
                <span>Feature</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Center: Visual Diagram -->
        <div class="flex-1 relative bg-gray-50 overflow-hidden">
          <svg class="w-full h-full" viewBox="0 0 900 400" preserveAspectRatio="xMidYMid meet">
            <!-- Connection lines -->
            {#each connections as conn}
              {@const fromNode = nodes.find((n) => n.id === conn.from)}
              {@const toNode = nodes.find((n) => n.id === conn.to)}
              {#if fromNode && toNode && (!searchQuery || (filteredNodeIds.has(conn.from) && filteredNodeIds.has(conn.to)))}
                <path
                  d={getConnectionPath(fromNode, toNode)}
                  fill="none"
                  stroke={conn.type === 'api'
                    ? '#3b82f6'
                    : conn.type === 'data'
                      ? '#22c55e'
                      : '#9ca3af'}
                  stroke-width={hoveredNode &&
                  (hoveredNode === conn.from || hoveredNode === conn.to)
                    ? 3
                    : 1}
                  stroke-dasharray={conn.type === 'dep' ? '4,4' : 'none'}
                  opacity={hoveredNode && hoveredNode !== conn.from && hoveredNode !== conn.to
                    ? 0.2
                    : 0.6}
                  class="transition-all duration-300"
                />
              {/if}
            {/each}

            <!-- Nodes -->
            {#each nodes as node}
              {#if !searchQuery || filteredNodeIds.has(node.id)}
                <g
                  transform="translate({node.x}, {node.y})"
                  class="cursor-pointer transition-all duration-200"
                  on:mouseenter={() => (hoveredNode = node.id)}
                  on:mouseleave={() => (hoveredNode = null)}
                  on:click={() => (selectedNode = node)}
                  opacity={hoveredNode &&
                  hoveredNode !== node.id &&
                  !node.dependencies.includes(hoveredNode) &&
                  !nodes.find((n) => n.id === hoveredNode)?.dependencies.includes(node.id)
                    ? 0.3
                    : 1}
                >
                  <!-- Node circle -->
                  <circle
                    r="30"
                    fill="white"
                    stroke={getNodeColor(node.type)}
                    stroke-width={selectedNode?.id === node.id ? 4 : 2}
                    class="fill-white"
                  />

                  <!-- Status indicator -->
                  {#if node.status === 'optional'}
                    <circle
                      r="34"
                      fill="none"
                      stroke={getNodeColor(node.type)}
                      stroke-width="1"
                      stroke-dasharray="4,2"
                      opacity="0.5"
                    />
                  {/if}

                  <!-- Icon using foreignObject for proper Lucide rendering -->
                  <foreignObject x="-12" y="-22" width="24" height="24">
                    <div
                      xmlns="http://www.w3.org/1999/xhtml"
                      style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;"
                    >
                      {#if getNodeIcon(node.type)}
                        {@const NodeIcon = getNodeIcon(node.type)}
                        <NodeIcon size={18} color={getNodeColor(node.type)} />
                      {/if}
                    </div>
                  </foreignObject>

                  <!-- Label -->
                  <text
                    text-anchor="middle"
                    dy="45"
                    font-size="11"
                    font-weight="500"
                    fill="currentColor"
                    class="fill-gray-800"
                  >
                    {node.label}
                  </text>

                  <!-- File count badge -->
                  {#if node.files}
                    <g transform="translate(20, -20)">
                      <circle r="10" fill={getNodeColor(node.type)} />
                      <text
                        text-anchor="middle"
                        dy="3"
                        font-size="8"
                        fill="white"
                        font-weight="bold"
                      >
                        {node.files}
                      </text>
                    </g>
                  {/if}
                </g>
              {/if}
            {/each}
          </svg>

          <!-- Quick Help Overlay -->
          {#if !selectedNode}
            <div
              class="absolute bottom-4 left-4 bg-white/90 p-3 rounded-lg shadow-lg backdrop-blur-sm max-w-xs"
            >
              <div class="flex items-start gap-2">
                <HelpCircle class="w-5 h-5 text-blue-500 mt-0.5" />
                <div class="text-sm">
                  <p class="font-medium mb-1">Getting Started</p>
                  <p class="text-gray-600">
                    Click any component to see details. Start with <span
                      class="font-mono text-pink-500">Mock Mode</span
                    > for zero-config exploration!
                  </p>
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Right Sidebar: Details -->
        <div class="w-80 border-l border-gray-200 overflow-y-auto p-4">
          {#if selectedNode}
            <div class="space-y-4">
              <div class="flex items-start gap-3">
                <div
                  class="w-12 h-12 rounded-xl flex items-center justify-center"
                  style="background-color: {getNodeColor(selectedNode.type)}20"
                >
                  {#if getNodeIcon(selectedNode.type)}
                    {@const SelNodeIcon = getNodeIcon(selectedNode.type)}
                    <SelNodeIcon class="w-6 h-6" style="color: {getNodeColor(selectedNode.type)}" />
                  {/if}
                </div>
                <div>
                  <h3 class="font-semibold">{selectedNode.label}</h3>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {selectedNode.type}
                  </span>
                </div>
              </div>

              <p class="text-sm text-gray-600">
                {selectedNode.description}
              </p>

              {#if selectedNode.files}
                <div class="flex items-center gap-2 text-sm">
                  <BookOpen class="w-4 h-4 text-gray-400" />
                  <span>{selectedNode.files} files</span>
                </div>
              {/if}

              {#if selectedNode.dependencies.length > 0}
                <div>
                  <h4 class="text-sm font-medium mb-2">Dependencies</h4>
                  <div class="flex flex-wrap gap-1">
                    {#each selectedNode.dependencies as dep}
                      {@const depNode = nodes.find((n) => n.id === dep)}
                      <button
                        on:click={() => (selectedNode = depNode || null)}
                        class="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        {depNode?.label || dep}
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- What depends on this -->
              {#if selectedNode}
                {@const currentNode = selectedNode}
                {@const dependents = nodes.filter((n) => n.dependencies.includes(currentNode.id))}
                {#if dependents.length > 0}
                  <div>
                    <h4 class="text-sm font-medium mb-2">Used By</h4>
                    <div class="flex flex-wrap gap-1">
                      {#each dependents as dep}
                        <button
                          on:click={() => (selectedNode = dep)}
                          class="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                          {dep.label}
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}
              {/if}

              <!-- Quick Actions -->
              <div class="pt-4 border-t border-gray-200 space-y-2">
                {#if selectedNode.type === 'feature'}
                  <button
                    class="w-full flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                  >
                    <Info class="w-4 h-4" />
                    Try This Feature
                  </button>
                {/if}

                {#if selectedNode.id === 'mock-mode'}
                  <div class="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p class="text-sm text-green-800">
                      <strong>✓ Perfect for beginners!</strong><br />
                      Run <code class="bg-green-100 px-1 rounded">npm run setup:interactive</code> and
                      choose "Quick Start" to enable this.
                    </p>
                  </div>
                {/if}

                <a
                  href="/docs/{selectedNode.type === 'feature'
                    ? 'CAPABILITIES'
                    : 'ARCHITECTURE'}.md"
                  target="_blank"
                  class="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  <BookOpen class="w-4 h-4" />
                  Read Documentation
                </a>
              </div>
            </div>
          {:else}
            <div class="text-center text-gray-500 py-8">
              <Layers class="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p class="text-sm">Select a component from the diagram or list to see details</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
