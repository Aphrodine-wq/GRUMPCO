<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { settingsStore } from '../stores/settingsStore';
  import { showToast } from '../stores/toastStore';
  import { Button, Card, Badge, Modal } from '../lib/design-system';
  import type { McpServerConfig } from '../types/settings';
  import { Plus, Trash2, Settings2, Plug2, Terminal, Globe, Download, Check } from 'lucide-svelte';

  // Built-in MCP server directory
  interface McpDirectoryEntry {
    id: string;
    name: string;
    description: string;
    command: string;
    args?: string[];
    category: string;
    icon: string; // SVG path data
    color: string; // icon accent color
  }

  // SVG icon paths (Lucide-style 24x24 viewbox)
  const ICONS = {
    folder: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
    github:
      'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z',
    database:
      'M12 2C7.582 2 4 3.79 4 6v12c0 2.21 3.582 4 8 4s8-1.79 8-4V6c0-2.21-3.582-4-8-4zM4 9c0 2.21 3.582 4 8 4s8-1.79 8-4M4 14c0 2.21 3.582 4 8 4s8-1.79 8-4',
    search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35',
    brain:
      'M12 2a7 7 0 00-5.2 2.3A6.98 6.98 0 004 9c0 1.8.7 3.4 1.8 4.7L12 22l6.2-8.3A6.98 6.98 0 0020 9a6.98 6.98 0 00-2.8-4.7A7 7 0 0012 2z',
    bot: 'M12 8V4H8M12 8a4 4 0 00-4 4v4a4 4 0 004 4h0a4 4 0 004-4v-4a4 4 0 00-4-4zM9 13h.01M15 13h.01',
    messageSquare: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
    mapPin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 7a3 3 0 100 6 3 3 0 000-6z',
    globe:
      'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z',
    hardDrive:
      'M22 12H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11zM6 16h.01M10 16h.01',
    lightbulb:
      'M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z',
    bell: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
    flask:
      'M9 3h6M10 9V3M14 9V3M5.243 17l3.07-5.386A2 2 0 009 10V3M15 3v7a2 2 0 00.687 1.614L18.757 17a2 2 0 01-.557 3.261l-.137.055a10.96 10.96 0 01-12.126 0l-.137-.055A2 2 0 015.243 17z',
    gitBranch:
      'M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9',
  };

  const MCP_DIRECTORY: McpDirectoryEntry[] = [
    {
      id: 'filesystem',
      name: 'Filesystem',
      description: 'Read, write, and manage files on your local filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
      category: 'Core',
      icon: ICONS.folder,
      color: '#f59e0b',
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Manage repos, issues, PRs, and code search via the GitHub API',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      category: 'Development',
      icon: ICONS.github,
      color: '#e5e7eb',
    },
    {
      id: 'postgres',
      name: 'PostgreSQL',
      description: 'Query and manage PostgreSQL databases with read/write access',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres'],
      category: 'Database',
      icon: ICONS.database,
      color: '#3b82f6',
    },
    {
      id: 'brave-search',
      name: 'Brave Search',
      description: 'Search the web using Brave Search API for real-time information',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      category: 'Search',
      icon: ICONS.search,
      color: '#f97316',
    },
    {
      id: 'memory',
      name: 'Memory',
      description: 'Persistent knowledge graph for storing and retrieving info across sessions',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
      category: 'Core',
      icon: ICONS.brain,
      color: '#ec4899',
    },
    {
      id: 'puppeteer',
      name: 'Puppeteer',
      description: 'Browser automation, screenshots, and web scraping via headless Chrome',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
      category: 'Automation',
      icon: ICONS.bot,
      color: '#10b981',
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Send messages, manage channels, and interact with Slack workspaces',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
      category: 'Communication',
      icon: ICONS.messageSquare,
      color: '#6366f1',
    },
    {
      id: 'google-maps',
      name: 'Google Maps',
      description: 'Geocoding, directions, place search, and distance calculations',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-google-maps'],
      category: 'Location',
      icon: ICONS.mapPin,
      color: '#ef4444',
    },
    {
      id: 'fetch',
      name: 'Fetch',
      description: 'Make HTTP requests and fetch content from any URL or web API',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
      category: 'Core',
      icon: ICONS.globe,
      color: '#0ea5e9',
    },
    {
      id: 'sqlite',
      name: 'SQLite',
      description: 'Query and manage local SQLite databases with full SQL support',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite'],
      category: 'Database',
      icon: ICONS.hardDrive,
      color: '#8b5cf6',
    },
    {
      id: 'sequential-thinking',
      name: 'Sequential Thinking',
      description: 'Dynamic, reflective problem-solving through structured chain-of-thought',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
      category: 'Reasoning',
      icon: ICONS.lightbulb,
      color: '#eab308',
    },
    {
      id: 'sentry',
      name: 'Sentry',
      description: 'Monitor errors, performance issues, and application health via Sentry',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sentry'],
      category: 'Monitoring',
      icon: ICONS.bell,
      color: '#f43f5e',
    },
    {
      id: 'everything',
      name: 'Everything',
      description: 'Reference MCP server with prompts, resources, and tools for testing',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
      category: 'Development',
      icon: ICONS.flask,
      color: '#14b8a6',
    },
    {
      id: 'gitlab',
      name: 'GitLab',
      description: 'Manage GitLab repos, merge requests, issues, and pipelines',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-gitlab'],
      category: 'Development',
      icon: ICONS.gitBranch,
      color: '#f97316',
    },
    {
      id: 'redis',
      name: 'Redis',
      description: 'Connect to Redis for caching, pub/sub, and key-value operations',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-redis'],
      category: 'Database',
      icon: ICONS.database,
      color: '#dc2626',
    },
    {
      id: 'mongodb',
      name: 'MongoDB',
      description: 'Query and manage MongoDB collections and documents',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-mongodb'],
      category: 'Database',
      icon: ICONS.database,
      color: '#16a34a',
    },
    {
      id: 'docker',
      name: 'Docker',
      description: 'Manage Docker containers, images, volumes, and networks',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-docker'],
      category: 'Infrastructure',
      icon: ICONS.hardDrive,
      color: '#2563eb',
    },
    {
      id: 'kubernetes',
      name: 'Kubernetes',
      description: 'Interact with Kubernetes clusters, pods, deployments, and services',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-kubernetes'],
      category: 'Infrastructure',
      icon: ICONS.globe,
      color: '#3b82f6',
    },
    {
      id: 'aws',
      name: 'AWS',
      description: 'Manage AWS services including S3, Lambda, EC2, and CloudFormation',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-aws'],
      category: 'Cloud',
      icon: ICONS.globe,
      color: '#f59e0b',
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Search, read, and create pages and databases in Notion workspaces',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-notion'],
      category: 'Productivity',
      icon: ICONS.lightbulb,
      color: '#1f2937',
    },
    {
      id: 'linear',
      name: 'Linear',
      description: 'Manage Linear issues, projects, teams, and workflow automations',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-linear'],
      category: 'Productivity',
      icon: ICONS.lightbulb,
      color: '#5e6ad2',
    },
    {
      id: 'cloudflare',
      name: 'Cloudflare',
      description: 'Manage Cloudflare Workers, KV storage, D1 databases, and DNS',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-cloudflare'],
      category: 'Cloud',
      icon: ICONS.globe,
      color: '#f48120',
    },
  ];

  let servers = $state<McpServerConfig[]>([]);
  let showAddModal = $state(false);
  let editingId = $state<string | null>(null);
  let formName = $state('');
  let formType = $state<'stdio' | 'url'>('stdio');
  let formCommand = $state('');
  let formArgs = $state('');
  let formUrl = $state('');
  let formEnv = $state('');
  let saving = $state(false);

  onMount(() => {
    servers = get(settingsStore)?.mcp?.servers ?? [];
    const unsub = settingsStore.subscribe((s) => {
      servers = s?.mcp?.servers ?? [];
    });
    return unsub;
  });

  function openAdd() {
    editingId = null;
    formName = '';
    formType = 'stdio';
    formCommand = '';
    formArgs = '';
    formUrl = '';
    formEnv = '';
    showAddModal = true;
  }

  function openEdit(server: McpServerConfig) {
    editingId = server.id;
    formName = server.name;
    formType = server.url ? 'url' : 'stdio';
    formCommand = server.command ?? '';
    formArgs = Array.isArray(server.args) ? server.args.join(' ') : '';
    formUrl = server.url ?? '';
    formEnv =
      server.env && typeof server.env === 'object'
        ? Object.entries(server.env)
            .map(([k, v]) => `${k}=${v}`)
            .join('\n')
        : '';
    showAddModal = true;
  }

  function closeModal() {
    showAddModal = false;
    editingId = null;
  }

  function generateId(): string {
    return `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  async function saveServer() {
    const name = formName.trim();
    if (!name) {
      showToast('Name is required', 'error');
      return;
    }
    if (formType === 'stdio') {
      if (!formCommand.trim()) {
        showToast('Command is required for stdio MCP', 'error');
        return;
      }
    } else {
      if (!formUrl.trim()) {
        showToast('URL is required for URL MCP', 'error');
        return;
      }
    }

    saving = true;
    try {
      const current = get(settingsStore);
      const existing = current?.mcp?.servers ?? [];
      const envObj: Record<string, string> = {};
      if (formEnv.trim()) {
        for (const line of formEnv.split('\n')) {
          const eq = line.indexOf('=');
          if (eq > 0) {
            const k = line.slice(0, eq).trim();
            const v = line.slice(eq + 1).trim();
            if (k) envObj[k] = v;
          }
        }
      }
      const argsList = formArgs.trim() ? formArgs.trim().split(/\s+/).filter(Boolean) : undefined;

      const entry: McpServerConfig = {
        id: editingId ?? generateId(),
        name,
        enabled: true,
        ...(formType === 'stdio'
          ? {
              command: formCommand.trim(),
              args: argsList,
              env: Object.keys(envObj).length ? envObj : undefined,
            }
          : { url: formUrl.trim() }),
      };

      const next =
        editingId != null
          ? existing.map((s) => (s.id === editingId ? entry : s))
          : [...existing, entry];

      const ok = await settingsStore.save({ mcp: { servers: next } });
      if (ok) {
        showToast(editingId ? 'MCP server updated' : 'MCP server added', 'success');
        closeModal();
      } else {
        showToast('Failed to save', 'error');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save', 'error');
    } finally {
      saving = false;
    }
  }

  async function removeServer(id: string) {
    const current = get(settingsStore);
    const existing = current?.mcp?.servers ?? [];
    const next = existing.filter((s) => s.id !== id);
    saving = true;
    try {
      const ok = await settingsStore.save({ mcp: { servers: next } });
      if (ok) showToast('MCP server removed', 'success');
      else showToast('Failed to remove', 'error');
    } finally {
      saving = false;
    }
  }

  async function toggleEnabled(server: McpServerConfig) {
    const current = get(settingsStore);
    const existing = current?.mcp?.servers ?? [];
    const next = existing.map((s) =>
      s.id === server.id ? { ...s, enabled: !(s.enabled ?? true) } : s
    );
    const ok = await settingsStore.save({ mcp: { servers: next } });
    if (ok) showToast(server.enabled !== false ? 'MCP disabled' : 'MCP enabled', 'success');
    else showToast('Failed to update', 'error');
  }

  function isDirectoryServerAdded(dirId: string): boolean {
    return servers.some((s) => s.name.toLowerCase() === dirId || s.id.includes(dirId));
  }

  async function addFromDirectory(entry: McpDirectoryEntry) {
    saving = true;
    try {
      const current = get(settingsStore);
      const existing = current?.mcp?.servers ?? [];
      const newServer: McpServerConfig = {
        id: `mcp_${entry.id}_${Date.now()}`,
        name: entry.name,
        enabled: true,
        command: entry.command,
        args: entry.args,
      };
      const next = [...existing, newServer];
      const ok = await settingsStore.save({ mcp: { servers: next } });
      if (ok) {
        showToast(`${entry.name} MCP server added`, 'success');
      } else {
        showToast('Failed to add server', 'error');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to add', 'error');
    } finally {
      saving = false;
    }
  }
</script>

<div class="mcp-card-wrapper">
  <div class="mcp-header-row">
    <h2 class="mcp-section-title">G-Agent MCP Servers</h2>
    <Button variant="primary" size="md" onclick={openAdd} class="add-mcp-btn">
      <Plus size={16} />
      Add MCP server
    </Button>
  </div>

  {#if servers.length === 0}
    <div class="mcp-empty-state">
      <div class="mcp-empty-icon">
        <Plug2 size={48} strokeWidth={1.5} />
      </div>
      <h3 class="mcp-empty-title">No MCP servers yet</h3>
      <p class="mcp-empty-text">
        Add stdio commands or URL endpoints so G-Agent can use their tools.
      </p>
    </div>
  {:else}
    <div class="mcp-server-grid">
      {#each servers as server (server.id)}
        <div class="mcp-server-card">
          <Card padding="sm">
            <div class="mcp-server-card-content">
              <div class="mcp-server-header">
                <div class="mcp-server-icon" class:url={!!server.url}>
                  {#if server.url}
                    <Globe size={20} />
                  {:else}
                    <Terminal size={20} />
                  {/if}
                </div>
                <div class="mcp-server-info">
                  <span class="mcp-server-name">{server.name}</span>
                  <Badge variant={server.enabled !== false ? 'success' : 'default'}>
                    {server.url ? 'URL' : 'stdio'}
                  </Badge>
                  {#if server.enabled === false}
                    <Badge variant="default">Disabled</Badge>
                  {/if}
                </div>
              </div>
              <p class="mcp-server-detail">
                {server.url ? server.url : (server.command ?? '')}
              </p>
              <div class="mcp-server-actions">
                <Button variant="ghost" size="sm" onclick={() => toggleEnabled(server)}>
                  {server.enabled !== false ? 'Disable' : 'Enable'}
                </Button>
                <Button variant="ghost" size="sm" onclick={() => openEdit(server)}>
                  <Settings2 size={14} /> Edit
                </Button>
                <Button variant="ghost" size="sm" onclick={() => removeServer(server.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Built-in MCP Directory -->
  <div class="mcp-directory-section">
    <h2 class="mcp-section-title">MCP Server Directory</h2>
    <p class="mcp-directory-desc">
      Popular MCP servers you can add with one click. Requires Node.js/npx installed.
    </p>
    <div class="mcp-directory-grid">
      {#each MCP_DIRECTORY as entry (entry.id)}
        {@const isAdded = isDirectoryServerAdded(entry.id)}
        <div class="mcp-directory-card" class:added={isAdded}>
          <div class="mcp-dir-icon" style="background: {entry.color}15; color: {entry.color}">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d={entry.icon} />
            </svg>
          </div>
          <div class="mcp-dir-info">
            <span class="mcp-dir-name">{entry.name}</span>
            <span class="mcp-dir-category">{entry.category}</span>
          </div>
          <p class="mcp-dir-desc">{entry.description}</p>
          <button
            type="button"
            class="mcp-dir-add-btn"
            class:added={isAdded}
            disabled={isAdded || saving}
            onclick={() => addFromDirectory(entry)}
          >
            {#if isAdded}
              <Check size={14} />
              Added
            {:else}
              <Download size={14} />
              Add
            {/if}
          </button>
        </div>
      {/each}
    </div>
  </div>
</div>

<Modal
  open={showAddModal}
  onClose={closeModal}
  title={editingId ? 'Edit MCP server' : 'Add MCP server'}
  size="md"
>
  <div class="mcp-form">
    <fieldset class="form-section">
      <legend>Basic info</legend>
      <div class="form-group">
        <label for="mcp-name">Name</label>
        <input
          id="mcp-name"
          type="text"
          bind:value={formName}
          placeholder="e.g. Filesystem"
          class="input"
        />
      </div>
    </fieldset>

    <fieldset class="form-section">
      <legend>Connection type</legend>
      <div class="radio-row">
        <label class="radio-card">
          <input type="radio" bind:group={formType} value="stdio" />
          <div class="radio-card-content">
            <Terminal size={20} />
            <span class="radio-card-title">stdio</span>
            <span class="radio-card-desc">Run a command (e.g. npx MCP package)</span>
          </div>
        </label>
        <label class="radio-card">
          <input type="radio" bind:group={formType} value="url" />
          <div class="radio-card-content">
            <Globe size={20} />
            <span class="radio-card-title">URL</span>
            <span class="radio-card-desc">HTTP or SSE endpoint</span>
          </div>
        </label>
      </div>
    </fieldset>

    {#if formType === 'stdio'}
      <fieldset class="form-section">
        <legend>stdio settings</legend>
        <div class="form-group">
          <label for="mcp-command">Command</label>
          <input
            id="mcp-command"
            type="text"
            bind:value={formCommand}
            placeholder="npx -y @modelcontextprotocol/server-filesystem"
            class="input"
          />
          <span class="form-hint">The executable or npx package to run</span>
        </div>
        <div class="form-group">
          <label for="mcp-args">Arguments (optional)</label>
          <input
            id="mcp-args"
            type="text"
            bind:value={formArgs}
            placeholder="--allow-paths /path/to/allow"
            class="input"
          />
        </div>
        <div class="form-group">
          <label for="mcp-env">Environment variables</label>
          <textarea
            id="mcp-env"
            bind:value={formEnv}
            placeholder="API_KEY=your_key&#10;DATABASE_URL=postgres://..."
            rows="3"
            class="input textarea"
          ></textarea>
          <span class="form-hint">One KEY=value per line</span>
        </div>
      </fieldset>
    {:else}
      <fieldset class="form-section">
        <legend>URL settings</legend>
        <div class="form-group">
          <label for="mcp-url">Server URL</label>
          <input
            id="mcp-url"
            type="url"
            bind:value={formUrl}
            placeholder="https://mcp.example.com/sse"
            class="input"
          />
          <span class="form-hint">HTTP or Server-Sent Events endpoint</span>
        </div>
      </fieldset>
    {/if}

    <div class="form-actions">
      <Button variant="secondary" onclick={closeModal}>Cancel</Button>
      <Button variant="primary" onclick={saveServer} disabled={saving}>
        {saving ? 'Saving…' : editingId ? 'Update' : 'Add server'}
      </Button>
    </div>
  </div>
</Modal>

<style>
  .mcp-card-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .mcp-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .mcp-section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text, #1f1147);
    margin: 0;
  }

  .mcp-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-content, 24px);
    text-align: center;
    border-radius: 12px;
    background: var(--color-bg-subtle, #f5f3ff);
    border: 1px dashed var(--color-border, #e9d5ff);
  }

  .mcp-empty-icon {
    color: var(--color-text-muted, #6b7280);
    opacity: 0.7;
    margin-bottom: 1rem;
  }

  .mcp-empty-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text, #1f1147);
    margin: 0 0 0.5rem;
  }

  .mcp-empty-text {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.5;
    margin: 0 0 1.25rem;
    max-width: 400px;
  }

  .mcp-server-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .mcp-server-card {
    min-width: 0;
  }

  .mcp-server-card-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .mcp-server-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .mcp-server-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    color: var(--color-primary, #7c3aed);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .mcp-server-icon.url {
    background: var(--color-info-subtle, rgba(59, 130, 246, 0.1));
    color: var(--color-info, #3b82f6);
  }

  .mcp-server-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    min-width: 0;
  }

  .mcp-server-name {
    font-weight: 600;
    color: var(--color-text, #1f1147);
  }

  .mcp-server-detail {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mcp-server-actions {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  /* Modal form */
  .mcp-form .form-section {
    border: none;
    margin: 0 0 1.25rem;
    padding: 0;
  }

  .mcp-form .form-section legend {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary, #4a4a5a);
    margin-bottom: 0.75rem;
    padding: 0;
  }

  .mcp-form .form-group {
    margin-bottom: 1rem;
  }

  .mcp-form .form-group:last-child {
    margin-bottom: 0;
  }

  .mcp-form .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text, #1f1147);
    margin-bottom: 0.35rem;
  }

  .mcp-form .form-hint {
    display: block;
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
    margin-top: 0.25rem;
  }

  .mcp-form .input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 8px;
    font-size: 0.875rem;
    background: var(--color-bg-input, #f3e8ff);
    color: var(--color-text, #1f1147);
  }

  .mcp-form .textarea {
    resize: vertical;
    min-height: 72px;
  }

  .radio-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.75rem;
  }

  .radio-card {
    display: block;
    cursor: pointer;
  }

  .radio-card input {
    position: absolute;
    opacity: 0;
  }

  .radio-card-content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
    padding: 1rem;
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 8px;
    background: var(--color-bg-subtle, #f5f3ff);
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .radio-card:has(input:checked) .radio-card-content {
    border-color: var(--color-primary, #7c3aed);
    box-shadow: 0 0 0 2px var(--color-primary-subtle, rgba(124, 58, 237, 0.2));
  }

  .radio-card:hover .radio-card-content {
    border-color: var(--color-border-highlight, #d8b4fe);
  }

  .radio-card-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--color-text, #1f1147);
  }

  .radio-card-desc {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
  }

  .form-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border-light, #f3e8ff);
  }

  /* MCP Directory */
  .mcp-directory-section {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border, #e9d5ff);
  }

  .mcp-directory-desc {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0.35rem 0 1rem;
    line-height: 1.5;
  }

  .mcp-directory-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 0.75rem;
  }

  .mcp-directory-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 12px;
    background: var(--color-bg-subtle, #f5f3ff);
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .mcp-directory-card:hover:not(.added) {
    border-color: var(--color-primary, #7c3aed);
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.1);
  }

  .mcp-directory-card.added {
    opacity: 0.7;
    border-style: dashed;
  }

  .mcp-dir-icon {
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    flex-shrink: 0;
  }

  .mcp-dir-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .mcp-dir-name {
    font-weight: 600;
    font-size: 0.9375rem;
    color: var(--color-text, #1f1147);
  }

  .mcp-dir-category {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--color-primary, #7c3aed);
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    padding: 0.125rem 0.5rem;
    border-radius: 10px;
  }

  .mcp-dir-desc {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.4;
    margin: 0;
    flex: 1;
  }

  .mcp-dir-add-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    align-self: flex-start;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 600;
    border: 1px solid var(--color-primary, #7c3aed);
    border-radius: 8px;
    background: transparent;
    color: var(--color-primary, #7c3aed);
    cursor: pointer;
    transition: all 0.15s;
  }

  .mcp-dir-add-btn:hover:not(:disabled) {
    background: var(--color-primary, #7c3aed);
    color: white;
  }

  .mcp-dir-add-btn.added {
    border-color: var(--color-success, #059669);
    color: var(--color-success, #059669);
    cursor: default;
  }

  .mcp-dir-add-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
