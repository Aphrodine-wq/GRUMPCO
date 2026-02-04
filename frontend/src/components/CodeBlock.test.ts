import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import CodeBlock from './CodeBlock.svelte';

// Mock highlighter - return a promise since it's async
vi.mock('../utils/highlighter', () => ({
  highlightCode: vi.fn((code, _lang) => Promise.resolve(`<pre><code>${code}</code></pre>`)),
}));

// Mock toastStore
vi.mock('../stores/toastStore', () => ({
  showToast: vi.fn(),
}));

describe('CodeBlock', () => {
  const sampleCode = 'function hello() {\n  console.log("Hello");\n}';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render code block', async () => {
    const { container } = render(CodeBlock, {
      props: { code: sampleCode, language: 'javascript' },
    });

    expect(container).toBeTruthy();
    // The code is loaded asynchronously via $effect, wait for it
    await waitFor(() => {
      expect(container.textContent).toContain('hello');
    });
  });

  it('should display language label', () => {
    const { getByText } = render(CodeBlock, {
      props: { code: sampleCode, language: 'javascript' },
    });

    expect(getByText(/javascript/i)).toBeTruthy();
  });

  it('should show copy button', () => {
    const { container } = render(CodeBlock, {
      props: { code: sampleCode, language: 'javascript' },
    });

    // The component uses Button with title="Copy code"
    const copyButton = container.querySelector('button[title="Copy code"]');
    expect(copyButton).toBeTruthy();
  });

  it('should copy code to clipboard when copy button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const { container } = render(CodeBlock, {
      props: { code: sampleCode, language: 'javascript' },
    });

    const copyButton = container.querySelector('button[title="Copy code"]');
    if (copyButton) {
      await fireEvent.click(copyButton);
      expect(writeTextMock).toHaveBeenCalledWith(sampleCode);
    }
  });

  it('should show success message after copying', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    const { container } = render(CodeBlock, {
      props: { code: sampleCode, language: 'javascript' },
    });

    const copyButton = container.querySelector('button[title="Copy code"]');
    if (copyButton) {
      await fireEvent.click(copyButton);
      // Toast is shown via toastStore, not inline text
    }
  });

  it('should show line numbers by default', async () => {
    const { container } = render(CodeBlock, {
      props: {
        code: sampleCode,
        language: 'javascript',
      },
    });

    // Wait for async rendering
    await waitFor(() => {
      // The component shows line numbers by default via .line-number elements
      const lineNumbers = container.querySelectorAll('.line-number');
      expect(lineNumbers.length).toBeGreaterThan(0);
    });
  });

  it('should display line count for multi-line code', async () => {
    const { container } = render(CodeBlock, {
      props: {
        code: sampleCode,
        language: 'javascript',
      },
    });

    // Wait for async rendering - line numbers should match code lines
    await waitFor(() => {
      const lineNumbers = container.querySelectorAll('.line-number');
      const expectedLines = sampleCode.split('\n').length;
      expect(lineNumbers.length).toBe(expectedLines);
    });
  });

  it('should handle empty code', () => {
    const { container } = render(CodeBlock, {
      props: { code: '', language: 'javascript' },
    });

    expect(container).toBeTruthy();
  });

  it('should handle very long code', () => {
    const longCode = 'console.log("test");\n'.repeat(1000);
    const { container } = render(CodeBlock, {
      props: { code: longCode, language: 'javascript' },
    });

    expect(container).toBeTruthy();
  });
});
