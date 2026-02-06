<script lang="ts">
  /**
   * AIQuestionModal – reusable confirmation modal for AI-driven prompts (e.g. SHIP).
   * Title, message, optional input, Confirm / Cancel.
   */
  import Modal from '../lib/design-system/components/Modal/Modal.svelte';
  import { Button } from '../lib/design-system';

  interface Props {
    open?: boolean;
    onClose?: () => void;
    onConfirm?: () => void;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }

  let {
    open = $bindable(false),
    onClose,
    onConfirm,
    title = 'Confirm',
    message = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
  }: Props = $props();

  function handleConfirm() {
    open = false;
    onConfirm?.();
  }

  function handleCancel() {
    open = false;
    onClose?.();
  }
</script>

<Modal
  bind:open
  {title}
  description={message}
  size="md"
  closeOnBackdrop={true}
  closeOnEscape={true}
  showCloseButton={true}
  onClose={handleCancel}
>
  {#snippet children()}{/snippet}
  {#snippet footer()}
    <div class="ai-question-footer">
      <Button variant="ghost" size="md" onclick={handleCancel}>
        {cancelLabel}
      </Button>
      <Button variant="primary" size="md" onclick={handleConfirm}>
        {confirmLabel}
      </Button>
    </div>
  {/snippet}
</Modal>

<style>
  .ai-question-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
