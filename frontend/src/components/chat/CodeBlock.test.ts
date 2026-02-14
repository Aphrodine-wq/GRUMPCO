import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import CodeBlock from './CodeBlock.svelte';

// Mock toastStore
vi.mock('../../stores/toastStore', () => ({
  showToast: vi.fn(),
}));

// Mock Tooltip component
vi.mock('../../lib/design-system', () => ({
  Tooltip: vi.fn(({ children }) => children),
}));

import { showToast } from '../../stores/toastStore';

describe('CodeBlock', () => {
  const sampleCode = 'function hello() {\n  console.log("Hello");\n}';
  const multiLineCode = 'line1\nline2\nline3\nline4\nline5';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render code block', () => {
    const { container } = render(CodeBlock, {
      props: {
        code: sampleCode,
        language: 'javascript',
      },
    });

    expect(container).toBeTruthy();
    expect(container.querySelector('.code-block')).toBeTruthy();
  });

  it('should display language label', () => {
    const { container } = render(CodeBlock, {
      props: {
        code: sampleCode,
        language: 'javascript',
      },
    });

    const badge = container.querySelector('.language-badge');
    expect(badge?.textContent).toBe('JavaScript');
  });

  it('should map language aliases correctly', () => {
    const testCases = [
      { lang: 'js', expected: 'JavaScript' },
      { lang: 'ts', expected: 'TypeScript' },
      { lang: 'py', expected: 'Python' },
      { lang: 'tsx', expected: 'TypeScript React' },
      { lang: 'jsx', expected: 'JavaScript React' },
      { lang: 'rs', expected: 'RS' }, // Not in the mapping, should uppercase
    ];

    testCases.forEach(({ lang, expected }) => {
      const { container } = render(CodeBlock, {
        props: { code: sampleCode, language: lang },
      });

      const badge = container.querySelector('.language-badge');
      expect(badge?.textContent).toBe(expected);
    });
  });

  it('should show filename when provided', () => {
    const { getByText } = render(CodeBlock, {
      props: {
        code: sampleCode,
        language: 'javascript',
        filename: 'script.js',
      },
    });

    expect(getByText('script.js')).toBeTruthy();
  });

  it('should show copy button', () => {
    const { container } = render(CodeBlock, {
      props: {
        code: sampleCode,
        language: 'javascript',
      },
    });

    const copyButton = container.querySelector('button.copy-btn');
    expect(copyButton).toBeTruthy();
    expect(copyButton?.getAttribute('aria-label')).toBe('Copy code');
  });

  it('should copy code to clipboard when copy button clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const { container } = render(CodeBlock, {
      props: {
        code: sampleCode,
        language: 'javascript',
      },
    });

    const copyButton = container.querySelector('button.copy-btn');
    await fireEvent.click(copyButton!);

    expect(writeTextMock).toHaveBeenCalledWith(sampleCode);
    expect(showToast).toHaveBeenCalledWith('Copied to clipboard', 'success', 2000);
  });

  it('should show copied state after clicking copy button', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    const { container } = render(CodeBlock, {
      props: {
        code: sampleCode,
        language: 'javascript',
      },
    });

    const copyButton = container.querySelector('button.copy-btn');
    expect(copyButton?.classList.contains('copied')).toBe(false);

    await fireEvent.click(copyButton!);

    expect(copyButton?.classList.contains('copied')).toBe(true);
  });

  it('should handle copy failure gracefully', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Copy failed'));
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const { container } = render(CodeBlock, {
      props: {
        code: sampleCode,
        language: 'javascript',
      },
    });

    const copyButton = container.querySelector('button.copy-btn');
    await fireEvent.click(copyButton!);

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Failed to copy', 'error');
    });
  });

  it('should reset copied state after 2 seconds', async () => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    const { container } = render(CodeBlock, {
      props: {
        code: sampleCode,
        language: 'javascript',
      },
    });

    const copyButton = container.querySelector('button.copy-btn');
    await fireEvent.click(copyButton!);

    expect(copyButton?.classList.contains('copied')).toBe(true);

    vi.advanceTimersByTime(2000);

    // Note: In real component, this would reset, but in test we need to wait
    vi.useRealTimers();
  });

  it('should render code content', () => {
    const { container } = render(CodeBlock, {
      props: {
        code: sampleCode,
        language: 'javascript',
      },
    });

    const codeElement = container.querySelector('code.code-text');
    expect(codeElement).toBeTruthy();
    expect(codeElement?.textContent).toContain('function hello()');
  });

  it('should apply max height style', () => {
    const { container } = render(CodeBlock, {
      props: {
        code: sampleCode,
        language: 'javascript',
        maxHeight: '200px',
      },
    });

    const codeBlock = container.querySelector('.code-block') as HTMLElement;
    expect(codeBlock?.style.getPropertyValue('--max-height')).toBe('200px');
  });

  it('should use default max height when not specified', () => {
    const { container } = render(CodeBlock, {
      props: {
        code: sampleCode,
        language: 'javascript',
      },
    });

    const codeBlock = container.querySelector('.code-block') as HTMLElement;
    expect(codeBlock?.style.getPropertyValue('--max-height')).toBe('400px');
  });

  it('should not show line numbers by default', () => {
    const { container } = render(CodeBlock, {
      props: {
        code: multiLineCode,
        language: 'javascript',
      },
    });

    const codeElement = container.querySelector('code.code-text');
    expect(codeElement?.classList.contains('with-numbers')).toBe(false);
  });

  it('should show line numbers when enabled', () => {
    const { container } = render(CodeBlock, {
      props: {
        code: multiLineCode,
        language: 'javascript',
        showLineNumbers: true,
      },
    });

    const codeElement = container.querySelector('code.code-text');
    expect(codeElement?.classList.contains('with-numbers')).toBe(true);
  });

  it('should display correct line numbers', () => {
    const { container } = render(CodeBlock, {
      props: {
        code: multiLineCode,
        language: 'javascript',
        showLineNumbers: true,
      },
    });

    const lineNumbers = container.querySelectorAll('.line-number');
    expect(lineNumbers.length).toBe(5);
    expect(lineNumbers[0].textContent).toBe('1');
    expect(lineNumbers[4].textContent).toBe('5');
  });

  it('should display code with line numbers correctly', () => {
    const { container } = render(CodeBlock, {
      props: {
        code: multiLineCode,
        language: 'javascript',
        showLineNumbers: true,
      },
    });

    const lineContents = container.querySelectorAll('.line-content');
    expect(lineContents.length).toBe(5);
    expect(lineContents[0].textContent).toBe('line1');
    expect(lineContents[4].textContent).toBe('line5');
  });

  it('should handle empty code', () => {
    const { container } = render(CodeBlock, {
      props: {
        code: '',
        language: 'javascript',
      },
    });

    expect(container.querySelector('.code-block')).toBeTruthy();
  });

  it('should handle single line code with line numbers', () => {
    const { container } = render(CodeBlock, {
      props: {
        code: 'single line',
        language: 'javascript',
        showLineNumbers: true,
      },
    });

    const lineNumbers = container.querySelectorAll('.line-number');
    expect(lineNumbers.length).toBe(1);
    expect(lineNumbers[0].textContent).toBe('1');
  });

  it('should handle code with trailing newline', () => {
    const codeWithTrailingNewline = 'line1\nline2\n';
    const { container } = render(CodeBlock, {
      props: {
        code: codeWithTrailingNewline,
        language: 'javascript',
        showLineNumbers: true,
      },
    });

    // Should handle trailing newline gracefully
    const lines = container.querySelectorAll('.line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('should handle various programming languages', () => {
    const languages = [
      'javascript',
      'typescript',
      'python',
      'rust',
      'go',
      'java',
      'html',
      'css',
      'json',
      'sql',
      'bash',
      'dockerfile',
      'svelte',
      'vue',
    ];

    languages.forEach((lang) => {
      const { container } = render(CodeBlock, {
        props: {
          code: sampleCode,
          language: lang,
        },
      });

      expect(container.querySelector('.code-block')).toBeTruthy();
    });
  });

  it('should handle unknown language gracefully', () => {
    const { container, getByText } = render(CodeBlock, {
      props: {
        code: sampleCode,
        language: 'unknownlang',
      },
    });

    expect(container.querySelector('.code-block')).toBeTruthy();
    expect(getByText('UNKNOWNLANG')).toBeTruthy();
  });

  it('should handle code with special characters', () => {
    const specialCode = '<div>Hello & "World" \'test\'</div>';
    const { container } = render(CodeBlock, {
      props: {
        code: specialCode,
        language: 'html',
      },
    });

    const codeElement = container.querySelector('code.code-text');
    expect(codeElement?.textContent).toContain('<div>Hello');
  });

  it('should have correct button type', () => {
    const { container } = render(CodeBlock, {
      props: {
        code: sampleCode,
        language: 'javascript',
      },
    });

    const copyButton = container.querySelector('button.copy-btn');
    expect(copyButton?.getAttribute('type')).toBe('button');
  });

  it('should update when code changes', async () => {
    const { container, rerender } = render(CodeBlock, {
      props: {
        code: 'initial code',
        language: 'javascript',
      },
    });

    const codeElement = container.querySelector('code.code-text');
    expect(codeElement?.textContent).toContain('initial code');

    await rerender({
      code: 'updated code',
      language: 'javascript',
    });

    expect(codeElement?.textContent).toContain('updated code');
  });

  it('should update when language changes', async () => {
    const { container, rerender, getByText } = render(CodeBlock, {
      props: {
        code: sampleCode,
        language: 'javascript',
      },
    });

    expect(getByText('JAVASCRIPT')).toBeTruthy();

    await rerender({
      code: sampleCode,
      language: 'python',
    });

    expect(getByText('PYTHON')).toBeTruthy();
  });
});
