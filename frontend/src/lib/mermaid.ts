
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
    securityLevel: 'loose',
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

export async function exportAsSvg(id: string): Promise<string> {
  const element = document.getElementById(id);
  if (!element) throw new Error('Diagram element not found');

  const svg = element.querySelector('svg');
  if (!svg) throw new Error('SVG not found in diagram');

  // Clone to avoid modifying the displayed diagram
  const clone = svg.cloneNode(true) as SVGElement;

  // Ensure styles are inline or included
  return clone.outerHTML;
}

export async function exportAsPng(id: string): Promise<Blob> {
  const svgData = await exportAsSvg(id);
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
    };
    img.onerror = reject;

    // Convert SVG to data URL
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.src = url;
  });
}
