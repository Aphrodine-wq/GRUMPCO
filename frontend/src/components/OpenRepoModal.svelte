<script lang="ts">
  import { fetchApi } from '../lib/api';
  import { workspaceStore } from '../stores/workspaceStore';
  import { showToast } from '../stores/toastStore';
  import { Button, Card } from '../lib/design-system';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();
  let repoUrl = $state('');
  let loading = $state(false);

  async function handleConnect() {
    if (!repoUrl.trim()) {
      showToast('Please enter a valid GitHub Repository URL', 'error');
      return;
    }

    loading = true;
    try {
      const res = await fetchApi('/api/workspace/remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: repoUrl.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to connect repository');
      }

      const data = await res.json();
      workspaceStore.setWorkspace(data.localPath, repoUrl.trim());
      showToast('GitHub repository connected successfully!', 'success');
      onClose();
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      loading = false;
    }
  }
</script>

<div
  class="modal-backdrop"
  onclick={onClose}
  role="button"
  tabindex="0"
  onkeydown={(e) => e.key === 'Escape' && onClose()}
>
  <div class="modal-container" onclick={(e) => e.stopPropagation()} role="presentation">
    <Card title="Connect GitHub Repository">
      <div class="modal-content">
        <p class="description">
          Enter a public GitHub repository URL to load it as your current workspace. G-Rump will
          clone the repository and allow you to interact with its code.
        </p>

        <div class="input-group">
          <label for="repo-url">Repository URL</label>
          <input
            id="repo-url"
            type="text"
            placeholder="https://github.com/user/repo"
            bind:value={repoUrl}
            disabled={loading}
            onkeydown={(e) => e.key === 'Enter' && handleConnect()}
          />
        </div>

        <div class="actions">
          <Button variant="ghost" onclick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" onclick={handleConnect} disabled={loading || !repoUrl.trim()}>
            {loading ? 'Connecting...' : 'Connect Workspace'}
          </Button>
        </div>
      </div>
    </Card>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    animation: fadeIn 0.2s ease-out;
  }

  .modal-container {
    width: 100%;
    max-width: 500px;
    padding: 16px;
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .modal-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .description {
    font-size: 14px;
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .input-group label {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
  }

  .input-group input {
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 14px;
    background: var(--color-bg-elevated, #ffffff);
    color: var(--color-text, #18181b);
    outline: none;
    transition: border-color 0.2s;
  }

  .input-group input:focus {
    border-color: var(--color-primary);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>
