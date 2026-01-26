import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMermaid, resetMermaidState } from '../useMermaid';
import { resetMocks, clipboardMock } from '../../tests/setup';

describe('useMermaid', () => {
  beforeEach(() => {
    resetMocks();
    resetMermaidState();
  });

  describe('renderDiagram', () => {
    it('should render a diagram and return svg', async () => {
      const { renderDiagram } = useMermaid();
      const code = 'graph TD; A-->B;';
      const result = await renderDiagram(code, 'test-diagram');
      expect(result).toContain('<svg');
      expect(result).toContain('test-diagram');
    });

    it('should set error on render failure', async () => {
      const mermaid = await import('mermaid');
      vi.mocked(mermaid.default.render).mockRejectedValueOnce(new Error('Invalid syntax'));
      
      const { renderDiagram, error } = useMermaid();
      
      await expect(renderDiagram('invalid', 'test')).rejects.toThrow();
      expect(error.value).toBe('Invalid syntax');
    });

    it('should clear previous error on successful render', async () => {
      const { renderDiagram, error } = useMermaid();
      
      // Set an initial error
      error.value = 'previous error';
      
      await renderDiagram('graph TD; A-->B;', 'test');
      expect(error.value).toBeNull();
    });
  });

  describe('copyToClipboard', () => {
    it('should copy text to clipboard and return true', async () => {
      const { copyToClipboard } = useMermaid();
      const result = await copyToClipboard('test text');
      
      expect(clipboardMock.writeText).toHaveBeenCalledWith('test text');
      expect(result).toBe(true);
    });

    it('should return false on clipboard error', async () => {
      clipboardMock.writeText.mockRejectedValueOnce(new Error('Clipboard error'));
      
      const { copyToClipboard } = useMermaid();
      const result = await copyToClipboard('test text');
      
      expect(result).toBe(false);
    });
  });

  describe('exportAsSvg', () => {
    it('should create download link and trigger click', () => {
      const { exportAsSvg } = useMermaid();
      
      const mockSvg = {
        outerHTML: '<svg>test</svg>'
      } as SVGElement;
      
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node as Node);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node as Node);
      
      exportAsSvg(mockSvg, 'test-diagram.svg');
      
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
      
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('should use default filename when not provided', () => {
      const { exportAsSvg } = useMermaid();
      
      const mockSvg = {
        outerHTML: '<svg>test</svg>'
      } as SVGElement;
      
      let capturedLink: HTMLAnchorElement | undefined;
      const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
        if (node instanceof HTMLAnchorElement) {
          capturedLink = node;
        }
        return node as Node;
      });
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node as Node);
      
      exportAsSvg(mockSvg);
      
      expect(capturedLink).toBeDefined();
      expect(capturedLink!.download).toBe('diagram.svg');
      
      appendSpy.mockRestore();
    });
  });

  describe('initMermaid', () => {
    it('should initialize mermaid only once', async () => {
      const mermaid = await import('mermaid');
      const initializeSpy = vi.mocked(mermaid.default.initialize);
      
      const { initMermaid } = useMermaid();
      
      await initMermaid();
      await initMermaid();
      
      expect(initializeSpy).toHaveBeenCalledTimes(1);
    });
  });
});
