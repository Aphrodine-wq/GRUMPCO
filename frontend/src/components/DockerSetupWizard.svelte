<script lang="ts">
  import { onMount } from 'svelte';
  import {
    getDockerVersion,
    getDockerInfo,
    getNvidiaToolkitVersion,
    detectGpu,
    isDockerSetupAvailable,
    type DockerVersionResult,
    type DockerInfoResult,
    type GpuDetectResult,
  } from '$lib/dockerSetup';
  import { fetchApi } from '$lib/api';
  import { Button, Card, Radio, Checkbox } from '$lib/design-system';
  import { Box, ArrowLeft } from 'lucide-svelte';

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
    <div class="hero-section">
      {#if onBack}
        <Button variant="ghost" size="sm" onclick={goBack} class="back-btn">
          <ArrowLeft size={16} />
          Back
        </Button>
      {/if}
      <div class="hero-content">
        <div class="hero-icon">
          <Box size={28} strokeWidth={2} />
        </div>
        <div class="hero-text">
          <h1 class="hero-title">Docker & GPU Setup</h1>
          <p class="hero-subtitle">Configure Docker and GPU acceleration for local AI inference.</p>
        </div>
      </div>
    </div>
    {#if !isDockerSetupAvailable()}
      <div class="remote-message" role="alert">
        <p>
          Docker setup requires the desktop app. Install G-Rump for Windows/Mac to configure Docker
          and GPU.
        </p>
      </div>
    {:else}
      <div class="step-progress" role="navigation" aria-label="Setup steps">
        <div class="step-progress-track">
          {#each steps as step, i}
            <div class="step-progress-item">
              <span
                class="step-dot"
                class:active={i === currentStep}
                class:done={i < currentStep}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span class="step-label">{step}</span>
              {#if i < steps.length - 1}
                <span class="step-connector" aria-hidden="true"></span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
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
          <Button variant="primary" onclick={handleOneClick}>Retry</Button>
        {/if}
      </div>
    {:else if currentStep === 0}
      <div class="step-content">
        <h3>Step 1: Docker</h3>

        <!-- Mode selector -->
        <div class="mode-selector">
          <Button
            variant={deployMode === 'guided' ? 'primary' : 'secondary'}
            size="sm"
            onclick={() => (deployMode = 'guided')}
          >
            Guided Setup
          </Button>
          <Button
            variant={deployMode === 'power' ? 'primary' : 'secondary'}
            size="sm"
            onclick={() => (deployMode = 'power')}
          >
            Power User
          </Button>
          <Button variant="primary" size="sm" onclick={handleOneClick}>One-Click Deploy</Button>
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
                <Card
                  variant="outlined"
                  padding="md"
                  interactive
                  onclick={() => (selectedOverlay = opt.id)}
                  class="preset-card {selectedOverlay === opt.id ? 'selected' : ''}"
                >
                  <Radio
                    name="overlay"
                    value={opt.id}
                    checked={selectedOverlay === opt.id}
                    label={opt.label}
                    description={opt.desc}
                    onchange={(v) => (selectedOverlay = v)}
                  />
                </Card>
              {/each}
            </div>
          </div>

          <div class="config-section">
            <h4>Advanced Services (Optional)</h4>
            <div class="checkbox-grid">
              <Checkbox
                bind:checked={includeTriton}
                label="Triton Inference Server"
                description="Local model serving with GPU"
              />
              <Checkbox
                bind:checked={includeRiva}
                label="NVIDIA Riva"
                description="Speech-to-text & text-to-speech"
              />
              <Checkbox
                bind:checked={includeGuardrails}
                label="NeMo Guardrails"
                description="AI safety filtering"
              />
            </div>
          </div>
        {:else}
          <!-- Guided: preset selection -->
          <h3>Step 3: Hardware Preset</h3>
          <div class="preset-grid">
            {#each presets as preset}
              <Card
                variant="outlined"
                padding="md"
                interactive
                onclick={() => (selectedPreset = preset.id)}
                class="preset-card {selectedPreset === preset.id ? 'selected' : ''}"
              >
                <Radio
                  name="preset"
                  value={preset.id}
                  label={preset.label}
                  description={preset.desc}
                  checked={selectedPreset === preset.id}
                  onchange={(v) => (selectedPreset = v)}
                />
              </Card>
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
          <Button variant="secondary" onclick={() => (startError = null)}>Try Again</Button>
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
    <Button variant="secondary" onclick={goBack} disabled={currentStep === 0 && !onBack}>
      {currentStep === 0 && onBack ? 'Back' : 'Previous'}
    </Button>
    <Button
      variant="primary"
      onclick={goNext}
      disabled={currentStep === 0 && !dockerVersion?.installed}
    >
      {currentStep === steps.length - 1 ? 'Start' : 'Next'}
    </Button>
  </footer>
</div>

<style>
  .wizard {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-app, #fafafa);
    color: var(--color-text, #1f1147);
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
  }

  .wizard-header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-border-light, #e9d5ff);
    flex-shrink: 0;
  }

  .hero-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .hero-content {
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
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    color: var(--color-primary, #7c3aed);
    border-radius: 12px;
  }

  .hero-text {
    flex: 1;
    min-width: 0;
  }

  .hero-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #1f1147);
  }

  .hero-subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
    color: var(--color-text-muted, #6b7280);
  }

  .remote-message {
    padding: 1rem;
    background: var(--color-warning-subtle, rgba(234, 179, 8, 0.1));
    border: 1px solid var(--color-warning-border, rgba(234, 179, 8, 0.3));
    border-radius: 8px;
  }

  .remote-message p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-text, #1f1147);
  }

  .step-progress {
    width: 100%;
  }

  .step-progress-track {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .step-progress-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .step-dot {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: var(--color-bg-input, #f3e8ff);
    color: var(--color-text-muted, #6b7280);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .step-dot.active {
    background: var(--color-primary, #7c3aed);
    color: var(--color-text-inverse, #fff);
  }

  .step-dot.done {
    background: var(--color-success, #22c55e);
    color: var(--color-text-inverse, #fff);
  }

  .step-label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-secondary, #4a4a5a);
  }

  .step-connector {
    width: 24px;
    height: 2px;
    background: var(--color-border-light, #f3e8ff);
  }

  .back-btn {
    align-self: flex-start;
  }
  .wizard-body {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
  }

  .step-content h3 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
    color: var(--color-text, #1f1147);
  }

  .status {
    margin: 0.5rem 0;
    padding: 0.5rem;
    border-radius: 0.375rem;
  }

  .status.ok {
    background: var(--color-success-subtle, rgba(34, 197, 94, 0.1));
    color: var(--color-success, #22c55e);
  }

  .status.warn {
    background: var(--color-warning-subtle, rgba(234, 179, 8, 0.1));
    color: var(--color-warning, #eab308);
  }

  .status.error {
    background: var(--color-error-subtle, rgba(239, 68, 68, 0.1));
    color: var(--color-error, #ef4444);
  }

  .status.info {
    background: var(--color-info-subtle, rgba(59, 130, 246, 0.1));
    color: var(--color-info, #3b82f6);
  }

  .gpu-line {
    font-family: monospace;
    font-size: 0.875rem;
    margin: 0.25rem 0;
    color: var(--color-text-secondary, #4a4a5a);
  }

  .gpu-line :global(code) {
    background: var(--color-bg-input, #f3e8ff);
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
  }

  .mode-selector {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1rem;
  }

  .preset-card {
    cursor: pointer;
  }

  .preset-card.selected {
    border-color: var(--color-primary, #7c3aed) !important;
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1)) !important;
  }

  .progress-wrap {
    margin-top: 1rem;
    position: relative;
    height: 2rem;
    background: var(--color-bg-input, #f3e8ff);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .progress-bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: var(--color-primary, #7c3aed);
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
    color: var(--color-text, #1f1147);
  }

  .wizard-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-border-light, #e9d5ff);
  }

  .logs-box {
    margin-top: 1rem;
    padding: 0.75rem;
    background: var(--color-bg-inset, #ede9fe);
    border-radius: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
    font-family: monospace;
    font-size: 0.8rem;
  }

  .log-line {
    margin: 0.25rem 0;
    color: var(--color-text-secondary, #4a4a5a);
  }

  .log-line:last-child {
    color: var(--color-text, #1f1147);
  }

  .config-section {
    margin-bottom: 1.5rem;
  }

  .config-section h4 {
    margin: 0 0 0.75rem;
    font-size: 0.95rem;
    color: var(--color-text-secondary, #4a4a5a);
  }

  .checkbox-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .summary {
    padding: 1rem;
    background: var(--color-bg-subtle, #f5f3ff);
    border-radius: 0.5rem;
  }

  .summary p {
    margin: 0.5rem 0;
    color: var(--color-text, #1f1147);
  }

  .hint {
    color: var(--color-text-muted, #6b7280);
    font-size: 0.875rem;
    margin-top: 1rem !important;
  }

  .install-link {
    display: inline-block;
    margin-top: 0.5rem;
    color: var(--color-primary, #7c3aed);
    text-decoration: underline;
  }

  .install-link:hover {
    color: var(--color-primary-hover, #6d28d9);
  }

  :global(code) {
    font-size: 0.8rem;
    word-break: break-all;
  }
</style>
