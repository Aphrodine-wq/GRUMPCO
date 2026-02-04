import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ChatInterface from './ChatInterface.svelte';
import { get } from 'svelte/store';

// Mock stores - use importOriginal to preserve all exports
vi.mock('../stores/sessionsStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../stores/sessionsStore')>();
  return {
    ...actual,
    currentSession: {
      subscribe: vi.fn((fn) => {
        fn(null);
        return () => {};
      }),
    },
    addMessage: vi.fn(),
  };
});

vi.mock('../stores/settingsStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../stores/settingsStore')>();
  return {
    ...actual,
  };
});

vi.mock('../stores/authStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../stores/authStore')>();
  return {
    ...actual,
    isAuthenticated: {
      subscribe: vi.fn((fn) => {
        fn(false);
        return () => {};
      }),
    },
  };
});

describe('ChatInterface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render chat interface', () => {
    const { container } = render(ChatInterface);
    expect(container).toBeTruthy();
  });

  it('should display empty state when no messages', () => {
    const { getByText } = render(ChatInterface);
    expect(getByText(/what are we building/i)).toBeTruthy();
  });

  it('should render message input', () => {
    const { container } = render(ChatInterface);
    // The component uses an input element, not textarea
    const input = container.querySelector('input.message-input');
    expect(input).toBeTruthy();
  });

  it('should handle message input', async () => {
    const { container } = render(ChatInterface);
    const input = container.querySelector('input.message-input') as HTMLInputElement;

    if (input) {
      await fireEvent.input(input, { target: { value: 'Test message' } });
      expect(input.value).toBe('Test message');
    }
  });

  it('should disable send button when input is empty', () => {
    const { container } = render(ChatInterface);
    // The send button has class "send-button" and type="submit"
    const sendButton = container.querySelector('button.send-button');
    expect(sendButton?.hasAttribute('disabled')).toBe(true);
  });

  it('should enable send button when input has text', async () => {
    const { container } = render(ChatInterface);
    const input = container.querySelector('input.message-input') as HTMLInputElement;
    const sendButton = container.querySelector('button.send-button');

    if (input && sendButton) {
      await fireEvent.input(input, { target: { value: 'Test' } });
      expect(sendButton.hasAttribute('disabled')).toBe(false);
    }
  });
});
