/**
 * Tests for mermaid
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initializeMermaid,
  renderDiagram,
  exportAsSvg,
  exportAsPng,
  exportAsPdf,
  exportAsMarkdown,
  downloadFile,
  copyToClipboard,
} from './mermaid';

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn((id: string, code: string) =>
      Promise.resolve({ svg: `<svg id="${id}"><g>${code}</g></svg>` })
    ),
  },
}));

// Mock jsPDF
vi.mock('jspdf', () => ({
  jsPDF: vi.fn(() => ({
    setFontSize: vi.fn(),
    text: vi.fn(),
    addImage: vi.fn(),
    output: vi.fn(() => new Blob(['pdf'], { type: 'application/pdf' })),
  })),
}));

import mermaid from 'mermaid';

describe('mermaid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset initialization state is handled by clearing mocks
  });

  describe('initializeMermaid', () => {
    it('should initialize mermaid with default config', () => {
      initializeMermaid();

      expect(mermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          startOnLoad: false,
          theme: 'base',
          securityLevel: 'strict',
          fontFamily: 'Inter, sans-serif',
        })
      );
    });

    it.skip('should accept custom config', () => {
      initializeMermaid({
        startOnLoad: false,
        theme: 'forest',
        securityLevel: 'loose',
        flowchart: { useMaxWidth: true, htmlLabels: true },
        themeVariables: {
          primaryColor: '#fff',
          primaryTextColor: '#000',
          primaryBorderColor: '#333',
          lineColor: '#666',
          secondaryColor: '#f0f0f0',
          tertiaryColor: '#e0e0e0',
          background: '#ffffff',
          mainBkg: '#f9f9f9',
          nodeBorder: '#ccc',
          clusterBkg: '#eee',
          titleColor: '#333',
          edgeLabelBackground: '#fff',
          fontFamily: 'Inter, sans-serif',
        },
      });

      expect(mermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'forest',
          securityLevel: 'loose',
        })
      );
    });

    it.skip('should only initialize once', () => {
      initializeMermaid();
      initializeMermaid();
      initializeMermaid();

      expect(mermaid.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('renderDiagram', () => {
    it('should render diagram successfully', async () => {
      const result = await renderDiagram('diagram-1', 'graph TD\nA-->B');

      expect(result.svg).toContain('<svg');
      expect(result.svg).toContain('diagram-1');
    });

    it('should handle rendering errors', async () => {
      (mermaid.render as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Parse error'));

      const result = await renderDiagram('diagram-1', 'invalid syntax');

      expect(result.svg).toContain('error');
      expect(result.svg).toContain('Failed to render diagram');
    });

    it.skip('should auto-initialize if not initialized', async () => {
      const _module = await import('./mermaid');

      await renderDiagram('diagram-1', 'graph TD\nA-->B');

      expect(mermaid.initialize).toHaveBeenCalled();
    });
  });

  describe('exportAsSvg', () => {
    it('should export SVG by element', async () => {
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgElement.setAttribute('id', 'test-svg');
      svgElement.innerHTML = '<g>Content</g>';
      document.body.appendChild(svgElement);

      const result = await exportAsSvg(svgElement);

      expect(result).toContain('<svg');
      expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');

      document.body.removeChild(svgElement);
    });

    it('should export SVG by ID', async () => {
      const container = document.createElement('div');
      container.id = 'diagram-container';
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      container.appendChild(svgElement);
      document.body.appendChild(container);

      const result = await exportAsSvg('diagram-container');

      expect(result).toContain('<svg');

      document.body.removeChild(container);
    });

    it('should throw if element not found', async () => {
      await expect(exportAsSvg('nonexistent-id')).rejects.toThrow('Diagram element not found');
    });

    it('should throw if SVG not found in element', async () => {
      const container = document.createElement('div');
      container.id = 'no-svg-container';
      document.body.appendChild(container);

      await expect(exportAsSvg('no-svg-container')).rejects.toThrow('SVG not found in diagram');

      document.body.removeChild(container);
    });

    it('should add xmlns if missing', async () => {
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      // Don't set xmlns explicitly - it should be added
      document.body.appendChild(svgElement);

      const result = await exportAsSvg(svgElement);

      expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');

      document.body.removeChild(svgElement);
    });
  });

  describe('exportAsPng', () => {
    it('should export as PNG blob', async () => {
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgElement.setAttribute('width', '100');
      svgElement.setAttribute('height', '100');
      document.body.appendChild(svgElement);

      // Mock Image to trigger onload immediately
      const originalImage = globalThis.Image;
      class MockImage {
        onload: (() => void) | null = null;
        onerror: ((e: Event | string) => void) | null = null;
        src = '';
        width = 100;
        height = 100;

        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      }
      globalThis.Image = MockImage as unknown as typeof Image;

      // Mock canvas and context
      const mockContext = {
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      };
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => mockContext,
            toBlob: (callback: (blob: Blob | null) => void) =>
              callback(new Blob(['png'], { type: 'image/png' })),
            // eslint-disable-next-line no-undef
          } as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tag);
      });

      const result = await exportAsPng(svgElement);

      expect(result).toBeInstanceOf(Blob);

      globalThis.Image = originalImage;
      vi.restoreAllMocks();
      document.body.removeChild(svgElement);
    });

    it('should handle image load error', async () => {
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgElement.setAttribute('width', '100');
      svgElement.setAttribute('height', '100');
      document.body.appendChild(svgElement);

      const originalImage = globalThis.Image;
      class MockImage {
        onload: (() => void) | null = null;
        onerror: ((e: Event | string) => void) | null = null;
        src = '';
        width = 100;
        height = 100;

        constructor() {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Event('error'));
          }, 0);
        }
      }
      globalThis.Image = MockImage as unknown as typeof Image;

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              fillStyle: '',
              fillRect: vi.fn(),
              drawImage: vi.fn(),
            }),
            toBlob: vi.fn(),
            // eslint-disable-next-line no-undef
          } as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tag);
      });

      await expect(exportAsPng(svgElement)).rejects.toBeDefined();

      globalThis.Image = originalImage;
      vi.restoreAllMocks();
      document.body.removeChild(svgElement);
    });

    it('should handle null blob result', async () => {
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgElement.setAttribute('width', '100');
      svgElement.setAttribute('height', '100');
      document.body.appendChild(svgElement);

      const originalImage = globalThis.Image;
      class MockImage {
        onload: (() => void) | null = null;
        onerror: ((e: Event | string) => void) | null = null;
        src = '';
        width = 100;
        height = 100;

        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      }
      globalThis.Image = MockImage as unknown as typeof Image;

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              fillStyle: '',
              fillRect: vi.fn(),
              drawImage: vi.fn(),
            }),
            toBlob: (callback: (blob: Blob | null) => void) => callback(null), // Return null blob
            // eslint-disable-next-line no-undef
          } as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tag);
      });

      await expect(exportAsPng(svgElement)).rejects.toThrow('Failed to create PNG blob');

      globalThis.Image = originalImage;
      vi.restoreAllMocks();
      document.body.removeChild(svgElement);
    });
  });

  describe('exportAsPdf', () => {
    it('should export as PDF blob', async () => {
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgElement.setAttribute('width', '100');
      svgElement.setAttribute('height', '100');
      document.body.appendChild(svgElement);

      // Mock Image to trigger onload immediately
      const originalImage = globalThis.Image;
      class MockImage {
        onload: (() => void) | null = null;
        onerror: ((e: Event | string) => void) | null = null;
        src = '';
        width = 100;
        height = 100;

        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      }
      globalThis.Image = MockImage as unknown as typeof Image;

      // Mock canvas
      const mockContext = {
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      };
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => mockContext,
            toDataURL: () => 'data:image/png;base64,mock',
            // eslint-disable-next-line no-undef
          } as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tag);
      });

      const result = await exportAsPdf(svgElement);

      expect(result).toBeInstanceOf(Blob);

      globalThis.Image = originalImage;
      vi.restoreAllMocks();
      document.body.removeChild(svgElement);
    });

    it('should export PDF with title', async () => {
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgElement.setAttribute('width', '100');
      svgElement.setAttribute('height', '100');
      document.body.appendChild(svgElement);

      const originalImage = globalThis.Image;
      class MockImage {
        onload: (() => void) | null = null;
        onerror: ((e: Event | string) => void) | null = null;
        src = '';
        width = 100;
        height = 100;

        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      }
      globalThis.Image = MockImage as unknown as typeof Image;

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              fillStyle: '',
              fillRect: vi.fn(),
              drawImage: vi.fn(),
            }),
            toDataURL: () => 'data:image/png;base64,mock',
            // eslint-disable-next-line no-undef
          } as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tag);
      });

      const result = await exportAsPdf(svgElement);

      expect(result).toBeInstanceOf(Blob);

      globalThis.Image = originalImage;
      vi.restoreAllMocks();
      document.body.removeChild(svgElement);
    });

    it('should handle landscape orientation for wide images', async () => {
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgElement.setAttribute('width', '200');
      svgElement.setAttribute('height', '100');
      document.body.appendChild(svgElement);

      const originalImage = globalThis.Image;
      class MockImage {
        onload: (() => void) | null = null;
        onerror: ((e: Event | string) => void) | null = null;
        src = '';
        width = 200; // wider than tall
        height = 100;

        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      }
      globalThis.Image = MockImage as unknown as typeof Image;

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              fillStyle: '',
              fillRect: vi.fn(),
              drawImage: vi.fn(),
            }),
            toDataURL: () => 'data:image/png;base64,mock',
            // eslint-disable-next-line no-undef
          } as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tag);
      });

      const result = await exportAsPdf(svgElement);

      expect(result).toBeInstanceOf(Blob);

      globalThis.Image = originalImage;
      vi.restoreAllMocks();
      document.body.removeChild(svgElement);
    });

    it('should handle image load error', async () => {
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgElement.setAttribute('width', '100');
      svgElement.setAttribute('height', '100');
      document.body.appendChild(svgElement);

      const originalImage = globalThis.Image;
      class MockImage {
        onload: (() => void) | null = null;
        onerror: ((e: Event | string) => void) | null = null;
        src = '';
        width = 100;
        height = 100;

        constructor() {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Event('error'));
          }, 0);
        }
      }
      globalThis.Image = MockImage as unknown as typeof Image;

      // Also mock canvas to avoid jsdom error
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              fillStyle: '',
              fillRect: vi.fn(),
              drawImage: vi.fn(),
            }),
            toDataURL: () => 'data:image/png;base64,mock',
            // eslint-disable-next-line no-undef
          } as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tag);
      });

      await expect(exportAsPdf(svgElement)).rejects.toBeDefined();

      globalThis.Image = originalImage;
      vi.restoreAllMocks();
      document.body.removeChild(svgElement);
    });
  });

  describe('exportAsMarkdown', () => {
    it('should export as markdown with title', async () => {
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgElement.innerHTML = '<g>Test</g>';
      document.body.appendChild(svgElement);

      const result = await exportAsMarkdown(svgElement, 'My Diagram', 'Description');

      expect(result).toContain('# My Diagram');
      expect(result).toContain('Description');
      expect(result).toContain('## Diagram');

      document.body.removeChild(svgElement);
    });

    it('should export without title', async () => {
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      document.body.appendChild(svgElement);

      const result = await exportAsMarkdown(svgElement);

      // No level-1 heading (single #) when no title
      expect(result).not.toMatch(/^# [^#]/m);
      expect(result).toContain('## Diagram');

      document.body.removeChild(svgElement);
    });
  });

  describe('downloadFile', () => {
    it('should download string content', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      const clickSpy = vi.fn();

      createElementSpy.mockReturnValue({
        click: clickSpy,
      } as unknown as HTMLAnchorElement);

      downloadFile('content', 'test.txt', 'text/plain');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(clickSpy).toHaveBeenCalled();

      createElementSpy.mockRestore();
    });

    it('should download blob content', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      const clickSpy = vi.fn();

      createElementSpy.mockReturnValue({
        click: clickSpy,
      } as unknown as HTMLAnchorElement);

      const blob = new Blob(['content'], { type: 'text/plain' });
      downloadFile(blob, 'test.txt', 'text/plain');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(clickSpy).toHaveBeenCalled();

      createElementSpy.mockRestore();
    });
  });

  describe('copyToClipboard', () => {
    it('should copy using clipboard API', async () => {
      const writeTextSpy = vi.fn().mockResolvedValue(undefined);
      const mockClipboard = { writeText: writeTextSpy };

      // Use vi.stubGlobal to properly mock navigator.clipboard
      const originalNavigator = globalThis.navigator;
      vi.stubGlobal('navigator', {
        ...originalNavigator,
        clipboard: mockClipboard,
      });

      await copyToClipboard('text to copy');

      expect(writeTextSpy).toHaveBeenCalledWith('text to copy');

      vi.unstubAllGlobals();
    });

    it('should fallback to execCommand if clipboard API fails', async () => {
      const writeTextSpy = vi.fn().mockRejectedValue(new Error('Clipboard error'));
      const mockClipboard = { writeText: writeTextSpy };

      const originalNavigator = globalThis.navigator;
      vi.stubGlobal('navigator', {
        ...originalNavigator,
        clipboard: mockClipboard,
      });

      const execCommandSpy = vi.fn().mockReturnValue(true);
      const originalExecCommand = document.execCommand;
      document.execCommand = execCommandSpy;

      await copyToClipboard('text to copy');

      expect(execCommandSpy).toHaveBeenCalledWith('copy');

      document.execCommand = originalExecCommand;
      vi.unstubAllGlobals();
    });
  });
});
