<script lang="ts">
  import { onMount } from 'svelte';
  import {
    getDockerVersion,
    getDockerInfo,
    getNvidiaToolkitVersion,
    detectGpu,
    type DockerVersionResult,
    type DockerInfoResult,
    type GpuDetectResult,
  } from '$lib/dockerSetup';
  import { fetchApi } from '$lib/api';

  interface Props {
    onComplete?: () => void;
    onBack?: () => void;
    /** Deploy mode: one-click, guided, or power-user */
    mode?: 'oneclick' | 'guided' | 'power';
  }

  let { onComplete, onBack, mode = 'guided' }: Props = $props();

  let currentStep = $state(0);
  let dockerVersion = $state<DockerVersionResult | null>(null);
  let dockerInfo = $state<DockerInfoResult | null>(null);
  let gpuResult = $state<GpuDetectResult | null>(null);
  let nvidiaToolkit = $state<{ installed: boolean; version?: string } | null>(null);
  let selectedPreset = $state<string>('gaming');
  let isStarting = $state(false);
  let startProgress = $state(0);
  let startLogs = $state<string[]>([]);
  let startError = $state<string | null>(null);
  let deployMode = $state<'oneclick' | 'guided' | 'power'>('guided');

  // Initialize from prop
  $effect(() => {
    if (mode) deployMode = mode;
  });
  let selectedOverlay = $state<string>('');
  let includeTriton = $state(false);
  let includeRiva = $state(false);
  let includeGuardrails = $state(false);

  const steps = ['Docker', 'GPU', 'Preset', 'Start'];
  const presets = [
    { id: 'gaming', label: 'Gaming PC', desc: '1 GPU (NVIDIA or AMD), 8GB VRAM', overlay: 'gpu' },
    { id: 'workstation', label: 'Workstation', desc: 'Multi-GPU, 24GB+ VRAM', overlay: 'gpu' },
    { id: 'laptop', label: 'Laptop', desc: 'CPU-only or integrated GPU', overlay: '' },
    { id: 'cloud', label: 'Cloud Server', desc: 'High CPU, optional GPU', overlay: 'gpu' },
  ];

  const overlayOptions = [
    { id: '', label: 'CPU Only', desc: 'No GPU acceleration' },
    { id: 'gpu', label: 'NVIDIA GPU', desc: 'CUDA acceleration' },
    { id: 'rocm', label: 'AMD GPU', desc: 'ROCm acceleration' },
  ];

  const installLinks: Record<string, string> = {
    win32: 'https://docs.docker.com/desktop/install/windows-install/',
    darwin: 'https://docs.docker.com/desktop/install/mac-install/',
    linux: 'https://docs.docker.com/engine/install/',
  };
  const platform =
    (typeof navigator !== 'undefined'
      ? (navigator as { platform?: string }).platform?.toLowerCase()
      : '') ?? '';
  const isWin = platform.includes('win');
  const isMac = platform.includes('mac');
  const installUrl = isWin ? installLinks.win32 : isMac ? installLinks.darwin : installLinks.linux;

  async function loadStep0() {
    dockerVersion = await getDockerVersion();
    if (dockerVersion?.installed) {
      dockerInfo = await getDockerInfo();
    }
  }

  async function loadStep1() {
    gpuResult = await detectGpu();
    if (gpuResult?.vendor === 'nvidia') {
      const tk = await getNvidiaToolkitVersion();
      nvidiaToolkit = tk ? { installed: tk.installed, version: tk.version } : null;
      selectedOverlay = 'gpu';
    } else if (gpuResult?.vendor === 'amd') {
      selectedOverlay = 'rocm';
    }
  }

  async function goNext() {
    if (currentStep === 0) await loadStep1();
    if (currentStep < steps.length - 1) currentStep++;
    else if (currentStep === steps.length - 1) await handleStart();
  }

  function goBack() {
    if (currentStep > 0) currentStep--;
    else onBack?.();
  }

  /** One-click deploy: auto-detect and start */
  async function handleOneClick() {
    isStarting = true;
    startProgress = 10;
    startLogs = ['Auto-detecting hardware...'];
    startError = null;

    try {
      // Detect Docker and GPU
      await loadStep0();
      if (!dockerVersion?.installed) {
        throw new Error('Docker not installed. Please install Docker first.');
      }
      startProgress = 30;
      startLogs = [...startLogs, 'Docker detected: ' + (dockerVersion.version || 'OK')];

      await loadStep1();
      startProgress = 50;

      // Auto-select best overlay
      let overlay = '';
      if (gpuResult?.vendor === 'nvidia' && nvidiaToolkit?.installed) {
        overlay = 'gpu';
        startLogs = [...startLogs, 'NVIDIA GPU detected with toolkit'];
      } else if (gpuResult?.vendor === 'amd') {
        overlay = 'rocm';
        startLogs = [...startLogs, 'AMD GPU detected'];
      } else {
        startLogs = [...startLogs, 'No GPU detected, using CPU mode'];
      }

      startProgress = 70;
      startLogs = [...startLogs, 'Starting containers...'];

      // Call backend API
      await startDockerStack(overlay, []);

      startProgress = 100;
      startLogs = [...startLogs, 'Stack started successfully!'];

      setTimeout(() => onComplete?.(), 1000);
    } catch (err) {
      startError = (err as Error).message;
      startLogs = [...startLogs, 'Error: ' + startError];
    } finally {
      isStarting = false;
    }
  }

  /** Call backend to start Docker stack */
  async function startDockerStack(overlay: string, profiles: string[]) {
    const res = await fetchApi('/api/docker/compose/up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overlay: overlay || undefined,
        profiles: profiles.length > 0 ? profiles : undefined,
        pull: true,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Failed to start: ${res.status}`);
    }

    return res.json();
  }

  async function handleStart() {
    isStarting = true;
    startProgress = 0;
    startLogs = [];
    startError = null;

    const progressInterval = setInterval(() => {
      if (startProgress < 90) startProgress += 5;
    }, 500);

    try {
      // Determine overlay based on preset
      const preset = presets.find((p) => p.id === selectedPreset);
      const overlay = deployMode === 'power' ? selectedOverlay : preset?.overlay || '';

      // Collect profiles for advanced services
      const profiles: string[] = [];
      if (includeTriton) profiles.push('triton');
      if (includeRiva) profiles.push('riva');
      if (includeGuardrails) profiles.push('guardrails');

      startLogs = [...startLogs, `Starting with overlay: ${overlay || 'none'}`];
      if (profiles.length > 0) {
        startLogs = [...startLogs, `Including profiles: ${profiles.join(', ')}`];
      }

      await startDockerStack(overlay, profiles);

      startProgress = 100;
      startLogs = [...startLogs, 'Docker stack started successfully!'];

      setTimeout(() => onComplete?.(), 1000);
    } catch (err) {
      startError = (err as Error).message;
      startLogs = [...startLogs, 'Error: ' + startError];
    } finally {
      clearInterval(progressInterval);
      isStarting = false;
    }
  }

  onMount(() => {
    // One-click mode auto-starts
    if (deployMode === 'oneclick') {
      handleOneClick();
    } else {
      loadStep0();
    }
  });
</script>

<div class="wizard">
  <header class="wizard-header">
    {#if onBack}
      <button type="button" class="back-btn" onclick={goBack}>Back</button>
    {/if}
    <h2>Docker & GPU Setup</h2>
    <div class="step-dots">
      {#each steps as _, i}
        <span class="dot" class:active={i === currentStep} class:done={i < currentStep}
          >{i + 1}</span
        >
      {/each}
    </div>
  </header>

  <div class="wizard-body">
    {#if deployMode === 'oneclick'}
      <!-- One-Click Mode -->
      <div class="step-content">
        <h3>One-Click Deploy</h3>
        <div class="progress-wrap">
          <div class="progress-bar" style="width: {startProgress}%"></div>
          <span
            >{isStarting ? `Deploying... ${startProgress}%` : startError ? 'Failed' : 'Ready'}</span
          >
        </div>
        <div class="logs-box">
          {#each startLogs as log}
            <p class="log-line">{log}</p>
          {/each}
        </div>
        {#if startError}
          <p class="status error">{startError}</p>
          <button type="button" class="btn primary" onclick={handleOneClick}>Retry</button>
        {/if}
      </div>
    {:else if currentStep === 0}
      <div class="step-content">
        <h3>Step 1: Docker</h3>

        <!-- Mode selector -->
        <div class="mode-selector">
          <button
            type="button"
            class="mode-btn"
            class:active={deployMode === 'guided'}
            onclick={() => (deployMode = 'guided')}
          >
            Guided Setup
          </button>
          <button
            type="button"
            class="mode-btn"
            class:active={deployMode === 'power'}
            onclick={() => (deployMode = 'power')}
          >
            Power User
          </button>
          <button type="button" class="mode-btn oneclick-btn" onclick={handleOneClick}>
            One-Click Deploy
          </button>
        </div>

        {#if dockerVersion?.installed}
          <p class="status ok">Docker installed: {dockerVersion.version ?? 'unknown'}</p>
          {#if dockerInfo?.running}
            <p class="status ok">Docker is running</p>
          {:else}
            <p class="status warn">Docker is not running. Start Docker Desktop and try again.</p>
          {/if}
        {:else}
          <p class="status error">Docker not detected.</p>
          <a href={installUrl} target="_blank" rel="noopener noreferrer" class="install-link"
            >Install Docker</a
          >
        {/if}
      </div>
    {:else if currentStep === 1}
      <div class="step-content">
        <h3>Step 2: GPU Detection</h3>
        {#if gpuResult?.vendor === 'nvidia'}
          <p class="status ok">NVIDIA GPU detected</p>
          {#each gpuResult.gpus as gpu}
            <p class="gpu-line">{gpu.name} - {gpu.memoryTotal} - Driver {gpu.driverVersion}</p>
          {/each}
          {#if nvidiaToolkit?.installed}
            <p class="status ok">
              nvidia-container-toolkit: {nvidiaToolkit.version ?? 'installed'}
            </p>
          {:else}
            <p class="status warn">
              Install nvidia-container-toolkit for GPU containers.
              <a
                href="https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html"
                target="_blank"
                rel="noopener noreferrer">Guide</a
              >
            </p>
          {/if}
        {:else if gpuResult?.vendor === 'amd'}
          <p class="status ok">AMD GPU detected</p>
          {#each gpuResult.gpus as gpu}
            <p class="gpu-line">{gpu.name} - {gpu.memoryTotal}</p>
          {/each}
        {:else}
          <p class="status info">No GPU detected. Using CPU-only mode.</p>
        {/if}
        {#if gpuResult === null}
          <p class="status">Detecting GPU...</p>
        {/if}
      </div>
    {:else if currentStep === 2}
      <div class="step-content">
        {#if deployMode === 'power'}
          <!-- Power User: manual configuration -->
          <h3>Step 3: Configuration</h3>

          <div class="config-section">
            <h4>GPU Overlay</h4>
            <div class="preset-grid">
              {#each overlayOptions as opt}
                <label class="preset-card" class:selected={selectedOverlay === opt.id}>
                  <input type="radio" name="overlay" bind:group={selectedOverlay} value={opt.id} />
                  <span class="preset-label">{opt.label}</span>
                  <span class="preset-desc">{opt.desc}</span>
                </label>
              {/each}
            </div>
          </div>

          <div class="config-section">
            <h4>Advanced Services (Optional)</h4>
            <div class="checkbox-grid">
              <label class="checkbox-card">
                <input type="checkbox" bind:checked={includeTriton} />
                <span class="checkbox-label">Triton Inference Server</span>
                <span class="checkbox-desc">Local model serving with GPU</span>
              </label>
              <label class="checkbox-card">
                <input type="checkbox" bind:checked={includeRiva} />
                <span class="checkbox-label">NVIDIA Riva</span>
                <span class="checkbox-desc">Speech-to-text & text-to-speech</span>
              </label>
              <label class="checkbox-card">
                <input type="checkbox" bind:checked={includeGuardrails} />
                <span class="checkbox-label">NeMo Guardrails</span>
                <span class="checkbox-desc">AI safety filtering</span>
              </label>
            </div>
          </div>
        {:else}
          <!-- Guided: preset selection -->
          <h3>Step 3: Hardware Preset</h3>
          <div class="preset-grid">
            {#each presets as preset}
              <label class="preset-card" class:selected={selectedPreset === preset.id}>
                <input type="radio" name="preset" bind:group={selectedPreset} value={preset.id} />
                <span class="preset-label">{preset.label}</span>
                <span class="preset-desc">{preset.desc}</span>
              </label>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div class="step-content">
        <h3>Step 4: Start Stack</h3>
        {#if isStarting}
          <div class="progress-wrap">
            <div class="progress-bar" style="width: {startProgress}%"></div>
            <span>Starting containers... {startProgress}%</span>
          </div>
          <div class="logs-box">
            {#each startLogs as log}
              <p class="log-line">{log}</p>
            {/each}
          </div>
        {:else if startError}
          <p class="status error">{startError}</p>
          <button type="button" class="btn secondary" onclick={() => (startError = null)}
            >Try Again</button
          >
        {:else}
          <div class="summary">
            {#if deployMode === 'power'}
              <p>
                <strong>Overlay:</strong>
                {overlayOptions.find((o) => o.id === selectedOverlay)?.label || 'None'}
              </p>
              {#if includeTriton || includeRiva || includeGuardrails}
                <p>
                  <strong>Services:</strong>
                  {[
                    includeTriton && 'Triton',
                    includeRiva && 'Riva',
                    includeGuardrails && 'Guardrails',
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              {/if}
            {:else}
              <p>
                <strong>Preset:</strong>
                {presets.find((p) => p.id === selectedPreset)?.label ?? selectedPreset}
              </p>
            {/if}
            <p class="hint">Click Start to launch the Docker stack.</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <footer class="wizard-footer">
    <button
      type="button"
      class="btn secondary"
      onclick={goBack}
      disabled={currentStep === 0 && !onBack}
    >
      {currentStep === 0 && onBack ? 'Back' : 'Previous'}
    </button>
    <button
      type="button"
      class="btn primary"
      onclick={goNext}
      disabled={currentStep === 0 && !dockerVersion?.installed}
    >
      {currentStep === steps.length - 1 ? 'Start' : 'Next'}
    </button>
  </footer>
</div>

<style>
  .wizard {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #1a1a2e);
    color: var(--text-primary, #e8e8e8);
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
  }
  .wizard-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border, #333);
  }
  .back-btn {
    background: transparent;
    border: 1px solid var(--border, #333);
    color: var(--text-secondary, #888);
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    cursor: pointer;
  }
  .back-btn:hover {
    background: var(--bg-hover, #222);
  }
  .wizard-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  .step-dots {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
  }
  .dot {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: var(--bg-hover, #222);
    color: var(--text-secondary, #888);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
  }
  .dot.active {
    background: #0db7ed;
    color: #fff;
  }
  .dot.done {
    background: #22c55e;
    color: #fff;
  }
  .wizard-body {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
  }
  .step-content h3 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
  }
  .status {
    margin: 0.5rem 0;
    padding: 0.5rem;
    border-radius: 0.375rem;
  }
  .status.ok {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }
  .status.warn {
    background: rgba(234, 179, 8, 0.15);
    color: #eab308;
  }
  .status.error {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }
  .status.info {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }
  .install-link {
    display: inline-block;
    margin-top: 0.5rem;
    color: #0db7ed;
  }
  .gpu-line {
    font-family: monospace;
    font-size: 0.875rem;
    margin: 0.25rem 0;
  }
  .gpu-line :global(code) {
    background: var(--bg-hover, #222);
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
  }
  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1rem;
  }
  .preset-card {
    display: flex;
    flex-direction: column;
    padding: 1rem;
    border: 2px solid var(--border, #333);
    border-radius: 0.5rem;
    cursor: pointer;
  }
  .preset-card.selected {
    border-color: #0db7ed;
    background: rgba(13, 183, 237, 0.1);
  }
  .preset-label {
    font-weight: 600;
  }
  .preset-desc {
    font-size: 0.8rem;
    color: var(--text-secondary, #888);
    margin-top: 0.25rem;
  }
  .preset-card input {
    margin-bottom: 0.5rem;
  }
  .progress-wrap {
    margin-top: 1rem;
    position: relative;
    height: 2rem;
    background: var(--bg-hover, #222);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  .progress-bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: #0db7ed;
    transition: width 0.2s;
  }
  .progress-wrap span {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 0.875rem;
  }
  .wizard-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border, #333);
  }
  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    cursor: pointer;
    border: 1px solid var(--border, #333);
  }
  .btn.secondary {
    background: transparent;
    color: var(--text-primary, #e8e8e8);
  }
  .btn.primary {
    background: #0db7ed;
    color: #fff;
    border-color: #0db7ed;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  :global(code) {
    font-size: 0.8rem;
    word-break: break-all;
  }

  /* Mode selector */
  .mode-selector {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .mode-btn {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border, #333);
    border-radius: 0.5rem;
    background: transparent;
    color: var(--text-primary, #e8e8e8);
    cursor: pointer;
    font-size: 0.875rem;
  }
  .mode-btn:hover {
    background: var(--bg-hover, #222);
  }
  .mode-btn.active {
    border-color: #0db7ed;
    background: rgba(13, 183, 237, 0.1);
  }
  .mode-btn.oneclick-btn {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    border-color: #22c55e;
    color: #fff;
  }
  .mode-btn.oneclick-btn:hover {
    background: linear-gradient(135deg, #16a34a, #15803d);
  }

  /* Logs box */
  .logs-box {
    margin-top: 1rem;
    padding: 0.75rem;
    background: var(--bg-hover, #111);
    border-radius: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
    font-family: monospace;
    font-size: 0.8rem;
  }
  .log-line {
    margin: 0.25rem 0;
    color: var(--text-secondary, #888);
  }
  .log-line:last-child {
    color: var(--text-primary, #e8e8e8);
  }

  /* Config section */
  .config-section {
    margin-bottom: 1.5rem;
  }
  .config-section h4 {
    margin: 0 0 0.75rem;
    font-size: 0.95rem;
    color: var(--text-secondary, #aaa);
  }

  /* Checkbox grid */
  .checkbox-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .checkbox-card {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border, #333);
    border-radius: 0.5rem;
    cursor: pointer;
  }
  .checkbox-card:hover {
    background: var(--bg-hover, #222);
  }
  .checkbox-card input {
    margin-top: 0.2rem;
  }
  .checkbox-label {
    font-weight: 500;
  }
  .checkbox-desc {
    display: block;
    font-size: 0.8rem;
    color: var(--text-secondary, #888);
  }

  /* Summary */
  .summary {
    padding: 1rem;
    background: var(--bg-hover, #222);
    border-radius: 0.5rem;
  }
  .summary p {
    margin: 0.5rem 0;
  }
  .hint {
    color: var(--text-secondary, #888);
    font-size: 0.875rem;
    margin-top: 1rem !important;
  }
</style>
