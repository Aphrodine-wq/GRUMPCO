<script lang="ts">
  /**
   * Guided troubleshooting: step-by-step diagnosis and animated guides.
   */
  import { Button, Card } from '$lib/design-system';

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

  let step = $state(0);
  const steps = ['What’s wrong?', 'Check connection', 'Check Docker', 'Check API key'];
</script>

<div class="troubleshooting">
  <header class="troubleshooting-header">
    {#if onBack}
      <Button variant="ghost" size="sm" onclick={onBack}>Back</Button>
    {/if}
    <h2>Troubleshooting</h2>
  </header>
  <div class="troubleshooting-body">
    <Card title={steps[step]} padding="md" class="troubleshooting-card">
      {#if step === 0}
        <p>Select the issue you’re seeing:</p>
        <ul class="issue-list">
          <li><button type="button" class="issue-btn">Backend unreachable</button></li>
          <li><button type="button" class="issue-btn">Docker not running</button></li>
          <li><button type="button" class="issue-btn">API key invalid</button></li>
        </ul>
      {:else if step === 1}
        <p>Ensure the backend is running:</p>
        <code>npm run dev</code> or <code>start-app.bat</code>
      {:else if step === 2}
        <p>Start Docker Desktop or run <code>docker info</code> to verify.</p>
      {:else}
        <p>
          Add <code>NVIDIA_NIM_API_KEY</code> or <code>OPENROUTER_API_KEY</code> to
          <code>backend/.env</code>.
        </p>
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
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
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
