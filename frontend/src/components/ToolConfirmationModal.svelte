<script lang="ts">
  interface Props {
    open: boolean;
    toolName: string;
    path?: string;
    /** For bash_execute: the command to run. When set, modal shows "Confirm command" and the command. */
    command?: string;
    toolId?: string;
    onAllow: () => void;
    onDeny: () => void;
    onAlwaysForSession?: () => void;
  }

  let { open, toolName, path, command, onAllow, onDeny, onAlwaysForSession }: Props = $props();

  const isBash = $derived(toolName === 'bash_execute' || toolName === 'bash');
  const title = $derived(isBash && command ? 'Confirm command' : 'Confirm file change');
</script>

{#if open}
  <div class="modal-backdrop" role="presentation" aria-hidden="false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="tool-confirm-title">
      <h2 id="tool-confirm-title" class="modal-title">{title}</h2>
      <p class="modal-desc">
        The assistant wants to run <strong>{toolName}</strong>
        {#if command}
          <span class="modal-desc-block"><code class="path">{command}</code></span>
        {:else if path}
          on <code class="path">{path}</code>
        {/if}
      </p>
      <div class="modal-actions">
        <button type="button" class="btn btn-allow" onclick={onAllow}>Allow</button>
        <button type="button" class="btn btn-deny" onclick={onDeny}>Deny</button>
        {#if onAlwaysForSession}
          <button type="button" class="btn btn-muted" onclick={onAlwaysForSession}>Always for this session</button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .modal {
    background: #fff;
    border-radius: 12px;
    padding: 20px 24px;
    max-width: 420px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  }
  .modal-title {
    margin: 0 0 10px 0;
    font-size: 18px;
    font-weight: 600;
    color: #1a1a1a;
  }
  .modal-desc {
    margin: 0 0 18px 0;
    font-size: 14px;
    color: #444;
    line-height: 1.45;
  }
  .modal-desc code.path {
    font-size: 12px;
    background: #f0f0f0;
    padding: 2px 6px;
    border-radius: 4px;
    word-break: break-all;
  }
  .modal-desc-block {
    display: block;
    margin-top: 6px;
  }
  .modal-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .btn {
    padding: 8px 16px;
    font-size: 14px;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .btn-allow {
    background: #0066cc;
    color: #fff;
    border-color: #0066cc;
  }
  .btn-allow:hover {
    background: #0052a3;
  }
  .btn-deny {
    background: #fff;
    color: #333;
    border-color: #ccc;
  }
  .btn-deny:hover {
    background: #f5f5f5;
  }
  .btn-muted {
    background: transparent;
    color: #666;
    border-color: #ddd;
  }
  .btn-muted:hover {
    background: #f9f9f9;
  }
</style>
