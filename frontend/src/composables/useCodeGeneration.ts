import { ref } from 'vue';

export type TechStack = 'react-express-prisma' | 'fastapi-sqlalchemy' | 'nextjs-prisma';
export type DiagramType = 'er' | 'sequence' | 'flowchart' | 'class';

export interface CodeGenRequest {
  diagramType: DiagramType;
  mermaidCode: string;
  techStack: TechStack;
  projectName?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export function useCodeGeneration() {
  const generating = ref(false);
  const error = ref<string | null>(null);

  function detectDiagramType(mermaidCode: string): DiagramType {
    const code = mermaidCode.toLowerCase().trim();
    if (code.startsWith('erdiagram')) return 'er';
    if (code.startsWith('sequencediagram')) return 'sequence';
    if (code.startsWith('classdiagram')) return 'class';
    return 'flowchart';
  }

  async function generateCode(request: CodeGenRequest): Promise<boolean> {
    generating.value = true;
    error.value = null;

    try {
      const response = await fetch(`${API_URL}/generate-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      error.value = err instanceof Error ? err.message : 'Failed to generate code';
      return false;
    } finally {
      generating.value = false;
    }
  }

  return {
    generating,
    error,
    generateCode,
    detectDiagramType,
  };
}
