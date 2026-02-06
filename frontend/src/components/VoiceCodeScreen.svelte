<script lang="ts">
  import { tick, onMount } from 'svelte';
  import { Button, Card } from '../lib/design-system';
  import { fetchApi } from '../lib/api.js';
  import { showToast } from '../stores/toastStore.js';
  import { colors } from '../lib/design-system/tokens/colors.js';
  import { setCurrentView } from '../stores/uiStore.js';

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

  const LANGUAGE_OPTIONS = [
    { id: 'en', label: 'English' },
    { id: 'es', label: 'Spanish' },
    { id: 'fr', label: 'French' },
    { id: 'de', label: 'German' },
    { id: 'ja', label: 'Japanese' },
  ] as const;

  const HISTORY_KEY = 'voice-code-history';
  const HISTORY_MAX = 20;

  interface HistoryEntry {
    id: string;
    timestamp: number;
    transcriptPreview: string;
    transcript: string | null;
    answer: string | null;
    code: string | null;
    audioBase64: string | null;
    sources: Array<{ source: string; type: string }>;
    confidence?: number;
  }

  let language = $state('en');
  let recording = $state(false);
  let loading = $state(false);
  let transcript = $state<string | null>(null);
  let answer = $state<string | null>(null);
  let code = $state<string | null>(null);
  let audioBase64 = $state<string | null>(null);
  let sources = $state<Array<{ source: string; type: string }>>([]);
  let confidence = $state<number | undefined>(undefined);
  let error = $state<string | null>(null);
  let mediaRecorder: MediaRecorder | null = $state(null);
  let audioChunks: Blob[] = [];
  let waveformCanvas: HTMLCanvasElement | null = $state(null);
  let waveformAnimationId: number | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let history = $state<HistoryEntry[]>([]);

  function drawWaveform() {
    if (!waveformCanvas || !analyser || !recording) return;
    const ctx = waveformCanvas.getContext('2d');
    if (!ctx) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const w = waveformCanvas.width;
    const h = waveformCanvas.height;
    ctx.fillStyle = 'rgba(250, 250, 250, 1)';
    ctx.fillRect(0, 0, w, h);
    const barCount = Math.min(32, Math.floor(w / 4));
    const step = Math.floor(data.length / barCount);
    const barWidth = Math.max(2, w / barCount - 2);
    for (let i = 0; i < barCount; i++) {
      const v = data[i * step] ?? 0;
      const barHeight = Math.max(2, (v / 255) * (h * 0.8));
      ctx.fillStyle = 'var(--color-primary, #18181b)';
      ctx.fillRect(i * (w / barCount) + 1, h / 2 - barHeight / 2, barWidth, barHeight);
    }
    waveformAnimationId = requestAnimationFrame(drawWaveform);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
      audioContext = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const node = ctx.createAnalyser();
      node.fftSize = 256;
      node.smoothingTimeConstant = 0.8;
      src.connect(node);
      analyser = node;

      MediaRecorder.isTypeSupported('audio/webm;codecs=opus');
      const recorder = new MediaRecorder(stream);
      mediaRecorder = recorder;
      audioChunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      recorder.onstop = async () => {
        if (waveformAnimationId != null) {
          cancelAnimationFrame(waveformAnimationId);
          waveformAnimationId = null;
        }
        analyser = null;
        if (audioContext) {
          audioContext.close().catch(() => {});
          audioContext = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        if (audioChunks.length === 0) return;
        await submitVoiceCode();
      };
      recorder.start();
      recording = true;
      error = null;
      transcript = null;
      answer = null;
      code = null;
      audioBase64 = null;
      sources = [];
      confidence = undefined;
      await tick();
      drawWaveform();
    } catch (e) {
      error = (e as Error).message;
      showToast('Microphone access failed', 'error');
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder = null;
    }
    recording = false;
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) history = JSON.parse(raw) as HistoryEntry[];
    } catch {
      history = [];
    }
  }

  function saveToHistory() {
    const preview = transcript?.slice(0, 60).trim() || 'No transcript';
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      transcriptPreview: preview + (transcript && transcript.length > 60 ? '…' : ''),
      transcript,
      answer,
      code,
      audioBase64,
      sources: [...sources],
      confidence,
    };
    history = [entry, ...history].slice(0, HISTORY_MAX);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      history = history.slice(0, HISTORY_MAX);
    }
  }

  function selectHistoryEntry(entry: HistoryEntry) {
    transcript = entry.transcript;
    answer = entry.answer;
    code = entry.code;
    audioBase64 = entry.audioBase64;
    sources = entry.sources ?? [];
    confidence = entry.confidence;
    error = null;
  }

  onMount(loadHistory);

  async function submitVoiceCode() {
    if (audioChunks.length === 0) return;
    loading = true;
    error = null;
    try {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const buf = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const res = await fetchApi('/api/voice/code', {
        method: 'POST',
        body: JSON.stringify({ audio: base64, language }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        transcript?: string;
        answer?: string;
        code?: string;
        audioBase64?: string;
        sources?: Array<{ source: string; type: string }>;
        confidence?: number;
      };
      transcript = data.transcript ?? null;
      answer = data.answer ?? null;
      code = data.code ?? null;
      audioBase64 = data.audioBase64 ?? null;
      sources = data.sources ?? [];
      confidence = data.confidence;
      saveToHistory();
    } catch (e) {
      error = (e as Error).message;
      showToast('Voice code failed', 'error');
    } finally {
      loading = false;
    }
  }

  function playTts() {
    if (!audioBase64) return;
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.onerror = () => URL.revokeObjectURL(url);
    audio.play().catch(() => showToast('Playback failed', 'error'));
  }
</script>

<div class="voice-code-screen" style:--bg-primary={colors.background.primary}>
  <header class="voice-code-header">
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
      <h1 class="voice-code-title">Voice code</h1>
    </div>
    <p class="header-hint">
      <button type="button" class="link-btn" onclick={() => setCurrentView('talkMode')}>
        Switch to Talk Mode
      </button>
      for continuous conversation.
    </p>
  </header>

  <div class="voice-code-container">
    <!-- Card 1: Record -->
    <Card title="Record" padding="md" class="voice-card voice-card-record">
      <p class="section-desc">
        Describe what you want in code. Your voice is transcribed, then RAG + chat generate code and
        a spoken summary.
      </p>
      <div class="language-row">
        <label class="label" for="voice-lang">Language</label>
        <select
          id="voice-lang"
          class="select"
          bind:value={language}
          disabled={loading || recording}
        >
          {#each LANGUAGE_OPTIONS as opt}
            <option value={opt.id}>{opt.label}</option>
          {/each}
        </select>
      </div>
      {#if recording}
        <div class="waveform-container">
          <canvas bind:this={waveformCanvas} class="waveform-canvas" width="300" height="60"
          ></canvas>
        </div>
      {/if}
      <div class="record-row">
        {#if recording}
          <Button variant="secondary" size="md" onclick={stopRecording} disabled={loading}>
            Stop and generate
          </Button>
        {:else}
          <Button variant="primary" size="md" onclick={startRecording} disabled={loading}>
            {#if loading}
              Generating…
            {:else}
              Start recording
            {/if}
          </Button>
        {/if}
      </div>
    </Card>

    {#if error}
      <Card title="Error" padding="md" class="voice-card voice-card-error">
        <p class="result-text">{error}</p>
      </Card>
    {/if}

    <!-- Card 2: Transcript -->
    {#if transcript !== null}
      <Card title="Transcript" padding="md" class="voice-card voice-card-transcript">
        <p class="result-text transcript">{transcript}</p>
      </Card>
    {/if}

    <!-- Card 3: Result (code + summary + playback) -->
    {#if answer !== null || code !== null}
      <Card title="Result" padding="md" class="voice-card voice-card-result">
        {#if answer}
          <p class="result-label">Summary</p>
          <div class="result-text markdown-ish">{answer}</div>
        {/if}
        {#if code}
          <p class="result-label">Code</p>
          <pre class="code-block">{code}</pre>
        {/if}
        {#if audioBase64}
          <div class="speak-row">
            <Button variant="secondary" size="sm" onclick={playTts}>Play spoken summary</Button>
          </div>
        {/if}
        {#if sources.length > 0}
          <p class="sources-label">Sources</p>
          <ul class="sources-list">
            {#each sources as s}
              <li><span class="source-type">{s.type}</span> {s.source}</li>
            {/each}
          </ul>
        {/if}
        {#if confidence !== undefined}
          <p class="confidence-tag">Confidence: {Math.round(confidence * 100)}%</p>
        {/if}
      </Card>
    {/if}

    <!-- History -->
    {#if history.length > 0}
      <Card title="Recent" padding="md" class="voice-card voice-card-history">
        <p class="section-desc">Select a past transcription to view again.</p>
        <ul class="history-list">
          {#each history as entry (entry.id)}
            <li>
              <button type="button" class="history-item" onclick={() => selectHistoryEntry(entry)}>
                <span class="history-time">{new Date(entry.timestamp).toLocaleString()}</span>
                <span class="history-preview">{entry.transcriptPreview}</span>
              </button>
            </li>
          {/each}
        </ul>
      </Card>
    {/if}
  </div>
</div>

<style>
  .voice-code-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--bg-primary);
    overflow: hidden;
  }

  .voice-code-header {
    background-color: white;
    border-bottom: 1px solid var(--border-color, #e4e4e7);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .voice-code-title {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    color: #18181b;
  }

  .header-hint {
    font-size: 0.8125rem;
    color: #71717a;
    margin: 0;
  }

  .voice-code-container {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem 24px;
    max-width: 720px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .voice-card {
    border: 1px solid #e4e4e7;
    border-radius: 12px;
    background: white;
  }

  .voice-card-record {
    border-color: #e4e4e7;
  }

  .voice-card-transcript .result-text.transcript {
    margin: 0;
  }

  .voice-card-result .result-label:first-of-type {
    margin-top: 0;
  }

  .voice-card-error {
    border-color: #fecaca;
    background: #fef2f2;
  }

  .voice-card-history {
    margin-top: 0.5rem;
  }

  .language-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .language-row .label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  .language-row .select {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    color: #18181b;
  }

  .history-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .history-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
    width: 100%;
    padding: 0.75rem 0;
    border: none;
    border-bottom: 1px solid #f4f4f5;
    background: none;
    font-size: 0.875rem;
    color: #18181b;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s;
  }

  .history-item:last-child {
    border-bottom: none;
  }

  .history-item:hover {
    background: #f9fafb;
  }

  .history-time {
    font-size: 0.75rem;
    color: #71717a;
  }

  .history-preview {
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .section-desc {
    font-size: 14px;
    color: #71717a;
    margin-bottom: 8px;
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--color-primary, #18181b);
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
    font-size: inherit;
  }

  .link-btn:hover {
    color: #52525b;
  }

  .waveform-container {
    margin: 12px 0;
    padding: 8px;
    background: #f4f4f5;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .waveform-canvas {
    display: block;
    border-radius: 4px;
    max-width: 100%;
  }

  .record-row {
    margin-top: 8px;
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

  .result-text.transcript {
    font-style: italic;
    color: #52525b;
  }

  .code-block {
    margin: 8px 0 0;
    padding: 12px;
    background: #27272a;
    color: #fafafa;
    border-radius: 6px;
    font-size: 13px;
    overflow-x: auto;
    white-space: pre;
  }

  .speak-row {
    margin-top: 12px;
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

  .confidence-tag {
    font-size: 12px;
    color: #71717a;
    margin: 12px 0 0;
  }
</style>
