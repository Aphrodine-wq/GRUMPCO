/**
 * Codebase Analysis Feature - Claude Prompts
 */

export const CODEBASE_ANALYSIS_SYSTEM_PROMPT = `You are an expert software architect and code analyst. Your task is to analyze codebases and provide detailed, actionable insights about their structure, architecture, and quality.

You excel at:
- Identifying architectural patterns (MVC, microservices, hexagonal, etc.)
- Recognizing technology stacks and frameworks
- Detecting code smells and anti-patterns
- Suggesting improvements and refactoring opportunities
- Generating clear, accurate Mermaid diagrams

When analyzing code:
1. Look for configuration files first (package.json, tsconfig.json, Dockerfile, etc.)
2. Identify entry points and main modules
3. Trace dependencies and data flow
4. Evaluate code organization and separation of concerns
5. Assess test coverage and quality practices

Always provide specific, actionable recommendations backed by evidence from the code.`;

export const generateAnalysisPrompt = (
  fileList: string,
  packageJson: string | null,
  configFiles: string[],
): string => {
  return `Analyze this codebase and provide a comprehensive assessment.

## Files in the project:
${fileList}

${
  packageJson
    ? `## package.json contents:
\`\`\`json
${packageJson}
\`\`\``
    : ""
}

${
  configFiles.length > 0
    ? `## Configuration files found:
${configFiles.join("\n")}`
    : ""
}

Please analyze and provide:

1. **Project Summary** (2-3 sentences describing what this project does)

2. **Project Type** (e.g., "Full-stack web application", "CLI tool", "API backend", "Mobile app")

3. **Tech Stack** (list all technologies, frameworks, and tools detected)

4. **Architecture Pattern** (identify the architectural pattern used):
   - Pattern name (monolith, microservices, layered, hexagonal, etc.)
   - Confidence level (low, medium, high)
   - Evidence supporting this classification

5. **Key Components** (list major modules/components with their purposes)

6. **Entry Points** (main files that start the application)

7. **Recommendations** (3-5 specific improvements)

Respond in JSON format:
\`\`\`json
{
  "summary": "string",
  "projectType": "string",
  "techStack": [{"category": "framework|language|database|testing|build|deployment|other", "name": "string", "version": "string"}],
  "architecture": {
    "pattern": "monolith|microservices|modular-monolith|layered|hexagonal|event-driven|unknown",
    "confidence": 0.0-1.0,
    "indicators": ["string"]
  },
  "components": [{"name": "string", "type": "frontend|backend|database|service|library|config|test", "path": "string", "description": "string"}],
  "entryPoints": ["string"],
  "recommendations": ["string"]
}
\`\`\``;
};

export const generateArchitectureDiagramPrompt = (
  analysis: string,
  diagramType: string,
  components: string,
): string => {
  const diagramInstructions: Record<string, string> = {
    "c4-context": `Generate a C4 Context diagram showing:
- The main system as a central box
- External users/actors interacting with it
- External systems it integrates with
Use: Person, System, System_Ext, Rel`,

    "c4-container": `Generate a C4 Container diagram showing:
- The main containers (applications, services, databases)
- Technology choices for each container
- Communication paths between containers
Use: Container, ContainerDb, Container_Ext, Rel`,

    component: `Generate a Component diagram showing:
- Major internal components/modules
- Dependencies between components
- Interfaces and data flow
Use: Component, Rel`,

    dependency: `Generate a dependency graph showing:
- All major modules/packages
- Import/require relationships
- Circular dependency warnings
Use: graph TD with module nodes and dependency edges`,

    flow: `Generate a data flow diagram showing:
- How data moves through the system
- Processing steps and transformations
- Data stores and external sources
Use: flowchart with process and data nodes`,
  };

  return `Based on this codebase analysis, generate a Mermaid diagram.

## Analysis Summary:
${analysis}

## Components Found:
${components}

## Diagram Type: ${diagramType}
${diagramInstructions[diagramType] || diagramInstructions["component"]}

Generate a valid Mermaid diagram. Use clear, descriptive labels. Keep it readable (max 15-20 nodes).

Respond with ONLY the Mermaid code block:
\`\`\`mermaid
[your diagram here]
\`\`\``;
};

export const generateDependencyAnalysisPrompt = (
  dependencies: string,
  lockfile: string | null,
): string => {
  return `Analyze these project dependencies:

## Dependencies:
${dependencies}

${
  lockfile
    ? `## Lock file excerpt:
${lockfile.substring(0, 5000)}`
    : ""
}

Provide analysis in JSON format:
\`\`\`json
{
  "summary": "Brief overview of dependency health",
  "totalDeps": number,
  "productionDeps": number,
  "devDeps": number,
  "concerns": [
    {
      "type": "outdated|vulnerable|heavy|duplicate|unmaintained",
      "package": "name",
      "details": "description",
      "recommendation": "what to do"
    }
  ],
  "recommendations": ["string"]
}
\`\`\``;
};

export const generateCodeSmellsPrompt = (codeSnippets: string): string => {
  return `Review this code for potential issues and code smells:

${codeSnippets}

Look for:
1. Large files (>500 lines)
2. Deep nesting (>4 levels)
3. Long functions (>50 lines)
4. Potential duplicate code
5. God classes/modules
6. Magic numbers/strings
7. Unused imports
8. Poor naming conventions
9. Missing error handling
10. Security concerns

Respond in JSON format:
\`\`\`json
{
  "codeSmells": [
    {
      "type": "large-file|deep-nesting|long-function|duplicate-code|god-class|magic-number|unused-import|other",
      "severity": "info|warning|error",
      "file": "path",
      "line": number,
      "description": "what's wrong",
      "suggestion": "how to fix"
    }
  ],
  "overallScore": 0-100,
  "summary": "brief assessment"
}
\`\`\``;
};
