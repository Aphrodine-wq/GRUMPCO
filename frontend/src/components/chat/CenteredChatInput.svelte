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
    /** Called when image is selected */
    onImageSelect?: (dataUrl: string) => void;
    /** Called when model picker should open */
    onModelClick?: () => void;
    /** Hide model selector (when moved to header) */
    hideModelSelector?: boolean;
    /** Reference to textarea element */
    inputRef?: HTMLTextAreaElement | null;
  }

  let {
    value = $bindable(''),
    streaming = false,
    isNimProvider = false,
    hasPendingImage = false,
    placeholder = 'Message G-Rump...',
    modelName = 'Auto',
    onInput,
    onSubmit,
    onCancel,
    onImageSelect,
    onModelClick,
    hideModelSelector = false,
    inputRef = $bindable(null),
  }: Props = $props();

  let imageInputRef = $state<HTMLInputElement | null>(null);
  let textareaHeight = $state(52); // Initial height, updated on resize

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
    imageInputRef?.click();
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

  const canSend = $derived((value.trim() || (isNimProvider && hasPendingImage)) && !streaming);
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
      {#if isNimProvider}
        <input
          type="file"
          accept="image/*"
          class="hidden-file-input"
          bind:this={imageInputRef}
          onchange={handleImageFileChange}
          aria-label="Attach image"
        />
        <Tooltip content="Attach image" position="top">
          <button
            type="button"
            class="action-btn attach-btn"
            onclick={triggerImageUpload}
            disabled={streaming}
            aria-label="Attach image"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            {#if hasPendingImage}
              <span class="attach-badge">1</span>
            {/if}
          </button>
        </Tooltip>
      {/if}

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

  <!-- Hint text -->
  <p class="input-hint">
    <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for new line
  </p>
</div>

<style>
  .centered-input-wrapper {
    width: 100%;
    max-width: 1000px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .input-container {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 1.5rem;
    padding: 0.5rem 0.75rem;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.04),
      0 4px 12px rgba(0, 0, 0, 0.05);
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .input-container:focus-within {
    border-color: var(--color-primary, #7c3aed);
    box-shadow:
      0 0 0 3px rgba(124, 58, 237, 0.1),
      0 4px 12px rgba(0, 0, 0, 0.08);
  }

  /* Model selector button */
  .model-button {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    background: #f3f4f6;
    border: 1px solid transparent;
    border-radius: 1rem;
    color: #4b5563;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .model-button:hover {
    background: #e5e7eb;
    border-color: #d1d5db;
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
    min-height: 24px;
    max-height: 200px;
    padding: 0.5rem 0;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 0.9375rem;
    line-height: 1.5;
    color: #111827;
    resize: none;
    outline: none;
    overflow-y: auto;
  }

  .message-input::placeholder {
    color: #9ca3af;
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
    color: #6b7280;
    cursor: pointer;
    transition: all 0.15s;
    position: relative;
  }

  .action-btn:hover:not(:disabled) {
    background: #f3f4f6;
    color: #374151;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    transition: all 0.15s;
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

  /* Hint text */
  .input-hint {
    margin: 0.5rem 0 0;
    font-size: 0.6875rem;
    color: #9ca3af;
    text-align: center;
  }

  .input-hint kbd {
    display: inline-block;
    padding: 0.125rem 0.375rem;
    font-family: ui-monospace, monospace;
    font-size: 0.625rem;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 0.25rem;
    box-shadow: 0 1px 0 #d1d5db;
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
