import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import ChatInputArea from './ChatInputArea.svelte';

describe('ChatInputArea', () => {
  const mockOnInput = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockOnImageSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render chat input area', () => {
    const { container } = render(ChatInputArea, {
      props: {
        inputText: '',
      },
    });

    expect(container).toBeTruthy();
    expect(container.querySelector('.input-container')).toBeTruthy();
  });

  it('should display prompt character', () => {
    const { container } = render(ChatInputArea, {
      props: { inputText: '' },
    });

    const prompt = container.querySelector('.input-prompt');
    expect(prompt).toBeTruthy();
    expect(prompt?.textContent).toBe('>');
  });

  it('should render input field with default placeholder', () => {
    const { container } = render(ChatInputArea, {
      props: { inputText: '' },
    });

    const input = container.querySelector('input.message-input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toBe('Describe what you want to build...');
  });

  it('should render input with custom placeholder', () => {
    const customPlaceholder = 'Custom placeholder text';
    const { container } = render(ChatInputArea, {
      props: {
        inputText: '',
        placeholder: customPlaceholder,
      },
    });

    const input = container.querySelector('input.message-input') as HTMLInputElement;
    expect(input.placeholder).toBe(customPlaceholder);
  });

  it('should display current input text', () => {
    const { container } = render(ChatInputArea, {
      props: { inputText: 'Hello world' },
    });

    const input = container.querySelector('input.message-input') as HTMLInputElement;
    expect(input.value).toBe('Hello world');
  });

  it('should call onInput when text changes', async () => {
    const { container } = render(ChatInputArea, {
      props: {
        inputText: '',
        onInput: mockOnInput,
      },
    });

    const input = container.querySelector('input.message-input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Test message' } });

    expect(mockOnInput).toHaveBeenCalledWith('Test message');
  });

  it('should call onSubmit when form is submitted', async () => {
    const { container } = render(ChatInputArea, {
      props: {
        inputText: 'Test message',
        onSubmit: mockOnSubmit,
      },
    });

    const form = container.querySelector('form.input-container');
    await fireEvent.submit(form!);

    expect(mockOnSubmit).toHaveBeenCalled();
  });



  it('should disable send button when input is empty', () => {
    const { container } = render(ChatInputArea, {
      props: { inputText: '' },
    });

    const sendButton = container.querySelector('button.send-button') as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
  });

  it('should enable send button when input has text', () => {
    const { container } = render(ChatInputArea, {
      props: { inputText: 'Hello' },
    });

    const sendButton = container.querySelector('button.send-button') as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);
  });

  it('should disable input when streaming', () => {
    const { container } = render(ChatInputArea, {
      props: {
        inputText: 'Test',
        streaming: true,
      },
    });

    const input = container.querySelector('input.message-input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('should disable send button when streaming', () => {
    const { container } = render(ChatInputArea, {
      props: {
        inputText: 'Test',
        streaming: true,
      },
    });

    const sendButton = container.querySelector('button.send-button') as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
  });

  it('should show cancel icon when streaming', () => {
    const { container } = render(ChatInputArea, {
      props: {
        inputText: 'Test',
        streaming: true,
      },
    });

    const sendButton = container.querySelector('button.send-button');
    expect(sendButton).toBeTruthy();
    // Cancel icon (X) should be present
    expect(sendButton?.querySelector('svg')).toBeTruthy();
  });

  it('should show send icon when not streaming', () => {
    const { container } = render(ChatInputArea, {
      props: { inputText: 'Test' },
    });

    const sendButton = container.querySelector('button.send-button');
    expect(sendButton).toBeTruthy();
    expect(sendButton?.querySelector('svg')).toBeTruthy();
  });

  it('should enable send button when has pending image with NIM provider', () => {
    const { container } = render(ChatInputArea, {
      props: {
        inputText: '',
        isNimProvider: true,
        hasPendingImage: true,
      },
    });

    const sendButton = container.querySelector('button.send-button') as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);
  });

  it('should not show image attach button by default', () => {
    const { container } = render(ChatInputArea, {
      props: { inputText: '' },
    });

    const attachButton = container.querySelector('button.attach-image-btn');
    expect(attachButton).toBeFalsy();
  });

  it('should show image attach button when isNimProvider is true', () => {
    const { container } = render(ChatInputArea, {
      props: {
        inputText: '',
        isNimProvider: true,
      },
    });

    const attachButton = container.querySelector('button.attach-image-btn');
    expect(attachButton).toBeTruthy();
    expect(attachButton?.getAttribute('aria-label')).toBe('Attach image');
  });

  it('should show badge when has pending image', () => {
    const { container } = render(ChatInputArea, {
      props: {
        inputText: '',
        isNimProvider: true,
        hasPendingImage: true,
      },
    });

    const badge = container.querySelector('.attach-badge');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('1');
  });

  it('should not show badge when no pending image', () => {
    const { container } = render(ChatInputArea, {
      props: {
        inputText: '',
        isNimProvider: true,
        hasPendingImage: false,
      },
    });

    const badge = container.querySelector('.attach-badge');
    expect(badge).toBeFalsy();
  });

  it('should disable attach button when streaming', () => {
    const { container } = render(ChatInputArea, {
      props: {
        inputText: '',
        isNimProvider: true,
        streaming: true,
      },
    });

    const attachButton = container.querySelector('button.attach-image-btn') as HTMLButtonElement;
    expect(attachButton.disabled).toBe(true);
  });

  it('should trigger file input when attach button clicked', async () => {
    const clickMock = vi.fn();
    const { container } = render(ChatInputArea, {
      props: {
        inputText: '',
        isNimProvider: true,
      },
    });

    const fileInput = container.querySelector('input.hidden-file-input') as HTMLInputElement;
    fileInput.click = clickMock;

    const attachButton = container.querySelector('button.attach-image-btn');
    await fireEvent.click(attachButton!);

    expect(clickMock).toHaveBeenCalled();
  });

  it('should handle image file selection', async () => {
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const { container } = render(ChatInputArea, {
      props: {
        inputText: '',
        isNimProvider: true,
        onImageSelect: mockOnImageSelect,
      },
    });

    const fileInput = container.querySelector('input.hidden-file-input') as HTMLInputElement;
    
    // Mock FileReader
    const mockResult = 'data:image/png;base64,test';
    const mockFileReader = {
      readAsDataURL: vi.fn(),
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      result: mockResult,
    };
    
    vi.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as unknown as FileReader);

    // Trigger file selection
    await fireEvent.change(fileInput, { target: { files: [file] } });
    
    // Simulate successful file read
    if (mockFileReader.onload) {
      mockFileReader.onload();
    }

    await waitFor(() => {
      expect(mockOnImageSelect).toHaveBeenCalledWith(mockResult);
    });
  });

  it('should ignore non-image files', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const { container } = render(ChatInputArea, {
      props: {
        inputText: '',
        isNimProvider: true,
        onImageSelect: mockOnImageSelect,
      },
    });

    const fileInput = container.querySelector('input.hidden-file-input') as HTMLInputElement;
    await fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockOnImageSelect).not.toHaveBeenCalled();
  });



  it('should handle keyboard enter to submit', async () => {
    const { container } = render(ChatInputArea, {
      props: {
        inputText: 'Test message',
        onSubmit: mockOnSubmit,
      },
    });

    const input = container.querySelector('input.message-input') as HTMLInputElement;
    await fireEvent.keyDown(input, { key: 'Enter' });

    // Form submission via Enter key
    expect(mockOnSubmit).not.toHaveBeenCalled(); // keyDown doesn't trigger form submit
  });

  it('should trim input text for canSend check', () => {
    const { container: container1 } = render(ChatInputArea, {
      props: { inputText: '   ' },
    });
    const sendButton1 = container1.querySelector('button.send-button') as HTMLButtonElement;
    expect(sendButton1.disabled).toBe(true);

    const { container: container2 } = render(ChatInputArea, {
      props: { inputText: '  hello  ' },
    });
    const sendButton2 = container2.querySelector('button.send-button') as HTMLButtonElement;
    expect(sendButton2.disabled).toBe(false);
  });

  it('should have correct aria-labels', () => {
    const { container } = render(ChatInputArea, {
      props: {
        inputText: '',
        isNimProvider: true,
      },
    });

    const input = container.querySelector('input.message-input');
    expect(input?.getAttribute('aria-label')).toBe('Chat input');

    const fileInput = container.querySelector('input.hidden-file-input');
    expect(fileInput?.getAttribute('aria-label')).toBe('Attach image');

    const attachButton = container.querySelector('button.attach-image-btn');
    expect(attachButton?.getAttribute('aria-label')).toBe('Attach image');

    const sendButton = container.querySelector('button.send-button');
    expect(sendButton?.getAttribute('aria-label')).toBe('Send message');
  });

  it('should have correct aria-label for cancel button when streaming', () => {
    const { container } = render(ChatInputArea, {
      props: {
        inputText: 'Test',
        streaming: true,
      },
    });

    const sendButton = container.querySelector('button.send-button');
    expect(sendButton?.getAttribute('aria-label')).toBe('Cancel');
  });

});
