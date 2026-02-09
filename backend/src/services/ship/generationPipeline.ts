/**
 * Multi-Stage Code Generation Pipeline
 *
 * Stages: Intent → Architecture → PRD → Skeleton → Implementation → Validation → Final
 * Each stage has typed input/output and fail-fast error handling
 * Supports retry with degradation
 */

import logger from "../../middleware/logger.js";
import { getRequestLogger } from "../../middleware/logger.js";
import type { StructuredIntent } from "../intent/intentCliRunner.js";
import {
  AstGeneratorService,
  type GeneratedFile,
  CodeGenerationError,
} from "./astGeneratorService.js";
import {
  validateTypeScript,
  type ValidationResult,
} from "./codeValidationService.js";
import { generateCodeFromDiagram } from "../ai-providers/claudeCodeService.js";
import type { FileDefinition } from "../../types/index.js";

// ============================================================================
// Pipeline Types
// ============================================================================

export type PipelineStage =
  | "intent"
  | "architecture"
  | "prd"
  | "skeleton"
  | "implementation"
  | "validation"
  | "final";

export interface PipelineContext {
  /** Original user request */
  request: string;
  /** Extracted intent */
  intent?: StructuredIntent;
  /** Generated architecture (Mermaid) */
  architecture?: string;
  /** Generated PRD */
  prd?: string;
  /** Code skeleton */
  skeleton?: FileDefinition[];
  /** Full implementation */
  implementation?: FileDefinition[];
  /** Validation results */
  validation?: ValidationResult[];
  /** Final output */
  final?: FileDefinition[];
  /** Stage execution history */
  history: StageExecution[];
  /** Metadata */
  metadata: {
    startTime: number;
    techStack?: string;
    projectName?: string;
  };
}

export interface StageExecution {
  stage: PipelineStage;
  status: "success" | "failure" | "skipped";
  durationMs: number;
  error?: string;
  retryCount: number;
}

export interface StageConfig {
  /** Stage name */
  name: PipelineStage;
  /** Execute this stage */
  enabled: boolean;
  /** Retry attempts on failure */
  maxRetries: number;
  /** Degrade to simpler mode on retry */
  degradation: boolean;
  /** Timeout in ms */
  timeoutMs: number;
  /** Skip if this condition is met */
  skipCondition?: (context: PipelineContext) => boolean;
}

export interface PipelineConfig {
  stages: Record<PipelineStage, StageConfig>;
  /** Global timeout */
  globalTimeoutMs: number;
  /** Enable validation between stages */
  validateBetweenStages: boolean;
  /** Stop on first error */
  failFast: boolean;
}

export interface PipelineResult {
  success: boolean;
  context: PipelineContext;
  /** Files generated */
  files: FileDefinition[];
  /** Total execution time */
  durationMs: number;
  /** Errors encountered */
  errors: PipelineError[];
  /** Stage summary */
  stageSummary: Record<PipelineStage, StageSummary>;
}

export interface StageSummary {
  status: "success" | "failure" | "skipped";
  durationMs: number;
  retryCount: number;
}

export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly stage: PipelineStage,
    public readonly cause?: Error,
    public readonly recoverable: boolean = false,
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  stages: {
    intent: {
      name: "intent",
      enabled: true,
      maxRetries: 2,
      degradation: true,
      timeoutMs: 10000,
    },
    architecture: {
      name: "architecture",
      enabled: true,
      maxRetries: 2,
      degradation: true,
      timeoutMs: 15000,
    },
    prd: {
      name: "prd",
      enabled: true,
      maxRetries: 1,
      degradation: true,
      timeoutMs: 20000,
    },
    skeleton: {
      name: "skeleton",
      enabled: true,
      maxRetries: 1,
      degradation: false,
      timeoutMs: 15000,
    },
    implementation: {
      name: "implementation",
      enabled: true,
      maxRetries: 2,
      degradation: true,
      timeoutMs: 60000,
    },
    validation: {
      name: "validation",
      enabled: true,
      maxRetries: 0,
      degradation: false,
      timeoutMs: 30000,
    },
    final: {
      name: "final",
      enabled: true,
      maxRetries: 0,
      degradation: false,
      timeoutMs: 5000,
    },
  },
  globalTimeoutMs: 120000,
  validateBetweenStages: false,
  failFast: true,
};

// ============================================================================
// Pipeline Implementation
// ============================================================================

export class GenerationPipeline {
  private config: PipelineConfig;
  private astService: AstGeneratorService;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
    this.astService = new AstGeneratorService();
  }

  /**
   * Execute the full pipeline
   */
  async execute(
    request: string,
    options?: {
      techStack?: string;
      projectName?: string;
      skipStages?: PipelineStage[];
    },
  ): Promise<PipelineResult> {
    const log = getRequestLogger();
    const startTime = Date.now();

    const context: PipelineContext = {
      request,
      history: [],
      metadata: {
        startTime,
        techStack: options?.techStack,
        projectName: options?.projectName,
      },
    };

    const errors: PipelineError[] = [];
    const stageSummary: Record<PipelineStage, StageSummary> = {} as any;

    try {
      // Stage 1: Intent Extraction
      if (this.shouldRunStage("intent", context, options?.skipStages)) {
        const result = await this.runStage("intent", context, () =>
          this.extractIntent(context),
        );
        stageSummary.intent = result.summary;
        if (result.error) errors.push(result.error);
      }

      // Stage 2: Architecture Generation
      if (this.shouldRunStage("architecture", context, options?.skipStages)) {
        const result = await this.runStage("architecture", context, () =>
          this.generateArchitecture(context),
        );
        stageSummary.architecture = result.summary;
        if (result.error) errors.push(result.error);
      }

      // Stage 3: PRD Generation
      if (this.shouldRunStage("prd", context, options?.skipStages)) {
        const result = await this.runStage("prd", context, () =>
          this.generatePRD(context),
        );
        stageSummary.prd = result.summary;
        if (result.error) errors.push(result.error);
      }

      // Stage 4: Skeleton Generation
      if (this.shouldRunStage("skeleton", context, options?.skipStages)) {
        const result = await this.runStage("skeleton", context, () =>
          this.generateSkeleton(context),
        );
        stageSummary.skeleton = result.summary;
        if (result.error) errors.push(result.error);
      }

      // Stage 5: Implementation
      if (this.shouldRunStage("implementation", context, options?.skipStages)) {
        const result = await this.runStage("implementation", context, () =>
          this.generateImplementation(context),
        );
        stageSummary.implementation = result.summary;
        if (result.error) errors.push(result.error);
      }

      // Stage 6: Validation
      if (this.shouldRunStage("validation", context, options?.skipStages)) {
        const result = await this.runStage("validation", context, () =>
          this.validate(context),
        );
        stageSummary.validation = result.summary;
        if (result.error) errors.push(result.error);
      }

      // Stage 7: Finalization
      if (this.shouldRunStage("final", context, options?.skipStages)) {
        const result = await this.runStage("final", context, () =>
          this.finalize(context),
        );
        stageSummary.final = result.summary;
        if (result.error) errors.push(result.error);
      }

      const durationMs = Date.now() - startTime;

      log.info(
        {
          durationMs,
          stages: Object.keys(stageSummary),
          errors: errors.length,
        },
        "Pipeline completed",
      );

      return {
        success: errors.length === 0,
        context,
        files: context.final || context.implementation || [],
        durationMs,
        errors,
        stageSummary,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      log.error({ error }, "Pipeline failed");

      return {
        success: false,
        context,
        files: [],
        durationMs,
        errors: [
          ...errors,
          new PipelineError(
            "Pipeline execution failed",
            "final",
            error as Error,
          ),
        ],
        stageSummary,
      };
    }
  }

  /**
   * Check if a stage should run
   */
  private shouldRunStage(
    stage: PipelineStage,
    context: PipelineContext,
    skipStages?: PipelineStage[],
  ): boolean {
    if (skipStages?.includes(stage)) return false;

    const stageConfig = this.config.stages[stage];
    if (!stageConfig.enabled) return false;

    if (stageConfig.skipCondition?.(context)) return false;

    return true;
  }

  /**
   * Run a pipeline stage with retry and degradation
   */
  private async runStage<T>(
    stageName: PipelineStage,
    context: PipelineContext,
    executor: () => Promise<T>,
  ): Promise<{ summary: StageSummary; error?: PipelineError }> {
    const config = this.config.stages[stageName];
    const startTime = Date.now();
    let retryCount = 0;

    while (retryCount <= config.maxRetries) {
      try {
        await executor();

        const summary: StageSummary = {
          status: "success",
          durationMs: Date.now() - startTime,
          retryCount,
        };

        context.history.push({
          stage: stageName,
          status: "success",
          durationMs: summary.durationMs,
          retryCount,
        });

        return { summary };
      } catch (error) {
        retryCount++;

        logger.warn(
          {
            stage: stageName,
            retry: retryCount,
            error: (error as Error).message,
          },
          "Stage failed, retrying",
        );

        if (retryCount > config.maxRetries) {
          const summary: StageSummary = {
            status: "failure",
            durationMs: Date.now() - startTime,
            retryCount: retryCount - 1,
          };

          context.history.push({
            stage: stageName,
            status: "failure",
            durationMs: summary.durationMs,
            error: (error as Error).message,
            retryCount: retryCount - 1,
          });

          const pipelineError = new PipelineError(
            `Stage ${stageName} failed after ${retryCount} attempts`,
            stageName,
            error as Error,
            false,
          );

          if (this.config.failFast) {
            throw pipelineError;
          }

          return { summary, error: pipelineError };
        }

        // Wait before retry
        await new Promise((r) => setTimeout(r, 1000 * retryCount));
      }
    }

    // Should not reach here
    return {
      summary: {
        status: "failure",
        durationMs: Date.now() - startTime,
        retryCount,
      },
      error: new PipelineError(`Stage ${stageName} failed`, stageName),
    };
  }

  // ============================================================================
  // Stage Implementations
  // ============================================================================

  /**
   * Stage 1: Extract intent from user request
   */
  private async extractIntent(context: PipelineContext): Promise<void> {
    const { HybridIntentParser } = await import("../intent/unifiedIntentParser.js");
    const parser = new HybridIntentParser();

    const result = await parser.parse(
      context.request,
      {},
      {
        useCache: true,
        fallbackToLlm: true,
      },
    );

    context.intent = result.intent;
  }

  /**
   * Stage 2: Generate architecture diagram
   */
  private async generateArchitecture(context: PipelineContext): Promise<void> {
    // Use existing architecture service
    const { generateArchitecture } = await import("./architectureService.js");

    const result = await generateArchitecture({
      projectDescription: context.request,
      techStack: context.metadata.techStack
        ? [context.metadata.techStack]
        : undefined,
    });

    const architecture = result.architecture;
    context.architecture =
      architecture?.c4Diagrams?.container ??
      architecture?.c4Diagrams?.context ??
      architecture?.c4Diagrams?.component ??
      "";

    // Persist full architecture JSON for downstream stages
    if (architecture) {
      context.metadata.techStack = architecture.techStack?.[0];
    }
  }

  /**
   * Stage 3: Generate PRD from architecture
   */
  private async generatePRD(context: PipelineContext): Promise<void> {
    // Use PRD generator service
    const { generatePRD } = await import("./prdGeneratorService.js");
    const { parseIntentUnified } = await import("../intent/intentCompilerService.js");

    if (!context.intent) {
      context.intent = await parseIntentUnified(context.request, {});
    }

    // Rebuild architecture object if needed
    const { generateArchitecture } = await import("./architectureService.js");
    const archResponse = await generateArchitecture({
      projectDescription: context.request,
      techStack: context.metadata.techStack
        ? [context.metadata.techStack]
        : undefined,
    });

    const architecture = archResponse.architecture;
    if (!architecture) {
      throw new PipelineError("Architecture missing for PRD generation", "prd");
    }

    const prdResponse = await generatePRD(
      {
        architectureId: architecture.id,
        projectName: context.metadata.projectName ?? "Generated Project",
        projectDescription: context.request,
      },
      architecture,
    );

    context.prd = prdResponse.prd
      ? JSON.stringify(prdResponse.prd, null, 2)
      : "";
    context.architecture =
      architecture.c4Diagrams?.container ??
      architecture.c4Diagrams?.context ??
      architecture.c4Diagrams?.component ??
      context.architecture;
  }

  /**
   * Stage 4: Generate code skeleton
   */
  private async generateSkeleton(context: PipelineContext): Promise<void> {
    // Generate skeleton using AST service
    const files: FileDefinition[] = [];

    // Generate basic structure based on tech stack
    const techStack = context.metadata.techStack || "typescript";

    if (techStack.includes("react") || techStack.includes("next")) {
      files.push({
        path: "src/App.tsx",
        content: "// TODO: Implement main app component\n",
      });
    }

    if (techStack.includes("express") || techStack.includes("node")) {
      files.push({
        path: "src/index.ts",
        content: "// TODO: Implement server entry point\n",
      });
    }

    context.skeleton = files;
  }

  /**
   * Stage 5: Generate full implementation
   */
  private async generateImplementation(
    context: PipelineContext,
  ): Promise<void> {
    // Use existing code generation with architecture
    const diagramType = this.detectDiagramType(context.architecture || "");

    const result = await generateCodeFromDiagram(
      diagramType,
      context.architecture || "",
      context.metadata.techStack || "typescript",
    );

    context.implementation = result.files;
  }

  /**
   * Stage 6: Validate generated code
   */
  private async validate(context: PipelineContext): Promise<void> {
    const files = context.implementation || [];
    const validations: ValidationResult[] = [];

    for (const file of files) {
      if (file.path.endsWith(".ts") || file.path.endsWith(".tsx")) {
        // Basic syntax validation
        const result = await validateTypeScript({
          workspaceRoot: "/tmp/validation",
          files: [file.path],
        });
        validations.push(result);
      }
    }

    context.validation = validations;
  }

  /**
   * Stage 7: Finalize output
   */
  private async finalize(context: PipelineContext): Promise<void> {
    // Merge implementation with skeleton, add any missing files
    const finalFiles = [...(context.implementation || [])];

    // Add skeleton files that aren't in implementation
    for (const skeletonFile of context.skeleton || []) {
      if (!finalFiles.find((f) => f.path === skeletonFile.path)) {
        finalFiles.push(skeletonFile);
      }
    }

    context.final = finalFiles;
  }

  /**
   * Detect diagram type from Mermaid code
   */
  private detectDiagramType(mermaidCode: string): string {
    const code = mermaidCode.toLowerCase().trim();
    if (code.startsWith("erdiagram")) return "er";
    if (code.startsWith("sequencediagram")) return "sequence";
    if (code.startsWith("classdiagram")) return "class";
    if (code.startsWith("flowchart") || code.startsWith("graph"))
      return "flowchart";
    if (code.startsWith("statediagram")) return "flowchart";
    return "flowchart";
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Run the full generation pipeline
 */
export async function runPipeline(
  request: string,
  options?: {
    techStack?: string;
    projectName?: string;
    skipStages?: PipelineStage[];
    config?: Partial<PipelineConfig>;
  },
): Promise<PipelineResult> {
  const pipeline = new GenerationPipeline(options?.config);
  return pipeline.execute(request, options);
}

/**
 * Run a single stage (for testing/debugging)
 */
export async function runSingleStage(
  stage: PipelineStage,
  context: Partial<PipelineContext>,
  config?: Partial<PipelineConfig>,
): Promise<PipelineResult> {
  const pipeline = new GenerationPipeline(config);
  const fullContext: PipelineContext = {
    request: context.request || "",
    history: [],
    metadata: { startTime: Date.now() },
    ...context,
  };

  const stagesToSkip = Object.keys(DEFAULT_PIPELINE_CONFIG.stages).filter(
    (s) => s !== stage,
  ) as PipelineStage[];

  return pipeline.execute(fullContext.request, { skipStages: stagesToSkip });
}

export default GenerationPipeline;
