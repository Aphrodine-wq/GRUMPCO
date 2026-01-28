<script lang="ts">
  import { shipStore, shipSession } from '../stores/shipStore';
  import { getCurrentProjectId } from '../stores/projectStore';
  import { fetchApi, getApiBase } from '../lib/api.js';
  import { showToast } from '../stores/toastStore';
  import { downloadCodegenZip } from '../lib/codeGeneration.js';
  import type { ShipStartRequest, ShipPhase } from '../types/ship';

  // Subscribe to SSE for ship.completed / ship.failed when we have an active ship session
  $effect(() => {
    const sess = $shipSession.session;
    const st = $shipSession.status;
    const streaming = $shipSession.isStreaming;
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
    const isTauri = typeof window !== 'undefined' && (!!(window as any).__TAURI__ || !!(window as any).__TAURI_INTERNALS__);
    const base = isTauri ? 'Download the project, then open the folder in ' : 'Download the ZIP, extract it, then open the folder in ';
    const msg = {
      cursor: base + 'Cursor (File > Open Folder).',
      vscode: base + 'VS Code (File > Open Folder).',
      jetbrains: base + 'IntelliJ or WebStorm (File > Open).',
    };
    showToast(msg[ide], 'info', 8000);
    handleShipDownload();
  }
</script>

<div class="ship-mode">
  <div class="ship-header">
    <h1>SHIP Mode</h1>
    <p class="subtitle">Sequential workflow: Design → Spec → Plan → Code</p>
  </div>
  
  {#if !session}
    <div class="start-section">
      <div class="form-group">
        <label for="description">Project Description</label>
        <textarea
          id="description"
          bind:value={projectDescription}
          placeholder="Describe your project..."
          rows="5"
        ></textarea>
      </div>
      
      <div class="preferences">
        <h3>Preferences</h3>
        <div class="preference-row">
          <label>
            <span>Frontend Framework:</span>
            <select bind:value={preferences.frontendFramework}>
              <option value="vue">Vue</option>
              <option value="react">React</option>
            </select>
          </label>
        </div>
        <div class="preference-row">
          <label>
            <span>Backend Runtime:</span>
            <select bind:value={preferences.backendRuntime}>
              <option value="node">Node.js</option>
              <option value="python">Python</option>
              <option value="go">Go</option>
            </select>
          </label>
        </div>
        <div class="preference-row">
          <label>
            <span>Database:</span>
            <select bind:value={preferences.database}>
              <option value="postgres">PostgreSQL</option>
              <option value="mongodb">MongoDB</option>
            </select>
          </label>
        </div>
        <div class="preference-row">
          <label>
            <input type="checkbox" bind:checked={preferences.includeTests} />
            Include Tests
          </label>
        </div>
        <div class="preference-row">
          <label>
            <input type="checkbox" bind:checked={preferences.includeDocs} />
            Include Documentation
          </label>
        </div>
      </div>

      <p class="ai-disclaimer">Generated code and content are suggestions only. Always review and test before use. We do not guarantee correctness or fitness for any purpose.</p>
      
      <button 
        class="start-button" 
        onclick={handleStart}
        disabled={!projectDescription.trim() || status === 'running'}
      >
        Start SHIP Mode
      </button>
    </div>
  {:else}
    <div class="session-section">
      <div class="phase-indicator">
        <div class="phase-progress">
          <div class="progress-bar" style="width: {getPhaseProgress()}%"></div>
        </div>
        <div class="phase-label">Current Phase: {phaseLabels[phase]}{#if isStreaming} <span class="streaming-dot">…</span>{/if}</div>
        <div class="status-badge" class:running={status === 'running'} class:completed={status === 'completed'} class:failed={status === 'failed'}>
          {isStreaming ? 'streaming' : status}
        </div>
      </div>
      
      {#if error}
        <div class="error-message">{error}</div>
        {#if canResume && session?.id}
          <div class="resume-actions">
            <button type="button" class="action-btn primary resume-btn" onclick={handleResume} disabled={isStreaming}>
              Resume from {phaseLabels[phase]}
            </button>
          </div>
        {/if}
      {/if}
      
      <div class="phase-results">
        {#if session.designResult}
          <div class="phase-result">
            <h3>Design Phase</h3>
            <p>Status: {session.designResult.status}</p>
            {#if session.designResult.architecture}
              <p>Architecture: {session.designResult.architecture.projectName}</p>
            {/if}
            {#if session.designResult.creativeDesignDoc}
              <details class="cdd-details">
                <summary>Creative Design Document (layout & UI/UX)</summary>
                <div class="cdd-content">
                  {#if session.designResult.creativeDesignDoc.layout}
                    <section class="cdd-section">
                      <h4>Layout</h4>
                      <p>{session.designResult.creativeDesignDoc.layout.gridDescription || '—'}</p>
                      {#if session.designResult.creativeDesignDoc.layout.regions?.length}
                        <ul>
                          {#each session.designResult.creativeDesignDoc.layout.regions as region}
                            <li><strong>{region.name}</strong>: {region.description}</li>
                          {/each}
                        </ul>
                      {/if}
                    </section>
                  {/if}
                  {#if session.designResult.creativeDesignDoc.keyScreens?.length}
                    <section class="cdd-section">
                      <h4>Key screens</h4>
                      <ul>
                        {#each session.designResult.creativeDesignDoc.keyScreens as screen}
                          <li><strong>{screen.name}</strong> — {screen.purpose}</li>
                        {/each}
                      </ul>
                    </section>
                  {/if}
                  {#if session.designResult.creativeDesignDoc.uxFlows?.length}
                    <section class="cdd-section">
                      <h4>UX flows</h4>
                      <ul>
                        {#each session.designResult.creativeDesignDoc.uxFlows as flow}
                          <li><strong>{flow.name}</strong>: {flow.steps?.join(' → ') || '—'}</li>
                        {/each}
                      </ul>
                    </section>
                  {/if}
                  {#if session.designResult.creativeDesignDoc.uiPrinciples?.visualHierarchy?.length || session.designResult.creativeDesignDoc.uiPrinciples?.keyInteractions?.length}
                    <section class="cdd-section">
                      <h4>UI principles</h4>
                      {#if session.designResult.creativeDesignDoc.uiPrinciples.visualHierarchy?.length}
                        <p><strong>Visual hierarchy:</strong> {session.designResult.creativeDesignDoc.uiPrinciples.visualHierarchy.join('; ')}</p>
                      {/if}
                      {#if session.designResult.creativeDesignDoc.uiPrinciples.keyInteractions?.length}
                        <p><strong>Key interactions:</strong> {session.designResult.creativeDesignDoc.uiPrinciples.keyInteractions.join('; ')}</p>
                      {/if}
                    </section>
                  {/if}
                  {#if session.designResult.creativeDesignDoc.accessibilityNotes?.length}
                    <section class="cdd-section">
                      <h4>Accessibility</h4>
                      <ul>
                        {#each session.designResult.creativeDesignDoc.accessibilityNotes as note}
                          <li>{note}</li>
                        {/each}
                      </ul>
                    </section>
                  {/if}
                  {#if session.designResult.creativeDesignDoc.responsivenessNotes?.length}
                    <section class="cdd-section">
                      <h4>Responsiveness</h4>
                      <ul>
                        {#each session.designResult.creativeDesignDoc.responsivenessNotes as note}
                          <li>{note}</li>
                        {/each}
                      </ul>
                    </section>
                  {/if}
                </div>
              </details>
            {/if}
          </div>
        {/if}
        
        {#if session.specResult}
          <div class="phase-result">
            <h3>Specification Phase</h3>
            <p>Status: {session.specResult.status}</p>
            {#if session.specResult.specification}
              <p>Specification: {session.specResult.specification.title}</p>
              <details class="phase-details">
                <summary>Specification details</summary>
                <div class="phase-details-content">
                  {#if session.specResult.specification.description}
                    <p class="spec-description">{session.specResult.specification.description}</p>
                  {/if}
                  {#if session.specResult.specification.sections?.requirements?.length}
                    <h4>Requirements</h4>
                    <ul>
                      {#each session.specResult.specification.sections.requirements as req}
                        <li><strong>{req.title}</strong>: {req.description}</li>
                      {/each}
                    </ul>
                  {:else}
                    <p class="text-muted">No requirements list available.</p>
                  {/if}
                </div>
              </details>
            {/if}
          </div>
        {/if}
        
        {#if session.planResult}
          <div class="phase-result">
            <h3>Plan Phase</h3>
            <p>Status: {session.planResult.status}</p>
            {#if session.planResult.plan}
              <p>Plan: {session.planResult.plan.title}</p>
              <details class="phase-details">
                <summary>Plan summary</summary>
                <div class="phase-details-content">
                  {#if session.planResult.plan.description}
                    <p class="plan-description">{session.planResult.plan.description}</p>
                  {/if}
                  {#if session.planResult.plan.phases?.length}
                    <h4>Phases and steps</h4>
                    <ul class="plan-phase-list">
                      {#each session.planResult.plan.phases as phase}
                        <li>
                          <strong>{phase.name}</strong>
                          {#if phase.steps?.length && session.planResult.plan.steps?.length}
                            <ul class="plan-step-list">
                              {#each phase.steps as stepId}
                                {@const step = session.planResult.plan.steps.find((s: { id: string }) => s.id === stepId)}
                                {#if step}
                                  <li>{step.title}</li>
                                {/if}
                              {/each}
                            </ul>
                          {/if}
                        </li>
                      {/each}
                    </ul>
                  {:else if session.planResult.plan.steps?.length}
                    <h4>Steps</h4>
                    <ul>
                      {#each session.planResult.plan.steps as step}
                        <li>{step.title}</li>
                      {/each}
                    </ul>
                  {:else}
                    <p class="text-muted">No phase breakdown available.</p>
                  {/if}
                </div>
              </details>
            {/if}
          </div>
        {/if}
        
        {#if session.codeResult}
          <div class="phase-result">
            <h3>Code Phase</h3>
            <p>Status: {session.codeResult.status}</p>
            {#if session.codeResult.session}
              <p>Session ID: {session.codeResult.session.sessionId}</p>
            {/if}
          </div>
        {/if}
      </div>
      
      {#if status === 'completed'}
        <div class="completion-message">
          <h2>✓ SHIP Mode Complete!</h2>
          <p>All phases have been completed successfully.</p>
          {#if showCompletionActions}
            <div class="completion-actions">
              <button type="button" class="action-btn success" onclick={handleShipDownload} title="Download project as ZIP">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Download
              </button>
              <button type="button" class="action-btn primary" onclick={handleShipPushClick} title="Push to GitHub">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                Push to GitHub
              </button>
              <button type="button" class="action-btn secondary" onclick={() => handleShipOpenInIde('cursor')} title="Open in Cursor">Cursor</button>
              <button type="button" class="action-btn secondary" onclick={() => handleShipOpenInIde('vscode')} title="Open in VS Code">VS Code</button>
              <button type="button" class="action-btn secondary" onclick={() => handleShipOpenInIde('jetbrains')} title="Open in JetBrains">JetBrains</button>
            </div>
          {/if}
          <button type="button" class="start-over-btn" onclick={handleStartOver}>Start over</button>
        </div>
      {/if}

      {#if showGitHubPrompt}
        <div class="github-prompt-overlay" role="dialog" aria-label="Push to GitHub">
          <div class="github-prompt">
            <label for="ship-repo-input" class="github-prompt-label">Repository name</label>
            <input id="ship-repo-input" type="text" class="github-prompt-input" placeholder="my-project" bind:value={repoNameInput} onkeydown={(e) => e.key === 'Enter' && submitShipPush()} />
            <div class="github-prompt-actions">
              <button type="button" class="action-btn primary" onclick={submitShipPush} disabled={!repoNameInput.trim()}>Push to GitHub</button>
              <button type="button" class="action-btn subtle" onclick={cancelShipGitHubPrompt}>Cancel</button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .ship-mode {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .ship-header {
    margin-bottom: 2rem;
  }
  
  .ship-header h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }
  
  .subtitle {
    color: #666;
    font-size: 1.1rem;
  }
  
  .start-section {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }
  
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: inherit;
    font-size: 1rem;
  }
  
  .preferences {
    margin: 2rem 0;
    padding: 1.5rem;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }
  
  .preferences h3 {
    margin-bottom: 1rem;
    color: #334155;
  }
  
  .preference-row {
    margin-bottom: 1rem;
  }
  
  .preference-row label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #475569;
  }
  
  .preference-row select {
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background-color: white;
    font-size: 0.95rem;
    cursor: pointer;
  }
  
  .ai-disclaimer {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0 0 1rem;
    line-height: 1.3;
  }

  .start-button {
    background: #007bff;
    color: white;
    border: none;
    padding: 0.75rem 2rem;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .start-button:hover:not(:disabled) {
    background: #0056b3;
  }
  
  .start-button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  
  .session-section {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .phase-indicator {
    margin-bottom: 2rem;
  }
  
  .phase-progress {
    height: 8px;
    background: #e9ecef;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 1rem;
  }
  
  .progress-bar {
    height: 100%;
    background: #007bff;
    transition: width 0.3s;
  }
  
  .phase-label {
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  
  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 600;
  }
  
  .status-badge.running {
    background: #fff3cd;
    color: #856404;
  }
  
  .status-badge.completed {
    background: #d4edda;
    color: #155724;
  }
  
  .status-badge.failed {
    background: #f8d7da;
    color: #721c24;
  }
  
  .error-message {
    background: #f8d7da;
    color: #721c24;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .resume-actions {
    margin-bottom: 1rem;
  }

  .resume-btn {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    border: none;
    background: #0EA5E9;
    color: #fff;
  }

  .resume-btn:hover:not(:disabled) {
    background: #0284c7;
  }

  .resume-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .phase-results {
    margin-top: 2rem;
  }
  
  .phase-result {
    padding: 1rem;
    margin-bottom: 1rem;
    background: #f9f9f9;
    border-radius: 4px;
    border-left: 4px solid #007bff;
  }
  
  .phase-result h3 {
    margin-bottom: 0.5rem;
  }

  .cdd-details {
    margin-top: 1rem;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
  }

  .cdd-details summary {
    padding: 0.5rem 0.75rem;
    background: #f0f4f8;
    cursor: pointer;
    font-weight: 600;
  }

  .cdd-content {
    padding: 1rem;
    background: #fafafa;
  }

  .cdd-section {
    margin-bottom: 1rem;
  }

  .cdd-section:last-child {
    margin-bottom: 0;
  }

  .cdd-section h4 {
    margin-bottom: 0.35rem;
    font-size: 0.95rem;
    color: #333;
  }

  .cdd-section ul {
    margin: 0.25rem 0 0 1rem;
    padding: 0;
  }

  .cdd-section li {
    margin-bottom: 0.25rem;
  }

  .phase-details {
    margin-top: 1rem;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
  }

  .phase-details summary {
    padding: 0.5rem 0.75rem;
    background: #f0f4f8;
    cursor: pointer;
    font-weight: 600;
  }

  .phase-details-content {
    padding: 1rem;
    background: #fafafa;
  }

  .phase-details-content h4 {
    margin-bottom: 0.35rem;
    font-size: 0.95rem;
    color: #333;
  }

  .phase-details-content .spec-description,
  .phase-details-content .plan-description {
    margin-bottom: 0.75rem;
    color: #374151;
    line-height: 1.4;
  }

  .phase-details-content .text-muted {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .plan-phase-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .plan-phase-list > li {
    margin-bottom: 0.75rem;
  }

  .plan-step-list {
    margin: 0.25rem 0 0 1rem;
    padding: 0;
    list-style: disc;
  }

  .plan-step-list li {
    margin-bottom: 0.2rem;
  }
  
  .completion-message {
    text-align: center;
    padding: 2rem;
    background: #d4edda;
    border-radius: 4px;
    margin-top: 2rem;
  }
  
  .completion-message h2 {
    color: #155724;
    margin-bottom: 0.5rem;
  }

  .start-over-btn {
    margin-top: 1rem;
    padding: 0.5rem 1.25rem;
    font-size: 0.95rem;
    border: 1px solid #155724;
    background: transparent;
    color: #155724;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
  }

  .start-over-btn:hover {
    background: #155724;
    color: white;
  }

  .completion-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
    margin-top: 1rem;
  }

  .completion-actions .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    border: none;
    transition: background 0.2s, color 0.2s;
  }

  .completion-actions .action-btn.success {
    background: #10B981;
    color: #fff;
  }
  .completion-actions .action-btn.success:hover { background: #059669; }

  .completion-actions .action-btn.primary {
    background: #0EA5E9;
    color: #fff;
  }
  .completion-actions .action-btn.primary:hover { background: #0052CC; }
  .completion-actions .action-btn.primary:disabled { opacity: 0.6; cursor: not-allowed; }

  .completion-actions .action-btn.secondary {
    background: #e9ecef;
    color: #155724;
  }
  .completion-actions .action-btn.secondary:hover { background: #dee2e6; }

  .github-prompt-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .github-prompt {
    background: #fff;
    padding: 1.25rem;
    border-radius: 8px;
    min-width: 280px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
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
  .github-prompt .action-btn.primary { background: #0EA5E9; color: #fff; }
  .github-prompt .action-btn.primary:hover:not(:disabled) { background: #0052CC; }
  .github-prompt .action-btn.subtle { background: #e9ecef; color: #6c757d; }
  .github-prompt .action-btn.subtle:hover { background: #dee2e6; }
</style>
