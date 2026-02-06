<script lang="ts">
  /**
   * ProjectEditorModal - Edit project/session metadata
   * Name, description, and session type
   */
  import { Modal, Button, Input } from '../lib/design-system';
  import { sessionsStore } from '../stores/sessionsStore';
  import type { Session, SessionType } from '../types';

  interface Props {
    open?: boolean;
    session: Session | null;
    onClose?: () => void;
    onSave?: () => void;
  }

  let { open = $bindable(false), session, onClose, onSave }: Props = $props();

  let name = $state('');
  let description = $state('');
  let sessionType = $state<SessionType | ''>('');

  $effect(() => {
    if (session) {
      name = session.name ?? '';
      description = session.description ?? '';
      // Show G-Agent for both gAgent and legacy freeAgent
      const raw = session.sessionType ?? '';
      sessionType = raw === 'freeAgent' ? 'gAgent' : raw;
    }
  });

  function handleSave() {
    if (!session) return;
    const updates: { name?: string; description?: string; sessionType?: SessionType } = {};
    if (name.trim()) updates.name = name.trim();
    if (description !== undefined) updates.description = description || undefined;
    if (sessionType) {
      updates.sessionType = sessionType as SessionType;
    } else {
      updates.sessionType = undefined;
    }
    sessionsStore.updateSessionMetadata(session.id, updates);
    open = false;
    onSave?.();
    onClose?.();
  }

  function handleClose() {
    open = false;
    onClose?.();
  }

  const SESSION_TYPE_OPTIONS: { value: SessionType | ''; label: string }[] = [
    { value: '', label: 'Default' },
    { value: 'chat', label: 'Chat' },
    { value: 'gAgent', label: 'G-Agent' },
  ];
</script>

<Modal bind:open {onClose} title="Edit Project" size="md" footer={editorFooter}>
  {#if session}
    <div class="editor-form">
      <Input
        bind:value={name}
        label="Name"
        placeholder="Project name"
        fullWidth
      />
      <div class="field-group">
        <label class="field-label" for="project-description">Description (optional)</label>
        <textarea
          id="project-description"
          class="description-input"
          bind:value={description}
          placeholder="Brief description of the project"
          rows="3"
        ></textarea>
      </div>
      <div class="field-group">
        <label class="field-label" for="project-session-type">Session Type</label>
        <select
          id="project-session-type"
          class="session-type-select"
          bind:value={sessionType}
        >
          {#each SESSION_TYPE_OPTIONS as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
    </div>
  {/if}
</Modal>

{#snippet editorFooter()}
  <Button variant="ghost" onclick={handleClose}>Cancel</Button>
  <Button variant="primary" onclick={handleSave} disabled={!name.trim()}>
    Save
  </Button>
{/snippet}

<style>
  .editor-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text, #18181b);
  }

  .description-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, #e4e4e7);
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    resize: vertical;
    min-height: 80px;
  }

  .description-input:focus {
    outline: none;
    border-color: var(--color-primary, #7c3aed);
    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
  }

  .session-type-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, #e4e4e7);
    border-radius: 8px;
    font-size: 0.875rem;
    background: white;
    cursor: pointer;
  }
</style>
