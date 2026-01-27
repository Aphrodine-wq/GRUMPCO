<script lang="ts">
  import { shipStore, shipSession } from '../stores/shipStore';
  import type { ShipStartRequest, ShipPhase } from '../types/ship';
  
  let projectDescription = $state('');
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
      };
      
      const newSession = await shipStore.start(request);
      await shipStore.executeStream(newSession.id, (data) => {
        console.log('SHIP update:', data);
      });
    } catch (err) {
      console.error('Failed to start SHIP mode:', err);
    }
  }
  
  function getPhaseProgress(): number {
    const phases: ShipPhase[] = ['design', 'spec', 'plan', 'code'];
    const currentIndex = phases.indexOf(phase);
    return currentIndex >= 0 ? ((currentIndex + 1) / phases.length) * 100 : 0;
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
      
      <button 
        class="start-button" 
        on:click={handleStart}
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
        <div class="phase-label">Current Phase: {phaseLabels[phase]}</div>
        <div class="status-badge" class:running={status === 'running'} class:completed={status === 'completed'} class:failed={status === 'failed'}>
          {status}
        </div>
      </div>
      
      {#if error}
        <div class="error-message">{error}</div>
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
            {/if}
          </div>
        {/if}
        
        {#if session.planResult}
          <div class="phase-result">
            <h3>Plan Phase</h3>
            <p>Status: {session.planResult.status}</p>
            {#if session.planResult.plan}
              <p>Plan: {session.planResult.plan.title}</p>
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
    background: #f9f9f9;
    border-radius: 4px;
  }
  
  .preferences h3 {
    margin-bottom: 1rem;
  }
  
  .preference-row {
    margin-bottom: 1rem;
  }
  
  .preference-row label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .preference-row select {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
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
</style>
