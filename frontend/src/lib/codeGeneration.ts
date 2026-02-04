import { fetchApi } from './api.js';

export type TechStack = 'react-express-prisma' | 'fastapi-sqlalchemy' | 'nextjs-prisma';
export type DiagramType = 'er' | 'sequence' | 'flowchart' | 'class';

export interface CodeGenRequest {
  diagramType: DiagramType;
  mermaidCode: string;
  techStack: TechStack;
  projectName?: string;
}

export function detectDiagramType(mermaidCode: string): DiagramType {
  const code = mermaidCode.toLowerCase().trim();
  if (code.startsWith('erdiagram')) return 'er';
  if (code.startsWith('sequencediagram')) return 'sequence';
  if (code.startsWith('classdiagram')) return 'class';
  return 'flowchart';
}

function parseDownloadFilename(contentDisposition: string | null): string {
  if (!contentDisposition) return 'generated-project.zip';
  const quoted = contentDisposition.match(/filename="([^"]*)"/);
  if (quoted?.[1]) return decodeURIComponent(quoted[1].replace(/^"(.*)"$/, '$1'));
  const encoded = contentDisposition.match(/filename\*=(?:UTF-8'')?([^;]+)/);
  if (encoded?.[1]) return decodeURIComponent(encoded[1].trim());
  return 'generated-project.zip';
}

/** Download codegen ZIP by session ID. Uses /api/codegen/download/:sessionId. */
export async function downloadCodegenZip(sessionId: string): Promise<void> {
  const response = await fetchApi(`/api/codegen/download/${sessionId}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error ?? `Download failed: ${response.status}`
    );
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  const filename = parseDownloadFilename(disposition);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.zip') ? filename : `${filename}.zip`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function generateCode(request: CodeGenRequest): Promise<boolean> {
  try {
    const response = await fetchApi('/api/generate-code', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    // Get the ZIP blob
    const blob = await response.blob();

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${request.projectName || 'generated-project'}.zip`;
    document.body.appendChild(a);
    a.click();

    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return true;
  } catch (err) {
    console.error('Code generation failed:', err);
    return false;
  }
}
