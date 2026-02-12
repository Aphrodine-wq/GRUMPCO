<script lang="ts">
  /**
   * ChatInputArea Component
   *
   * Handles user input, image attachment, and send button for chat interface.
   * Extracted from ChatInterface.svelte for better maintainability.
   */
  interface Props {
    /** Current input text */
    inputText: string;
    /** Whether streaming is active */
    streaming?: boolean;
    /** Whether NIM provider is active (enables image upload) */
    isNimProvider?: boolean;
    /** Whether an image is pending */
    hasPendingImage?: boolean;
    /** Placeholder text */
    placeholder?: string;
    /** Called when input text changes */
    onInput?: (text: string) => void;
    /** Called when form is submitted */
    onSubmit?: () => void;
    /** Called when image is selected */
    onImageSelect?: (dataUrl: string) => void;
    /** Reference to input element */
    inputRef?: HTMLInputElement | null;
  }

  let {
    inputText = $bindable(''),
    streaming = false,
    isNimProvider = false,
    hasPendingImage = false,
    placeholder = 'Describe what you want to build...',
    onInput,
    onSubmit,
    onImageSelect,
    inputRef = $bindable(null),
  }: Props = $props();

  let imageInputRef = $state<HTMLInputElement | null>(null);

  function handleFormSubmit(e: Event) {
    e.preventDefault();
    onSubmit?.();
  }

  function handleInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    inputText = target.value;
    onInput?.(target.value);
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

  const canSend = $derived((inputText.trim() || (isNimProvider && hasPendingImage)) && !streaming);
</script>

<form class="input-container" onsubmit={handleFormSubmit}>
  <span class="input-prompt">&gt;</span>

  <div class="input-wrapper">
    <input
      bind:value={inputText}
      bind:this={inputRef}
      oninput={handleInputChange}
      {placeholder}
      class="message-input"
      disabled={streaming}
      aria-label="Chat input"
    />
  </div>

  {#if isNimProvider}
    <input
      type="file"
      accept="image/*"
      class="hidden-file-input"
      bind:this={imageInputRef}
      onchange={handleImageFileChange}
      aria-label="Attach image"
    />
    <button
      type="button"
      class="attach-image-btn"
      title="Attach image"
      aria-label="Attach image"
      onclick={triggerImageUpload}
      disabled={streaming}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
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
  {/if}

  <button
    class="send-button"
    type="submit"
    disabled={!canSend}
    aria-label={streaming ? 'Cancel' : 'Send message'}
  >
    {#if streaming}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    {:else}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="m5 12 7-7 7 7" />
        <path d="M12 19V5" />
      </svg>
    {/if}
  </button>
</form>

<style>
  .input-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background-color: var(--color-bg-input, #f3f4f6);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    border: 1px solid transparent;
    transition:
      border-color 50ms ease-out,
      box-shadow 50ms ease-out;
  }

  .input-container:focus-within {
    border-color: var(--color-primary, #3b82f6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    background-color: var(--color-bg-elevated, #ffffff);
  }

  .input-prompt {
    font-family: 'Fira Code', monospace;
    font-weight: 700;
    color: var(--color-text-muted, #6b7280);
    user-select: none;
  }

  .input-wrapper {
    flex: 1;
    display: flex;
  }

  .message-input {
    width: 100%;
    border: none;
    background: transparent;
    font-size: 1rem;
    color: var(--color-text, #111827);
    outline: none;
    padding: 0;
  }

  .message-input::placeholder {
    color: var(--color-text-muted, #9ca3af);
  }

  .message-input:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .send-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    width: 2rem;
    height: 2rem;
    cursor: pointer;
    transition: background-color 50ms ease-out;
    padding: 0;
  }

  .send-button:hover:not(:disabled) {
    background: #2563eb;
  }

  .send-button:disabled {
    background: var(--color-border, #d1d5db);
    cursor: not-allowed;
  }

  .hidden-file-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .attach-image-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-inset, #e5e7eb);
    color: var(--color-text-secondary, #4b5563);
    border: none;
    border-radius: 0.5rem;
    width: 2rem;
    height: 2rem;
    cursor: pointer;
    transition: background-color 50ms ease-out;
    padding: 0;
  }

  .attach-image-btn:hover:not(:disabled) {
    background: var(--color-border, #d1d5db);
  }

  .attach-image-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .attach-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    background: #3b82f6;
    color: white;
    font-size: 0.65rem;
    font-weight: 600;
    min-width: 1rem;
    height: 1rem;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    .input-container,
    .send-button,
    .attach-image-btn {
      transition: none;
    }
  }
</style>
