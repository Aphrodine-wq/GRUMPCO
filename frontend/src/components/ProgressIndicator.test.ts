import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ProgressIndicator from './ProgressIndicator.svelte';

describe('ProgressIndicator', () => {
  const sampleStages = [
    { id: 'design', label: 'Design', status: 'completed' as const, timeEstimate: 10 },
    { id: 'build', label: 'Build', status: 'active' as const, timeEstimate: 30 },
    { id: 'test', label: 'Test', status: 'pending' as const, timeEstimate: 15 },
  ];

  it('should render progress indicator', () => {
    const { container } = render(ProgressIndicator, {
      props: { stages: sampleStages },
    });

    expect(container.querySelector('.progress-indicator')).toBeTruthy();
  });

  it('should display stage count in header', () => {
    const { container } = render(ProgressIndicator, {
      props: { stages: sampleStages },
    });

    // Header shows "Progress: X / Y stages"
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('3');
  });

  it('should render all stages', () => {
    const { container } = render(ProgressIndicator, {
      props: { stages: sampleStages },
    });

    const stageItems = container.querySelectorAll('.stage-item');
    expect(stageItems.length).toBe(3);
  });

  it('should display stage labels', () => {
    const { getByText } = render(ProgressIndicator, {
      props: { stages: sampleStages },
    });

    expect(getByText('Design')).toBeTruthy();
    expect(getByText('Build')).toBeTruthy();
    expect(getByText('Test')).toBeTruthy();
  });

  it('should mark completed stages with checkmark', () => {
    const { container } = render(ProgressIndicator, {
      props: { stages: sampleStages },
    });

    const completedStage = container.querySelector('.stage-item.completed');
    expect(completedStage).toBeTruthy();
    expect(completedStage?.textContent).toContain('✓');
  });

  it('should mark active stage with spinner', () => {
    const { container } = render(ProgressIndicator, {
      props: { stages: sampleStages },
    });

    const activeStage = container.querySelector('.stage-item.active');
    expect(activeStage).toBeTruthy();
    expect(container.querySelector('.stage-spinner')).toBeTruthy();
  });

  it('should mark pending stages', () => {
    const { container } = render(ProgressIndicator, {
      props: { stages: sampleStages },
    });

    const pendingStages = container.querySelectorAll('.stage-item.pending');
    expect(pendingStages.length).toBe(1);
  });

  it('should show progress bar', () => {
    const { container } = render(ProgressIndicator, {
      props: { stages: sampleStages },
    });

    expect(container.querySelector('.progress-bar')).toBeTruthy();
    expect(container.querySelector('.progress-fill')).toBeTruthy();
  });

  it('should handle error stage status', () => {
    const errorStages = [
      { id: 'step1', label: 'Step 1', status: 'error' as const, timeEstimate: 10 },
    ];

    const { container } = render(ProgressIndicator, {
      props: { stages: errorStages },
    });

    const errorStage = container.querySelector('.stage-item.error');
    expect(errorStage).toBeTruthy();
    expect(errorStage?.textContent).toContain('✗');
  });

  it('should show active pulse animation', () => {
    const { container } = render(ProgressIndicator, {
      props: { stages: sampleStages },
    });

    expect(container.querySelector('.stage-pulse')).toBeTruthy();
  });
});
