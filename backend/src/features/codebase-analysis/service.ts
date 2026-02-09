/**
 * Codebase Analysis Service
 *
 * Analyzes existing codebases to extract architecture, dependencies,
 * and provide insights for development.
 */

import * as fs from "fs";
import * as path from "path";
import { getStream, type StreamParams } from "../../services/ai-providers/llmGateway.js";
import {
  type CodebaseAnalysisResult,
  type AnalysisRequest,
  type ArchitectureDiagramRequest,
  type DependencyGraphRequest,
  type MetricsRequest,
  type FileInfo,
  type CodeMetrics,
  type TechStackItem,
  type CodeSmell,
  type DependencyInfo,
  type ArchitectureComponent,
  type ArchitecturePattern,
} from "./types.js";
import {
  CODEBASE_ANALYSIS_SYSTEM_PROMPT,
  generateAnalysisPrompt,
  generateArchitectureDiagramPrompt,
  generateDependencyAnalysisPrompt,
  generateCodeSmellsPrompt,
} from "./prompts.js";

const DEFAULT_MODEL = "moonshotai/kimi-k2.5";

/**
 * Helper to call LLM via gateway and get complete response text
 */
async function callLLM(params: StreamParams): Promise<string> {
  const stream = getStream(params, {
    provider: "nim",
    modelId: params.model || DEFAULT_MODEL,
  });
  let responseText = "";
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      responseText += event.delta.text;
    }
  }
  return responseText;
}

// File extensions to language mapping
const LANGUAGE_MAP: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript (React)",
  ".js": "JavaScript",
  ".jsx": "JavaScript (React)",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".kt": "Kotlin",
  ".swift": "Swift",
  ".rb": "Ruby",
  ".php": "PHP",
  ".cs": "C#",
  ".cpp": "C++",
  ".c": "C",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".html": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".md": "Markdown",
  ".sql": "SQL",
  ".sh": "Shell",
  ".bat": "Batch",
};

// Directories to ignore
const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  "__pycache__",
  "venv",
  ".venv",
  "target",
  "vendor",
  ".idea",
  ".vscode",
]);

// Files to ignore
const IGNORE_FILES = new Set([
  ".DS_Store",
  "Thumbs.db",
  ".gitignore",
  ".npmignore",
]);

/**
 * Recursively scan directory for files
 */
function scanDirectory(
  dirPath: string,
  maxDepth: number = 10,
  currentDepth: number = 0,
  excludePatterns: string[] = [],
): FileInfo[] {
  const files: FileInfo[] = [];

  if (currentDepth >= maxDepth || !fs.existsSync(dirPath)) {
    return files;
  }

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip ignored directories and files
      if (IGNORE_DIRS.has(entry.name) || IGNORE_FILES.has(entry.name)) {
        continue;
      }

      // Check exclude patterns
      if (excludePatterns.some((pattern) => fullPath.includes(pattern))) {
        continue;
      }

      if (entry.isDirectory()) {
        files.push(
          ...scanDirectory(
            fullPath,
            maxDepth,
            currentDepth + 1,
            excludePatterns,
          ),
        );
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const language = LANGUAGE_MAP[ext] || "Other";

        try {
          const stats = fs.statSync(fullPath);
          const content = fs.readFileSync(fullPath, "utf-8");
          const lines = content.split("\n").length;

          files.push({
            path: fullPath,
            name: entry.name,
            extension: ext,
            size: stats.size,
            lines,
            language,
          });
        } catch (_err) {
          // Skip files that can't be read
        }
      }
    }
  } catch (_err) {
    // Skip directories that can't be read
  }

  return files;
}

/**
 * Calculate code metrics from file list
 */
function calculateMetrics(files: FileInfo[]): CodeMetrics {
  const languages: Record<string, { files: number; lines: number }> = {};
  let totalLines = 0;

  for (const file of files) {
    totalLines += file.lines;

    if (!languages[file.language]) {
      languages[file.language] = { files: 0, lines: 0 };
    }
    languages[file.language].files++;
    languages[file.language].lines += file.lines;
  }

  const sortedFiles = [...files].sort((a, b) => b.lines - a.lines);
  const largestFiles = sortedFiles.slice(0, 10).map((f) => ({
    path: f.path,
    lines: f.lines,
  }));

  return {
    totalFiles: files.length,
    totalLines,
    codeLines: totalLines, // Simplified - could parse for actual code vs comments
    commentLines: 0,
    blankLines: 0,
    languages,
    largestFiles,
    averageFileSize:
      files.length > 0 ? Math.round(totalLines / files.length) : 0,
  };
}

/**
 * Read package.json if it exists
 */
function readPackageJson(
  workspacePath: string,
): { content: string; parsed: Record<string, unknown> } | null {
  const pkgPath = path.join(workspacePath, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const content = fs.readFileSync(pkgPath, "utf-8");
      return { content, parsed: JSON.parse(content) };
    } catch (_err) {
      return null;
    }
  }
  return null;
}

/**
 * Find configuration files
 */
function findConfigFiles(workspacePath: string): string[] {
  const configPatterns = [
    "tsconfig.json",
    "package.json",
    "vite.config.ts",
    "vite.config.js",
    "webpack.config.js",
    "next.config.js",
    "nuxt.config.ts",
    "svelte.config.js",
    "tailwind.config.js",
    "postcss.config.js",
    ".eslintrc",
    ".eslintrc.js",
    ".prettierrc",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    ".github/workflows",
    "Makefile",
    "Cargo.toml",
    "go.mod",
    "requirements.txt",
    "pyproject.toml",
    "setup.py",
  ];

  const found: string[] = [];
  for (const pattern of configPatterns) {
    const fullPath = path.join(workspacePath, pattern);
    if (fs.existsSync(fullPath)) {
      found.push(pattern);
    }
  }
  return found;
}

/**
 * Extract dependencies from package.json
 */
function extractDependencies(pkg: Record<string, unknown>): {
  production: DependencyInfo[];
  development: DependencyInfo[];
} {
  const production: DependencyInfo[] = [];
  const development: DependencyInfo[] = [];

  if (pkg.dependencies) {
    for (const [name, version] of Object.entries(pkg.dependencies)) {
      production.push({
        name,
        version: String(version),
        type: "production",
      });
    }
  }

  if (pkg.devDependencies) {
    for (const [name, version] of Object.entries(pkg.devDependencies)) {
      development.push({
        name,
        version: String(version),
        type: "development",
      });
    }
  }

  return { production, development };
}

/**
 * Main analysis function
 */
export async function analyzeCodebase(
  request: AnalysisRequest,
): Promise<CodebaseAnalysisResult> {
  const { workspacePath, options = {} } = request;
  const { maxDepth = 10, excludePatterns = [] } = options;

  // Scan files
  const files = scanDirectory(workspacePath, maxDepth, 0, excludePatterns);

  // Calculate metrics
  const metrics = calculateMetrics(files);

  // Read package.json
  const pkg = readPackageJson(workspacePath);

  // Find config files
  const configFiles = findConfigFiles(workspacePath);

  // Extract dependencies
  const deps = pkg
    ? extractDependencies(pkg.parsed)
    : { production: [], development: [] };

  // Generate file list for LLM analysis
  const fileList = files
    .map(
      (f) =>
        `${f.path.replace(workspacePath, "")} (${f.language}, ${f.lines} lines)`,
    )
    .slice(0, 200) // Limit for context window
    .join("\n");

  // Call LLM for analysis
  const analysisPrompt = generateAnalysisPrompt(
    fileList,
    pkg?.content || null,
    configFiles,
  );

  const responseText = await callLLM({
    model: DEFAULT_MODEL,
    max_tokens: 4096,
    system: CODEBASE_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: analysisPrompt }],
  });

  let analysisData: Record<string, unknown> = {};
  try {
    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      analysisData = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
    }
  } catch (_err) {
    // Use defaults if parsing fails
  }

  const techStack =
    (analysisData.techStack as TechStackItem[] | undefined) ?? [];
  const archRaw = analysisData.architecture as
    | { pattern?: string; confidence?: number; indicators?: string[] }
    | undefined;
  const componentsRaw =
    (analysisData.components as
      | Array<{
          name?: string;
          type?: string;
          path?: string;
          description?: string;
        }>
      | undefined) ?? [];
  const entryPoints = (analysisData.entryPoints as string[] | undefined) ?? [];
  const recommendations =
    (analysisData.recommendations as string[] | undefined) ?? [];

  const projectName =
    pkg?.parsed && typeof pkg.parsed === "object" && "name" in pkg.parsed
      ? String(
          (pkg.parsed as { name?: unknown }).name ||
            path.basename(workspacePath),
        )
      : path.basename(workspacePath);
  const result: CodebaseAnalysisResult = {
    projectName,
    projectPath: workspacePath,
    analyzedAt: new Date().toISOString(),
    summary:
      typeof analysisData.summary === "string"
        ? analysisData.summary
        : "Analysis complete",
    projectType:
      typeof analysisData.projectType === "string"
        ? analysisData.projectType
        : "Unknown",
    techStack,
    frameworks: techStack
      .filter((t) => t.category === "framework")
      .map((t) => t.name),
    languages: Object.keys(metrics.languages),
    architecture: {
      pattern: {
        pattern:
          (archRaw?.pattern as ArchitecturePattern["pattern"]) ?? "unknown",
        confidence:
          typeof archRaw?.confidence === "number" ? archRaw.confidence : 0,
        indicators: Array.isArray(archRaw?.indicators)
          ? archRaw.indicators
          : [],
      },
      components: componentsRaw.map((c) => ({
        name: c.name ?? "",
        type: (c.type as ArchitectureComponent["type"]) ?? "library",
        path: c.path ?? "",
        description: c.description ?? "",
        dependencies: [],
        exports: [],
        complexity: "medium" as const,
      })),
      entryPoints,
      layers: [],
    },
    metrics,
    dependencies: {
      production: deps.production,
      development: deps.development,
      total: deps.production.length + deps.development.length,
    },
    codeSmells: [],
    recommendations,
  };

  return result;
}

/**
 * Generate architecture diagram
 *
 * Returns both the Mermaid diagram and a short summary so callers
 * (frontend, API) can display context alongside the diagram.
 */
export async function generateArchitectureDiagram(
  request: ArchitectureDiagramRequest,
): Promise<{ mermaidDiagram: string; summary: string; diagramType: string }> {
  const { workspacePath, diagramType = "component" } = request;

  // First, get a quick analysis so we have a summary + components
  const analysis = await analyzeCodebase({
    workspacePath,
    options: { analysisDepth: "quick" },
  });

  // Generate diagram prompt
  const componentsStr = analysis.architecture.components
    .map((c) => `- ${c.name} (${c.type}): ${c.description}`)
    .join("\n");

  const diagramPrompt = generateArchitectureDiagramPrompt(
    analysis.summary,
    diagramType,
    componentsStr,
  );

  const responseText = await callLLM({
    model: DEFAULT_MODEL,
    max_tokens: 2048,
    system: CODEBASE_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: diagramPrompt }],
  });

  // Extract Mermaid diagram (fallback to empty string if not found)
  const mermaidMatch = responseText.match(/```mermaid\n?([\s\S]*?)\n?```/);
  const mermaidDiagram = mermaidMatch ? mermaidMatch[1].trim() : "";

  return {
    mermaidDiagram,
    summary: analysis.summary,
    diagramType,
  };
}

/**
 * Analyze dependencies
 */
export async function analyzeDependencies(
  request: DependencyGraphRequest,
): Promise<{
  error?: string;
  dependencies?: DependencyInfo[];
  raw?: string;
  [key: string]: unknown;
}> {
  const { workspacePath, includeDevDeps = true } = request;

  const pkg = readPackageJson(workspacePath);
  if (!pkg) {
    return { error: "No package.json found" };
  }

  const deps = extractDependencies(pkg.parsed);
  const allDeps = includeDevDeps
    ? [...deps.production, ...deps.development]
    : deps.production;

  const depsStr = allDeps
    .map((d) => `${d.name}@${d.version} (${d.type})`)
    .join("\n");

  // Read lock file if exists
  let lockfile: string | null = null;
  const lockPath = path.join(workspacePath, "package-lock.json");
  if (fs.existsSync(lockPath)) {
    try {
      lockfile = fs.readFileSync(lockPath, "utf-8");
    } catch (_err) {
      // Ignore
    }
  }

  const analysisPrompt = generateDependencyAnalysisPrompt(depsStr, lockfile);

  const responseText = await callLLM({
    model: DEFAULT_MODEL,
    max_tokens: 2048,
    system: CODEBASE_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: analysisPrompt }],
  });

  try {
    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
  } catch (_err) {
    // Return raw response
  }

  return {
    dependencies: allDeps,
    raw: responseText,
  };
}

/**
 * Get code metrics
 */
export async function getCodeMetrics(
  request: MetricsRequest,
): Promise<CodeMetrics> {
  const { workspacePath } = request;
  const files = scanDirectory(workspacePath);
  return calculateMetrics(files);
}

/**
 * Detect code smells
 */
export async function detectCodeSmells(
  workspacePath: string,
): Promise<CodeSmell[]> {
  const files = scanDirectory(workspacePath);
  const smells: CodeSmell[] = [];

  // Check for large files
  for (const file of files) {
    if (file.lines > 500) {
      smells.push({
        type: "large-file",
        severity: file.lines > 1000 ? "error" : "warning",
        file: file.path,
        description: `File has ${file.lines} lines, which is quite large`,
        suggestion: "Consider splitting into smaller modules",
      });
    }
  }

  // Sample some files for deeper analysis with LLM
  const sampleFiles = files
    .filter((f) => [".ts", ".js", ".py", ".go"].includes(f.extension))
    .slice(0, 5);

  if (sampleFiles.length > 0) {
    const snippets = sampleFiles
      .map((f) => {
        try {
          const content = fs.readFileSync(f.path, "utf-8");
          return `## ${f.path}\n\`\`\`${f.language.toLowerCase()}\n${content.substring(0, 2000)}\n\`\`\``;
        } catch (_err) {
          return "";
        }
      })
      .filter(Boolean)
      .join("\n\n");

    if (snippets) {
      const prompt = generateCodeSmellsPrompt(snippets);

      const responseText = await callLLM({
        model: DEFAULT_MODEL,
        max_tokens: 2048,
        system: CODEBASE_ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });

      try {
        const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[1]);
          smells.push(...(data.codeSmells || []));
        }
      } catch (_err) {
        // Continue with basic smells
      }
    }
  }

  return smells;
}
