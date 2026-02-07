<script lang="ts">
  /**
   * CenteredChatInput Component
   *
   * ChatGPT-inspired centered input with integrated model selector.
   * Features:
   * - Centered, floating input area
   * - Model dropdown integrated into input
   * - Image attachment support
   * - Expandable textarea
   * - Clean, minimal design
   */
  import { Tooltip } from '../../lib/design-system';

  interface Props {
    /** Current input text */
    value: string;
    /** Whether streaming/generating is active */
    streaming?: boolean;
    /** Whether NIM provider is active (enables image upload) */
    isNimProvider?: boolean;
    /** Whether an image is pending */
    hasPendingImage?: boolean;
    /** Placeholder text */
    placeholder?: string;
    /** Current model display name */
    modelName?: string;
    /** Called when input text changes */
    onInput?: (text: string) => void;
    /** Called when form is submitted */
    onSubmit?: () => void;
    /** Called when cancel is requested during streaming */
    onCancel?: () => void;
    /** Called when image is selected (max 3) */
    onImageSelect?: (dataUrl: string) => void;
    /** Called when document is selected (max 3; file passed for backend) */
    onDocumentSelect?: (file: File) => void;
    /** Whether documents are pending */
    hasPendingDocuments?: boolean;
    /** Pending image count (0–3) for badge */
    pendingImageCount?: number;
    /** Pending document count (0–3) for badge */
    pendingDocumentCount?: number;
    /** Called when model picker should open */
    onModelClick?: () => void;
    /** Hide model selector (when moved to header) */
    hideModelSelector?: boolean;
    /** Reference to textarea element */
    inputRef?: HTMLTextAreaElement | null;
  }

  const MAX_IMAGES = 3;
  const MAX_DOCUMENTS = 3;

  let {
    value = $bindable(''),
    streaming = false,
    isNimProvider: _isNimProvider = false,
    hasPendingImage = false,
    hasPendingDocuments = false,
    pendingImageCount = 0,
    pendingDocumentCount = 0,
    placeholder = 'Message G-Rump...',
    modelName = 'Auto',
    onInput,
    onSubmit,
    onCancel,
    onImageSelect,
    onDocumentSelect,
    onModelClick,
    hideModelSelector = false,
    inputRef = $bindable(null),
  }: Props = $props();

  let imageInputRef = $state<HTMLInputElement | null>(null);
  let documentInputRef = $state<HTMLInputElement | null>(null);
  let attachMenuOpen = $state(false);
  let textareaHeight = $state(44); // Initial height, updated on resize

  function handleFormSubmit(e: Event) {
    e.preventDefault();
    if (streaming) {
      onCancel?.();
    } else {
      onSubmit?.();
    }
  }

  function handleInputChange(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    value = target.value;
    onInput?.(target.value);
    adjustTextareaHeight(target);
  }

  function handleKeyDown(e: KeyboardEvent) {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!streaming && value.trim()) {
        onSubmit?.();
      }
    }
  }

  function adjustTextareaHeight(textarea: HTMLTextAreaElement) {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Calculate new height (max 200px)
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${newHeight}px`;
    textareaHeight = newHeight;
  }

  function triggerImageUpload() {
    attachMenuOpen = false;
    imageInputRef?.click();
  }

  function triggerDocumentUpload() {
    attachMenuOpen = false;
    documentInputRef?.click();
  }

  async function handleImageFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    onImageSelect?.(dataUrl);
  }

  function handleDocumentFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    onDocumentSelect?.(file);
  }

  const canAddImage = $derived(pendingImageCount < MAX_IMAGES);
  const canAddDocument = $derived(pendingDocumentCount < MAX_DOCUMENTS);
  const totalAttachments = $derived(pendingImageCount + pendingDocumentCount);
  const canSend = $derived(
    (value.trim() || hasPendingImage || hasPendingDocuments || totalAttachments > 0) && !streaming
  );
</script>

<div class="centered-input-wrapper">
  <form class="input-container" onsubmit={handleFormSubmit}>
    {#if !hideModelSelector}
      <!-- Model selector button (left side) -->
      <button
        type="button"
        class="model-button"
        onclick={() => onModelClick?.()}
        title="Change model"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"
          />
        </svg>
        <span class="model-name">{modelName}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    {/if}

    <!-- Textarea input -->
    <div class="input-area">
      <textarea
        bind:value
        bind:this={inputRef}
        oninput={handleInputChange}
        onkeydown={handleKeyDown}
        {placeholder}
        class="message-input"
        disabled={streaming}
        rows="1"
        aria-label="Chat input"
        style="height: {textareaHeight}px"
      ></textarea>
    </div>

    <!-- Action buttons (right side) -->
    <div class="action-buttons">
      <input
        type="file"
        accept="image/*"
        class="hidden-file-input"
        bind:this={imageInputRef}
        onchange={handleImageFileChange}
        aria-label="Attach image"
      />
      <input
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        class="hidden-file-input"
        bind:this={documentInputRef}
        onchange={handleDocumentFileChange}
        aria-label="Attach document"
      />
      <div class="attach-wrapper">
        <Tooltip content="Attach image or document (up to 3 each)" position="top">
          <button
            type="button"
            class="action-btn attach-btn"
            onclick={() => (attachMenuOpen = !attachMenuOpen)}
            disabled={streaming}
            aria-label="Attach"
            aria-expanded={attachMenuOpen}
            aria-haspopup="true"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
              />
            </svg>
            {#if totalAttachments > 0}
              <span class="attach-badge">{totalAttachments}</span>
            {/if}
          </button>
        </Tooltip>
        {#if attachMenuOpen}
          <div class="attach-menu" role="menu">
            <button
              type="button"
              class="attach-menu-item"
              role="menuitem"
              disabled={!canAddImage}
              onclick={triggerImageUpload}
            >
              <span class="attach-menu-label">Image</span>
              <span class="attach-menu-count">{pendingImageCount}/{MAX_IMAGES}</span>
            </button>
            <button
              type="button"
              class="attach-menu-item"
              role="menuitem"
              disabled={!canAddDocument}
              onclick={triggerDocumentUpload}
            >
              <span class="attach-menu-label">Document</span>
              <span class="attach-menu-count">{pendingDocumentCount}/{MAX_DOCUMENTS}</span>
            </button>
          </div>
        {/if}
      </div>

      <!-- Send/Cancel button -->
      <Tooltip content={streaming ? 'Stop generating' : 'Send message'} position="top">
        <button
          class="send-button"
          class:streaming
          class:can-send={canSend}
          type="submit"
          disabled={!canSend && !streaming}
          aria-label={streaming ? 'Stop generating' : 'Send message'}
        >
          {#if streaming}
            <!-- Stop icon -->
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          {:else}
            <!-- Arrow up icon -->
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path d="m5 12 7-7 7 7" />
              <path d="M12 19V5" />
            </svg>
          {/if}
        </button>
      </Tooltip>
    </div>
  </form>
</div>

<style>
  .centered-input-wrapper {
    width: 100%;
    max-width: 880px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .input-container {
    display: flex;
    align-items: flex-end;
    gap: 0.4rem;
    background: var(--color-bg-card, #ffffff);
    border: none;
    border-radius: 1.25rem;
    padding: 0.35rem 0.6rem;
    box-shadow: var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.05));
    transition: box-shadow 50ms ease-out;
  }

  .input-container:focus-within {
    box-shadow: var(--focus-ring, 0 0 0 2px rgba(124, 58, 237, 0.3));
  }

  /* Model selector button */
  .model-button {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-input, #f3f4f6);
    border: 1px solid transparent;
    border-radius: 1rem;
    color: var(--color-text-secondary, #4b5563);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 50ms ease-out;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .model-button:hover {
    background: var(--color-bg-inset, #e5e7eb);
    border-color: var(--color-border-light, #d1d5db);
  }

  .model-button:focus {
    outline: none;
    border-color: var(--color-primary, #7c3aed);
  }

  .model-button .model-name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Textarea input area */
  .input-area {
    flex: 1;
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .message-input {
    width: 100%;
    min-height: 20px;
    max-height: 200px;
    padding: 0.35rem 0;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--color-text, #111827);
    resize: none;
    outline: none;
    overflow-y: auto;
  }

  .message-input::placeholder {
    color: var(--color-text-muted, #9ca3af);
  }

  .message-input:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* Scrollbar styling for textarea */
  .message-input::-webkit-scrollbar {
    width: 4px;
  }

  .message-input::-webkit-scrollbar-track {
    background: transparent;
  }

  .message-input::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 2px;
  }

  /* Action buttons */
  .action-buttons {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .hidden-file-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 50ms ease-out;
    position: relative;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .attach-wrapper {
    position: relative;
  }

  .attach-menu {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 0.25rem;
    min-width: 140px;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.5rem;
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.1));
    padding: 0.25rem;
    z-index: 20;
  }

  .attach-menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    color: var(--color-text, #374151);
    background: none;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background 50ms ease-out;
  }

  .attach-menu-item:hover:not(:disabled) {
    background: var(--color-bg-subtle, #f3f4f6);
  }

  .attach-menu-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .attach-menu-label {
    font-weight: 500;
  }

  .attach-menu-count {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
    margin-left: 0.5rem;
  }

  .attach-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 1rem;
    height: 1rem;
    background: var(--color-primary, #7c3aed);
    color: white;
    font-size: 0.625rem;
    font-weight: 600;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Send button */
  .send-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    background: #d1d5db;
    border: none;
    border-radius: 0.75rem;
    color: white;
    cursor: not-allowed;
    transition: all 50ms ease-out;
  }

  .send-button.can-send {
    background: var(--color-primary, #7c3aed);
    cursor: pointer;
  }

  .send-button.can-send:hover {
    background: var(--color-primary-dark, #6d28d9);
    transform: scale(1.02);
  }

  .send-button.streaming {
    background: #ef4444;
    cursor: pointer;
  }

  .send-button.streaming:hover {
    background: #dc2626;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .input-container,
    .model-button,
    .action-btn,
    .send-button {
      transition: none;
    }

    .send-button.can-send:hover {
      transform: none;
    }
  }
</style>
