<script lang="ts">
  /**
   * CodeAgentTimeline Component
   *
   * Shows a vertical timeline of the AI's code generation workflow:
   * Plan → Tool Call → Result → Summary
   * Inspired by Claude Code's agentic output.
   */

  interface TimelineStep {
    type: 'plan' | 'tool_call' | 'tool_result' | 'summary' | 'error' | 'retry';
    label: string;
    detail?: string;
    status: 'pending' | 'running' | 'success' | 'error';
    toolName?: string;
    filePath?: string;
    linesAdded?: number;
    linesRemoved?: number;
    executionTime?: number;
  }

  interface Props {
    steps: TimelineStep[];
    currentTurn?: number;
    maxTurns?: number;
    isActive?: boolean;
  }

  let { steps = [], currentTurn = 0, maxTurns = 15, isActive = false }: Props = $props();

  function getStatusIcon(status: TimelineStep['status']): string {
    switch (status) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'running':
        return '⟳';
      case 'pending':
        return '○';
      default:
        return '·';
    }
  }

  function getTypeIcon(type: TimelineStep['type']): string {
    switch (type) {
      case 'plan':
        return '≡';
      case 'tool_call':
        return '#';
      case 'tool_result':
        return '◎';
      case 'summary':
        return '▪';
      case 'error':
        return '!';
      case 'retry':
        return '↻';
      default:
        return '·';
    }
  }

  function getShortPath(fullPath: string): string {
    const segments = fullPath.replace(/\\/g, '/').split('/');
    if (segments.length <= 3) return segments.join('/');
    return '…/' + segments.slice(-3).join('/');
  }
</script>

{#if steps.length > 0}
  <div class="timeline-container" class:active={isActive}>
    {#if currentTurn > 0}
      <div class="timeline-header">
        <span class="turn-indicator">Turn {currentTurn}/{maxTurns}</span>
        {#if isActive}
          <span class="active-dot"></span>
        {/if}
      </div>
    {/if}

    <div class="timeline-steps">
      {#each steps as step, i}
        <div
          class="timeline-step"
          class:success={step.status === 'success'}
          class:error={step.status === 'error'}
          class:running={step.status === 'running'}
        >
          <!-- Connector line -->
          {#if i > 0}
            <div
              class="timeline-connector"
              class:success={step.status === 'success'}
              class:error={step.status === 'error'}
            ></div>
          {/if}

          <!-- Step dot -->
          <div
            class="step-dot"
            class:success={step.status === 'success'}
            class:error={step.status === 'error'}
            class:running={step.status === 'running'}
          >
            <span class="dot-icon">{getStatusIcon(step.status)}</span>
          </div>

          <!-- Step content -->
          <div class="step-content">
            <div class="step-label">
              <span class="step-type-icon">{getTypeIcon(step.type)}</span>
              <span class="step-text">{step.label}</span>
              {#if step.executionTime}
                <span class="step-time"
                  >{step.executionTime < 1000
                    ? `${step.executionTime}ms`
                    : `${(step.executionTime / 1000).toFixed(1)}s`}</span
                >
              {/if}
            </div>

            {#if step.filePath}
              <div class="step-file">
                <code>{getShortPath(step.filePath)}</code>
                {#if step.linesAdded || step.linesRemoved}
                  <span class="step-diff">
                    {#if step.linesAdded}<span class="diff-add">+{step.linesAdded}</span>{/if}
                    {#if step.linesRemoved}<span class="diff-rm">-{step.linesRemoved}</span>{/if}
                  </span>
                {/if}
              </div>
            {/if}

            {#if step.detail}
              <div class="step-detail">{step.detail}</div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .timeline-container {
    padding: 0.5rem 0;
    margin: 0.5rem 0;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 0.75rem;
  }

  .timeline-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    padding-left: 1.75rem;
  }

  .turn-indicator {
    font-size: 0.65rem;
    font-weight: 600;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .active-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 6px #22c55e;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  .timeline-steps {
    display: flex;
    flex-direction: column;
    gap: 0;
    position: relative;
  }

  .timeline-step {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    position: relative;
    padding: 0.25rem 0;
    padding-left: 0.25rem;
  }

  .timeline-connector {
    position: absolute;
    left: calc(0.25rem + 8px);
    top: -0.25rem;
    width: 2px;
    height: 0.5rem;
    background: #30363d;
  }

  .timeline-connector.success {
    background: rgba(34, 197, 94, 0.3);
  }

  .timeline-connector.error {
    background: rgba(248, 113, 113, 0.3);
  }

  .step-dot {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #21262d;
    border: 2px solid #30363d;
    z-index: 1;
  }

  .step-dot.success {
    border-color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
  }

  .step-dot.error {
    border-color: #f87171;
    background: rgba(248, 113, 113, 0.1);
  }

  .step-dot.running {
    border-color: #60a5fa;
    background: rgba(96, 165, 250, 0.1);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .dot-icon {
    font-size: 0.55rem;
    line-height: 1;
  }

  .step-dot.success .dot-icon {
    color: #22c55e;
  }
  .step-dot.error .dot-icon {
    color: #f87171;
  }
  .step-dot.running .dot-icon {
    color: #60a5fa;
  }

  .step-content {
    flex: 1;
    min-width: 0;
    padding-top: 1px;
  }

  .step-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: #e6edf3;
  }

  .step-type-icon {
    font-size: 0.7rem;
  }

  .step-text {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .step-time {
    font-size: 0.6rem;
    color: #484f58;
    margin-left: auto;
    flex-shrink: 0;
  }

  .step-file {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.125rem;
  }

  .step-file code {
    font-size: 0.65rem;
    color: #58a6ff;
    background: none;
    padding: 0;
  }

  .step-diff {
    display: flex;
    gap: 0.25rem;
    font-size: 0.6rem;
    font-weight: 600;
  }

  .diff-add {
    color: #22c55e;
  }
  .diff-rm {
    color: #f87171;
  }

  .step-detail {
    font-size: 0.65rem;
    color: #8b949e;
    margin-top: 0.125rem;
    line-height: 1.4;
  }

  .timeline-step.error .step-text {
    color: #fca5a5;
  }

  .timeline-step.running .step-text {
    color: #93c5fd;
  }
</style>
