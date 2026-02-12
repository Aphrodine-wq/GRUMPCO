import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import ErrorBoundary from './ErrorBoundary.svelte';

// Mock the error handler utility
vi.mock('../utils/errorHandler', () => ({
  processError: vi.fn((err: Error) => ({
    id: 'test-error',
    code: 'UNKNOWN',
    userMessage: err?.message || 'Something went wrong',
    recovery: [],
    metadata: { stack: err?.stack || '' },
  })),
  logError: vi.fn(),
}));

// Mock toastStore
vi.mock('../stores/toastStore', () => ({
  showToast: vi.fn(),
}));

describe('ErrorBoundary', () => {
  it('should render without errors', () => {
    const { container } = render(ErrorBoundary);
    expect(container).toBeTruthy();
  });

  it('should not render error UI in normal state', () => {
    const { container } = render(ErrorBoundary);

    expect(container.querySelector('.error-boundary')).toBeFalsy();
  });

  it('should not render error card when no error has occurred', () => {
    const { container } = render(ErrorBoundary);

    expect(container.querySelector('.error-card-wrap')).toBeFalsy();
    expect(container.querySelector('.error-content')).toBeFalsy();
  });
});
