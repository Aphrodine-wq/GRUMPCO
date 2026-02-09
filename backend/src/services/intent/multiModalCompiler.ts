/**
 * Multi-Modal Compiler Service
 *
 * Intelligently combines different content types (code, docs, tests) into
 * unified context with weighted relevance by content type and cross-references.
 *
 * Key Features:
 * 1. Content Type Detection - Automatically classifies content modality
 * 2. Weighted Relevance - Different weights for code vs docs vs tests
 * 3. Cross-Reference Detection - Links code to its tests and docs
 * 4. Modality Balancing - Ensures balanced representation in context
 * 5. Intent-Aware Weighting - Adjusts weights based on user intent
 *
 * @module services/multiModalCompiler
 */

import { EventEmitter } from "events";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Content modality types
 */
export type ContentModality =
  | "code" // Source code files
  | "test" // Test files
  | "docs" // Documentation (README, docs/, etc.)
  | "config" // Configuration files
  | "types" // Type definitions
  | "api" // API definitions (OpenAPI, GraphQL, etc.)
  | "data" // Data files (JSON, YAML, etc.)
  | "style" // Style files (CSS, SCSS, etc.)
  | "unknown"; // Unclassified

/**
 * A multi-modal unit representing content with its modality
 */
export interface MultiModalUnit {
  id: string;
  filePath: string;
  modality: ContentModality;

  // Content at different levels
  content: {
    abstract: string; // 1-2 sentence summary
    summary: string; // Paragraph summary
    detailed: string; // Full content (truncated if large)
    source?: string; // Original source
  };

  // Cross-references to related content
  crossRefs: CrossReference[];

  // Metadata
  meta: {
    language?: string;
    framework?: string;
    size: number; // Bytes
    tokenCount: number;
    importance: number; // Base importance 0-1
    lastModified?: string;
  };

  // Embedding for similarity search
  embedding?: number[];
}

/**
 * Cross-reference between content units
 */
export interface CrossReference {
  targetId: string;
  targetPath: string;
  type: CrossRefType;
  strength: number; // 0-1, how strong is the relationship
  bidirectional: boolean;
}

export type CrossRefType =
  | "tests" // This code is tested by target
  | "tested_by" // This test tests target
  | "documents" // This doc documents target
  | "documented_by" // This code is documented by target
  | "imports" // This file imports target
  | "imported_by" // This file is imported by target
  | "implements" // This implements interface in target
  | "extends" // This extends class in target
  | "configures" // This config configures target
  | "types_for" // This type file provides types for target
  | "styles"; // This style file styles target

/**
 * User intent for weight adjustment
 */
export type UserIntent =
  | "understand" // User wants to understand code
  | "implement" // User wants to implement something
  | "debug" // User is debugging
  | "test" // User is writing tests
  | "document" // User is writing docs
  | "refactor" // User is refactoring
  | "review" // User is reviewing code
  | "configure"; // User is configuring

/**
 * Modality weights configuration
 */
export interface ModalityWeights {
  code: number;
  test: number;
  docs: number;
  config: number;
  types: number;
  api: number;
  data: number;
  style: number;
  unknown: number;
}

/**
 * Multi-modal compilation request
 */
export interface MultiModalRequest {
  query: string;
  intent?: UserIntent;

  // Which modalities to include
  modalities?: ContentModality[];

  // Custom weights (override defaults)
  weights?: Partial<ModalityWeights>;

  // Constraints
  constraints: {
    maxTokens: number;
    maxUnitsPerModality?: number;
    minCrossRefStrength?: number;
  };

  // Options
  options?: {
    includeCrossRefs?: boolean;
    balanceModalities?: boolean;
    preferRecent?: boolean;
  };
}

/**
 * Multi-modal compilation result
 */
export interface MultiModalResult {
  id: string;

  // Compiled context organized by modality
  compiledContext: string;

  // Breakdown by modality
  modalityBreakdown: Array<{
    modality: ContentModality;
    unitCount: number;
    tokenCount: number;
    percentage: number;
  }>;

  // Included units with their effective weights
  includedUnits: Array<{
    id: string;
    filePath: string;
    modality: ContentModality;
    baseWeight: number;
    intentBoost: number;
    crossRefBoost: number;
    finalWeight: number;
    tokenCount: number;
  }>;

  // Cross-references found
  crossReferences: Array<{
    sourceId: string;
    targetId: string;
    type: CrossRefType;
    strength: number;
  }>;

  // Statistics
  stats: {
    totalUnits: number;
    totalTokens: number;
    modalitiesIncluded: number;
    crossRefsFound: number;
    compilationTimeMs: number;
  };
}

/**
 * Multi-modal compiler configuration
 */
export interface MultiModalConfig {
  // Default weights by modality
  defaultWeights: ModalityWeights;

  // Intent-based weight modifiers
  intentModifiers: Record<UserIntent, Partial<ModalityWeights>>;

  // Cross-reference settings
  crossRefBoostFactor: number; // How much cross-refs boost relevance
  minCrossRefStrength: number; // Minimum strength to consider

  // Balancing
  enableBalancing: boolean;
  maxModalityPercentage: number; // Max % of tokens for single modality
  minModalityPercentage: number; // Min % if modality is included

  // File patterns for modality detection
  modalityPatterns: Record<ContentModality, RegExp[]>;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_MODALITY_WEIGHTS: ModalityWeights = {
  code: 1.0,
  test: 0.7,
  docs: 0.8,
  config: 0.5,
  types: 0.9,
  api: 0.85,
  data: 0.4,
  style: 0.3,
  unknown: 0.2,
};

export const INTENT_MODIFIERS: Record<UserIntent, Partial<ModalityWeights>> = {
  understand: { docs: 1.2, code: 1.0, types: 1.1 },
  implement: { code: 1.2, types: 1.1, api: 1.0 },
  debug: { code: 1.3, test: 1.1, config: 0.8 },
  test: { test: 1.5, code: 1.0, types: 0.9 },
  document: { docs: 1.3, code: 0.9, api: 1.1 },
  refactor: { code: 1.2, test: 1.0, types: 1.1 },
  review: { code: 1.1, test: 1.0, docs: 0.9 },
  configure: { config: 1.5, docs: 1.0, code: 0.7 },
};

export const MODALITY_PATTERNS: Record<ContentModality, RegExp[]> = {
  code: [/\.(ts|js|tsx|jsx|py|go|rs|java|cpp|c|cs|rb|php|swift|kt)$/i],
  test: [
    /\.(test|spec)\.(ts|js|tsx|jsx|py)$/i,
    /\/__tests__\//i,
    /\/test\//i,
    /\.test$/i,
    /_test\.(go|py)$/i,
  ],
  docs: [
    /README\.md$/i,
    /CHANGELOG\.md$/i,
    /CONTRIBUTING\.md$/i,
    /\.md$/i,
    /\/docs?\//i,
    /\.rst$/i,
    /\.adoc$/i,
  ],
  config: [
    /\.(json|yaml|yml|toml|ini|env)$/i,
    /config\./i,
    /\.config\.(ts|js)$/i,
    /tsconfig\.json$/i,
    /package\.json$/i,
    /\.eslintrc/i,
    /\.prettierrc/i,
    /vite\.config/i,
    /webpack\.config/i,
  ],
  types: [
    /\.d\.ts$/i,
    /types\.(ts|js)$/i,
    /\/types\//i,
    /interfaces\.(ts|js)$/i,
    /\.pyi$/i,
  ],
  api: [
    /openapi\.(json|yaml|yml)$/i,
    /swagger\.(json|yaml|yml)$/i,
    /\.graphql$/i,
    /schema\.(graphql|gql)$/i,
    /\/api\//i,
    /routes\.(ts|js)$/i,
  ],
  data: [/\.json$/i, /\.csv$/i, /\.xml$/i, /fixtures\//i, /seeds?\//i, /mock/i],
  style: [
    /\.css$/i,
    /\.scss$/i,
    /\.sass$/i,
    /\.less$/i,
    /\.styl$/i,
    /tailwind/i,
  ],
  unknown: [],
};

export const DEFAULT_MULTIMODAL_CONFIG: MultiModalConfig = {
  defaultWeights: DEFAULT_MODALITY_WEIGHTS,
  intentModifiers: INTENT_MODIFIERS,
  crossRefBoostFactor: 0.3,
  minCrossRefStrength: 0.3,
  enableBalancing: true,
  maxModalityPercentage: 0.6,
  minModalityPercentage: 0.1,
  modalityPatterns: MODALITY_PATTERNS,
};

// ============================================================================
// MULTI-MODAL COMPILER SERVICE
// ============================================================================

export class MultiModalCompilerService extends EventEmitter {
  private config: MultiModalConfig;
  private units: Map<string, MultiModalUnit> = new Map();
  private crossRefIndex: Map<string, CrossReference[]> = new Map();

  // Metrics
  private metrics = {
    compilations: 0,
    unitsProcessed: 0,
    crossRefsDetected: 0,
    avgModalityBalance: 0,
  };

  constructor(config: Partial<MultiModalConfig> = {}) {
    super();
    this.config = { ...DEFAULT_MULTIMODAL_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // MODALITY DETECTION
  // --------------------------------------------------------------------------

  /**
   * Detect content modality from file path and content
   */
  detectModality(filePath: string, content?: string): ContentModality {
    // Check patterns in order of specificity
    const checkOrder: ContentModality[] = [
      "test", // Check test first (often matches code patterns too)
      "types", // Type files before general code
      "api", // API definitions
      "config", // Config files
      "docs", // Documentation
      "style", // Style files
      "data", // Data files
      "code", // General code last
    ];

    for (const modality of checkOrder) {
      const patterns = this.config.modalityPatterns[modality];
      for (const pattern of patterns) {
        if (pattern.test(filePath)) {
          return modality;
        }
      }
    }

    // Content-based detection for ambiguous cases
    if (content) {
      return this.detectModalityFromContent(content, filePath);
    }

    return "unknown";
  }

  /**
   * Detect modality from content analysis
   */
  private detectModalityFromContent(
    content: string,
    filePath: string,
  ): ContentModality {
    const lower = content.toLowerCase();

    // Test indicators
    if (
      lower.includes("describe(") ||
      lower.includes("it(") ||
      lower.includes("test(") ||
      lower.includes("@test") ||
      lower.includes("assert") ||
      lower.includes("expect(")
    ) {
      return "test";
    }

    // Documentation indicators
    if (
      filePath.endsWith(".md") ||
      (lower.includes("## ") && lower.includes("# "))
    ) {
      return "docs";
    }

    // Type definition indicators
    if (
      lower.includes("interface ") ||
      lower.includes("type ") ||
      lower.includes("declare ")
    ) {
      return "types";
    }

    // API indicators
    if (
      lower.includes("router.") ||
      lower.includes("@route") ||
      lower.includes("endpoint") ||
      lower.includes("openapi")
    ) {
      return "api";
    }

    // Config indicators
    if (lower.includes('"name":') && lower.includes('"version":')) {
      return "config";
    }

    // Default to code if it looks like code
    if (
      lower.includes("function ") ||
      lower.includes("class ") ||
      lower.includes("import ") ||
      lower.includes("export ")
    ) {
      return "code";
    }

    return "unknown";
  }

  // --------------------------------------------------------------------------
  // CROSS-REFERENCE DETECTION
  // --------------------------------------------------------------------------

  /**
   * Detect cross-references between units
   */
  detectCrossReferences(
    unit: MultiModalUnit,
    allUnits: MultiModalUnit[],
  ): CrossReference[] {
    const refs: CrossReference[] = [];
    const content = unit.content.source || unit.content.detailed;

    for (const other of allUnits) {
      if (other.id === unit.id) continue;

      // Check for various relationship types
      const relationships = this.findRelationships(unit, other, content);
      refs.push(...relationships);
    }

    return refs;
  }

  /**
   * Find relationships between two units
   */
  private findRelationships(
    source: MultiModalUnit,
    target: MultiModalUnit,
    sourceContent: string,
  ): CrossReference[] {
    const refs: CrossReference[] = [];

    // Test ↔ Code relationship
    if (source.modality === "test" && target.modality === "code") {
      const strength = this.calculateTestCodeStrength(
        source,
        target,
        sourceContent,
      );
      if (strength >= this.config.minCrossRefStrength) {
        refs.push({
          targetId: target.id,
          targetPath: target.filePath,
          type: "tested_by",
          strength,
          bidirectional: true,
        });
      }
    }

    if (source.modality === "code" && target.modality === "test") {
      const strength = this.calculateTestCodeStrength(
        target,
        source,
        target.content.source || "",
      );
      if (strength >= this.config.minCrossRefStrength) {
        refs.push({
          targetId: target.id,
          targetPath: target.filePath,
          type: "tests",
          strength,
          bidirectional: true,
        });
      }
    }

    // Docs ↔ Code relationship
    if (source.modality === "docs" && target.modality === "code") {
      const strength = this.calculateDocsCodeStrength(source, target);
      if (strength >= this.config.minCrossRefStrength) {
        refs.push({
          targetId: target.id,
          targetPath: target.filePath,
          type: "documents",
          strength,
          bidirectional: true,
        });
      }
    }

    // Import relationships
    if (this.hasImport(sourceContent, target.filePath)) {
      refs.push({
        targetId: target.id,
        targetPath: target.filePath,
        type: "imports",
        strength: 0.8,
        bidirectional: true,
      });
    }

    // Types ↔ Code relationship
    if (source.modality === "types" && target.modality === "code") {
      if (this.isTypesFor(source, target)) {
        refs.push({
          targetId: target.id,
          targetPath: target.filePath,
          type: "types_for",
          strength: 0.9,
          bidirectional: true,
        });
      }
    }

    // Config ↔ Code relationship
    if (source.modality === "config") {
      const configRefs = this.findConfigRelationships(source, target);
      refs.push(...configRefs);
    }

    return refs;
  }

  /**
   * Calculate relationship strength between test and code
   */
  private calculateTestCodeStrength(
    test: MultiModalUnit,
    code: MultiModalUnit,
    testContent: string,
  ): number {
    let strength = 0;

    // Same directory structure (e.g., src/foo.ts and tests/foo.test.ts)
    const testBase = test.filePath.replace(
      /\.(test|spec)\.(ts|js|tsx|jsx)$/i,
      "",
    );
    const codeBase = code.filePath.replace(/\.(ts|js|tsx|jsx)$/i, "");

    if (testBase.includes(codeBase.split("/").pop() || "")) {
      strength += 0.5;
    }

    // Test imports the code file
    if (this.hasImport(testContent, code.filePath)) {
      strength += 0.4;
    }

    // Test mentions code file name or exports
    const codeFileName =
      code.filePath
        .split("/")
        .pop()
        ?.replace(/\.\w+$/, "") || "";
    if (testContent.toLowerCase().includes(codeFileName.toLowerCase())) {
      strength += 0.2;
    }

    return Math.min(1, strength);
  }

  /**
   * Calculate relationship strength between docs and code
   */
  private calculateDocsCodeStrength(
    docs: MultiModalUnit,
    code: MultiModalUnit,
  ): number {
    let strength = 0;
    const docsContent = (
      docs.content.source || docs.content.detailed
    ).toLowerCase();

    // Docs in same directory
    const docsDir = docs.filePath.split("/").slice(0, -1).join("/");
    const codeDir = code.filePath.split("/").slice(0, -1).join("/");
    if (docsDir === codeDir) {
      strength += 0.3;
    }

    // Docs mentions code file
    const codeFileName = code.filePath.split("/").pop() || "";
    if (docsContent.includes(codeFileName.toLowerCase())) {
      strength += 0.4;
    }

    // Docs has code blocks with similar patterns
    if (
      docsContent.includes("```") &&
      docsContent.includes(code.meta.language || "unknown")
    ) {
      strength += 0.2;
    }

    return Math.min(1, strength);
  }

  /**
   * Check if content imports a file
   */
  private hasImport(content: string, targetPath: string): boolean {
    // Extract filename without extension
    const fileName =
      targetPath
        .split("/")
        .pop()
        ?.replace(/\.\w+$/, "") || "";

    // Various import patterns
    const patterns = [
      new RegExp(`from\\s+['"](.*${fileName})['"']`, "i"),
      new RegExp(`import\\s+['"](.*${fileName})['"']`, "i"),
      new RegExp(`require\\(['"](.*${fileName})['"]\\)`, "i"),
    ];

    return patterns.some((p) => p.test(content));
  }

  /**
   * Check if types file provides types for code
   */
  private isTypesFor(types: MultiModalUnit, code: MultiModalUnit): boolean {
    // Same base name (e.g., foo.d.ts for foo.ts)
    const typesBase = types.filePath
      .replace(/\.d\.ts$/i, "")
      .replace(/\/types\//i, "/");
    const codeBase = code.filePath.replace(/\.(ts|js)$/i, "");

    return typesBase.includes(codeBase.split("/").pop() || "___");
  }

  /**
   * Find config relationships
   */
  private findConfigRelationships(
    config: MultiModalUnit,
    target: MultiModalUnit,
  ): CrossReference[] {
    const refs: CrossReference[] = [];
    const configContent = config.content.source || config.content.detailed;

    // Config mentions target file
    const targetName = target.filePath.split("/").pop() || "";
    if (configContent.includes(targetName)) {
      refs.push({
        targetId: target.id,
        targetPath: target.filePath,
        type: "configures",
        strength: 0.6,
        bidirectional: true,
      });
    }

    return refs;
  }

  // --------------------------------------------------------------------------
  // UNIT INDEXING
  // --------------------------------------------------------------------------

  /**
   * Index a file as a multi-modal unit
   */
  indexUnit(
    filePath: string,
    content: string,
    options: {
      modality?: ContentModality;
      embedding?: number[];
      importance?: number;
    } = {},
  ): MultiModalUnit {
    const modality = options.modality || this.detectModality(filePath, content);

    const unit: MultiModalUnit = {
      id: `mm_${this.hashString(filePath)}`,
      filePath,
      modality,
      content: {
        abstract: this.generateAbstract(content, modality),
        summary: this.generateSummary(content, modality),
        detailed: content.slice(0, 10000), // Truncate large files
        source: content,
      },
      crossRefs: [],
      meta: {
        language: this.detectLanguage(filePath),
        size: content.length,
        tokenCount: this.estimateTokens(content),
        importance:
          options.importance ??
          this.calculateImportance(filePath, content, modality),
        lastModified: new Date().toISOString(),
      },
      embedding: options.embedding,
    };

    this.units.set(unit.id, unit);
    this.metrics.unitsProcessed++;

    // Detect cross-references with existing units
    if (this.units.size > 1) {
      const allUnits = Array.from(this.units.values());
      unit.crossRefs = this.detectCrossReferences(unit, allUnits);
      this.crossRefIndex.set(unit.id, unit.crossRefs);
      this.metrics.crossRefsDetected += unit.crossRefs.length;
    }

    this.emit("unit_indexed", {
      id: unit.id,
      modality,
      crossRefs: unit.crossRefs.length,
    });

    return unit;
  }

  /**
   * Generate abstract (1-2 sentences) from content
   */
  private generateAbstract(content: string, modality: ContentModality): string {
    const firstLines = content.split("\n").slice(0, 5).join(" ").trim();

    switch (modality) {
      case "code": {
        // Extract first function/class name
        const match = content.match(
          /(?:export\s+)?(?:async\s+)?(?:function|class|const|interface|type)\s+(\w+)/,
        );
        if (match) {
          return `Defines ${match[1]} - ${firstLines.slice(0, 100)}`;
        }
        return firstLines.slice(0, 150);
      }

      case "test": {
        const describeMatch = content.match(/describe\s*\(\s*['"](.+?)['"]/);
        if (describeMatch) {
          return `Tests for ${describeMatch[1]}`;
        }
        return `Test file - ${firstLines.slice(0, 100)}`;
      }

      case "docs": {
        // Get first heading or paragraph
        const headingMatch = content.match(/^#\s+(.+)/m);
        if (headingMatch) {
          return headingMatch[1];
        }
        return firstLines.slice(0, 150);
      }

      default:
        return firstLines.slice(0, 150);
    }
  }

  /**
   * Generate summary (paragraph) from content
   */
  private generateSummary(content: string, modality: ContentModality): string {
    switch (modality) {
      case "code": {
        // Extract exports and main structures
        const exports =
          content.match(
            /export\s+(?:async\s+)?(?:function|class|const|interface|type)\s+(\w+)/g,
          ) || [];
        const structures = exports
          .slice(0, 5)
          .join(", ")
          .replace(/export\s+(async\s+)?/g, "");

        if (structures) {
          return `Exports: ${structures}. ${content.slice(0, 300).replace(/\s+/g, " ")}`;
        }
        return content.slice(0, 500).replace(/\s+/g, " ");
      }

      case "test": {
        // Extract test descriptions
        const describes =
          content.match(/(?:describe|it|test)\s*\(\s*['"](.+?)['"]/g) || [];
        const testNames = describes
          .slice(0, 5)
          .map((d) => d.match(/['"](.+?)['"]/)?.[1] || "")
          .filter(Boolean);
        return `Tests: ${testNames.join(", ") || "various tests"}`;
      }

      case "docs": {
        // Get first few paragraphs
        const paragraphs = content.split(/\n\n+/).slice(0, 3).join(" ");
        return paragraphs.slice(0, 500).replace(/\s+/g, " ");
      }

      default:
        return content.slice(0, 500).replace(/\s+/g, " ");
    }
  }

  /**
   * Detect programming language from file path
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const langMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      py: "python",
      go: "go",
      rs: "rust",
      java: "java",
      cpp: "cpp",
      c: "c",
      cs: "csharp",
      rb: "ruby",
      php: "php",
      swift: "swift",
      kt: "kotlin",
      md: "markdown",
      json: "json",
      yaml: "yaml",
      yml: "yaml",
      css: "css",
      scss: "scss",
    };
    return langMap[ext] || ext;
  }

  /**
   * Calculate importance of a unit
   */
  private calculateImportance(
    filePath: string,
    content: string,
    modality: ContentModality,
  ): number {
    let importance = 0.5;

    // Entry points are important
    if (
      filePath.includes("index.") ||
      filePath.includes("main.") ||
      filePath.includes("app.")
    ) {
      importance += 0.2;
    }

    // Exports increase importance
    const exportCount = (content.match(/export\s+/g) || []).length;
    importance += Math.min(0.2, exportCount * 0.02);

    // READMEs are important
    if (filePath.toLowerCase().includes("readme")) {
      importance += 0.3;
    }

    // Modality base importance
    const modalityBonus: Record<ContentModality, number> = {
      code: 0.1,
      api: 0.1,
      types: 0.05,
      docs: 0.05,
      test: 0,
      config: 0,
      data: -0.1,
      style: -0.1,
      unknown: -0.2,
    };
    importance += modalityBonus[modality] || 0;

    return Math.max(0, Math.min(1, importance));
  }

  // --------------------------------------------------------------------------
  // MULTI-MODAL COMPILATION
  // --------------------------------------------------------------------------

  /**
   * Compile multi-modal context from indexed units
   */
  compile(request: MultiModalRequest): MultiModalResult {
    const startTime = performance.now();
    this.metrics.compilations++;

    // 1. Determine intent and weights
    const intent = request.intent || this.inferIntent(request.query);
    const weights = this.calculateWeights(intent, request.weights);

    // 2. Filter units by requested modalities
    const modalityFilter =
      request.modalities ||
      (Object.keys(DEFAULT_MODALITY_WEIGHTS) as ContentModality[]);
    const candidateUnits = Array.from(this.units.values()).filter((u) =>
      modalityFilter.includes(u.modality),
    );

    // 3. Calculate effective weight for each unit
    const scoredUnits = candidateUnits.map((unit) => {
      const baseWeight = weights[unit.modality];
      const intentBoost = this.calculateIntentBoost(unit, intent);
      const crossRefBoost = this.calculateCrossRefBoost(unit, candidateUnits);
      const relevanceScore = this.calculateRelevance(unit, request.query);

      const finalWeight =
        (baseWeight + intentBoost + crossRefBoost) *
        relevanceScore *
        unit.meta.importance;

      return {
        unit,
        baseWeight,
        intentBoost,
        crossRefBoost,
        relevanceScore,
        finalWeight,
      };
    });

    // 4. Sort by final weight
    scoredUnits.sort((a, b) => b.finalWeight - a.finalWeight);

    // 5. Select units within token budget, respecting modality balance
    const selectedUnits = this.selectBalancedUnits(
      scoredUnits,
      request.constraints.maxTokens,
      request.constraints.maxUnitsPerModality,
      request.options?.balanceModalities !== false,
    );

    // 6. Gather cross-references
    const crossRefs: MultiModalResult["crossReferences"] = [];
    if (request.options?.includeCrossRefs !== false) {
      for (const selected of selectedUnits) {
        for (const ref of selected.unit.crossRefs) {
          if (selectedUnits.some((s) => s.unit.id === ref.targetId)) {
            crossRefs.push({
              sourceId: selected.unit.id,
              targetId: ref.targetId,
              type: ref.type,
              strength: ref.strength,
            });
          }
        }
      }
    }

    // 7. Compile context with modality organization
    const compiledContext = this.formatCompiledContext(
      selectedUnits,
      crossRefs,
    );

    // 8. Calculate modality breakdown
    const modalityBreakdown = this.calculateModalityBreakdown(selectedUnits);

    // 9. Build result
    const result: MultiModalResult = {
      id: `mmc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      compiledContext,
      modalityBreakdown,
      includedUnits: selectedUnits.map((s) => ({
        id: s.unit.id,
        filePath: s.unit.filePath,
        modality: s.unit.modality,
        baseWeight: s.baseWeight,
        intentBoost: s.intentBoost,
        crossRefBoost: s.crossRefBoost,
        finalWeight: s.finalWeight,
        tokenCount: s.unit.meta.tokenCount,
      })),
      crossReferences: crossRefs,
      stats: {
        totalUnits: selectedUnits.length,
        totalTokens: selectedUnits.reduce(
          (sum, s) => sum + s.unit.meta.tokenCount,
          0,
        ),
        modalitiesIncluded: new Set(selectedUnits.map((s) => s.unit.modality))
          .size,
        crossRefsFound: crossRefs.length,
        compilationTimeMs: performance.now() - startTime,
      },
    };

    this.emit("compilation_complete", { id: result.id, stats: result.stats });

    return result;
  }

  /**
   * Infer user intent from query
   */
  private inferIntent(query: string): UserIntent {
    const lower = query.toLowerCase();

    if (lower.match(/\b(debug|error|bug|fix|issue|problem|broken)\b/)) {
      return "debug";
    }
    if (lower.match(/\b(test|spec|coverage|assert|expect)\b/)) {
      return "test";
    }
    if (lower.match(/\b(document|docs|readme|explain|describe)\b/)) {
      return "document";
    }
    if (lower.match(/\b(implement|create|add|build|make|write)\b/)) {
      return "implement";
    }
    if (lower.match(/\b(refactor|clean|improve|optimize|simplify)\b/)) {
      return "refactor";
    }
    if (lower.match(/\b(review|check|audit|analyze)\b/)) {
      return "review";
    }
    if (lower.match(/\b(config|configure|setup|environment|settings)\b/)) {
      return "configure";
    }

    return "understand";
  }

  /**
   * Calculate effective weights based on intent
   */
  private calculateWeights(
    intent: UserIntent,
    customWeights?: Partial<ModalityWeights>,
  ): ModalityWeights {
    const base = { ...this.config.defaultWeights };
    const modifiers = this.config.intentModifiers[intent] || {};

    // Apply intent modifiers
    for (const [modality, modifier] of Object.entries(modifiers)) {
      const key = modality as ContentModality;
      base[key] = base[key] * (modifier || 1);
    }

    // Apply custom overrides
    if (customWeights) {
      Object.assign(base, customWeights);
    }

    return base;
  }

  /**
   * Calculate intent-based boost for a unit
   */
  private calculateIntentBoost(
    unit: MultiModalUnit,
    intent: UserIntent,
  ): number {
    const modifiers = this.config.intentModifiers[intent] || {};
    const modifier = modifiers[unit.modality] || 1;
    return (modifier - 1) * 0.2; // Convert modifier to boost value
  }

  /**
   * Calculate cross-reference boost for a unit
   */
  private calculateCrossRefBoost(
    unit: MultiModalUnit,
    allUnits: MultiModalUnit[],
  ): number {
    if (unit.crossRefs.length === 0) return 0;

    // More cross-refs = more central/important
    const refCount = unit.crossRefs.filter((r) =>
      allUnits.some((u) => u.id === r.targetId),
    ).length;

    return Math.min(0.3, refCount * this.config.crossRefBoostFactor * 0.1);
  }

  /**
   * Calculate relevance of a unit to the query
   */
  private calculateRelevance(unit: MultiModalUnit, query: string): number {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const unitText =
      `${unit.content.abstract} ${unit.content.summary}`.toLowerCase();
    const unitWords = new Set(unitText.split(/\s+/));

    let overlap = 0;
    for (const word of queryWords) {
      if (unitWords.has(word)) overlap++;
    }

    const jaccardSimilarity = overlap / Math.max(1, queryWords.size);

    // File path relevance
    const pathRelevance = queryWords.has(
      unit.filePath
        .split("/")
        .pop()
        ?.replace(/\.\w+$/, "")
        .toLowerCase() || "",
    )
      ? 0.2
      : 0;

    return Math.min(1, 0.5 + jaccardSimilarity + pathRelevance);
  }

  /**
   * Select balanced units within token budget
   */
  private selectBalancedUnits(
    scoredUnits: Array<{
      unit: MultiModalUnit;
      baseWeight: number;
      intentBoost: number;
      crossRefBoost: number;
      finalWeight: number;
    }>,
    maxTokens: number,
    maxPerModality?: number,
    enableBalancing = true,
  ): typeof scoredUnits {
    const selected: typeof scoredUnits = [];
    const modalityCounts = new Map<ContentModality, number>();
    const modalityTokens = new Map<ContentModality, number>();
    let totalTokens = 0;

    for (const scored of scoredUnits) {
      const modality = scored.unit.modality;
      const tokenCost = Math.min(scored.unit.meta.tokenCount, 2000); // Cap per-unit tokens

      // Check total budget
      if (totalTokens + tokenCost > maxTokens) continue;

      // Check per-modality limit
      if (maxPerModality) {
        const count = modalityCounts.get(modality) || 0;
        if (count >= maxPerModality) continue;
      }

      // Check modality balance
      if (enableBalancing) {
        const modalityPct =
          (modalityTokens.get(modality) || 0) / Math.max(1, totalTokens);
        if (
          modalityPct > this.config.maxModalityPercentage &&
          selected.length > 3
        ) {
          continue;
        }
      }

      // Add unit
      selected.push(scored);
      totalTokens += tokenCost;
      modalityCounts.set(modality, (modalityCounts.get(modality) || 0) + 1);
      modalityTokens.set(
        modality,
        (modalityTokens.get(modality) || 0) + tokenCost,
      );
    }

    return selected;
  }

  /**
   * Format compiled context with modality organization
   */
  private formatCompiledContext(
    units: Array<{ unit: MultiModalUnit; finalWeight: number }>,
    crossRefs: MultiModalResult["crossReferences"],
  ): string {
    const sections: string[] = [];

    // Group by modality
    const byModality = new Map<ContentModality, typeof units>();
    for (const u of units) {
      const list = byModality.get(u.unit.modality) || [];
      list.push(u);
      byModality.set(u.unit.modality, list);
    }

    // Format each modality section
    const modalityOrder: ContentModality[] = [
      "code",
      "types",
      "api",
      "test",
      "docs",
      "config",
      "data",
      "style",
      "unknown",
    ];

    for (const modality of modalityOrder) {
      const modalityUnits = byModality.get(modality);
      if (!modalityUnits || modalityUnits.length === 0) continue;

      const header = this.getModalityHeader(modality);
      const content = modalityUnits
        .map((u) => this.formatUnit(u.unit))
        .join("\n\n");

      sections.push(`## ${header}\n\n${content}`);
    }

    // Add cross-reference summary if relevant
    if (crossRefs.length > 0) {
      const refSummary = this.formatCrossRefSummary(crossRefs);
      sections.push(`## Relationships\n\n${refSummary}`);
    }

    return sections.join("\n\n---\n\n");
  }

  /**
   * Get human-readable header for modality
   */
  private getModalityHeader(modality: ContentModality): string {
    const headers: Record<ContentModality, string> = {
      code: "📝 Source Code",
      test: "🧪 Tests",
      docs: "📚 Documentation",
      config: "⚙️ Configuration",
      types: "🔷 Type Definitions",
      api: "🔌 API Definitions",
      data: "📊 Data",
      style: "🎨 Styles",
      unknown: "📄 Other",
    };
    return headers[modality];
  }

  /**
   * Format a single unit for context
   */
  private formatUnit(unit: MultiModalUnit): string {
    const header = `### ${unit.filePath}`;
    const meta = unit.meta.language ? `\`${unit.meta.language}\`` : "";

    // Use summary for context efficiency
    const content = unit.content.summary || unit.content.abstract;

    return `${header} ${meta}\n${content}`;
  }

  /**
   * Format cross-reference summary
   */
  private formatCrossRefSummary(
    crossRefs: MultiModalResult["crossReferences"],
  ): string {
    const grouped = new Map<CrossRefType, string[]>();

    for (const ref of crossRefs) {
      const list = grouped.get(ref.type) || [];
      list.push(`${ref.sourceId} → ${ref.targetId}`);
      grouped.set(ref.type, list);
    }

    const lines: string[] = [];
    for (const [type, refs] of grouped) {
      lines.push(`- **${type}**: ${refs.length} connections`);
    }

    return lines.join("\n");
  }

  /**
   * Calculate modality breakdown
   */
  private calculateModalityBreakdown(
    units: Array<{ unit: MultiModalUnit }>,
  ): MultiModalResult["modalityBreakdown"] {
    const counts = new Map<
      ContentModality,
      { count: number; tokens: number }
    >();
    let totalTokens = 0;

    for (const { unit } of units) {
      const existing = counts.get(unit.modality) || { count: 0, tokens: 0 };
      existing.count++;
      existing.tokens += unit.meta.tokenCount;
      totalTokens += unit.meta.tokenCount;
      counts.set(unit.modality, existing);
    }

    return Array.from(counts.entries()).map(([modality, data]) => ({
      modality,
      unitCount: data.count,
      tokenCount: data.tokens,
      percentage: totalTokens > 0 ? (data.tokens / totalTokens) * 100 : 0,
    }));
  }

  // --------------------------------------------------------------------------
  // UTILITIES
  // --------------------------------------------------------------------------

  /**
   * Estimate tokens in text
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Simple string hash
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // --------------------------------------------------------------------------
  // PUBLIC METHODS
  // --------------------------------------------------------------------------

  /**
   * Get indexed units
   */
  getUnits(): MultiModalUnit[] {
    return Array.from(this.units.values());
  }

  /**
   * Get unit by ID
   */
  getUnit(id: string): MultiModalUnit | undefined {
    return this.units.get(id);
  }

  /**
   * Get units by modality
   */
  getUnitsByModality(modality: ContentModality): MultiModalUnit[] {
    return Array.from(this.units.values()).filter(
      (u) => u.modality === modality,
    );
  }

  /**
   * Get cross-references for a unit
   */
  getCrossRefs(unitId: string): CrossReference[] {
    return this.crossRefIndex.get(unitId) || [];
  }

  /**
   * Get metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Clear all indexed units
   */
  clear(): void {
    this.units.clear();
    this.crossRefIndex.clear();
  }
}

// ============================================================================
// SINGLETON MANAGEMENT
// ============================================================================

const multiModalInstances = new Map<string, MultiModalCompilerService>();

/**
 * Get or create a multi-modal compiler for a session
 */
export function getMultiModalCompiler(
  sessionId: string,
  config?: Partial<MultiModalConfig>,
): MultiModalCompilerService {
  let instance = multiModalInstances.get(sessionId);
  if (!instance) {
    instance = new MultiModalCompilerService(config);
    multiModalInstances.set(sessionId, instance);
  }
  return instance;
}

/**
 * Destroy a multi-modal compiler instance
 */
export function destroyMultiModalCompiler(sessionId: string): void {
  const instance = multiModalInstances.get(sessionId);
  if (instance) {
    instance.clear();
    multiModalInstances.delete(sessionId);
  }
}
