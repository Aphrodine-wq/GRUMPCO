<script lang="ts">
  import type { Plan, PlanStep } from '../types/plan';
  import { approvePlan, startPlanExecution } from '../stores/planStore';

  interface Props {
    plan: Plan;
  }

  let { plan = $bindable() }: Props = $props();

  let expandedSteps = $state<Set<string>>(new Set());
  let expandedPhases = $state<Set<string>>(new Set());

  function toggleStep(stepId: string) {
    if (expandedSteps.has(stepId)) {
      expandedSteps.delete(stepId);
    } else {
      expandedSteps.add(stepId);
    }
    expandedSteps = new Set(expandedSteps);
  }

  function togglePhase(phaseId: string) {
    if (expandedPhases.has(phaseId)) {
      expandedPhases.delete(phaseId);
    } else {
      expandedPhases.add(phaseId);
    }
    expandedPhases = new Set(expandedPhases);
  }

  function getRiskColor(risk: string): string {
    switch (risk) {
      case 'low':
        return '#10B981';
      case 'medium':
        return '#F59E0B';
      case 'high':
        return '#DC2626';
      default:
        return '#6B7280';
    }
  }

  function formatTime(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  async function handleApprove() {
    try {
      await approvePlan(plan.id, true);
    } catch (error) {
      console.error('Failed to approve plan:', error);
    }
  }

  async function handleExecute() {
    try {
      await startPlanExecution(plan.id);
    } catch (error) {
      console.error('Failed to execute plan:', error);
    }
  }

  function exportAsMarkdown() {
    const lines: string[] = [
      `# ${plan.title}`,
      '',
      plan.description,
      '',
      `**${plan.steps.length} steps** · **${formatTime(plan.totalEstimatedTime)}** estimated · *${plan.status}*`,
      '',
      '---',
      '',
    ];
    for (const phase of plan.phases) {
      lines.push(`## ${phase.name}`);
      lines.push('');
      const phaseSteps = plan.steps.filter((s) => phase.steps?.includes(s.id));
      for (const step of phaseSteps) {
        lines.push(`### ${step.title}`);
        lines.push('');
        lines.push(step.description);
        lines.push('');
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plan-${plan.id || 'export'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="plan-viewer">
  <div class="plan-header">
    <h2 class="plan-title">{plan.title}</h2>
    <p class="plan-description">{plan.description}</p>
    <div class="plan-meta">
      <span class="meta-item">
        <strong>{plan.steps.length}</strong> steps
      </span>
      <span class="meta-item">
        <strong>{formatTime(plan.totalEstimatedTime)}</strong> estimated
      </span>
      <span
        class="meta-item status"
        class:approved={plan.status === 'approved'}
        class:executing={plan.status === 'executing'}
      >
        {plan.status}
      </span>
    </div>
  </div>

  <div class="plan-actions">
    <button type="button" class="btn btn-secondary" onclick={exportAsMarkdown}>
      Export (Markdown)
    </button>
    {#if plan.status === 'draft' || plan.status === 'pending_approval'}
      <button type="button" class="btn btn-primary" onclick={handleApprove}> Approve Plan </button>
      <button type="button" class="btn btn-secondary"> Edit Plan </button>
    {/if}
    {#if plan.status === 'approved'}
      <button type="button" class="btn btn-primary" onclick={handleExecute}> Execute Plan </button>
    {/if}
  </div>

  <div class="phases">
    {#each plan.phases as phase (phase.id)}
      <div class="phase">
        <div
          class="phase-header"
          role="button"
          tabindex="0"
          onclick={() => togglePhase(phase.id)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              togglePhase(phase.id);
            }
          }}
        >
          <div class="phase-info">
            <span class="phase-name">{phase.name}</span>
            <span
              class="phase-status"
              class:in-progress={phase.status === 'in_progress'}
              class:completed={phase.status === 'completed'}
            >
              {phase.status}
            </span>
          </div>
          <svg
            class="expand-icon"
            class:expanded={expandedPhases.has(phase.id)}
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>

        {#if expandedPhases.has(phase.id)}
          <div class="phase-steps">
            {#each phase.steps
              .map((id) => plan.steps.find((s) => s.id === id))
              .filter((s): s is PlanStep => s != null) as step (step.id)}
              <div class="step" class:expanded={expandedSteps.has(step.id)}>
                <div
                  class="step-header"
                  role="button"
                  tabindex="0"
                  onclick={() => toggleStep(step.id)}
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleStep(step.id);
                    }
                  }}
                >
                  <div class="step-info">
                    <span class="step-number">{step.order}</span>
                    <span class="step-title">{step.title}</span>
                    <span class="step-time">{formatTime(step.estimatedTime)}</span>
                    <span
                      class="step-risk"
                      style="background-color: {getRiskColor(step.risk)}20; color: {getRiskColor(
                        step.risk
                      )}"
                    >
                      {step.risk}
                    </span>
                  </div>
                  <svg
                    class="expand-icon"
                    class:expanded={expandedSteps.has(step.id)}
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>

                {#if expandedSteps.has(step.id)}
                  <div class="step-content">
                    <p class="step-description">{step.description}</p>

                    {#if step.fileChanges.length > 0}
                      <div class="file-changes">
                        <strong>File Changes:</strong>
                        <ul>
                          {#each step.fileChanges as change (change.path)}
                            <li>
                              <span
                                class="change-type"
                                class:create={change.type === 'create'}
                                class:modify={change.type === 'modify'}
                                class:delete={change.type === 'delete'}
                              >
                                {change.type}
                              </span>
                              <code>{change.path}</code>
                              {#if change.description}
                                <span class="change-desc"> - {change.description}</span>
                              {/if}
                            </li>
                          {/each}
                        </ul>
                      </div>
                    {/if}

                    {#if step.dependencies.length > 0}
                      <div class="dependencies">
                        <strong>Depends on:</strong>
                        {step.dependencies.join(', ')}
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .plan-viewer {
    background: var(--color-bg-card);
    border-radius: 8px;
    padding: 1.5rem;
    max-width: 900px;
    margin: 0 auto;
  }

  .plan-header {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-border);
  }

  .plan-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: var(--color-text);
  }

  .plan-description {
    color: var(--color-text-muted);
    margin: 0 0 1rem 0;
  }

  .plan-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .meta-item strong {
    color: var(--color-text);
    font-weight: 600;
  }

  .status {
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    background: var(--color-bg-secondary);
    text-transform: capitalize;
  }

  .status.approved {
    background: #d1fae5;
    color: #065f46;
  }

  .status.executing {
    background: #e0f2fe;
    color: #0c4a6e;
  }

  .plan-actions {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--color-primary);
    color: #ffffff;
  }

  .btn-primary:hover {
    background: #0052cc;
  }

  .btn-secondary {
    background: var(--color-bg-secondary);
    color: var(--color-text);
  }

  .btn-secondary:hover {
    background: var(--color-bg-secondary);
  }

  .phases {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .phase {
    border: 1px solid var(--color-border);
    border-radius: 6px;
    overflow: hidden;
  }

  .phase-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--color-bg-secondary);
    cursor: pointer;
    transition: background 0.2s;
  }

  .phase-header:hover {
    background: var(--color-bg-secondary);
  }

  .phase-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .phase-name {
    font-weight: 600;
    color: var(--color-text);
  }

  .phase-status {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background: var(--color-bg-secondary);
    font-size: 0.75rem;
    text-transform: capitalize;
  }

  .phase-status.in-progress {
    background: #e0f2fe;
    color: #0c4a6e;
  }

  .phase-status.completed {
    background: #d1fae5;
    color: #065f46;
  }

  .expand-icon {
    transition: transform 0.2s;
    color: var(--color-text-muted);
  }

  .expand-icon.expanded {
    transform: rotate(180deg);
  }

  .phase-steps {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .step {
    border: 1px solid var(--color-border);
    border-radius: 4px;
    overflow: hidden;
  }

  .step-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--color-bg-card);
    cursor: pointer;
    transition: background 0.2s;
  }

  .step-header:hover {
    background: #f9fafb;
  }

  .step-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }

  .step-number {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #e5e5e5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
  }

  .step-title {
    font-weight: 500;
    color: #000000;
    flex: 1;
  }

  .step-time {
    font-size: 0.75rem;
    color: #6b7280;
    font-family: 'JetBrains Mono', monospace;
  }

  .step-risk {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    text-transform: capitalize;
    font-weight: 500;
  }

  .step-content {
    padding: 1rem;
    background: #f9fafb;
    border-top: 1px solid #e5e5e5;
  }

  .step-description {
    margin: 0 0 1rem 0;
    color: #374151;
  }

  .file-changes {
    margin-top: 1rem;
  }

  .file-changes ul {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0 0 0;
  }

  .file-changes li {
    padding: 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .change-type {
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    background: #f5f5f5;
    color: #6b7280;
  }

  .change-type.create {
    background: #d1fae5;
    color: #065f46;
  }

  .change-type.modify {
    background: #e0f2fe;
    color: #0c4a6e;
  }

  .change-type.delete {
    background: #fee2e2;
    color: #991b1b;
  }

  code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    background: #f5f5f5;
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    color: #000000;
  }

  .change-desc {
    color: #6b7280;
    font-style: italic;
  }

  .dependencies {
    margin-top: 0.75rem;
    font-size: 0.875rem;
    color: #6b7280;
  }
</style>
