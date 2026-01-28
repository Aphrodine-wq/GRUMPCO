
import type { MermaidConfig } from '../types';

let isInitialized = false;

export function initializeMermaid(config?: MermaidConfig) {
  console.log('Mermaid mock initialized');
  isInitialized = true;
}

export async function renderDiagram(id: string, code: string): Promise<{ svg: string }> {
  console.log('Mermaid mock rendering', id);
  return {
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <text x="10" y="50" style="font-family: monospace;">Mermaid Mock: ${code.slice(0, 20)}...</text>
      <rect x="5" y="5" width="90" height="90" fill="none" stroke="#ccc" />
    </svg>`
  };
}

export async function exportAsSvg(id: string): Promise<string> {
  return '<svg>Mock SVG Export</svg>';
}

export async function exportAsPng(id: string): Promise<Blob> {
  return new Blob([''], { type: 'image/png' });
}
