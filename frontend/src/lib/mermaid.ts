/* eslint-disable @typescript-eslint/no-explicit-any -- Mermaid theme type (Phase 1.1) */
import mermaid from 'mermaid';
import type { MermaidConfig } from '../types';

let isInitialized = false;

export function initializeMermaid(config?: MermaidConfig) {
  if (isInitialized) return;

  const theme = config?.theme || 'base';
  const isDark = document.documentElement.classList.contains('dark');

  mermaid.initialize({
    startOnLoad: false,
    theme: theme as any,
    darkMode: isDark,
    securityLevel: 'strict',
    fontFamily: 'Inter, sans-serif',
    ...config,
  });

  isInitialized = true;
}

export async function renderDiagram(id: string, code: string): Promise<{ svg: string }> {
  if (!isInitialized) initializeMermaid();

  try {
    const { svg } = await mermaid.render(id, code);
    return { svg };
  } catch (error) {
    console.error('Mermaid rendering failed:', error);
    // Fallback or re-throw
    return { svg: `<pre class="error">Failed to render diagram: ${(error as Error).message}</pre>` };
  }
}

/**
 * Export a diagram as SVG string
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
 * Export a diagram as PNG blob
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
 * Export a diagram as PDF
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
 * Export diagram as markdown with embedded SVG
 */
export async function exportAsMarkdown(elementOrId: string | SVGElement, title?: string, description?: string): Promise<string> {
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
 * Helper to download a blob or string as a file
 */
export function downloadFile(content: Blob | string, filename: string, type: string) {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Copy content to clipboard
 */
export async function copyToClipboard(content: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(content);
  } catch (error) {
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
