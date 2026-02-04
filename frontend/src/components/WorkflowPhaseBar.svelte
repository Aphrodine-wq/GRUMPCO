<script lang="ts">
  import type { ComponentType } from 'svelte';
  import type { WorkflowPhase, AgentType, AgentTask } from '../types/workflow';
  import { Layers, Palette, Cog, Rocket, CheckCircle, BookOpen, Wrench } from 'lucide-svelte';

  interface Props {
    phase: WorkflowPhase;
    progress?: number;
    agents?: Record<AgentType, AgentTask>;
  }

  let {
    phase = $bindable('idle'),
    progress = $bindable(undefined),
    agents = $bindable(undefined),
  }: Props = $props();

  const phaseOrder: WorkflowPhase[] = ['idle', 'architecture', 'prd', 'codegen', 'complete'];

  // Agent icon mappings
  const agentIconMap: Record<string, ComponentType> = {
    architect: Layers,
    frontend: Palette,
    backend: Cog,
    devops: Rocket,
    test: CheckCircle,
    docs: BookOpen,
  };

  function isPhaseComplete(checkPhase: WorkflowPhase): boolean {
    const currentIndex = phaseOrder.indexOf(phase);
    const checkIndex = phaseOrder.indexOf(checkPhase);
    return currentIndex > checkIndex || phase === 'complete';
  }

  function getAgentIcon(type: string): ComponentType {
    return agentIconMap[type] || Wrench;
  }

  function formatAgentName(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
</script>

{#if phase !== 'idle'}
  <div class="workflow-phase-bar">
    <div class="phase-steps">
      <div
        class="phase-step"
        class:active={phase === 'architecture'}
        class:complete={isPhaseComplete('architecture')}
      >
        <div class="phase-icon">
          {#if isPhaseComplete('architecture')}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          {:else}
            <span>1</span>
          {/if}
        </div>
        <span class="phase-label">Architecture</span>
      </div>

      <div class="phase-connector" class:complete={isPhaseComplete('architecture')}></div>

      <div
        class="phase-step"
        class:active={phase === 'prd'}
        class:complete={isPhaseComplete('prd')}
      >
        <div class="phase-icon">
          {#if isPhaseComplete('prd')}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          {:else}
            <span>2</span>
          {/if}
        </div>
        <span class="phase-label">PRD</span>
      </div>

      <div class="phase-connector" class:complete={isPhaseComplete('prd')}></div>

      <div
        class="phase-step"
        class:active={phase === 'codegen'}
        class:complete={isPhaseComplete('codegen')}
      >
        <div class="phase-icon">
          {#if isPhaseComplete('codegen')}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          {:else if phase === 'codegen' && (progress ?? 0) > 0}
            <span>{progress}%</span>
          {:else}
            <span>3</span>
          {/if}
        </div>
        <span class="phase-label">Code</span>
      </div>
    </div>

    {#if phase === 'codegen' && agents}
      <div class="agent-progress">
        {#each Object.entries(agents) as [type, agent] (type)}
          <div class="agent-status {agent.status}" title={agent.description}>
            <span class="agent-icon">
              {#if getAgentIcon(type)}
                {@const AgentIcon = getAgentIcon(type)}
                <AgentIcon size={16} />
              {/if}
            </span>
            <span class="agent-name">{formatAgentName(type)}</span>
            <span class="agent-status-dot"></span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .workflow-phase-bar {
    background: #fafafa;
    padding: 1rem 0;
  }

  .phase-steps {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .phase-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .phase-step.active {
    opacity: 1;
  }

  .phase-step.complete {
    opacity: 1;
  }

  .phase-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #e4e4e7;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    font-weight: 600;
    color: #71717a;
  }

  .phase-step.active .phase-icon {
    background: var(--color-primary);
    color: white;
    box-shadow: 0 2px 8px rgba(14, 165, 233, 0.2);
  }

  .phase-step.complete .phase-icon {
    background: #059669;
    color: white;
  }

  .phase-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .phase-step.active .phase-label {
    color: var(--color-primary);
    font-weight: 600;
  }

  .phase-connector {
    width: 40px;
    height: 2px;
    background: #e4e4e7;
    transition: background 0.2s;
  }

  .phase-connector.complete {
    background: #059669;
  }

  .agent-progress {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
    padding-top: 1rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .agent-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: white;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .agent-status.running {
    background: #e0f2fe;
  }

  .agent-status.completed {
    background: #d1fae5;
  }

  .agent-status.failed {
    background: #fee2e2;
  }

  .agent-icon {
    font-size: 1rem;
  }

  .agent-name {
    color: #000000;
  }

  .agent-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #9ca3af;
  }

  .agent-status.running .agent-status-dot {
    background: var(--color-primary);
    animation: pulse 1.5s infinite;
  }

  .agent-status.completed .agent-status-dot {
    background: #10b981;
  }

  .agent-status.failed .agent-status-dot {
    background: #dc2626;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
