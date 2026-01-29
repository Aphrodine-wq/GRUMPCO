<script lang="ts">
  import { shipStore, shipSession } from '../stores/shipStore';
  import { getCurrentProjectId } from '../stores/projectStore';
  import { fetchApi, getApiBase } from '../lib/api.js';
  import { showToast } from '../stores/toastStore';
  import { downloadCodegenZip } from '../lib/codeGeneration.js';
  import type { ShipStartRequest, ShipPhase } from '../types/ship';

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
        } else if (event === 'ship.failed' && payload?.sessionId) {
          shipStore.getSession(payload.sessionId);
          showToast((payload.error as string) || 'SHIP failed', 'error');
        }
      } catch (_) {}
    };
    es.onerror = () => es.close();
    return () => es.close();
  });

  let projectDescription = $state('');
  let repoNameInput = $state('');
  let showGitHubPrompt = $state(false);
  let preferences = $state({
    frontendFramework: 'vue' as 'vue' | 'react',
    backendRuntime: 'node' as 'node' | 'python' | 'go',
    database: 'postgres' as 'postgres' | 'mongodb',
    includeTests: true,
    includeDocs: true,
  });

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

  async function handleStart() {
    if (!projectDescription.trim()) return;

    try {
      const request: ShipStartRequest = {
        projectDescription: projectDescription.trim(),
        preferences,
        projectId: getCurrentProjectId() ?? undefined,
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
      showToast('Download started', 'success');
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

  function handleShipOpenInIde(ide: 'cursor' | 'vscode' | 'jetbrains') {
    const isTauri =
      typeof window !== 'undefined' &&
      (!!(window as any).__TAURI__ || !!(window as any).__TAURI_INTERNALS__);
    const base = isTauri
      ? 'Download the project, then open the folder in '
      : 'Download the ZIP, extract it, then open the folder in ';
    const msg = {
      cursor: base + 'Cursor (File > Open Folder).',
      vscode: base + 'VS Code (File > Open Folder).',
      jetbrains: base + 'IntelliJ or WebStorm (File > Open).',
    };
    showToast(msg[ide], 'info', 8000);
    handleShipDownload();
  }
</script>

<div class="ship-overlay">
  <div class="ship-modal">
    <div class="ship-header">
      <div class="header-content">
        <h1>SHIP Mode</h1>
        <p class="subtitle">Sequential workflow: Design → Spec → Plan → Code</p>
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
          <p class="ship-empty-intro">Describe your app idea and we'll generate architecture, spec, plan, and code in one run.</p>
          <div class="form-group">
            <label for="description">Project Description</label>
            <textarea
              id="description"
              bind:value={projectDescription}
              placeholder="Describe your project idea in detail..."
              rows="4"
            ></textarea>
          </div>

          <div class="preferences-grid">
            <div class="preference-col">
              <h3>Configuration</h3>
              <div class="preference-item">
                <label>
                  <span class="pref-label">Frontend</span>
                  <select bind:value={preferences.frontendFramework}>
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

          <div class="footer-actions">
            <p class="ai-disclaimer">Generated code is a suggestion. Review before use.</p>
            <button
              class="start-button"
              onclick={handleStart}
              disabled={!projectDescription.trim() || status === 'running'}
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
              <span>{error}</span>
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
                  autoFocus
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
    max-width: 700px;
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

  .subtitle {
    color: #64748b;
    font-size: 0.9rem;
    margin: 0;
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
    color: #0284c7;
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
    background: #0ea5e9;
    color: #fff;
  }
  .github-prompt .action-btn.primary:hover:not(:disabled) {
    background: #0052cc;
  }
  .github-prompt .action-btn.subtle {
    background: #e9ecef;
    color: #6c757d;
  }
  .github-prompt .action-btn.subtle:hover {
    background: #dee2e6;
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
