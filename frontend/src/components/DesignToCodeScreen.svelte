<script lang="ts">
  import { Button, Card } from '../lib/design-system';
  import { getApiBase } from '../lib/api.js';
  import { showToast } from '../stores/toastStore.js';
  import { colors } from '../lib/design-system/tokens/colors.js';

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

  let description = $state('');
  let targetFramework = $state<'svelte' | 'react' | 'vue' | 'flutter'>('svelte');
  let imageFile: File | null = $state(null);
  let imagePreview = $state<string | null>(null);
  let loading = $state(false);
  let code = $state<string | null>(null);
  let explanation = $state<string | null>(null);
  let error = $state<string | null>(null);

  function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }
    imageFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      imagePreview = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (!description.trim()) {
      showToast('Enter a description', 'error');
      return;
    }
    if (!imageFile && !imagePreview) {
      showToast('Upload an image or paste a screenshot', 'error');
      return;
    }
    loading = true;
    error = null;
    code = null;
    explanation = null;
    try {
      let imageBase64: string | undefined;
      if (imageFile) {
        const buf = await imageFile.arrayBuffer();
        imageBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      } else if (imagePreview?.startsWith('data:')) {
        imageBase64 = imagePreview.replace(/^data:image\/\w+;base64,/, '');
      }
      const res = await fetch(`${getApiBase()}/api/vision/design-to-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageBase64,
          description: description.trim(),
          targetFramework,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { code?: string; explanation?: string };
      code = data.code ?? null;
      explanation = data.explanation ?? null;
      showToast('Code generated', 'success');
    } catch (e) {
      error = (e as Error).message;
      showToast('Design-to-code failed', 'error');
    } finally {
      loading = false;
    }
  }
</script>

<div class="design-screen" style:--bg-primary={colors.background.primary}>
  <header class="design-header">
    <div class="header-left">
      {#if onBack}
        <Button variant="ghost" size="sm" onclick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back
        </Button>
      {/if}
      <h1 class="design-title">Design to code</h1>
    </div>
  </header>

  <div class="design-container">
    <Card title="Input" padding="md">
      <p class="section-desc">Upload a screenshot or design image and describe what you want. Kimi will generate framework code.</p>
      <div class="field">
        <label class="label">Image</label>
        <input type="file" accept="image/*" onchange={onFileChange} class="file-input" />
        {#if imagePreview}
          <img src={imagePreview} alt="Preview" class="image-preview" />
        {/if}
      </div>
      <div class="field">
        <label class="label">Description</label>
        <textarea
          class="textarea"
          bind:value={description}
          placeholder="e.g. A login form with email, password, and Submit button"
          rows="3"
          disabled={loading}
        ></textarea>
      </div>
      <div class="field">
        <label class="label">Framework</label>
        <select bind:value={targetFramework} class="select" disabled={loading}>
          <option value="svelte">Svelte</option>
          <option value="react">React</option>
          <option value="vue">Vue</option>
          <option value="flutter">Flutter</option>
        </select>
      </div>
      <Button variant="primary" size="md" onclick={submit} disabled={loading}>
        {#if loading}
          Generating…
        {:else}
          Generate code
        {/if}
      </Button>
    </Card>

    {#if error}
      <div class="result-card error">
        <p class="result-label">Error</p>
        <p class="result-text">{error}</p>
      </div>
    {/if}

    {#if code !== null}
      <Card title="Generated code" padding="md">
        {#if explanation}
          <p class="explanation">{explanation}</p>
        {/if}
        <pre class="code-block">{code}</pre>
      </Card>
    {/if}
  </div>
</div>

<style>
  .design-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--bg-primary);
    overflow: hidden;
  }

  .design-header {
    background-color: white;
    border-bottom: 1px solid var(--border-color, #e4e4e7);
    padding: 12px 24px;
    display: flex;
    align-items: center;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .design-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }

  .design-container {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    max-width: 720px;
    margin: 0 auto;
    width: 100%;
  }

  .section-desc {
    font-size: 14px;
    color: #71717a;
    margin-bottom: 16px;
  }

  .field {
    margin-bottom: 16px;
  }

  .label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #52525b;
    margin-bottom: 6px;
  }

  .file-input {
    font-size: 14px;
  }

  .image-preview {
    margin-top: 8px;
    max-width: 280px;
    max-height: 160px;
    object-fit: contain;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
  }

  .textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    font-size: 14px;
    resize: vertical;
  }

  .select {
    padding: 8px 12px;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    font-size: 14px;
  }

  .result-card.error {
    margin-top: 24px;
    padding: 20px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
  }

  .result-label {
    font-size: 12px;
    font-weight: 600;
    color: #71717a;
    margin: 0 0 8px;
    text-transform: uppercase;
  }

  .result-text {
    font-size: 14px;
    color: #18181b;
    margin: 0;
  }

  .explanation {
    font-size: 14px;
    color: #52525b;
    margin-bottom: 12px;
  }

  .code-block {
    margin: 0;
    padding: 12px;
    background: #27272a;
    color: #fafafa;
    border-radius: 6px;
    font-size: 13px;
    overflow-x: auto;
    white-space: pre;
  }
</style>
