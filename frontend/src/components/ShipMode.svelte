<script lang="ts">
  import { shipStore, shipSession } from '../stores/shipStore';
  import { getCurrentProjectId } from '../stores/projectStore';
  import { fetchApi, getApiBase } from '../lib/api.js';
  import { showToast } from '../stores/toastStore';
  import { processError } from '../utils/errorHandler.js';
  import { downloadCodegenZip } from '../lib/codeGeneration.js';
  import { optimizeIntent } from '../stores/featuresStore.js';
  import { buildOptimizedDescription } from '../utils/intentOptimizer.js';
  import type { ShipStartRequest, ShipPhase } from '../types/ship';
  import type { IntentOptimizerResult } from '../stores/featuresStore.js';

  const eventMode = import.meta.env?.VITE_EVENT_MODE ?? 'sse';

  // Subscribe to SSE for ship.completed / ship.failed when we have an active ship session
  $effect(() => {
    const sess = $shipSession.session;
    const st = $shipSession.status;
    const streaming = $shipSession.isStreaming;
    if (eventMode === 'poll') return;
    if (typeof window === 'undefined' || !sess?.id || (st !== 'running' && !streaming)) return;
    const url = getApiBase() + '/api/events/stream?sessionId=' + encodeURIComponent(sess.id);
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        const { event, payload } = JSON.parse(e.data);
        if (event === 'ship.completed' && payload?.sessionId) {
          shipStore.getSession(payload.sessionId);
          showToast('SHIP completed', 'success');
          (
            window as { grump?: { notify?: (t: string, b: string, tag?: string) => void } }
          ).grump?.notify?.('G-Rump', 'SHIP completed', 'ship');
        } else if (event === 'ship.failed' && payload?.sessionId) {
          shipStore.getSession(payload.sessionId);
          const errMsg = (payload.error as string) || 'SHIP failed';
          const ctx = processError(new Error(errMsg));
          showToast(ctx.userMessage, 'error');
          (
            window as { grump?: { notify?: (t: string, b: string, tag?: string) => void } }
          ).grump?.notify?.('G-Rump', ctx.userMessage, 'ship');
        }
      } catch (_) {}
    };
    es.onerror = () => es.close();
    return () => es.close();
  });

  let projectName = $state('');
  let projectDescription = $state('');
  let repoOrg = $state('');
  let repoSource = $state<'git' | 'local'>('git');
  let localPath = $state('');
  let deploymentTarget = $state<string>('none');
  let runDesign = $state(true);
  let runSpec = $state(true);
  let runPlan = $state(true);
  let runCode = $state(true);
  let repoNameInput = $state('');
  let showGitHubPrompt = $state(false);
  let optimizeLoading = $state(false);
  let optimizeResult = $state<IntentOptimizerResult | null>(null);
  let optimizeError = $state<string | null>(null);
  type FrontendFw = 'svelte' | 'next' | 'angular' | 'vue' | 'react';
  type BackendRt = 'node' | 'bun' | 'deno' | 'python' | 'go';
  type Db = 'postgres' | 'mongodb' | 'sqlite';
  let preferences = $state({
    frontendFramework: 'vue' as FrontendFw,
    backendRuntime: 'node' as BackendRt,
    database: 'postgres' as Db,
    includeTests: true,
    includeDocs: true,
  });

  const DEPLOYMENT_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'vercel', label: 'Vercel' },
    { value: 'aws', label: 'AWS' },
    { value: 'gcp', label: 'Google Cloud' },
    { value: 'netlify', label: 'Netlify' },
    { value: 'railway', label: 'Railway' },
  ];

  let session = $derived($shipSession.session);
  let phase = $derived($shipSession.phase);
  let status = $derived($shipSession.status);
  let error = $derived($shipSession.error);
  let isStreaming = $derived($shipSession.isStreaming);

  const phaseLabels: Record<ShipPhase, string> = {
    design: 'Design',
    spec: 'Specification',
    plan: 'Planning',
    code: 'Code Generation',
    completed: 'Completed',
    failed: 'Failed',
  };

  const selectedPhases = $derived(
    [
      runDesign && ('design' as const),
      runSpec && ('spec' as const),
      runPlan && ('plan' as const),
      runCode && ('code' as const),
    ].filter(Boolean) as ('design' | 'spec' | 'plan' | 'code')[]
  );
  const canStart = $derived(
    projectDescription.trim().length > 0 && selectedPhases.length > 0 && status !== 'running'
  );

  async function handleStart() {
    if (!canStart) return;

    try {
      // TODO: backend to accept localPath for local runs; for now only repoOrg (Git) is sent
      const request: ShipStartRequest = {
        projectDescription: projectDescription.trim(),
        preferences,
        projectId: getCurrentProjectId() ?? undefined,
        projectName: projectName.trim() || undefined,
        repoOrg: repoSource === 'git' ? repoOrg.trim() || undefined : undefined,
        deploymentTarget: deploymentTarget === 'none' ? undefined : deploymentTarget,
        phases: selectedPhases.length < 4 ? selectedPhases : undefined,
      };

      const newSession = await shipStore.start(request);
      await shipStore.executeStream(newSession.id);
    } catch (err) {
      console.error('Failed to start SHIP mode:', err);
    }
  }

  function handleStartOver() {
    shipStore.reset();
  }

  const runnablePhases: ShipPhase[] = ['design', 'spec', 'plan', 'code'];
  const canResume = $derived(runnablePhases.includes(phase));

  async function handleResume() {
    if (!session?.id || !canResume) return;
    try {
      await shipStore.executeStream(session.id, undefined, { resumeFromPhase: phase });
    } catch (err) {
      console.error('Failed to resume SHIP:', err);
    }
  }

  function getPhaseProgress(): number {
    const phases: ShipPhase[] = ['design', 'spec', 'plan', 'code'];
    const currentIndex = phases.indexOf(phase);
    return currentIndex >= 0 ? ((currentIndex + 1) / phases.length) * 100 : 0;
  }

  const codegenSessionId = $derived(session?.codeResult?.session?.sessionId);
  const showCompletionActions = $derived(status === 'completed' && !!codegenSessionId);

  async function handleShipDownload() {
    if (!codegenSessionId) return;
    try {
      await downloadCodegenZip(codegenSessionId);
      showToast('Download started. Check your Downloads folder.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Download failed', 'error');
    }
  }

  function handleShipPushClick() {
    showGitHubPrompt = true;
  }

  async function submitShipPush() {
    const name = repoNameInput.trim();
    if (!name || !codegenSessionId) return;
    try {
      const res = await fetchApi('/api/github/create-and-push', {
        method: 'POST',
        body: JSON.stringify({ sessionId: codegenSessionId, repoName: name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast((data as { error?: string }).error ?? 'Push to GitHub failed', 'error');
        return;
      }
      showToast(`Pushed to GitHub as ${name}`, 'success');
      showGitHubPrompt = false;
      repoNameInput = '';
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Push to GitHub failed', 'error');
    }
  }

  function cancelShipGitHubPrompt() {
    showGitHubPrompt = false;
    repoNameInput = '';
  }

  async function handleOptimizeIntent() {
    const raw = projectDescription.trim();
    if (!raw || optimizeLoading) return;
    optimizeLoading = true;
    optimizeError = null;
    optimizeResult = null;
    try {
      const result = await optimizeIntent(raw, 'architecture');
      optimizeResult = result;
      showToast('Intent optimized', 'success');
    } catch (err) {
      optimizeError = err instanceof Error ? err.message : 'Optimization failed';
      showToast(optimizeError, 'error');
    } finally {
      optimizeLoading = false;
    }
  }

  function useOptimizedDescription() {
    if (optimizeResult) {
      projectDescription = buildOptimizedDescription(optimizeResult);
      optimizeResult = null;
      showToast('Using optimized description', 'success');
    }
  }

  function dismissOptimizePanel() {
    optimizeResult = null;
    optimizeError = null;
  }
</script>

<div class="ship-overlay">
  <div class="ship-modal">
    <div class="ship-header">
      <div class="header-content">
        <h1>Design → Spec → Plan → Code</h1>
      </div>
      <button
        class="close-btn"
        onclick={() => window.dispatchEvent(new CustomEvent('close-ship-mode'))}
        aria-label="Close"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"
          ></line></svg
        >
      </button>
    </div>

    <div class="ship-content">
      {#if !session}
        <div class="start-section">
          <p class="ship-empty-intro">Describe your app. We'll generate architecture, spec, plan, and code.</p>

          <!-- Section 1: Project -->
          <div class="ship-section">
            <h3 class="ship-section-title">1. Project</h3>
            <div class="form-group">
              <label for="project-name">Project name</label>
              <input
                id="project-name"
                type="text"
                bind:value={projectName}
                placeholder="My App (optional)"
                class="ship-input"
              />
            </div>
            <div class="form-group">
              <label for="description">Project description</label>
              <textarea
                id="description"
                bind:value={projectDescription}
                placeholder="Describe your project idea in detail..."
                rows="4"
              ></textarea>
              <div class="optimize-row">
                <button
                  type="button"
                  class="optimize-btn"
                  onclick={handleOptimizeIntent}
                  disabled={!projectDescription.trim() || optimizeLoading}
                  title="Refine your intent for architecture before SHIP"
                >
                  {optimizeLoading ? 'Optimizing…' : 'Optimize intent'}
                </button>
              </div>
            </div>
          </div>

          {#if optimizeError}
            <div class="optimize-error" role="alert">
              {optimizeError}
              <button type="button" class="dismiss-btn" onclick={dismissOptimizePanel}
                >Dismiss</button
              >
            </div>
          {/if}

          {#if optimizeResult}
            <div class="optimize-panel">
              <h3 class="optimize-panel-title">Optimized intent</h3>
              <div class="optimize-panel-content">
                {#if optimizeResult.optimized.features?.length}
                  <div class="optimize-section">
                    <strong>Features</strong>
                    <ul>
                      {#each optimizeResult.optimized.features as f}
                        <li>{f}</li>
                      {/each}
                    </ul>
                  </div>
                {/if}
                {#if optimizeResult.optimized.constraints?.length}
                  <div class="optimize-section">
                    <strong>Constraints</strong>
                    <ul>
                      {#each optimizeResult.optimized.constraints as c}
                        <li>{c.description}</li>
                      {/each}
                    </ul>
                  </div>
                {/if}
                {#if optimizeResult.optimized.nonFunctionalRequirements?.length}
                  <div class="optimize-section">
                    <strong>Non-functional</strong>
                    <ul>
                      {#each optimizeResult.optimized.nonFunctionalRequirements as n}
                        <li>{n.requirement}</li>
                      {/each}
                    </ul>
                  </div>
                {/if}
                {#if optimizeResult.optimized.clarifications?.length}
                  <div class="optimize-section">
                    <strong>Clarifications</strong>
                    <ul>
                      {#each optimizeResult.optimized.clarifications as q}
                        <li>{q.question}</li>
                      {/each}
                    </ul>
                  </div>
                {/if}
                {#if optimizeResult.optimized.reasoning}
                  <p class="optimize-reasoning">{optimizeResult.optimized.reasoning}</p>
                {/if}
              </div>
              <div class="optimize-panel-actions">
                <button type="button" class="action-btn secondary" onclick={dismissOptimizePanel}>
                  Dismiss
                </button>
                <button type="button" class="action-btn primary" onclick={useOptimizedDescription}>
                  Use optimized description
                </button>
              </div>
            </div>
          {/if}

          <!-- Section 2: Repo & deploy -->
          <div class="ship-section">
            <h3 class="ship-section-title">2. Repo & deploy</h3>
            <div class="preferences-grid ship-section-grid">
              <div class="form-group repo-source-group" role="group" aria-labelledby="repo-source-label">
                <span id="repo-source-label" class="repo-source-label">Git integration or local file explorer</span>
                <div class="repo-tabs">
                  <button
                    type="button"
                    class="repo-tab"
                    class:active={repoSource === 'git'}
                    onclick={() => (repoSource = 'git')}
                  >
                    Git
                  </button>
                  <button
                    type="button"
                    class="repo-tab"
                    class:active={repoSource === 'local'}
                    onclick={() => (repoSource = 'local')}
                  >
                    Local
                  </button>
                </div>
                {#if repoSource === 'git'}
                  <input
                    id="repo-org"
                    type="text"
                    bind:value={repoOrg}
                    placeholder="username or org (optional)"
                    class="ship-input"
                  />
                {:else}
                  <div class="local-path-row">
                    <input
                      id="local-path"
                      type="text"
                      bind:value={localPath}
                      placeholder="Path to local folder"
                      class="ship-input"
                    />
                    {#if typeof window !== 'undefined' && (window as { grump?: { selectDirectory?: () => Promise<{ path?: string; canceled?: boolean }> } }).grump?.selectDirectory}
                      <button
                        type="button"
                        class="browse-btn"
                        onclick={async () => {
                          const grump = (window as { grump?: { selectDirectory?: () => Promise<{ path?: string; canceled?: boolean }> } }).grump;
                          const result = await grump?.selectDirectory?.();
                          if (result?.path && !result.canceled) localPath = result.path;
                        }}
                      >
                        Browse
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
              <div class="form-group deployment-target-group">
                <label for="deployment-target">Deployment target</label>
                <select id="deployment-target" bind:value={deploymentTarget} class="ship-select">
                  {#each DEPLOYMENT_OPTIONS as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
              </div>
            </div>
          </div>

          <!-- Section 3: Configuration -->
          <details class="advanced-config ship-section">
            <summary>3. Configuration (stack & options)</summary>
            <div class="preferences-grid">
              <div class="preference-col">
                <h3>Configuration</h3>
                <div class="preference-item">
                  <label>
                    <span class="pref-label">Frontend</span>
                    <select bind:value={preferences.frontendFramework}>
                      <option value="svelte">Svelte</option>
                      <option value="next">Next.js</option>
                      <option value="angular">Angular</option>
                      <option value="vue">Vue</option>
                      <option value="react">React</option>
                    </select>
                  </label>
                </div>
                <div class="preference-item">
                  <label>
                    <span class="pref-label">Runtime</span>
                    <select bind:value={preferences.backendRuntime}>
                      <option value="node">Node.js</option>
                      <option value="bun">Bun</option>
                      <option value="deno">Deno</option>
                      <option value="python">Python</option>
                      <option value="go">Go</option>
                    </select>
                  </label>
                </div>
                <div class="preference-item">
                  <label>
                    <span class="pref-label">Database</span>
                    <select bind:value={preferences.database}>
                      <option value="postgres">PostgreSQL</option>
                      <option value="mongodb">MongoDB</option>
                      <option value="sqlite">SQLite</option>
                    </select>
                  </label>
                </div>
              </div>

              <div class="preference-col">
                <h3>Options</h3>
                <div class="checkbox-group">
                  <label class="checkbox-label">
                    <input type="checkbox" bind:checked={preferences.includeTests} />
                    <span>Include Tests</span>
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" bind:checked={preferences.includeDocs} />
                    <span>Include Documentation</span>
                  </label>
                </div>
              </div>
            </div>
          </details>

          <!-- Section 4: Phases -->
          <div class="ship-section">
            <h3 class="ship-section-title">4. Phases to run</h3>
            <p class="ship-section-hint">Select which steps to run. Code requires Plan and Spec; Plan requires Spec; Spec requires Design.</p>
            <div class="phases-checkboxes">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={runDesign} />
                <span>Design</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={runSpec} />
                <span>Specification</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={runPlan} />
                <span>Planning</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={runCode} />
                <span>Code generation</span>
              </label>
            </div>
          </div>

          <!-- Section 5: Actions -->
          <div class="footer-actions ship-section">
            <p class="ai-disclaimer">Generated code is a suggestion. Review before use.</p>
            <button
              class="start-button"
              onclick={handleStart}
              disabled={!canStart}
            >
              Start SHIP Mode
            </button>
          </div>
        </div>
      {:else}
        <div class="session-section">
          <div class="phase-indicator">
            <div class="phase-header">
              <span class="current-phase">{phaseLabels[phase]}</span>
              <span
                class="status-badge"
                class:running={status === 'running'}
                class:completed={status === 'completed'}
                class:failed={status === 'failed'}
              >
                {isStreaming ? 'streaming' : status}
              </span>
            </div>
            <div class="phase-progress-track">
              <div class="progress-fill" style="width: {getPhaseProgress()}%"></div>
            </div>
          </div>

          {#if error}
            {@const errorContext = processError(new Error(error))}
            <div class="error-banner">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                ><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"
                ></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg
              >
              <span>{errorContext.userMessage}</span>
            </div>
            {#if canResume && session?.id}
              <div class="resume-actions">
                <button
                  type="button"
                  class="action-btn primary resume-btn"
                  onclick={handleResume}
                  disabled={isStreaming}
                >
                  Resume from {phaseLabels[phase]}
                </button>
              </div>
            {/if}
          {/if}

          <div class="phase-results-scroll">
            <div class="phase-results">
              {#if session.designResult}
                <div class="phase-card completed">
                  <div class="phase-card-header">
                    <span class="check-icon">✓</span>
                    <h3>Design</h3>
                  </div>
                  <div class="phase-card-content">
                    {#if session.designResult.architecture}
                      <p class="phase-summary">{session.designResult.architecture.projectName}</p>
                    {/if}
                    <!-- Details omitted for brevity in modal view, expandable if needed -->
                  </div>
                </div>
              {/if}

              {#if session.specResult}
                <div class="phase-card completed">
                  <div class="phase-card-header">
                    <span class="check-icon">✓</span>
                    <h3>Specification</h3>
                  </div>
                  <div class="phase-card-content">
                    {#if session.specResult.specification}
                      <p class="phase-summary">{session.specResult.specification.title}</p>
                    {/if}
                  </div>
                </div>
              {/if}

              {#if session.planResult}
                <div class="phase-card completed">
                  <div class="phase-card-header">
                    <span class="check-icon">✓</span>
                    <h3>Plan</h3>
                  </div>
                  <div class="phase-card-content">
                    {#if session.planResult.plan}
                      <p class="phase-summary">{session.planResult.plan.title}</p>
                    {/if}
                  </div>
                </div>
              {/if}

              {#if session.codeResult}
                <div class="phase-card completed">
                  <div class="phase-card-header">
                    <span class="check-icon">✓</span>
                    <h3>Code</h3>
                  </div>
                  <div class="phase-card-content">
                    <p class="phase-summary">Code generation complete.</p>
                  </div>
                </div>
              {/if}
            </div>
          </div>

          {#if status === 'completed'}
            <div class="completion-panel">
              <div class="completion-header">
                <h2>All Systems Go! 🚀</h2>
                <p>Your project is ready for liftoff.</p>
              </div>
              {#if showCompletionActions}
                <div class="action-grid">
                  <button type="button" class="action-tile primary" onclick={handleShipDownload}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      ><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline
                        points="7 10 12 15 17 10"
                      ></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg
                    >
                    <span>Download ZIP</span>
                  </button>
                  <button type="button" class="action-tile" onclick={handleShipPushClick}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      ><path
                        d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
                      ></path></svg
                    >
                    <span>Push to GitHub</span>
                  </button>
                  <!-- IDE Actions omitted for cleaner layout -->
                </div>
                <div class="secondary-actions">
                  <button type="button" class="text-btn" onclick={handleStartOver}
                    >Start new project</button
                  >
                </div>
              {/if}
            </div>
          {/if}

          {#if showGitHubPrompt}
            <div class="github-prompt-overlay" role="dialog" aria-label="Push to GitHub">
              <div class="github-prompt">
                <h3>Push to GitHub</h3>
                <label for="ship-repo-input" class="github-prompt-label">Repository Name</label>
                <input
                  id="ship-repo-input"
                  type="text"
                  class="github-prompt-input"
                  placeholder="my-awesome-project"
                  bind:value={repoNameInput}
                  onkeydown={(e) => e.key === 'Enter' && submitShipPush()}
                />
                <div class="github-prompt-actions">
                  <button
                    type="button"
                    class="action-btn secondary"
                    onclick={cancelShipGitHubPrompt}>Cancel</button
                  >
                  <button
                    type="button"
                    class="action-btn primary"
                    onclick={submitShipPush}
                    disabled={!repoNameInput.trim()}>Push</button
                  >
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* Modal Overlay */
  .ship-overlay {
    position: fixed; /* Ensure it floats over everything */
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1rem;
  }

  .ship-modal {
    background: white;
    width: 100%;
    max-width: 1000px;
    border-radius: 16px;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
  }

  @keyframes modalSlideUp {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Header */
  .ship-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #f1f5f9;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    background: #ffffff;
  }

  .header-content h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.25rem 0;
    letter-spacing: -0.02em;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: -0.5rem;
    margin-right: -0.5rem;
  }

  .close-btn:hover {
    background: #f1f5f9;
    color: #475569;
  }

  /* Content Area */
  .ship-content {
    overflow-y: auto;
    padding: 2rem;
    flex: 1;
    background: #f8fafc;
  }

  /* Start section intro */
  .ship-empty-intro {
    font-size: 0.95rem;
    color: #64748b;
    line-height: 1.5;
    margin: 0 0 1.5rem 0;
  }

  .ship-section {
    margin-bottom: 1.75rem;
  }

  .ship-section-title {
    font-size: 1rem;
    font-weight: 600;
    color: #334155;
    margin: 0 0 0.75rem 0;
  }

  .ship-section-hint {
    font-size: 0.8125rem;
    color: #64748b;
    margin: 0 0 0.75rem 0;
    line-height: 1.4;
  }

  .ship-section-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .ship-input {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.9375rem;
    background: white;
  }

  .ship-input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .ship-select {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.9375rem;
    background: white;
  }

  .phases-checkboxes {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
  }

  .phases-checkboxes .checkbox-label {
    margin: 0;
  }

  /* Form Styles */
  .form-group {
    margin-bottom: 2rem;
  }

  .form-group label {
    display: block;
    font-weight: 600;
    color: #334155;
    margin-bottom: 0.75rem;
    font-size: 0.95rem;
  }

  .repo-source-label {
    display: block;
    font-weight: 600;
    color: #334155;
    margin-bottom: 0.75rem;
    font-size: 0.95rem;
  }

  .deployment-target-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .deployment-target-group .ship-select {
    max-width: 100%;
  }

  .repo-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .repo-tab {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #64748b;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .repo-tab:hover {
    background: #e2e8f0;
    color: #334155;
  }

  .repo-tab.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .local-path-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .local-path-row .ship-input {
    flex: 1;
  }

  .browse-btn {
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #334155;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    white-space: nowrap;
  }

  .browse-btn:hover {
    background: #e2e8f0;
  }

  textarea {
    width: 100%;
    padding: 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-family: inherit;
    font-size: 1rem;
    line-height: 1.5;
    resize: vertical;
    outline: none;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
    background: white;
  }

  textarea:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .optimize-row {
    margin-top: 0.75rem;
  }

  .optimize-btn {
    background: transparent;
    border: 1px solid #e2e8f0;
    color: #64748b;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .optimize-btn:hover:not(:disabled) {
    border-color: #3b82f6;
    color: #3b82f6;
    background: #eff6ff;
  }

  .optimize-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .optimize-error {
    background: #fee2e2;
    border: 1px solid #fecaca;
    color: #991b1b;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .dismiss-btn {
    background: transparent;
    border: none;
    color: #991b1b;
    cursor: pointer;
    font-size: 0.85rem;
    text-decoration: underline;
  }

  .optimize-panel {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.25rem;
    margin-bottom: 1.5rem;
    max-height: 320px;
    overflow-y: auto;
  }

  .optimize-panel-title {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    color: #334155;
  }

  .optimize-panel-content {
    font-size: 0.9rem;
    color: #475569;
  }

  .optimize-section {
    margin-bottom: 1rem;
  }

  .optimize-section strong {
    display: block;
    color: #334155;
    margin-bottom: 0.25rem;
  }

  .optimize-section ul {
    margin: 0;
    padding-left: 1.25rem;
  }

  .optimize-section li {
    margin-bottom: 0.25rem;
  }

  .optimize-reasoning {
    margin: 1rem 0 0 0;
    font-style: italic;
    color: #64748b;
  }

  .optimize-panel-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #f1f5f9;
  }

  .optimize-panel-actions .action-btn {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    border-radius: 6px;
    cursor: pointer;
    border: none;
    font-weight: 500;
  }

  .optimize-panel-actions .action-btn.primary {
    background: #3b82f6;
    color: white;
  }

  .optimize-panel-actions .action-btn.primary:hover {
    background: #2563eb;
  }

  .optimize-panel-actions .action-btn.secondary {
    background: #f1f5f9;
    color: #475569;
  }

  .optimize-panel-actions .action-btn.secondary:hover {
    background: #e2e8f0;
  }

  .advanced-config {
    margin-bottom: 1.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #f8fafc;
    overflow: hidden;
  }

  .advanced-config summary {
    padding: 0.75rem 1rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #475569;
    cursor: pointer;
    list-style: none;
    user-select: none;
  }

  .advanced-config summary::-webkit-details-marker {
    display: none;
  }

  .advanced-config summary::before {
    content: '▶';
    display: inline-block;
    margin-right: 0.5rem;
    font-size: 0.75rem;
    transition: transform 0.2s;
  }

  .advanced-config[open] summary::before {
    transform: rotate(90deg);
  }

  .advanced-config .preferences-grid {
    padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0;
  }

  .preferences-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-bottom: 2.5rem;
  }

  .preference-col h3 {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    font-weight: 700;
    margin: 0 0 1rem 0;
  }

  .preference-item {
    margin-bottom: 0.75rem;
  }

  .preference-item label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  }

  .pref-label {
    font-size: 0.9rem;
    color: #475569;
    font-weight: 500;
  }

  select {
    border: none;
    background: transparent;
    font-size: 0.9rem;
    color: #1e293b;
    font-weight: 600;
    cursor: pointer;
    outline: none;
    text-align: right;
  }

  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    font-size: 0.95rem;
    color: #334155;
  }

  .checkbox-label input[type='checkbox'] {
    width: 1.1rem;
    height: 1.1rem;
    accent-color: #3b82f6;
    cursor: pointer;
  }

  /* Footer Actions */
  .footer-actions {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
    margin-top: auto;
  }

  .ai-disclaimer {
    font-size: 0.8rem;
    color: #94a3b8;
    text-align: center;
    margin: 0;
  }

  .start-button {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: none;
    padding: 1rem;
    border-radius: 8px;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      transform 0.1s,
      box-shadow 0.2s;
    box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);
  }

  .start-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 8px -1px rgba(59, 130, 246, 0.3);
  }

  .start-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .start-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #cbd5e1;
    box-shadow: none;
  }

  /* Session View */
  .phase-indicator {
    margin-bottom: 2rem;
  }

  .phase-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .current-phase {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1e293b;
  }

  .phase-progress-track {
    height: 6px;
    background: #e2e8f0;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #3b82f6;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .status-badge {
    text-transform: uppercase;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.25rem 0.6rem;
    border-radius: 99px;
  }

  .status-badge.running {
    background: #e0f2fe;
    color: var(--color-primary-hover);
  }
  .status-badge.completed {
    background: #dcfce7;
    color: #166534;
  }
  .status-badge.failed {
    background: #fee2e2;
    color: #b91c1c;
  }

  /* Error Banner */
  .error-banner {
    background: #fee2e2;
    border: 1px solid #fecaca;
    color: #991b1b;
    padding: 1rem;
    border-radius: 8px;
    display: flex;
    gap: 0.75rem;
    align-items: center;
    margin-bottom: 2rem;
  }

  /* Phase Cards */
  .phase-results-scroll {
    margin: -0.5rem;
    padding: 0.5rem;
  }

  .phase-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem 1.25rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .phase-card.completed {
    border-left: 4px solid #3b82f6;
  }

  .phase-card-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .check-icon {
    color: #22c55e;
    font-weight: 800;
  }

  .phase-card-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #334155;
  }

  .phase-summary {
    margin: 0;
    color: #64748b;
    font-size: 0.9rem;
  }

  /* Completion Panel */
  .completion-panel {
    text-align: center;
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid #e2e8f0;
  }

  .completion-header h2 {
    font-size: 1.5rem;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }

  .completion-header p {
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .action-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .action-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem;
    border: 1px solid #e2e8f0;
    background: white;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    color: #475569;
  }

  .action-tile:hover {
    border-color: #3b82f6;
    background: #eff6ff;
    color: #1e40af;
  }

  .action-tile.primary {
    background: #f8fafc;
  }

  .secondary-actions {
    margin-top: 1.5rem;
  }

  .text-btn {
    background: none;
    border: none;
    color: #94a3b8;
    text-decoration: underline;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .text-btn:hover {
    color: #64748b;
  }

  /* GitHub Prompt */
  .github-prompt-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .github-prompt {
    background: #fff;
    padding: 1.25rem;
    border-radius: 8px;
    min-width: 280px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .github-prompt-label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #374151;
  }

  .github-prompt-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .github-prompt-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .github-prompt .action-btn {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    border: none;
  }
  .github-prompt .action-btn.primary {
    background: var(--color-primary);
    color: #fff;
  }
  .github-prompt .action-btn.primary:hover:not(:disabled) {
    background: #0052cc;
  }

  @media (prefers-reduced-motion: reduce) {
    .github-prompt-overlay,
    .github-prompt {
      animation: none;
    }
    .ship-modal {
      animation: none;
      transition: opacity 150ms ease;
    }
    .close-btn,
    .action-tile,
    .progress-fill,
    .start-button,
    textarea {
      transition: none;
    }
  }
</style>
