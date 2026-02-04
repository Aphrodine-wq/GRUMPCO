/**
 * @fileoverview Mermaid diagram rendering and export utilities.
 *
 * This module provides a unified interface for rendering Mermaid diagrams
 * and exporting them to various formats (SVG, PNG, PDF, Markdown).
 *
 * ## Features
 *
 * | Function              | Purpose                                    |
 * |-----------------------|--------------------------------------------|
 * | initializeMermaid     | One-time Mermaid library initialization    |
 * | renderDiagram         | Render Mermaid code to SVG                 |
 * | exportAsSvg           | Export diagram as SVG string               |
 * | exportAsPng           | Export diagram as PNG blob                 |
 * | exportAsPdf           | Export diagram as PDF blob (via jsPDF)     |
 * | exportAsMarkdown      | Export diagram as Markdown with SVG embed  |
 * | downloadFile          | Trigger browser download for any content   |
 * | copyToClipboard       | Copy text content to clipboard             |
 *
 * ## Usage
 *
 * ```typescript
 * import { initializeMermaid, renderDiagram, exportAsPng } from './mermaid';
 *
 * // Initialize once at app startup
 * initializeMermaid({ theme: 'dark' });
 *
 * // Render a diagram
 * const { svg } = await renderDiagram('my-diagram', 'graph TD; A-->B;');
 *
 * // Export to PNG
 * const blob = await exportAsPng('my-diagram');
 * ```
 *
 * @module lib/mermaid
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Mermaid theme type not in @types (Phase 1.1; see docs/KNOWN_ISSUES.md) */
import mermaid from 'mermaid';
import type { MermaidConfig } from '../types';

/** Tracks whether Mermaid has been initialized to prevent duplicate init calls. */
let isInitialized = false;

/**
 * Initializes the Mermaid library with the given configuration.
 * This function is idempotent - calling it multiple times has no effect.
 *
 * @param config - Optional Mermaid configuration options
 * @param config.theme - Theme to use: 'default', 'dark', 'forest', 'neutral', 'base'
 *
 * @example
 * ```typescript
 * // Initialize with dark theme
 * initializeMermaid({ theme: 'dark' });
 *
 * // Initialize with default settings
 * initializeMermaid();
 * ```
 */
export function initializeMermaid(config?: MermaidConfig): void {
  if (isInitialized) return;

  const theme = config?.theme || 'base';

  mermaid.initialize({
    startOnLoad: false,
    theme: theme as any,
    securityLevel: 'strict',
    fontFamily: 'Inter, sans-serif',
    ...config,
  });

  isInitialized = true;
}

/**
 * Renders Mermaid diagram code into an SVG element.
 *
 * Automatically initializes Mermaid if not already initialized.
 * Returns an error message wrapped in a `<pre>` tag if rendering fails.
 *
 * @param id - Unique identifier for the diagram (used for DOM element ID)
 * @param code - Mermaid diagram code to render
 * @returns Object containing the rendered SVG string
 *
 * @example
 * ```typescript
 * const { svg } = await renderDiagram('flowchart-1', `
 *   graph TD
 *     A[Start] --> B{Decision}
 *     B -->|Yes| C[OK]
 *     B -->|No| D[End]
 * `);
 *
 * // Insert into DOM
 * container.innerHTML = svg;
 * ```
 */
export async function renderDiagram(id: string, code: string): Promise<{ svg: string }> {
  if (!isInitialized) initializeMermaid();

  try {
    const { svg } = await mermaid.render(id, code);
    return { svg };
  } catch (error) {
    console.error('Mermaid rendering failed:', error);
    // Fallback or re-throw
    return {
      svg: `<pre class="error">Failed to render diagram: ${(error as Error).message}</pre>`,
    };
  }
}

/**
 * Exports a rendered Mermaid diagram as an SVG string.
 *
 * Accepts either an SVG element directly or the ID of a container element
 * that contains the SVG. Clones the SVG to avoid modifying the displayed diagram.
 *
 * @param elementOrId - Either an SVG element or the ID of a container element
 * @returns The SVG as a string with proper xmlns attribute
 * @throws Error if the element is not found or contains no SVG
 *
 * @example
 * ```typescript
 * // By container ID
 * const svgString = await exportAsSvg('diagram-container');
 *
 * // By element reference
 * const svgElement = document.querySelector('svg');
 * const svgString = await exportAsSvg(svgElement);
 * ```
 */
export async function exportAsSvg(elementOrId: string | SVGElement): Promise<string> {
  let svg: SVGElement | null = null;

  if (elementOrId instanceof SVGElement) {
    svg = elementOrId;
  } else {
    const element = document.getElementById(elementOrId);
    if (!element) throw new Error('Diagram element not found');
    svg = element.querySelector('svg');
  }

  if (!svg) throw new Error('SVG not found in diagram');

  // Clone to avoid modifying the displayed diagram
  const clone = svg.cloneNode(true) as SVGElement;

  // Basic cleanup/ensuring attributes
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  return clone.outerHTML;
}

/**
 * Exports a rendered Mermaid diagram as a PNG blob.
 *
 * Converts the SVG to a canvas, draws it with a white background,
 * and exports as PNG. Uses the Image API for SVG-to-canvas conversion.
 *
 * @param elementOrId - Either an SVG element or the ID of a container element
 * @returns A Blob containing the PNG image data
 * @throws Error if the element is not found, contains no SVG, or PNG creation fails
 *
 * @example
 * ```typescript
 * const pngBlob = await exportAsPng('diagram-container');
 *
 * // Download the PNG
 * downloadFile(pngBlob, 'diagram.png', 'image/png');
 *
 * // Or create an object URL
 * const url = URL.createObjectURL(pngBlob);
 * ```
 */
export async function exportAsPng(elementOrId: string | SVGElement): Promise<Blob> {
  const svgData = await exportAsSvg(elementOrId);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = 'white'; // Background
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create PNG blob'));
      }, 'image/png');
      URL.revokeObjectURL(img.src);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(img.src);
      reject(e);
    };

    // Convert SVG to data URL
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.src = url;
  });
}

/**
 * Exports a rendered Mermaid diagram as a PDF blob.
 *
 * Dynamically imports jsPDF to create the PDF. The PDF orientation
 * is automatically determined based on diagram dimensions.
 *
 * @param elementOrId - Either an SVG element or the ID of a container element
 * @param title - Optional title to display at the top of the PDF
 * @returns A Blob containing the PDF document
 * @throws Error if the element is not found, contains no SVG, or PDF creation fails
 *
 * @example
 * ```typescript
 * const pdfBlob = await exportAsPdf('diagram-container', 'Architecture Diagram');
 *
 * // Download the PDF
 * downloadFile(pdfBlob, 'diagram.pdf', 'application/pdf');
 * ```
 */
export async function exportAsPdf(elementOrId: string | SVGElement, title?: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf');

  const svgData = await exportAsSvg(elementOrId);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }

      // Create PDF
      const pdf = new jsPDF({
        orientation: img.width > img.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [img.width, img.height],
      });

      // Add title if provided
      if (title) {
        pdf.setFontSize(16);
        pdf.text(title, 20, 30);
      }

      // Add image
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, title ? 50 : 0, img.width, img.height);

      // Convert to blob
      const pdfBlob = pdf.output('blob');
      URL.revokeObjectURL(img.src);
      resolve(pdfBlob);
    };

    img.onerror = (e) => {
      URL.revokeObjectURL(img.src);
      reject(e);
    };

    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.src = url;
  });
}

/**
 * Exports a diagram as Markdown with embedded SVG.
 *
 * Creates a Markdown document with optional title and description,
 * plus the SVG embedded in a collapsible `<details>` section.
 *
 * @param elementOrId - Either an SVG element or the ID of a container element
 * @param title - Optional title for the Markdown document (H1 heading)
 * @param description - Optional description paragraph
 * @returns Markdown string with embedded SVG
 *
 * @example
 * ```typescript
 * const markdown = await exportAsMarkdown(
 *   'diagram-container',
 *   'System Architecture',
 *   'High-level overview of the system components.'
 * );
 * ```
 */
export async function exportAsMarkdown(
  elementOrId: string | SVGElement,
  title?: string,
  description?: string
): Promise<string> {
  const svgData = await exportAsSvg(elementOrId);

  let markdown = '';

  if (title) {
    markdown += `# ${title}\n\n`;
  }

  if (description) {
    markdown += `${description}\n\n`;
  }

  markdown += '## Diagram\n\n';
  markdown += '```mermaid\n';
  // Note: This would need the original mermaid code, not the SVG
  // For now, we'll embed the SVG
  markdown += '```\n\n';
  markdown += `<details>\n<summary>View SVG</summary>\n\n${svgData}\n\n</details>\n`;

  return markdown;
}

/**
 * Triggers a browser download for a Blob or string content.
 *
 * Creates a temporary anchor element to trigger the download,
 * then cleans up the object URL.
 *
 * @param content - The content to download (Blob or string)
 * @param filename - The suggested filename for the download
 * @param type - MIME type for string content (e.g., 'text/plain', 'image/svg+xml')
 *
 * @example
 * ```typescript
 * // Download a string as text file
 * downloadFile('Hello, World!', 'greeting.txt', 'text/plain');
 *
 * // Download a blob
 * const blob = new Blob(['data'], { type: 'text/csv' });
 * downloadFile(blob, 'data.csv', 'text/csv');
 * ```
 */
export function downloadFile(content: Blob | string, filename: string, type: string): void {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Copies text content to the system clipboard.
 *
 * Uses the modern Clipboard API with a fallback to the legacy
 * `document.execCommand('copy')` method for older browsers.
 *
 * @param content - The text content to copy
 * @returns Promise that resolves when the copy is complete
 *
 * @example
 * ```typescript
 * await copyToClipboard('Some text to copy');
 *
 * // Copy diagram code
 * const svgString = await exportAsSvg('diagram');
 * await copyToClipboard(svgString);
 * ```
 */
export async function copyToClipboard(content: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(content);
  } catch (_error) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}
