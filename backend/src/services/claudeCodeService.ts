import Anthropic from '@anthropic-ai/sdk';
import { getRequestLogger } from '../middleware/logger.js';
import { createApiTimer } from '../middleware/metrics.js';
import type { TechStack, DiagramType, FileDefinition } from '../types/index.js';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface CodeGenerationResponse {
  files: FileDefinition[];
  warnings?: string[];
}

function getBaseSystemPrompt(techStack: TechStack): string {
  const stackDescriptions: Record<TechStack, string> = {
    'react-express-prisma': 'React (TypeScript) frontend with Express.js backend and Prisma ORM with PostgreSQL',
    'fastapi-sqlalchemy': 'Python FastAPI backend with SQLAlchemy ORM',
    'nextjs-prisma': 'Next.js 14 App Router (TypeScript) with Prisma ORM'
  };

  return `You are an expert software architect generating starter code scaffolds from Mermaid diagrams.

TARGET STACK: ${stackDescriptions[techStack]}

CRITICAL RULES:
1. Generate SHALLOW scaffolding - working structure with placeholder logic
2. Focus on project structure, interfaces, and basic implementations
3. Include TODO comments for complex business logic
4. Return ONLY valid JSON in this exact format, no other text:
{
  "files": [
    {"path": "relative/path/file.ext", "content": "file contents here"}
  ],
  "warnings": ["optional warning messages about limitations"]
}

IMPORTANT:
- All file paths must be relative to project root
- Include proper directory structure (src/, etc.)
- Include package.json or requirements.txt with dependencies
- Include a .gitignore appropriate for the stack
- Include .env.example with placeholder values
- Code should compile/run without errors
- Use modern syntax and best practices for the stack`;
}

function getErDiagramPrompt(mermaidCode: string, techStack: TechStack): string {
  const base = getBaseSystemPrompt(techStack);
  
  return `${base}

FROM THIS ER DIAGRAM:
\`\`\`mermaid
${mermaidCode}
\`\`\`

GENERATE:
1. Database schema files (Prisma schema or SQLAlchemy models)
2. Model/Entity definitions with relationships
3. Basic CRUD service stubs with TODO comments
4. Type definitions

MAP RELATIONSHIPS:
- One-to-many → foreign keys with proper references
- Many-to-many → junction tables
- Entity attributes → appropriate column types`;
}

function getSequenceDiagramPrompt(mermaidCode: string, techStack: TechStack): string {
  const base = getBaseSystemPrompt(techStack);
  
  return `${base}

FROM THIS SEQUENCE DIAGRAM:
\`\`\`mermaid
${mermaidCode}
\`\`\`

GENERATE:
1. API route definitions for each message/call
2. Controller/handler stubs for each participant
3. Request/Response DTOs or types
4. Basic middleware placeholders

MAP DIAGRAM ELEMENTS:
- Participants → Controller classes or route modules
- Messages → HTTP endpoints (infer POST/GET/PUT/DELETE from context)
- Return arrows → Response types`;
}

function getFlowchartPrompt(mermaidCode: string, techStack: TechStack): string {
  const base = getBaseSystemPrompt(techStack);
  
  return `${base}

FROM THIS FLOWCHART:
\`\`\`mermaid
${mermaidCode}
\`\`\`

GENERATE:
1. State machine or workflow service
2. Decision point logic with if/else stubs
3. Process step functions
4. Type definitions for state

MAP DIAGRAM ELEMENTS:
- Process nodes → Functions
- Decision diamonds → Conditional logic with TODO
- Start/End → Entry and exit points
- Arrows → Function calls or state transitions`;
}

function getClassDiagramPrompt(mermaidCode: string, techStack: TechStack): string {
  const base = getBaseSystemPrompt(techStack);
  
  return `${base}

FROM THIS CLASS DIAGRAM:
\`\`\`mermaid
${mermaidCode}
\`\`\`

GENERATE:
1. Class/interface definitions
2. Method signatures with TODO bodies
3. Property declarations with types
4. Inheritance/composition structures

MAP DIAGRAM ELEMENTS:
- Classes → Class files with proper structure
- Attributes → Properties with visibility modifiers
- Methods → Function signatures
- Relationships → Inheritance, composition, or references`;
}

function buildPrompt(diagramType: DiagramType, mermaidCode: string, techStack: TechStack): string {
  switch (diagramType) {
    case 'er':
      return getErDiagramPrompt(mermaidCode, techStack);
    case 'sequence':
      return getSequenceDiagramPrompt(mermaidCode, techStack);
    case 'flowchart':
      return getFlowchartPrompt(mermaidCode, techStack);
    case 'class':
      return getClassDiagramPrompt(mermaidCode, techStack);
    default:
      return getFlowchartPrompt(mermaidCode, techStack);
  }
}

export async function generateCodeFromDiagram(
  diagramType: DiagramType,
  mermaidCode: string,
  techStack: TechStack
): Promise<CodeGenerationResponse> {
  const log = getRequestLogger();
  const timer = createApiTimer('generate_code');
  
  try {
    log.info({ diagramType, techStack }, 'Generating code from diagram');
    
    const prompt = buildPrompt(diagramType, mermaidCode, techStack);
    
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON response
    let parsed: CodeGenerationResponse;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      log.error({ rawText: content.text.substring(0, 500) }, 'Failed to parse code generation response');
      throw new Error('Failed to parse code generation response as JSON');
    }

    if (!parsed.files || !Array.isArray(parsed.files)) {
      throw new Error('Invalid response: missing files array');
    }

    // Sanitize file paths
    parsed.files = parsed.files.map(file => ({
      path: file.path.replace(/^\/+/, '').replace(/\.\./g, ''),
      content: file.content
    }));

    timer.success();
    log.info({ fileCount: parsed.files.length }, 'Code generated successfully');
    
    return parsed;
  } catch (error) {
    const err = error as Error;
    timer.failure('error');
    log.error({ error: err.message }, 'Code generation failed');
    throw error;
  }
}
