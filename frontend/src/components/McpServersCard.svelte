<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { settingsStore } from '../stores/settingsStore';
  import { showToast } from '../stores/toastStore';
  import { Button, Card, Modal } from '../lib/design-system';
  import type { McpServerConfig } from '../types/settings';
  import { Plus, Trash2, Settings2 } from 'lucide-svelte';

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
          ? { command: formCommand.trim(), args: argsList, env: Object.keys(envObj).length ? envObj : undefined }
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
    if (!confirm('Remove this MCP server? G-Agent will no longer use its tools.')) return;
    const current = get(settingsStore);
    const existing = current?.mcp?.servers ?? [];
    const next = existing.filter((s) => s.id !== id);
    const ok = await settingsStore.save({ mcp: { servers: next } });
    if (ok) showToast('MCP server removed', 'success');
    else showToast('Failed to remove', 'error');
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
</script>

<Card title="G-Agent MCP Servers" padding="md">
  <p class="section-desc">
    Add MCP servers so G-Agent can automatically use their tools. Configure stdio (command) or URL-based servers.
  </p>
  {#if servers.length === 0}
    <p class="empty-hint">No MCP servers configured. Add one to let G-Agent connect.</p>
  {:else}
    <ul class="mcp-list">
      {#each servers as server (server.id)}
        <li class="mcp-item">
          <div class="mcp-item-main">
            <span class="mcp-name">{server.name}</span>
            <span class="mcp-type">{server.url ? 'URL' : 'stdio'}</span>
            {#if server.enabled === false}
              <span class="mcp-badge disabled">Disabled</span>
            {/if}
          </div>
          <div class="mcp-item-actions">
            <Button variant="ghost" size="sm" onclick={() => toggleEnabled(server)}>
              {server.enabled !== false ? 'Disable' : 'Enable'}
            </Button>
            <Button variant="ghost" size="sm" onclick={() => openEdit(server)}>
              <Settings2 size={14} />
            </Button>
            <Button variant="ghost" size="sm" onclick={() => removeServer(server.id)}>
              <Trash2 size={14} />
            </Button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="mcp-actions">
    <Button variant="primary" size="md" class="add-mcp-btn" onclick={openAdd}>
      <Plus size={16} />
      Add MCP server
    </Button>
  </div>
</Card>

<Modal
  open={showAddModal}
  onClose={closeModal}
  title={editingId ? 'Edit MCP server' : 'Add MCP server'}
  size="sm"
>
  <div class="mcp-form">
    <div class="form-group">
      <label for="mcp-name">Name</label>
      <input id="mcp-name" type="text" bind:value={formName} placeholder="My MCP" class="input" />
    </div>
    <div class="form-group" role="group" aria-labelledby="mcp-type-legend">
      <span id="mcp-type-legend" class="form-label">Type</span>
      <div class="radio-row">
        <label class="radio-label">
          <input type="radio" bind:group={formType} value="stdio" />
          stdio (command)
        </label>
        <label class="radio-label">
          <input type="radio" bind:group={formType} value="url" />
          URL
        </label>
      </div>
    </div>
    {#if formType === 'stdio'}
      <div class="form-group">
        <label for="mcp-command">Command</label>
        <input
          id="mcp-command"
          type="text"
          bind:value={formCommand}
          placeholder="npx -y @modelcontextprotocol/server-filesystem"
          class="input"
        />
      </div>
      <div class="form-group">
        <label for="mcp-args">Args (space-separated)</label>
        <input
          id="mcp-args"
          type="text"
          bind:value={formArgs}
          placeholder="--allow-paths /path"
          class="input"
        />
      </div>
      <div class="form-group">
        <label for="mcp-env">Env (one KEY=value per line)</label>
        <textarea
          id="mcp-env"
          bind:value={formEnv}
          placeholder="API_KEY=secret"
          rows="2"
          class="input textarea"
        ></textarea>
      </div>
    {:else}
      <div class="form-group">
        <label for="mcp-url">URL</label>
        <input
          id="mcp-url"
          type="url"
          bind:value={formUrl}
          placeholder="https://mcp.example.com/sse"
          class="input"
        />
      </div>
    {/if}
    <div class="form-actions">
      <Button variant="secondary" onclick={closeModal}>Cancel</Button>
      <Button variant="primary" onclick={saveServer} disabled={saving}>
        {saving ? 'Saving…' : editingId ? 'Update' : 'Add'}
      </Button>
    </div>
  </div>
</Modal>

<style>
  .section-desc {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0 0 1rem 0;
    line-height: 1.4;
  }
  .empty-hint {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0 0 1rem 0;
  }
  .mcp-list {
    list-style: none;
    margin: 0 0 1rem 0;
    padding: 0;
  }
  .mcp-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-bottom: 0.5rem;
  }
  .mcp-item-main {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }
  .mcp-name {
    font-weight: 600;
    color: #334155;
  }
  .mcp-type {
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
  }
  .mcp-badge.disabled {
    font-size: 0.75rem;
    color: #94a3b8;
  }
  .mcp-item-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }
  .mcp-actions {
    margin-top: 0.75rem;
  }

  .mcp-actions :global(.add-mcp-btn) {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 500;
  }
  .mcp-form .form-group {
    margin-bottom: 1rem;
  }
  .mcp-form .form-group .form-label,
  .mcp-form .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.35rem;
  }
  .mcp-form .input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
  }
  .mcp-form .textarea {
    resize: vertical;
    min-height: 60px;
  }
  .radio-row {
    display: flex;
    gap: 1rem;
  }
  .radio-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-weight: normal;
    cursor: pointer;
  }
  .form-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1.25rem;
  }
</style>
