import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import ConnectionStatusBanner from './ConnectionStatusBanner.svelte';

// Mock the connectionStatusStore
vi.mock('../stores/connectionStatusStore', async () => {
  const { writable } = await import('svelte/store');
  const status = writable('connected');
  return {
    connectionStatus: status,
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    checkConnection: vi.fn().mockResolvedValue(undefined),
  };
});

describe('ConnectionStatusBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without errors', () => {
    const { container } = render(ConnectionStatusBanner);
    expect(container).toBeTruthy();
  });

  it('should show connected status dot when connected', () => {
    const { container } = render(ConnectionStatusBanner);

    const banner = container.querySelector('.connection-banner.connected');
    expect(banner).toBeTruthy();
    expect(banner?.querySelector('.status-dot')).toBeTruthy();
  });

  it('should have role="status" when connected', () => {
    const { container } = render(ConnectionStatusBanner);

    const statusElement = container.querySelector('[role="status"]');
    expect(statusElement).toBeTruthy();
  });

  it('should have polite aria-live attribute', () => {
    const { container } = render(ConnectionStatusBanner);

    const banner = container.querySelector('[aria-live="polite"]');
    expect(banner).toBeTruthy();
  });
});
