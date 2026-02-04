/**
 * Codebase Analysis Routes
 *
 * API endpoints for analyzing existing codebases.
 */

import { Router, type Request, type Response } from "express";
import logger from "../../middleware/logger.js";
import {
  analyzeCodebase,
  generateArchitectureDiagram,
  analyzeDependencies,
  getCodeMetrics,
  detectCodeSmells,
} from "./service.js";
import {
  type AnalysisRequest,
  type ArchitectureDiagramRequest,
  type DependencyGraphRequest,
  type MetricsRequest,
} from "./types.js";

const router = Router();

/**
 * POST /api/analyze/project
 * Full codebase analysis
 */
router.post("/project", async (req: Request, res: Response) => {
  try {
    const { workspacePath, options } = req.body as AnalysisRequest;

    if (!workspacePath) {
      res.status(400).json({
        error: "Missing workspacePath",
        type: "validation_error",
      });
      return;
    }

    const result = await analyzeCodebase({ workspacePath, options });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, "Analysis error");
    res.status(500).json({
      error: err.message,
      type: "analysis_error",
    });
  }
});

/**
 * POST /api/analyze/architecture
 * Generate architecture diagram from codebase
 */
router.post("/architecture", async (req: Request, res: Response) => {
  try {
    const { workspacePath, diagramType, focusOn } =
      req.body as ArchitectureDiagramRequest;

    if (!workspacePath) {
      res.status(400).json({
        error: "Missing workspacePath",
        type: "validation_error",
      });
      return;
    }

    const {
      mermaidDiagram,
      summary,
      diagramType: resolvedDiagramType,
    } = await generateArchitectureDiagram({
      workspacePath,
      diagramType,
      focusOn,
    });

    res.json({
      success: true,
      data: {
        mermaidDiagram,
        summary,
        diagramType: resolvedDiagramType || diagramType || "component",
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, "Architecture diagram error");
    const hint =
      err.message.includes("ENOENT") || err.message.includes("no such file")
        ? "Ensure workspacePath exists and is readable."
        : err.message.includes("timeout") || err.message.includes("ETIMEDOUT")
          ? "Analysis timed out; try a smaller workspace or increase timeout."
          : undefined;
    res.status(500).json({
      error: err.message,
      type: "diagram_error",
      ...(hint && { hint }),
    });
  }
});

/**
 * POST /api/analyze/dependencies
 * Analyze project dependencies
 */
router.post("/dependencies", async (req: Request, res: Response) => {
  try {
    const { workspacePath, includeDevDeps, showVersions } =
      req.body as DependencyGraphRequest;

    if (!workspacePath) {
      res.status(400).json({
        error: "Missing workspacePath",
        type: "validation_error",
      });
      return;
    }

    const result = await analyzeDependencies({
      workspacePath,
      includeDevDeps,
      showVersions,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, "Dependency analysis error");
    res.status(500).json({
      error: err.message,
      type: "dependency_error",
    });
  }
});

/**
 * POST /api/analyze/metrics
 * Get code metrics
 */
router.post("/metrics", async (req: Request, res: Response) => {
  try {
    const { workspacePath, groupBy } = req.body as MetricsRequest;

    if (!workspacePath) {
      res.status(400).json({
        error: "Missing workspacePath",
        type: "validation_error",
      });
      return;
    }

    const metrics = await getCodeMetrics({ workspacePath, groupBy });

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, "Metrics error");
    res.status(500).json({
      error: err.message,
      type: "metrics_error",
    });
  }
});

/**
 * POST /api/analyze/code-smells
 * Detect code smells and quality issues
 */
router.post("/code-smells", async (req: Request, res: Response) => {
  try {
    const { workspacePath } = req.body;

    if (!workspacePath) {
      res.status(400).json({
        error: "Missing workspacePath",
        type: "validation_error",
      });
      return;
    }

    const smells = await detectCodeSmells(workspacePath);

    res.json({
      success: true,
      data: {
        codeSmells: smells,
        total: smells.length,
        byType: smells.reduce(
          (acc, s) => {
            acc[s.type] = (acc[s.type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        bySeverity: smells.reduce(
          (acc, s) => {
            acc[s.severity] = (acc[s.severity] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, "Code smells error");
    res.status(500).json({
      error: err.message,
      type: "code_smells_error",
    });
  }
});

/**
 * GET /api/analyze/health
 * Health check for analysis service
 */
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "codebase-analysis",
    version: "1.0.0",
  });
});

export default router;
