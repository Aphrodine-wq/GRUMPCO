import type { MermaidConfig } from '../types';

// Lazy-loaded mermaid instance
let mermaidInstance: typeof import('mermaid').default | null = null;
let mermaidPromise: Promise<typeof import('mermaid').default> | null = null;

const getMermaid = async () => {
  if (mermaidInstance) return mermaidInstance;
  
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      mermaidInstance = m.default;
      return mermaidInstance;
    });
  }
  
  return mermaidPromise;
};

let initialized = false;

const mermaidConfig: MermaidConfig = {
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'strict',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
  },
  themeVariables: {
    primaryColor: '#FFFFFF',
    primaryTextColor: '#000000',
    primaryBorderColor: '#000000',
    lineColor: '#000000',
    secondaryColor: '#F5F5F5',
    tertiaryColor: '#E5E5E5',
    background: '#FFFFFF',
    mainBkg: '#FFFFFF',
    nodeBorder: '#000000',
    clusterBkg: '#F5F5F5',
    titleColor: '#000000',
    edgeLabelBackground: '#FFFFFF',
    fontFamily: 'JetBrains Mono, monospace',
  },
};

export async function initMermaid(): Promise<void> {
  if (initialized) return;
  
  const mermaid = await getMermaid();
  mermaid.initialize(mermaidConfig);
  initialized = true;
}

export async function renderDiagram(code: string, elementId: string): Promise<string> {
  await initMermaid();

  try {
    const mermaid = await getMermaid();
    const { svg } = await mermaid.render(elementId, code);
    return svg;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to render diagram';
    throw new Error(errorMessage);
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

export function exportAsSvg(svgElement: SVGElement, filename: string = 'diagram.svg'): void {
  const svgData = svgElement.outerHTML;
  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportAsPng(svgElement: SVGElement, filename: string = 'diagram.png'): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const svgData = svgElement.outerHTML;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create PNG blob'));
            return;
          }
          
          const pngUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = pngUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          URL.revokeObjectURL(pngUrl);
          resolve();
        }, 'image/png');
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG as image'));
      };
      
      img.src = url;
    } catch (error) {
      reject(error);
    }
  });
}

// For testing - reset mermaid state
export function resetMermaidState(): void {
  mermaidInstance = null;
  mermaidPromise = null;
  initialized = false;
}
