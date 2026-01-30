<script lang="ts">
  import { Button, Card } from '../lib/design-system';
  import { fetchApi } from '../lib/api.js';
  import { showToast } from '../stores/toastStore.js';
  import { colors } from '../lib/design-system/tokens/colors.js';

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
  let error = $state<string | null>(null);
  let recording = $state(false);
  let transcribing = $state(false);
  let speaking = $state(false);
  let mediaRecorder: MediaRecorder | null = $state(null);
  let audioChunks: Blob[] = [];

  async function startVoiceInput() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
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
      const res = await fetchApi('/api/rag/query', {
        method: 'POST',
        body: JSON.stringify({
          query: q,
          outputFormat,
          ...(outputFormat === 'structured' && {
            structuredSchema: 'tasks: string[] or endpoints: Array<{ method: string, path: string, description: string }>',
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
</script>

<div class="ask-docs-screen" style:--bg-primary={colors.background.primary}>
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
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back
        </Button>
      {/if}
      <h1 class="ask-docs-title">Ask docs</h1>
    </div>
  </header>

  <div class="ask-docs-container">
    <Card title="Query" padding="md">
      <p class="section-desc">Ask a question about the docs, codebase, or specs. Answers are grounded in the RAG index.</p>
      <div class="field-group">
        <label class="field-label" for="ask-docs-input">Question</label>
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
              <svg class="mic-icon recording" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            {:else}
              <svg class="mic-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            {/if}
          </button>
        </div>
        <div class="format-row">
          <label class="field-label" for="ask-docs-format">Output</label>
          <select id="ask-docs-format" class="format-select" bind:value={outputFormat} disabled={loading}>
            <option value="natural">Natural language</option>
            <option value="structured">Structured (JSON)</option>
          </select>
        </div>
        <Button variant="primary" size="sm" onclick={submit} disabled={loading || !query.trim()}>
          {#if loading}
            Asking…
          {:else}
            Ask
          {/if}
        </Button>
      </div>
    </Card>

    {#if error}
      <div class="result-card error">
        <p class="result-label">Error</p>
        <p class="result-text">{error}</p>
      </div>
    {/if}

    {#if answer !== null && !error}
      <div class="result-card">
        {#if confidence !== undefined}
          <div class="confidence-row">
            <span class="result-label">Confidence</span>
            <div class="confidence-bar" role="progressbar" aria-valuenow={confidence} aria-valuemin="0" aria-valuemax="1">
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
            {#if speaking}
              Playing…
            {:else}
              Speak answer
            {/if}
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
                  <a class="citation-link" href={c.url} target="_blank" rel="noopener noreferrer">{c.source}</a>
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
      </div>
    {/if}
  </div>
</div>

<style>
  .ask-docs-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--bg-primary);
    overflow: hidden;
  }

  .ask-docs-header {
    background-color: white;
    border-bottom: 1px solid var(--border-color, #e4e4e7);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .ask-docs-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }

  .ask-docs-container {
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

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .field-label {
    font-size: 13px;
    font-weight: 600;
    color: #3f3f46;
  }

  .query-input {
    width: 100%;
    padding: 12px;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    min-height: 80px;
  }

  .query-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  .query-row .query-input {
    flex: 1;
    min-width: 0;
  }

  .mic-btn {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #52525b;
  }

  .mic-btn:hover:not(:disabled) {
    background: #f4f4f5;
    border-color: #0ea5e9;
    color: #0ea5e9;
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
    50% { opacity: 0.6; }
  }

  .speak-row {
    margin-top: 12px;
  }

  .query-input:focus {
    outline: none;
    border-color: #0ea5e9;
  }

  .result-card {
    margin-top: 24px;
    padding: 20px;
    background: #fafafa;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
  }

  .result-card.error {
    background: #fef2f2;
    border-color: #fecaca;
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
    line-height: 1.6;
    color: #18181b;
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

  .format-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .format-select {
    padding: 8px 12px;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    font-size: 14px;
    max-width: 200px;
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
    background: #e4e4e7;
    border-radius: 4px;
    overflow: hidden;
  }

  .confidence-fill {
    height: 100%;
    background: #0ea5e9;
    border-radius: 4px;
    transition: width 0.2s ease;
  }

  .confidence-value {
    font-size: 13px;
    font-weight: 600;
    color: #52525b;
  }

  .fallback-cta {
    font-size: 13px;
    color: #b45309;
    margin: 0 0 12px;
    padding: 8px 12px;
    background: #fffbeb;
    border-radius: 6px;
  }

  .structured-block {
    margin: 8px 0 0;
    padding: 12px;
    background: #27272a;
    color: #fafafa;
    border-radius: 6px;
    font-size: 12px;
    overflow-x: auto;
    white-space: pre;
  }

  .citations .citation-id {
    font-weight: 700;
    color: #0ea5e9;
    margin-right: 6px;
  }

  .citation-link {
    color: #0ea5e9;
    text-decoration: none;
  }

  .citation-link:hover {
    text-decoration: underline;
  }
</style>
