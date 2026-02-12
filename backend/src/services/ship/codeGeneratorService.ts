import { generateCodeFromDiagram } from '../ai-providers/claudeCodeService.js';
import { getBaseTemplate, getPackageJson } from './projectTemplates.js';
import { createProjectZip } from './zipService.js';
import type {
  CodeGenerationRequest,
  CodeGenerationResult,
  FileDefinition,
} from '../../types/index.js';
import { getRequestLogger } from '../../middleware/logger.js';
import { type PassThrough } from 'stream';

function sanitizeProjectName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50) || 'generated-project'
  );
}

function detectDiagramType(mermaidCode: string): string {
  const code = mermaidCode.toLowerCase().trim();
  if (code.startsWith('erdiagram')) return 'er';
  if (code.startsWith('sequencediagram')) return 'sequence';
  if (code.startsWith('classdiagram')) return 'class';
  if (code.startsWith('flowchart') || code.startsWith('graph')) return 'flowchart';
  if (code.startsWith('statediagram')) return 'flowchart';
  return 'flowchart';
}

export async function generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
  const log = getRequestLogger();

  const { diagramType, mermaidCode, techStack, projectName = 'generated-project' } = request;

  log.info({ diagramType, techStack }, 'Starting code generation');

  // Generate code from Claude
  const aiResponse = await generateCodeFromDiagram(diagramType, mermaidCode, techStack);

  // Get base template files
  const baseFiles = getBaseTemplate(techStack);

  // Get package.json if applicable
  const packageJson = getPackageJson(sanitizeProjectName(projectName), techStack);

  // Merge files, avoiding duplicates (AI-generated files take precedence)
  const aiFilePaths = new Set(aiResponse.files.map((f) => f.path));
  const mergedFiles: FileDefinition[] = [
    ...aiResponse.files,
    ...baseFiles.filter((f) => !aiFilePaths.has(f.path)),
  ];

  // Add package.json if not already present
  if (packageJson && !aiFilePaths.has('package.json')) {
    mergedFiles.push(packageJson);
  }

  log.info({ fileCount: mergedFiles.length }, 'Code generation complete');

  return {
    files: mergedFiles,
    techStack,
    warnings: aiResponse.warnings,
  };
}

export async function generateProjectZip(request: CodeGenerationRequest): Promise<PassThrough> {
  const log = getRequestLogger();

  const projectName = sanitizeProjectName(request.projectName || 'generated-project');

  log.info({ projectName }, 'Generating project ZIP');

  // Generate code
  const result = await generateCode(request);

  // Create ZIP stream
  const zipStream = createProjectZip(result.files, projectName, request.techStack);

  return zipStream;
}

export { detectDiagramType };
