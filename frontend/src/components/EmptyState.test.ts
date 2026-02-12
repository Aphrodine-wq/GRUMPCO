import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import EmptyState from './EmptyState.svelte';

describe('EmptyState', () => {
  it('should render headline', () => {
    const { getByText } = render(EmptyState, {
      props: { headline: 'No items found' },
    });

    expect(getByText('No items found')).toBeTruthy();
  });

  it('should render description when provided', () => {
    const { getByText } = render(EmptyState, {
      props: { headline: 'No items', description: 'Try adding something new.' },
    });

    expect(getByText('Try adding something new.')).toBeTruthy();
  });

  it('should not render description when not provided', () => {
    const { container } = render(EmptyState, {
      props: { headline: 'No items' },
    });

    expect(container.querySelector('.empty-state-description')).toBeFalsy();
  });

  it('should apply compact variant class', () => {
    const { container } = render(EmptyState, {
      props: { headline: 'No data', variant: 'compact' },
    });

    expect(container.querySelector('.empty-state.compact')).toBeTruthy();
  });

  it('should use default variant without compact class', () => {
    const { container } = render(EmptyState, {
      props: { headline: 'No data' },
    });

    const emptyState = container.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState?.classList.contains('compact')).toBe(false);
  });

  it('should have role="status" for accessibility', () => {
    const { container } = render(EmptyState, {
      props: { headline: 'Nothing here' },
    });

    expect(container.querySelector('[role="status"]')).toBeTruthy();
  });

  it('should render illustration (FrownyFace)', () => {
    const { container } = render(EmptyState, {
      props: { headline: 'Empty' },
    });

    expect(container.querySelector('.empty-state-illustration')).toBeTruthy();
  });
});
