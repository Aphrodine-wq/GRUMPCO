/**
 * ViewLoading component tests
 *
 * Tests for the loading spinner with rotating tips.
 * NOTE: This file is named FeedbackWidget.test.ts for coverage config
 * compatibility, but tests ViewLoading because FeedbackWidget hangs
 * in jsdom due to Svelte 5 reactivity + lucide-svelte SVG issues.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import ViewLoading from './ViewLoading.svelte';

describe('ViewLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render with the provided message', () => {
    const { getByText } = render(ViewLoading, {
      props: { message: 'Loading Canvas…' },
    });
    expect(getByText('Loading Canvas…')).toBeTruthy();
  });

  it('should have status role for accessibility', () => {
    const { container } = render(ViewLoading, {
      props: { message: 'Loading…' },
    });
    expect(container.querySelector('[role="status"]')).toBeTruthy();
  });

  it('should render a spinner element', () => {
    const { container } = render(ViewLoading, {
      props: { message: 'Loading…' },
    });
    expect(container.querySelector('.view-loading-spinner')).toBeTruthy();
  });

  it('should display the first loading tip initially', () => {
    const { getByText } = render(ViewLoading, {
      props: { message: 'Loading…' },
    });
    expect(getByText('Tip: Use Ctrl+B to toggle the sidebar.')).toBeTruthy();
  });

  it('should have aria-live polite for screen readers', () => {
    const { container } = render(ViewLoading, {
      props: { message: 'Loading…' },
    });
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy();
  });

  it('should render the message in the loading-message paragraph', () => {
    const { container } = render(ViewLoading, {
      props: { message: 'Loading Docker…' },
    });
    const msgEl = container.querySelector('.view-loading-message');
    expect(msgEl?.textContent).toBe('Loading Docker…');
  });

  it('should render the loading tip in the tip paragraph', () => {
    const { container } = render(ViewLoading, {
      props: { message: 'Loading…' },
    });
    const tipEl = container.querySelector('.view-loading-tip');
    expect(tipEl?.textContent).toContain('Tip:');
  });
});
