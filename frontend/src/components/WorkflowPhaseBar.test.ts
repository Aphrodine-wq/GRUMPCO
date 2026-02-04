import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import WorkflowPhaseBar from './WorkflowPhaseBar.svelte';

describe('WorkflowPhaseBar', () => {
  it('should not render when phase is idle', () => {
    const { container } = render(WorkflowPhaseBar, {
      props: { phase: 'idle' },
    });

    expect(container.querySelector('.workflow-phase-bar')).toBeFalsy();
  });

  it('should render phase steps when phase is not idle', () => {
    const { container } = render(WorkflowPhaseBar, {
      props: { phase: 'architecture' },
    });

    expect(container.querySelector('.workflow-phase-bar')).toBeTruthy();
    expect(container.querySelector('.phase-steps')).toBeTruthy();
  });

  it('should show architecture as active when in architecture phase', () => {
    const { container, getByText } = render(WorkflowPhaseBar, {
      props: { phase: 'architecture' },
    });

    expect(getByText('Architecture')).toBeTruthy();
    const activeStep = container.querySelector('.phase-step.active');
    expect(activeStep).toBeTruthy();
  });

  it('should mark completed phases with checkmark', () => {
    const { container } = render(WorkflowPhaseBar, {
      props: { phase: 'prd' },
    });

    // Architecture should be complete when in PRD phase
    const completeSteps = container.querySelectorAll('.phase-step.complete');
    expect(completeSteps.length).toBeGreaterThan(0);

    // Should have a checkmark SVG
    const checkmark = container.querySelector('.phase-step.complete svg');
    expect(checkmark).toBeTruthy();
  });

  it('should show progress percentage during codegen', () => {
    const { container } = render(WorkflowPhaseBar, {
      props: { phase: 'codegen', progress: 50 },
    });

    expect(container.textContent).toContain('50');
  });

  it('should render all three phase labels', () => {
    const { getByText } = render(WorkflowPhaseBar, {
      props: { phase: 'architecture' },
    });

    expect(getByText('Architecture')).toBeTruthy();
    expect(getByText('PRD')).toBeTruthy();
    expect(getByText('Code')).toBeTruthy();
  });

  it('should show phase connectors', () => {
    const { container } = render(WorkflowPhaseBar, {
      props: { phase: 'architecture' },
    });

    const connectors = container.querySelectorAll('.phase-connector');
    expect(connectors.length).toBe(2); // Two connectors between three phases
  });

  it('should mark connectors as complete when phase is past', () => {
    const { container } = render(WorkflowPhaseBar, {
      props: { phase: 'codegen' },
    });

    // Both connectors should be complete when in codegen phase
    const completeConnectors = container.querySelectorAll('.phase-connector.complete');
    expect(completeConnectors.length).toBe(2);
  });

  it('should show agent progress during codegen with agents', () => {
    const agents = {
      architect: { status: 'completed', description: 'Done' },
      frontend: { status: 'running', description: 'Building UI' },
      backend: { status: 'pending', description: 'Waiting' },
    };

    const { container } = render(WorkflowPhaseBar, {
      props: { phase: 'codegen', agents },
    });

    expect(container.querySelector('.agent-progress')).toBeTruthy();
    expect(container.querySelectorAll('.agent-status').length).toBe(3);
  });

  it('should not show agent progress when not in codegen phase', () => {
    const agents = {
      architect: { status: 'completed', description: 'Done' },
    };

    const { container } = render(WorkflowPhaseBar, {
      props: { phase: 'architecture', agents },
    });

    expect(container.querySelector('.agent-progress')).toBeFalsy();
  });

  it('should mark all phases complete when phase is complete', () => {
    const { container } = render(WorkflowPhaseBar, {
      props: { phase: 'complete' },
    });

    const completeSteps = container.querySelectorAll('.phase-step.complete');
    expect(completeSteps.length).toBe(3);
  });
});
