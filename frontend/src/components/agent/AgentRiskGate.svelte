<script lang="ts">
  /**
   * AgentRiskGate – Risk acknowledgment gate shown before the user can
   * access the autonomous agent.  Extracted from AgentScreen.svelte.
   */
  import { Button } from '../../lib/design-system';
  import { Shield, AlertTriangle, Zap, Activity } from 'lucide-svelte';

  interface Props {
    onAccept: () => void;
    onBack: () => void;
  }
  let { onAccept, onBack }: Props = $props();
</script>

<div class="risk-gate">
  <div class="risk-card">
    <div class="risk-icon-wrapper">
      <div class="risk-icon">
        <Shield size={48} strokeWidth={1.5} />
      </div>
    </div>

    <h1 class="risk-title">Autonomous Agent</h1>
    <p class="risk-subtitle">Before you proceed, please read and understand the following:</p>

    <div class="risk-items">
      <div class="risk-item">
        <AlertTriangle size={20} />
        <div>
          <strong>File System Access</strong>
          <p>The Agent can create, modify, and delete files in your workspace autonomously.</p>
        </div>
      </div>
      <div class="risk-item">
        <Zap size={20} />
        <div>
          <strong>API Calls & External Services</strong>
          <p>
            The Agent may make external API calls, run commands, and interact with connected
            integrations.
          </p>
        </div>
      </div>
      <div class="risk-item">
        <Activity size={20} />
        <div>
          <strong>Cost Implications</strong>
          <p>
            Autonomous operations consume API tokens. Budget limits are enforced but costs can
            accumulate.
          </p>
        </div>
      </div>
    </div>

    <div class="risk-actions">
      <Button variant="ghost" onclick={onBack}>Go Back</Button>
      <Button variant="primary" onclick={onAccept}>
        <Shield size={16} />
        I Understand the Risks — Continue
      </Button>
    </div>
  </div>
</div>

<style>
  .risk-gate {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    background: var(--color-bg-app, #0a0a0f);
    background-image: radial-gradient(
      ellipse at center,
      rgba(124, 58, 237, 0.08) 0%,
      transparent 60%
    );
  }

  .risk-card {
    max-width: 520px;
    width: 100%;
    background: var(--color-bg-card, #141420);
    border: 1px solid var(--color-border, rgba(124, 58, 237, 0.2));
    border-radius: 20px;
    padding: 2.5rem;
    text-align: center;
  }

  .risk-icon-wrapper {
    margin-bottom: 1.5rem;
  }

  .risk-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 88px;
    height: 88px;
    border-radius: 22px;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(239, 68, 68, 0.1));
    color: var(--color-primary, #7c3aed);
    animation: pulse-glow 3s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%,
    100% {
      box-shadow: 0 0 20px rgba(124, 58, 237, 0.2);
    }
    50% {
      box-shadow: 0 0 40px rgba(124, 58, 237, 0.35);
    }
  }

  .risk-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text, #f0f0f5);
    margin: 0 0 0.5rem;
    letter-spacing: -0.03em;
  }

  .risk-subtitle {
    color: var(--color-text-muted, #8b8b9a);
    margin: 0 0 1.5rem;
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .risk-items {
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .risk-item {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: var(--color-text-muted, #aaa);
  }

  .risk-item :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--color-warning, #f59e0b);
  }

  .risk-item strong {
    display: block;
    color: var(--color-text, #f0f0f5);
    font-size: 0.9375rem;
    margin-bottom: 0.25rem;
  }

  .risk-item p {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.4;
  }

  .risk-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }
</style>
