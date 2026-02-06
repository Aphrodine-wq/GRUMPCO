<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { settingsStore } from '../stores/settingsStore';
  import { showToast } from '../stores/toastStore';
  import { Button, Card, Badge, Modal } from '../lib/design-system';
  import type { McpServerConfig } from '../types/settings';
  import { Plus, Trash2, Settings2, Plug2, Terminal, Globe } from 'lucide-svelte';

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
</style>
