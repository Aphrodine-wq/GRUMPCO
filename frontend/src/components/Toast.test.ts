import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import Toast from './Toast.svelte';
import { toasts, showToast, dismissToast, resetToastState } from '../stores/toastStore';
import { get } from 'svelte/store';

// Mock the toastStore to control toast rendering
vi.mock('../stores/toastStore', async () => {
  const { writable } = await import('svelte/store');
  const store = writable<
    {
      id: string;
      message: string;
      type: string;
      duration: number;
      persistent?: boolean;
      actions?: { label: string; action: () => void; primary?: boolean }[];
      onDismiss?: () => void;
    }[]
  >([]);
  return {
    toasts: store,
    dismissToast: vi.fn((id: string) => {
      store.update((t) => t.filter((toast) => toast.id !== id));
    }),
    showToast: vi.fn(),
    resetToastState: vi.fn(),
  };
});

describe('Toast', () => {
  beforeEach(() => {
    toasts.set([]);
    vi.clearAllMocks();
  });

  it('should render without errors when no toasts exist', () => {
    const { container } = render(Toast);
    expect(container.querySelector('.toast-container')).toBeTruthy();
  });

  it('should render a toast with correct type class', () => {
    toasts.set([{ id: 'test-1', message: 'Success message', type: 'success', duration: 3000 }]);

    const { container } = render(Toast);
    const toast = container.querySelector('.toast--success');
    expect(toast).toBeTruthy();
  });

  it('should render error toast with correct class', () => {
    toasts.set([{ id: 'test-2', message: 'Error occurred', type: 'error', duration: 3000 }]);

    const { container } = render(Toast);
    expect(container.querySelector('.toast--error')).toBeTruthy();
  });

  it('should render info toast with correct class', () => {
    toasts.set([{ id: 'test-3', message: 'Info message', type: 'info', duration: 3000 }]);

    const { container } = render(Toast);
    expect(container.querySelector('.toast--info')).toBeTruthy();
  });

  it('should display the toast message', () => {
    toasts.set([{ id: 'test-4', message: 'Hello World', type: 'info', duration: 3000 }]);

    const { getByText } = render(Toast);
    expect(getByText('Hello World')).toBeTruthy();
  });

  it('should render dismiss button with correct aria-label', () => {
    toasts.set([{ id: 'test-5', message: 'Dismissable', type: 'info', duration: 3000 }]);

    const { container } = render(Toast);
    const dismissButton = container.querySelector('button[aria-label="Dismiss notification"]');
    expect(dismissButton).toBeTruthy();
  });

  it('should render action buttons when actions are provided', () => {
    toasts.set([
      {
        id: 'test-6',
        message: 'With actions',
        type: 'info',
        duration: 3000,
        actions: [
          { label: 'Undo', action: vi.fn(), primary: true },
          { label: 'Dismiss', action: vi.fn() },
        ],
      },
    ]);

    const { getByText } = render(Toast);
    expect(getByText('Undo')).toBeTruthy();
    expect(getByText('Dismiss')).toBeTruthy();
  });

  it('should show progress bar when duration > 0', () => {
    toasts.set([{ id: 'test-7', message: 'With progress', type: 'info', duration: 3000 }]);

    const { container } = render(Toast);
    const progress = container.querySelector('.toast-progress');
    expect(progress).toBeTruthy();
  });

  it('should not show progress bar when duration is 0', () => {
    toasts.set([
      { id: 'test-8', message: 'Persistent', type: 'info', duration: 0, persistent: true },
    ]);

    const { container } = render(Toast);
    const progress = container.querySelector('.toast-progress');
    expect(progress).toBeFalsy();
  });

  it('should render the toast container with correct aria attributes', () => {
    const { container } = render(Toast);
    const toastContainer = container.querySelector('[aria-live="polite"]');
    expect(toastContainer).toBeTruthy();
    expect(toastContainer?.getAttribute('aria-atomic')).toBe('true');
  });

  it('should render multiple toasts', () => {
    toasts.set([
      { id: 'toast-a', message: 'First', type: 'success', duration: 3000 },
      { id: 'toast-b', message: 'Second', type: 'error', duration: 3000 },
    ]);

    const { container } = render(Toast);
    const toastElements = container.querySelectorAll('.toast');
    expect(toastElements.length).toBe(2);
  });
});
