/**
 * Core types for the enhanced compiler system
 */

// EnrichedIntent type definition (mirrored from backend)
export interface CodePattern {
  pattern: string;
  description: string;
  applicability: 'high' | 'medium' | 'low';
}

export interface OptimizationOpportunity {
  area: 'performance' | 'security' | 'scalability' | 'maintainability';
  suggestion: string;
  impact: 'high' | 'medium' | 'low';
}

export interface CodeQualityRequirements {
  type_safety?: 'strict' | 'moderate' | 'loose';
  testing?: {
    unit?: boolean;
    integration?: boolean;
    e2e?: boolean;
    coverage_target?: number;
  };
  documentation?: string[];
  performance?: {
    response_time_ms?: number;
    throughput_rps?: number;
  };
  security?: string[];
}

export interface AmbiguityAnalysis {
  score: number;
  reason: string;
  clarification_questions: string[];
}

export interface EnrichedIntent {
  actors: string[];
  features: string[];
  data_flows: string[];
  tech_stack_hints: string[];
  constraints: Record<string, unknown>;
  raw: string;
  enriched?: {
    reasoning?: string;
    ambiguity_analysis?: AmbiguityAnalysis;
    features?: string[];
    users?: string[];
    data_flows?: string[];
    tech_stack?: string[];
    code_patterns?: string[];
    architecture_hints?: CodePattern[];
    optimization_opportunities?: OptimizationOpportunity[];
    code_quality_requirements?: CodeQualityRequirements;
  };
}

/** Compiler configuration options */
export interface CompilerConfig {
  /** Enable incremental compilation */
  incremental?: boolean;
  /** Enable watch mode */
  watch?: boolean;
  /** Enable bundle analysis */
  analyze?: boolean;
  /** Enable parallel processing */
  parallel?: boolean;
  /** Number of worker threads (defaults to CPU count) */
  workers?: number;
  /** Enable dead code elimination */
  dce?: boolean;
  /** Enable source map generation */
  sourceMaps?: boolean | 'inline' | 'hidden';
  /** Enable hot reload */
  hotReload?: boolean;
  /** Hot reload port */
  hotReloadPort?: number;
  /** Output directory */
  outDir?: string;
  /** Cache directory */
  cacheDir?: string;
  /** Entry points */
  entry?: string | string[];
  /** Transform plugins */
  plugins?: TransformPlugin[];
  /** External dependencies */
  external?: string[];
  /** Target environment */
  target?: 'es2020' | 'es2022' | 'node20';
  /** Minify output */
  minify?: boolean;
  /** Tree shake */
  treeShake?: boolean;
}

/** Compilation result */
export interface CompileResult {
  /** Success status */
  success: boolean;
  /** Output files */
  outputs: OutputFile[];
  /** Compilation time in ms */
  duration: number;
  /** File count */
  fileCount: number;
  /** Total size in bytes */
  totalSize: number;
  /** Warnings */
  warnings: string[];
  /** Errors */
  errors: string[];
  /** Bundle analysis (if enabled) */
  analysis?: BundleAnalysis;
  /** Source map info (if enabled) */
  sourceMaps?: SourceMapInfo[];
}

/** Output file */
export interface OutputFile {
  /** File path */
  path: string;
  /** File content */
  content: string | Buffer;
  /** Size in bytes */
  size: number;
  /** Source map path (if applicable) */
  sourceMapPath?: string;
}

/** File hash entry for incremental compilation */
export interface FileHashEntry {
  /** File path */
  path: string;
  /** xxhash64 of file content */
  hash: string;
  /** Last modified time */
  mtime: number;
  /** File size */
  size: number;
}

/** Dependency graph node */
export interface DependencyNode {
  /** File path */
  path: string;
  /** Direct dependencies */
  dependencies: string[];
  /** Dependents (files that import this) */
  dependents: string[];
  /** Hash at time of compilation */
  hash: string;
  /** Compilation output hash */
  outputHash: string;
  /** Intent metadata */
  intent?: EnrichedIntent;
}

/** Cache entry */
export interface CacheEntry {
  /** Input file hash */
  inputHash: string;
  /** Output content */
  output: string;
  /** Output hash for validation */
  outputHash: string;
  /** Dependencies at time of compilation */
  dependencies: string[];
  /** Timestamp */
  timestamp: number;
  /** Intent metadata */
  intent?: EnrichedIntent;
}

/** Transform hook context */
export interface TransformContext {
  /** File path */
  filePath: string;
  /** File content */
  content: string;
  /** Source map (if available) */
  sourceMap?: SourceMap;
  /** Intent metadata (if parsed) */
  intent?: EnrichedIntent;
  /** Compiler configuration */
  config: CompilerConfig;
}

/** Transform plugin */
export interface TransformPlugin {
  /** Plugin name */
  name: string;
  /** Pre-parse transform */
  preParse?(context: TransformContext): TransformResult | Promise<TransformResult>;
  /** Post-parse transform */
  postParse?(context: TransformContext & { ast: unknown }): TransformResult | Promise<TransformResult>;
  /** Pre-compile transform */
  preCompile?(context: TransformContext): TransformResult | Promise<TransformResult>;
  /** Post-compile transform */
  postCompile?(context: TransformContext & { output: string }): TransformResult | Promise<TransformResult>;
}

/** Transform result */
export interface TransformResult {
  /** Transformed content */
  content: string;
  /** Transformed AST (for postParse transforms) */
  ast?: unknown;
  /** Updated source map (if applicable) */
  sourceMap?: SourceMap;
  /** Whether the transform made changes */
  changed: boolean;
  /** Any errors from transform */
  errors?: string[];
  /** Any warnings from transform */
  warnings?: string[];
}

/** Source map */
export interface SourceMap {
  /** Version */
  version: number;
  /** Source file */
  sources: string[];
  /** Source content */
  sourcesContent?: string[];
  /** Mappings */
  mappings: string;
  /** Names */
  names: string[];
}

/** Source map info */
export interface SourceMapInfo {
  /** Source file path */
  sourcePath: string;
  /** Output file path */
  outputPath: string;
  /** Source map file path */
  mapPath: string;
}

/** Bundle analysis result */
export interface BundleAnalysis {
  /** Total size in bytes */
  totalSize: number;
  /** Gzipped size estimate */
  gzippedSize: number;
  /** Intent breakdowns */
  intents: IntentAnalysis[];
  /** Dependencies breakdown */
  dependencies: DependencyAnalysis[];
  /** Treemap data for visualization */
  treemap: TreemapNode;
}

/** Intent analysis */
export interface IntentAnalysis {
  /** Intent ID */
  id: string;
  /** Intent name */
  name: string;
  /** Size in bytes */
  size: number;
  /** Percentage of total bundle */
  percentage: number;
  /** Features count */
  featureCount: number;
  /** Files */
  files: string[];
}

/** Dependency analysis */
export interface DependencyAnalysis {
  /** Package name */
  name: string;
  /** Size in bytes */
  size: number;
  /** Is dev dependency */
  isDev: boolean;
  /** Files from this dependency */
  files: string[];
}

/** Treemap node */
export interface TreemapNode {
  /** Node name */
  name: string;
  /** Node value (size) */
  value?: number;
  /** Children nodes */
  children?: TreemapNode[];
}

/** Dead code elimination result */
export interface DCEResult {
  /** Files processed */
  filesProcessed: number;
  /** Code removed in bytes */
  bytesRemoved: number;
  /** Unused exports identified */
  unusedExports: string[];
  /** Used exports */
  usedExports: string[];
}

/** Worker task */
export interface WorkerTask {
  /** Task ID */
  id: string;
  /** File path */
  filePath: string;
  /** File content */
  content: string;
  /** Dependencies to resolve */
  dependencies?: string[];
}

/** Worker result */
export interface WorkerResult {
  /** Task ID */
  taskId: string;
  /** Success status */
  success: boolean;
  /** Output */
  output?: string;
  /** Error message */
  error?: string;
  /** Dependencies found */
  dependencies?: string[];
  /** Duration in ms */
  duration: number;
}

/** Watch event */
export interface WatchEvent {
  /** Event type */
  type: 'add' | 'change' | 'unlink';
  /** File path */
  path: string;
  /** Stats (if available) */
  stats?: {
    size: number;
    mtime: Date;
  };
}

/** Hot reload message */
export interface HotReloadMessage {
  /** Message type */
  type: 'reload' | 'update' | 'error' | 'connected';
  /** Update ID */
  updateId?: string;
  /** Changed files */
  changedFiles?: string[];
  /** Error info */
  error?: {
    message: string;
    stack?: string;
  };
  /** Timestamp */
  timestamp: number;
}
