/**
 * Codebase Analysis Feature - Type Definitions
 */

export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  lines: number;
  language: string;
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: "production" | "development" | "peer";
  isOutdated?: boolean;
  vulnerabilities?: number;
}

export interface ArchitectureComponent {
  name: string;
  type:
    | "frontend"
    | "backend"
    | "database"
    | "service"
    | "library"
    | "config"
    | "test";
  path: string;
  description: string;
  dependencies: string[];
  exports: string[];
  complexity: "low" | "medium" | "high";
}

export interface CodeMetrics {
  totalFiles: number;
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  languages: Record<string, { files: number; lines: number }>;
  largestFiles: Array<{ path: string; lines: number }>;
  averageFileSize: number;
}

export interface ArchitecturePattern {
  pattern:
    | "monolith"
    | "microservices"
    | "modular-monolith"
    | "layered"
    | "hexagonal"
    | "event-driven"
    | "unknown";
  confidence: number;
  indicators: string[];
}

export interface TechStackItem {
  category:
    | "framework"
    | "language"
    | "database"
    | "testing"
    | "build"
    | "deployment"
    | "other";
  name: string;
  version?: string;
  configFile?: string;
}

export interface CodeSmell {
  type:
    | "large-file"
    | "deep-nesting"
    | "long-function"
    | "duplicate-code"
    | "god-class"
    | "magic-number"
    | "unused-import";
  severity: "info" | "warning" | "error";
  file: string;
  line?: number;
  description: string;
  suggestion: string;
}

export interface CodebaseAnalysisResult {
  projectName: string;
  projectPath: string;
  analyzedAt: string;

  // Overview
  summary: string;
  projectType: string;

  // Tech Stack
  techStack: TechStackItem[];
  frameworks: string[];
  languages: string[];

  // Architecture
  architecture: {
    pattern: ArchitecturePattern;
    components: ArchitectureComponent[];
    entryPoints: string[];
    layers: string[];
  };

  // Metrics
  metrics: CodeMetrics;

  // Dependencies
  dependencies: {
    production: DependencyInfo[];
    development: DependencyInfo[];
    total: number;
  };

  // Quality
  codeSmells: CodeSmell[];
  recommendations: string[];

  // Generated Diagrams
  mermaidDiagram?: string;
}

export interface AnalysisRequest {
  workspacePath: string;
  options?: {
    includeTests?: boolean;
    maxDepth?: number;
    excludePatterns?: string[];
    analysisDepth?: "quick" | "standard" | "deep";
  };
}

export interface ArchitectureDiagramRequest {
  workspacePath: string;
  diagramType?:
    | "c4-context"
    | "c4-container"
    | "component"
    | "dependency"
    | "flow";
  focusOn?: string;
}

export interface DependencyGraphRequest {
  workspacePath: string;
  includeDevDeps?: boolean;
  showVersions?: boolean;
}

export interface MetricsRequest {
  workspacePath: string;
  groupBy?: "language" | "directory" | "component";
}
