<script lang="ts">
  /**
   * G-Agent local confirmation: show every time user starts a G-Agent session locally.
   */
  import { AlertTriangle } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }

  let { open, onConfirm, onCancel }: Props = $props();
</script>

{#if open}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="g-agent-local-title">
    <div class="modal">
      <div class="modal-icon">
        <AlertTriangle width={40} height={40} strokeWidth={2} />
      </div>
      <h2 id="g-agent-local-title" class="modal-title">Run G-Agent locally?</h2>
      <p class="modal-body">
        Running G-Agent locally gives the AI full access to your system. Use Docker for sandboxing
        and security. Only continue if you understand and accept this risk.
      </p>
      <div class="modal-actions">
        <button type="button" class="btn-cancel" onclick={onCancel}>Cancel</button>
        <button type="button" class="btn-confirm" onclick={onConfirm}>I understand, continue</button
        >
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    padding: 1rem;
  }
  .modal {
    max-width: 420px;
    width: 100%;
    padding: 1.5rem;
    background: var(--color-bg-card, #fff);
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    text-align: center;
  }
  .modal-icon {
    color: var(--color-warning, #f59e0b);
    margin-bottom: 1rem;
  }
  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text, #111);
    margin: 0 0 0.75rem 0;
  }
  .modal-body {
    font-size: 0.9375rem;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.5;
    margin: 0 0 1.5rem 0;
  }
  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  .btn-cancel {
    padding: 8px 20px;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-text);
    background: var(--color-bg-subtle, #f3f4f6);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-cancel:hover {
    background: var(--color-bg-card-hover, #e5e7eb);
  }
  .btn-confirm {
    padding: 8px 20px;
    font-size: 0.9375rem;
    font-weight: 500;
    color: white;
    background: var(--color-primary, #6366f1);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-confirm:hover {
    background: var(--color-primary-hover, #4f46e5);
  }
</style>
