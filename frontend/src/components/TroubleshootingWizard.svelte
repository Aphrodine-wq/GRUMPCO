<script lang="ts">
  /**
   * Guided troubleshooting: step-by-step diagnosis and animated guides.
   */
  import { Button, Card } from '$lib/design-system';
  import { getApiBase } from '$lib/api.js';

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

  let step = $state(0);
  const steps = ['What’s wrong?', 'Connection', 'CORS', 'Authentication', 'Models', 'Docker'];
  const apiBase = $derived(getApiBase());
</script>

<div class="troubleshooting">
  <header class="troubleshooting-header">
    {#if onBack}
      <Button variant="ghost" size="sm" onclick={onBack}>Back</Button>
    {/if}
    <h2>Troubleshooting</h2>
    <p class="header-subtitle">Step-by-step checks for common setup issues</p>
  </header>
  <div class="troubleshooting-body">
    <Card title={steps[step]} padding="md" class="troubleshooting-card">
      {#if step === 0}
        <p>Select the issue you’re seeing:</p>
        <ul class="issue-list">
          <li>
            <button type="button" class="issue-btn" onclick={() => (step = 1)}
              >Backend not connecting</button
            >
          </li>
          <li>
            <button type="button" class="issue-btn" onclick={() => (step = 2)}
              >CORS / blocked requests</button
            >
          </li>
          <li>
            <button type="button" class="issue-btn" onclick={() => (step = 3)}
              >Authentication failing</button
            >
          </li>
          <li>
            <button type="button" class="issue-btn" onclick={() => (step = 4)}
              >API keys / models not working</button
            >
          </li>
          <li>
            <button type="button" class="issue-btn" onclick={() => (step = 5)}
              >Docker not running</button
            >
          </li>
        </ul>
      {:else if step === 1}
        <section class="trouble-section">
          <h3>Connection</h3>
          <p>
            Verify the backend is reachable. Current API base: <code class="api-url">{apiBase}</code
            >
          </p>
          <ol class="check-list">
            <li>
              <strong>Backend running?</strong> Run <code>npm run dev</code> or
              <code>start-app.bat</code>
            </li>
            <li>
              <strong>Electron:</strong> Set <code>VITE_API_URL</code> in <code>frontend/.env</code> to
              your Render URL.
            </li>
            <li><strong>Remote:</strong> See <code>docs/RENDER_BACKEND_ENV.md</code></li>
          </ol>
        </section>
      {:else if step === 2}
        <section class="trouble-section">
          <h3>CORS</h3>
          <p>CORS_ORIGINS must include your frontend origin.</p>
          <ol class="check-list">
            <li>
              Set <code>CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173</code> (and deployed
              URLs).
            </li>
            <li>See <code>docs/RENDER_BACKEND_ENV.md</code></li>
          </ol>
        </section>
      {:else if step === 3}
        <section class="trouble-section">
          <h3>Authentication</h3>
          <ol class="check-list">
            <li><strong>Supabase:</strong> SUPABASE_URL, SUPABASE_ANON_KEY in backend.</li>
            <li><strong>Frontend:</strong> VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.</li>
            <li><strong>OAuth:</strong> PUBLIC_BASE_URL, FRONTEND_URL must match.</li>
          </ol>
        </section>
      {:else if step === 4}
        <section class="trouble-section">
          <h3>Models / API Keys</h3>
          <ol class="check-list">
            <li><strong>NVIDIA NIM:</strong> NVIDIA_NIM_API_KEY in backend/.env</li>
            <li><strong>OpenRouter:</strong> OPENROUTER_API_KEY</li>
            <li><strong>Mock:</strong> MOCK_AI_MODE=true to test without keys</li>
          </ol>
        </section>
      {:else}
        <section class="trouble-section">
          <h3>Docker</h3>
          <ol class="check-list">
            <li>Start Docker Desktop. Run <code>docker info</code> to verify.</li>
            <li><code>docker compose up -d</code> from project root.</li>
          </ol>
        </section>
      {/if}
    </Card>
    <div class="troubleshooting-actions">
      {#if step > 0}
        <Button variant="ghost" size="sm" onclick={() => step--}>Previous</Button>
      {/if}
      {#if step < steps.length - 1}
        <Button variant="primary" size="sm" onclick={() => step++}>Next</Button>
      {/if}
    </div>
  </div>
</div>

<style>
  .troubleshooting {
    display: flex;
    flex-direction: column;
    height: 100%;
    font-family:
      'Inter',
      system-ui,
      -apple-system,
      sans-serif;
    background: #ffffff;
  }
  .troubleshooting-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    background: #ffffff;
  }
  .troubleshooting-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #7c3aed;
  }

  .header-subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
  }

  .trouble-section h3 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    color: var(--color-text, #111827);
  }

  .trouble-section p {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
  }

  .check-list {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.875rem;
    line-height: 1.6;
  }

  .check-list li {
    margin-bottom: 0.5rem;
  }

  .api-url {
    word-break: break-all;
  }
  .troubleshooting-body {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
    background: #ffffff;
  }
  .troubleshooting-body :global(.troubleshooting-card) {
    background: #ffffff !important;
    border: 1px solid #e9d5ff !important;
    box-shadow: 0 1px 3px rgba(124, 58, 237, 0.08) !important;
  }
  .troubleshooting-body :global(.troubleshooting-card .card-content),
  .troubleshooting-body :global(.troubleshooting-card .card-header),
  .troubleshooting-body :global(.troubleshooting-card .header-title) {
    color: #6d28d9 !important;
  }
  .troubleshooting-body :global(.troubleshooting-card p) {
    color: #6d28d9 !important;
  }
  .issue-list {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0;
  }
  .issue-btn {
    display: block;
    width: 100%;
    padding: 0.75rem 1rem;
    margin-bottom: 0.5rem;
    text-align: left;
    background: #ffffff;
    border: 1px solid #e9d5ff;
    border-radius: 0.5rem;
    color: #6d28d9;
    font-weight: 500;
    cursor: pointer;
  }
  .issue-btn:hover {
    background: #f5f3ff;
    border-color: #7c3aed;
  }
  .troubleshooting-body code {
    font-size: 0.875rem;
    padding: 0.2rem 0.4rem;
    background: #f5f3ff;
    border-radius: 0.25rem;
    color: #6d28d9;
    border: 1px solid #e9d5ff;
  }
  .troubleshooting-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
</style>
