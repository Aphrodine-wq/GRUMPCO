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
    <Card title={steps[step]} padding="md">
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
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
  }
  .troubleshooting-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border, #333);
  }
  .troubleshooting-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  .troubleshooting-body {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
  }
  .issue-list {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0;
  }
  .issue-btn {
    display: block;
    width: 100%;
    padding: 0.5rem 1rem;
    margin-bottom: 0.25rem;
    text-align: left;
    background: var(--bg-secondary, #222);
    border: 1px solid var(--border, #333);
    border-radius: 0.5rem;
    color: var(--text-primary, #e8e8e8);
    cursor: pointer;
  }
  .issue-btn:hover {
    background: var(--bg-hover, #333);
  }
  code {
    font-size: 0.875rem;
    padding: 0.125rem 0.25rem;
    background: var(--bg-secondary, #222);
    border-radius: 0.25rem;
  }
  .troubleshooting-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
</style>
