<script lang="ts">
  import { get } from 'svelte/store';
  import { Button, Card } from '../lib/design-system';
  import { fetchApi } from '../lib/api.js';
  import { showToast } from '../stores/toastStore.js';
  import { workspaceStore } from '../stores/workspaceStore.js';
  import { BookOpen } from 'lucide-svelte';

  type DocType = 'doc' | 'code' | 'spec';

  interface RagCitation {
    id: number;
    source: string;
    type: string;
    url?: string;
  }

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

  let query = $state('');
  let loading = $state(false);
  let answer = $state<string | null>(null);
  let sources = $state<Array<{ source: string; type: string }>>([]);
  let confidence = $state<number | undefined>(undefined);
  let fallback = $state<string | null>(null);
  let citations = $state<RagCitation[]>([]);
  let structured = $state<Record<string, unknown> | null>(null);
  let outputFormat = $state<'natural' | 'structured'>('natural');
  let typesFilter = $state<DocType[]>([]);
  let hybridSearch = $state(false);
  let namespaceOverride = $state('');
  let error = $state<string | null>(null);
  let uploadProgress = $state<'idle' | 'uploading' | 'done' | 'error'>('idle');
  let uploadError = $state<string | null>(null);
  let dragOver = $state(false);
  let recording = $state(false);
  let transcribing = $state(false);
  let speaking = $state(false);
  let mediaRecorder: MediaRecorder | null = $state(null);
  let audioChunks: Blob[] = [];

  async function startVoiceInput() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream);
      mediaRecorder = recorder;
      audioChunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (audioChunks.length === 0) return;
        transcribing = true;
        error = null;
        try {
          const blob = new Blob(audioChunks, { type: mime });
          const buf = await blob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          const res = await fetchApi('/api/voice/transcribe', {
            method: 'POST',
            body: JSON.stringify({ audio: base64 }),
          });
          if (!res.ok) {
            const data = (await res.json()) as { error?: string };
            throw new Error(data?.error ?? `HTTP ${res.status}`);
          }
          const data = (await res.json()) as { text?: string };
          const text = data.text ?? '';
          if (text) {
            query = text;
            submit();
          }
        } catch (e) {
          error = (e as Error).message;
          showToast('Transcription failed', 'error');
        } finally {
          transcribing = false;
        }
      };
      recorder.start();
      recording = true;
    } catch (e) {
      error = (e as Error).message;
      showToast('Microphone access failed', 'error');
    }
  }

  function stopVoiceInput() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder = null;
    }
    recording = false;
  }

  async function speakAnswer() {
    const text = answer ?? '';
    if (!text.trim()) return;
    speaking = true;
    error = null;
    try {
      const res = await fetchApi('/api/voice/synthesize', {
        method: 'POST',
        body: JSON.stringify({ text, base64: true }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { audio?: string };
      const b64 = data.audio ?? '';
      if (!b64) throw new Error('No audio in response');
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        speaking = false;
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        speaking = false;
        showToast('Playback failed', 'error');
      };
      await audio.play();
    } catch (e) {
      error = (e as Error).message;
      showToast('Speak answer failed', 'error');
      speaking = false;
    }
  }

  async function submit() {
    const q = query.trim();
    if (!q) return;
    loading = true;
    answer = null;
    sources = [];
    confidence = undefined;
    fallback = null;
    citations = [];
    structured = null;
    error = null;
    try {
      const namespace = namespaceOverride.trim() || get(workspaceStore).root || undefined;
      const res = await fetchApi('/api/rag/query', {
        method: 'POST',
        body: JSON.stringify({
          query: q,
          outputFormat,
          ...(typesFilter.length > 0 && { types: typesFilter }),
          ...(hybridSearch && { hybrid: true }),
          ...(namespace && { namespace }),
          ...(outputFormat === 'structured' && {
            structuredSchema:
              'tasks: string[] or endpoints: Array<{ method: string, path: string, description: string }>',
          }),
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        answer: string;
        sources?: Array<{ source: string; type: string }>;
        confidence?: number;
        fallback?: string;
        citations?: RagCitation[];
        structured?: Record<string, unknown>;
      };
      answer = data.answer ?? null;
      sources = data.sources ?? [];
      confidence = data.confidence;
      fallback = data.fallback ?? null;
      citations = data.citations ?? [];
      structured = data.structured ?? null;
    } catch (e) {
      error = (e as Error).message;
      showToast('Ask docs failed', 'error');
    } finally {
      loading = false;
    }
  }

  function toggleType(t: DocType) {
    typesFilter = typesFilter.includes(t)
      ? typesFilter.filter((x) => x !== t)
      : [...typesFilter, t];
  }

  const ACCEPTED_EXT = '.md,.mdx,.mdoc,.ts,.tsx,.js,.jsx,.svelte,.vue,.py,.json,.yaml,.yml';
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB per file
  const MAX_TOTAL_SIZE = 5 * 1024 * 1024; // 5MB total

  async function handleFileUpload(files: FileList | null) {
    if (!files?.length) return;
    uploadProgress = 'uploading';
    uploadError = null;
    try {
      const docs: { content: string; source: string; type: DocType }[] = [];
      let totalSize = 0;
      for (let i = 0; i < files.length; i++) {
        const f = files[i]!;
        if (f.size > MAX_FILE_SIZE) {
          throw new Error(`File ${f.name} exceeds 2MB limit`);
        }
        totalSize += f.size;
        if (totalSize > MAX_TOTAL_SIZE) throw new Error('Total upload size exceeds 5MB');
        const ext = f.name.includes('.') ? f.name.slice(f.name.lastIndexOf('.')).toLowerCase() : '';
        let type: DocType = 'doc';
        if (['.md', '.mdx', '.mdoc'].includes(ext)) type = 'doc';
        else if (['.ts', '.tsx', '.js', '.jsx', '.svelte', '.vue', '.py', '.json'].includes(ext))
          type = 'code';
        else type = 'doc';
        const content = await f.text();
        docs.push({ content, source: f.name, type });
      }
      const namespace = namespaceOverride.trim() || get(workspaceStore).root || undefined;
      const res = await fetchApi('/api/rag/reindex', {
        method: 'POST',
        body: JSON.stringify({ docs, ...(namespace && { namespace }) }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data?.error ?? `Upload failed: ${res.status}`);
      }
      const data = (await res.json()) as { chunks?: number };
      uploadProgress = 'done';
      showToast(`Indexed ${data.chunks ?? docs.length} chunks`, 'success');
    } catch (e) {
      uploadError = (e as Error).message;
      uploadProgress = 'error';
      showToast('Upload failed', 'error');
    }
  }
</script>

<div class="ask-docs-screen">
  <header class="ask-docs-header">
    <div class="header-left">
      {#if onBack}
        <Button variant="ghost" size="sm" onclick={onBack}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back
        </Button>
      {/if}
      <div class="hero-section">
        <div class="hero-icon">
          <BookOpen size={28} strokeWidth={2} />
        </div>
        <div>
          <h1 class="ask-docs-title">Ask Docs</h1>
          <p class="ask-docs-subtitle">
            Ask questions about your docs, codebase, or specs. Answers use the RAG index.
          </p>
        </div>
      </div>
    </div>
  </header>

  <div class="ask-docs-container">
    <!-- Question input (top) -->
    <Card padding="md" variant="outlined" class="query-card">
      <div class="query-row">
        <textarea
          id="ask-docs-input"
          class="query-input"
          placeholder="e.g. How do I run the backend tests?"
          bind:value={query}
          disabled={loading}
          rows="3"
        ></textarea>
        <button
          type="button"
          class="mic-btn"
          title={recording ? 'Stop recording' : 'Record question (voice)'}
          disabled={loading || transcribing}
          onclick={recording ? stopVoiceInput : startVoiceInput}
          aria-label={recording ? 'Stop recording' : 'Record question'}
        >
          {#if transcribing}
            <span class="mic-status">…</span>
          {:else if recording}
            <svg
              class="mic-icon recording"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          {:else}
            <svg
              class="mic-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          {/if}
        </button>
      </div>
      <!-- Compact control strip: filters + format toggle -->
      <div class="control-strip">
        <div class="filter-chips">
          <button
            type="button"
            class="type-chip"
            class:active={typesFilter.includes('doc')}
            onclick={() => toggleType('doc')}
            disabled={loading}>Docs</button
          >
          <button
            type="button"
            class="type-chip"
            class:active={typesFilter.includes('code')}
            onclick={() => toggleType('code')}
            disabled={loading}>Code</button
          >
          <button
            type="button"
            class="type-chip"
            class:active={typesFilter.includes('spec')}
            onclick={() => toggleType('spec')}
            disabled={loading}>Spec</button
          >
          <label class="hybrid-toggle">
            <input type="checkbox" bind:checked={hybridSearch} disabled={loading} />
            Hybrid
          </label>
        </div>
        <div class="format-toggle">
          <span class="format-label">Output:</span>
          <button
            type="button"
            class="format-btn"
            class:active={outputFormat === 'natural'}
            onclick={() => (outputFormat = 'natural')}
            disabled={loading}
          >
            Natural
          </button>
          <button
            type="button"
            class="format-btn"
            class:active={outputFormat === 'structured'}
            onclick={() => (outputFormat = 'structured')}
            disabled={loading}
          >
            JSON
          </button>
        </div>
      </div>
      <Button
        variant="primary"
        size="md"
        onclick={submit}
        disabled={loading || !query.trim()}
        class="ask-btn"
      >
        {#if loading}
          Asking…
        {:else}
          Ask
        {/if}
      </Button>
    </Card>

    <!-- Output (below) -->
    {#if error}
      <Card padding="md" variant="outlined" class="result-card error">
        <p class="result-label">Error</p>
        <p class="result-text">{error}</p>
      </Card>
    {/if}

    {#if answer !== null && !error}
      <Card padding="md" variant="outlined" class="result-card">
        {#if confidence !== undefined}
          <div class="confidence-row">
            <span class="result-label">Confidence</span>
            <div
              class="confidence-bar"
              role="progressbar"
              aria-valuenow={confidence}
              aria-valuemin="0"
              aria-valuemax="1"
            >
              <div class="confidence-fill" style="width: {Math.round(confidence * 100)}%"></div>
            </div>
            <span class="confidence-value">{Math.round(confidence * 100)}%</span>
          </div>
        {/if}
        {#if fallback}
          <p class="fallback-cta">{fallback}</p>
        {/if}
        <p class="result-label">Answer</p>
        <div class="result-text markdown-ish">{answer}</div>
        <div class="speak-row">
          <Button variant="secondary" size="sm" onclick={speakAnswer} disabled={speaking}>
            {#if speaking}Playing…{:else}Speak answer{/if}
          </Button>
        </div>
        {#if structured && Object.keys(structured).length > 0}
          <p class="sources-label">Structured data</p>
          <pre class="structured-block">{JSON.stringify(structured, null, 2)}</pre>
        {/if}
        {#if citations.length > 0}
          <p class="sources-label">Sources</p>
          <ul class="sources-list citations">
            {#each citations as c}
              <li>
                <span class="citation-id">[{c.id}]</span>
                {#if c.url}
                  <a class="citation-link" href={c.url} target="_blank" rel="noopener noreferrer"
                    >{c.source}</a
                  >
                {:else}
                  <span class="source-type">{c.type}</span> {c.source}
                {/if}
              </li>
            {/each}
          </ul>
        {:else if sources.length > 0}
          <p class="sources-label">Sources</p>
          <ul class="sources-list">
            {#each sources as s}
              <li><span class="source-type">{s.type}</span> {s.source}</li>
            {/each}
          </ul>
        {/if}
      </Card>
    {/if}

    <!-- Upload documents (secondary, collapsed by default or inline) -->
    <details class="upload-details">
      <summary>Upload documents to RAG index</summary>
      <p class="section-desc">
        Add your own documents. Supports .md, .ts, .tsx, .svelte, .json, etc. Max 2MB per file, 5MB
        total.
      </p>
      <input
        type="text"
        class="namespace-input"
        placeholder="Workspace namespace (optional)"
        bind:value={namespaceOverride}
        disabled={loading}
      />
      <div
        class="upload-zone"
        class:dragover={dragOver}
        role="button"
        tabindex="0"
        aria-label="Upload files by dropping or clicking"
        ondragover={(e) => {
          e.preventDefault();
          dragOver = true;
        }}
        ondragleave={() => {
          dragOver = false;
        }}
        ondrop={(e) => {
          e.preventDefault();
          dragOver = false;
          handleFileUpload(e.dataTransfer?.files ?? null);
        }}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            document.getElementById('rag-upload')?.click();
          }
        }}
      >
        <input
          type="file"
          id="rag-upload"
          class="upload-input"
          accept={ACCEPTED_EXT}
          multiple
          onchange={(e) => {
            handleFileUpload((e.target as HTMLInputElement)?.files ?? null);
            (e.target as HTMLInputElement).value = '';
          }}
        />
        <label for="rag-upload" class="upload-label">
          {#if uploadProgress === 'uploading'}
            Indexing…
          {:else if uploadProgress === 'done'}
            Upload complete
          {:else}
            Drop files or click to upload
          {/if}
        </label>
      </div>
      {#if uploadError}
        <p class="upload-error">{uploadError}</p>
      {/if}
    </details>
  </div>
</div>

<style>
  .ask-docs-screen {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: var(--color-bg-subtle, #f9fafb);
    overflow: hidden;
  }

  .ask-docs-header {
    flex-shrink: 0;
    background: var(--color-bg-card, #ffffff);
    border-bottom: 1px solid var(--color-border, #e5e7eb);
    padding: 1rem 1.5rem;
    display: flex;
    align-items: center;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .hero-section {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .hero-icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(124, 58, 237, 0.06));
    color: var(--color-primary, #7c3aed);
    border-radius: 12px;
  }

  .ask-docs-title {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
    color: var(--color-text, #111827);
  }

  .ask-docs-subtitle {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
    line-height: 1.5;
  }

  .ask-docs-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
    max-width: 720px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .query-card {
    flex-shrink: 0;
  }

  .section-desc {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0 0 0.75rem;
  }

  .control-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    margin: 0.75rem 0 1rem;
  }

  .filter-chips {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .format-toggle {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .format-label {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    margin-right: 0.25rem;
  }

  .format-btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.8125rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    background: var(--color-bg-card, #fff);
    color: var(--color-text-muted, #6b7280);
    cursor: pointer;
  }

  .format-btn:hover:not(:disabled) {
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
  }

  .format-btn.active {
    background: var(--color-primary, #7c3aed);
    border-color: var(--color-primary, #7c3aed);
    color: white;
  }

  .hybrid-toggle {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    cursor: pointer;
  }

  .ask-btn {
    margin-top: 0.5rem;
  }

  .upload-details {
    margin-top: 0.5rem;
    padding: 1rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    background: var(--color-bg-card, #fff);
  }

  .upload-details summary {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text, #111827);
    cursor: pointer;
  }

  .upload-details .namespace-input {
    display: block;
    width: 100%;
    max-width: 320px;
    margin-bottom: 0.75rem;
  }

  .query-input {
    flex: 1;
    min-width: 0;
    padding: 0.75rem 1rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    resize: vertical;
    min-height: 80px;
    background: var(--color-bg-card, #fff);
    color: var(--color-text, #111827);
  }

  .query-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .mic-btn {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    background: var(--color-bg-card, #fff);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted, #52525b);
  }

  .mic-btn:hover:not(:disabled) {
    background: var(--color-bg-subtle, #f4f4f5);
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
  }

  .mic-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .mic-icon {
    flex-shrink: 0;
  }

  .mic-icon.recording {
    color: #dc2626;
    animation: pulse 1s ease-in-out infinite;
  }

  .mic-status {
    font-size: 14px;
    color: #71717a;
  }

  @keyframes pulse {
    50% {
      opacity: 0.6;
    }
  }

  .speak-row {
    margin-top: 12px;
  }

  .query-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .result-card {
    background: var(--color-bg-card, #fff);
  }

  .result-card.error {
    background: var(--color-error-subtle, rgba(239, 68, 68, 0.06));
    border-color: var(--color-error, #ef4444);
  }

  .result-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted, #71717a);
    margin: 0 0 0.5rem;
    text-transform: uppercase;
  }

  .result-text {
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--color-text, #18181b);
    margin: 0;
    white-space: pre-wrap;
  }

  .result-text.markdown-ish {
    white-space: pre-wrap;
  }

  .sources-label {
    font-size: 12px;
    font-weight: 600;
    color: #71717a;
    margin: 16px 0 8px;
    text-transform: uppercase;
  }

  .sources-list {
    margin: 0;
    padding-left: 20px;
    font-size: 13px;
    color: #52525b;
  }

  .source-type {
    font-weight: 600;
    color: #71717a;
    margin-right: 6px;
  }

  .confidence-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .confidence-bar {
    flex: 1;
    max-width: 120px;
    height: 8px;
    background: var(--color-border, #e4e4e7);
    border-radius: 4px;
    overflow: hidden;
  }

  .confidence-fill {
    height: 100%;
    background: var(--color-primary);
    border-radius: 4px;
    transition: width 0.2s ease;
  }

  .confidence-value {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-muted, #52525b);
  }

  .fallback-cta {
    font-size: 0.8125rem;
    color: #b45309;
    margin: 0 0 0.75rem;
    padding: 0.5rem 0.75rem;
    background: #fffbeb;
    border-radius: 6px;
  }

  .structured-block {
    margin: 0.5rem 0 0;
    padding: 0.75rem 1rem;
    background: var(--color-bg-elevated, #27272a);
    color: var(--color-text-inverse, #fafafa);
    border-radius: 6px;
    font-size: 12px;
    overflow-x: auto;
    white-space: pre;
  }

  .citations .citation-id {
    font-weight: 700;
    color: var(--color-primary);
    margin-right: 6px;
  }

  .citation-link {
    color: var(--color-primary);
    text-decoration: none;
  }

  .citation-link:hover {
    text-decoration: underline;
  }

  .type-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .type-chip {
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    background: var(--color-bg-card, #fff);
    font-size: 0.8125rem;
    cursor: pointer;
    color: var(--color-text, #111827);
  }

  .type-chip:hover:not(:disabled) {
    border-color: var(--color-primary, #7c3aed);
  }

  .type-chip.active {
    background: var(--color-primary, #7c3aed);
    border-color: var(--color-primary, #7c3aed);
    color: white;
  }

  .namespace-input {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    font-size: 0.875rem;
  }

  .upload-zone {
    border: 2px dashed var(--color-border, #e5e7eb);
    border-radius: 8px;
    padding: 24px;
    text-align: center;
    cursor: pointer;
  }

  .upload-zone:hover,
  .upload-zone.dragover {
    border-color: var(--color-primary, #7c3aed);
    background: var(--color-bg-subtle, #fafafa);
  }

  .upload-input {
    display: none;
  }

  .upload-label {
    cursor: pointer;
    font-size: 14px;
    color: #71717a;
  }

  .upload-error {
    margin-top: 8px;
    font-size: 13px;
    color: #dc2626;
  }
</style>
