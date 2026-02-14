import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import LazyView from './LazyView.svelte';
import type { ViewDefinition } from '../lib/viewRegistry';

// Mock uiStore
vi.mock('../stores/uiStore', async () => {
  const { writable } = await import('svelte/store');
  return {
    currentView: writable('chat'),
    setCurrentView: vi.fn(),
    sidebarCollapsed: writable(false),
    showPricing: writable(false),
    commandPaletteOpen: writable(false),
    settingsInitialTab: writable('general'),
    focusChatTrigger: writable(0),
  };
});

// Mock ViewLoading
vi.mock('./ViewLoading.svelte', () => ({
  default: Object.assign(
    function MockViewLoading() {
      // Svelte 5 component constructor
    },
    { displayName: 'ViewLoading' }
  ),
}));

describe('LazyView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render error state when loader rejects', async () => {
    const definition: ViewDefinition = {
      loader: () => Promise.reject(new Error('Module not found')),
      loadingLabel: 'Loading Test…',
      backTo: 'chat',
    };

    const { container } = render(LazyView, { props: { definition } });

    await waitFor(() => {
      const errorEl = container.querySelector('.load-error');
      expect(errorEl).toBeTruthy();
    });

    expect(container.querySelector('.error-detail')?.textContent).toContain('Module not found');
  });

  it('should render error state with unknown error for non-Error rejections', async () => {
    const definition: ViewDefinition = {
      loader: () => Promise.reject('string error'),
      loadingLabel: 'Loading Test…',
      backTo: 'chat',
    };

    const { container } = render(LazyView, { props: { definition } });

    await waitFor(() => {
      const errorEl = container.querySelector('.load-error');
      expect(errorEl).toBeTruthy();
    });
  });

  it('should render retry and go back buttons on error', async () => {
    const definition: ViewDefinition = {
      loader: () => Promise.reject(new Error('fail')),
      loadingLabel: 'Loading…',
      backTo: 'chat',
    };

    const { container } = render(LazyView, { props: { definition } });

    await waitFor(() => {
      expect(container.querySelector('.retry-btn')).toBeTruthy();
      expect(container.querySelector('.back-btn')).toBeTruthy();
    });
  });

  it('should show "Failed to load view" heading on error', async () => {
    const definition: ViewDefinition = {
      loader: () => Promise.reject(new Error('oops')),
      loadingLabel: 'Loading…',
      backTo: 'chat',
    };

    const { container } = render(LazyView, { props: { definition } });

    await waitFor(() => {
      const heading = container.querySelector('.load-error h3');
      expect(heading?.textContent).toBe('Failed to load view');
    });
  });
});
