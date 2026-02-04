<script lang="ts">
  import { tick } from 'svelte';
  import { Button, Card } from '../lib/design-system';
  import { fetchApi } from '../lib/api.js';
  import { showToast } from '../stores/toastStore.js';
  import { colors } from '../lib/design-system/tokens/colors.js';
  import { setCurrentView } from '../stores/uiStore.js';

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

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
        body: JSON.stringify({ audio: base64 }),
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
  </header>

  <div class="voice-code-container">
    <Card title="Record" padding="md">
      <p class="section-desc">
        Describe what you want in code. Your voice is transcribed, then RAG + chat generate code and
        a spoken summary.
      </p>
      <p class="section-link">
        <button type="button" class="link-btn" onclick={() => setCurrentView('talkMode')}
          >Switch to Talk Mode</button
        > for continuous conversation.
      </p>
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
      <div class="result-card error">
        <p class="result-label">Error</p>
        <p class="result-text">{error}</p>
      </div>
    {/if}

    {#if transcript !== null || answer !== null}
      <div class="result-card">
        {#if transcript}
          <p class="result-label">Transcript</p>
          <p class="result-text transcript">{transcript}</p>
        {/if}
        {#if answer}
          <p class="result-label">Answer</p>
          <div class="result-text markdown-ish">{answer}</div>
        {/if}
        {#if code}
          <p class="result-label">Code</p>
          <pre class="code-block">{code}</pre>
        {/if}
        {#if audioBase64}
          <div class="speak-row">
            <Button variant="secondary" size="sm" onclick={playTts}>Play summary</Button>
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
      </div>
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
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .voice-code-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }

  .voice-code-container {
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
    margin-bottom: 8px;
  }

  .section-link {
    font-size: 13px;
    color: #71717a;
    margin: 0 0 16px;
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
