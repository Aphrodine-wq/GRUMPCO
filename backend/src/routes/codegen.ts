/**
 * Code Generation Routes
 * Endpoints for multi-agent code generation
 */

import express, { type Request, type Response, type Router } from "express";
import {
  initializeSession,
  initializeSessionMulti,
  getSession,
  executeCodeGeneration,
  executeCodeGenerationMulti,
} from "../services/agentOrchestrator.js";
import { enqueueCodegenJob } from "../services/jobQueue.js";
import { isServerlessRuntime } from "../config/runtime.js";
import { getDatabase } from "../db/database.js";
import { createCodegenZip } from "../services/zipService.js";
import { getRequestLogger } from "../middleware/logger.js";
import type { AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { sendServerError } from "../utils/errorResponse.js";
import {
  validateCodegenRequest,
  handleCodegenValidationErrors,
} from "../middleware/validator.js";
import type { CodeGenRequest, CodeGenRequestMulti } from "../types/agents.js";
import type { PRD } from "../types/prd.js";
import type { SystemArchitecture } from "../types/architecture.js";

/** Agent status entry in codegen API responses */
interface AgentStatusEntry {
  taskId: string;
  status: string;
  description: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  error?: string;
}

const router: Router = express.Router();

const DEFAULT_PREFERENCES = {
  frontendFramework: "vue" as const,
  backendRuntime: "node" as const,
  database: "postgres" as const,
  includeTests: true,
  includeDocs: true,
};

interface CodeGenRequestBody extends CodeGenRequest {
  prd: PRD;
  architecture: SystemArchitecture;
  projectId?: string;
}

interface CodeGenRequestBodyMulti {
  prds: Array<{ prd: PRD; componentId?: string; componentLabel?: string }>;
  architecture: SystemArchitecture;
  preferences?: CodeGenRequest["preferences"];
  componentMapping?: CodeGenRequestMulti["componentMapping"];
  projectId?: string;
}

/**
 * POST /api/codegen/start
 * Initialize and start code generation.
 * Legacy: { prdId, architectureId, prd, architecture, preferences }
 * Multi-PRD: { prds, architecture, preferences?, componentMapping? }
 */
router.post(
  "/start",
  validateCodegenRequest,
  handleCodegenValidationErrors,
  async (req: Request, res: Response) => {
    const log = getRequestLogger();
    const body = req.body as CodeGenRequestBody | CodeGenRequestBodyMulti;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    try {
      const isMulti =
        Array.isArray((body as CodeGenRequestBodyMulti).prds) &&
        (body as CodeGenRequestBodyMulti).architecture;

      if (isMulti) {
        const { prds, architecture, preferences, componentMapping } =
          body as CodeGenRequestBodyMulti;
        if (!prds?.length || !architecture?.metadata) {
          res.status(400).json({
            error: "Multi-PRD requires prds array and architecture",
            type: "validation_error",
          });
          return;
        }
        log.info(
          { prdCount: prds.length, architectureId: architecture.id },
          "Multi-PRD code generation start requested",
        );
        const session = await initializeSessionMulti({
          prds,
          architecture,
          preferences: preferences ?? DEFAULT_PREFERENCES,
          componentMapping,
          userId,
          projectId: (body as CodeGenRequestBodyMulti).projectId,
        });
        let jobId: string | null = null;
        if (isServerlessRuntime) {
          jobId = await enqueueCodegenJob(session.sessionId);
        } else {
          setImmediate(() => {
            executeCodeGenerationMulti(session).catch((error) => {
              log.error(
                { sessionId: session.sessionId, error: error.message },
                "Multi-PRD codegen failed",
              );
            });
          });
        }
        res.json({
          sessionId: session.sessionId,
          status: session.status,
          agents: Object.entries(session.agents).reduce<
            Record<string, AgentStatusEntry>
          >(
            (acc, [type, task]) => {
              acc[type] = {
                taskId: task.taskId,
                status: task.status,
                description: task.description,
              };
              return acc;
            },
            Object.create(null) as Record<string, AgentStatusEntry>,
          ),
          subTasksByPrdId: session.subTasksByPrdId,
          jobQueued: isServerlessRuntime,
          jobId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { prdId, architectureId, preferences, prd, architecture } =
        body as CodeGenRequestBody;
      if (!prdId || !architectureId || !prd || !architecture) {
        res.status(400).json({
          error:
            "Missing required fields: prdId, architectureId, prd, architecture",
          type: "validation_error",
        });
        return;
      }

      log.info(
        {
          prdId,
          architectureId,
          frontendFramework: preferences?.frontendFramework,
          backendRuntime: preferences?.backendRuntime,
        },
        "Code generation start requested",
      );

      const session = await initializeSession({
        prdId,
        architectureId,
        projectId: (body as CodeGenRequestBody).projectId,
        preferences: preferences ?? DEFAULT_PREFERENCES,
        userId,
      });

      // Store PRD + architecture in session for serverless workers
      session.prds = [prd];
      session.architecture = architecture;
      await getDatabase().saveSession(session);

      let jobId: string | null = null;
      if (isServerlessRuntime) {
        jobId = await enqueueCodegenJob(session.sessionId);
      } else {
        setImmediate(() => {
          executeCodeGeneration(session, prd, architecture).catch((error) => {
            log.error(
              { sessionId: session.sessionId, error: error.message },
              "Background code generation failed",
            );
          });
        });
      }

      res.json({
        sessionId: session.sessionId,
        status: session.status,
        agents: Object.entries(session.agents).reduce<
          Record<string, AgentStatusEntry>
        >(
          (acc, [type, task]) => {
            acc[type] = {
              taskId: task.taskId,
              status: task.status,
              description: task.description,
            };
            return acc;
          },
          Object.create(null) as Record<string, AgentStatusEntry>,
        ),
        jobQueued: isServerlessRuntime,
        jobId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const err = error as Error;
      log.error({ error: err.message }, "Code generation start error");
      sendServerError(res, err);
    }
  },
);

/**
 * GET /api/codegen/status/:sessionId
 * Get current status of code generation
 */
router.get(
  "/status/:sessionId",
  async (req: Request<{ sessionId: string }>, res: Response) => {
    const log = getRequestLogger();

    try {
      const { sessionId } = req.params;

      const session = await getSession(sessionId);
      if (!session) {
        res.status(404).json({
          error: "Session not found",
          type: "not_found",
        });
        return;
      }

      // Calculate progress
      const totalAgents = Object.keys(session.agents).length;
      const completedAgents = Object.values(session.agents).filter(
        (agent) => agent.status === "completed",
      ).length;
      const progress = (completedAgents / totalAgents) * 100;

      const payload: Record<string, unknown> = {
        sessionId,
        status: session.status,
        progress: Math.round(progress),
        agents: Object.entries(session.agents).reduce<
          Record<string, AgentStatusEntry>
        >(
          (acc, [type, task]) => {
            acc[type] = {
              taskId: task.taskId,
              status: task.status,
              description: task.description,
              startedAt: task.startedAt,
              completedAt: task.completedAt,
              duration: task.duration,
              error: task.error,
            };
            return acc;
          },
          Object.create(null) as Record<string, AgentStatusEntry>,
        ),
        generatedFileCount: session.generatedFiles?.length || 0,
        error: session.error,
        timestamp: new Date().toISOString(),
      };
      if (session.subTasksByPrdId)
        (payload as Record<string, unknown>).subTasksByPrdId =
          session.subTasksByPrdId;
      res.json(payload);
    } catch (error) {
      const err = error as Error;
      log.error({ error: err.message }, "Status check error");
      sendServerError(res, error);
    }
  },
);

/**
 * GET /api/codegen/download/:sessionId
 * Download generated code as zip
 */
router.get(
  "/download/:sessionId",
  async (req: Request<{ sessionId: string }>, res: Response) => {
    const log = getRequestLogger();

    try {
      const { sessionId } = req.params;

      const session = await getSession(sessionId);
      if (!session) {
        res.status(404).json({
          error: "Session not found",
          type: "not_found",
        });
        return;
      }

      if (session.status !== "completed") {
        res.status(400).json({
          error: `Code generation not complete. Current status: ${session.status}`,
          type: "invalid_state",
        });
        return;
      }

      if (!session.generatedFiles || session.generatedFiles.length === 0) {
        res.status(400).json({
          error: "No files were generated",
          type: "invalid_state",
        });
        return;
      }

      const projectName =
        session.architecture?.projectName ??
        session.prdId ??
        "generated-project";
      const zip = createCodegenZip(session.generatedFiles, projectName);

      log.info(
        { sessionId, fileCount: session.generatedFiles.length },
        "Download requested",
      );

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(projectName)}.zip"`,
      );
      zip.pipe(res);
    } catch (error) {
      const err = error as Error;
      log.error({ error: err.message }, "Download error");
      sendServerError(res, error);
    }
  },
);

/**
 * POST /api/codegen/preview/:sessionId
 * Get preview of generated files
 */
router.post(
  "/preview/:sessionId",
  async (
    req: Request<{ sessionId: string }, object, { filePath: string }>,
    res: Response,
  ) => {
    const log = getRequestLogger();

    try {
      const { sessionId } = req.params;
      const { filePath } = req.body;

      const session = await getSession(sessionId);
      if (!session) {
        res.status(404).json({
          error: "Session not found",
          type: "not_found",
        });
        return;
      }

      if (!filePath) {
        res.status(400).json({
          error: "Missing filePath",
          type: "validation_error",
        });
        return;
      }

      const file = session.generatedFiles?.find((f) => f.path === filePath);
      if (!file) {
        res.status(404).json({
          error: "File not found in generated project",
          type: "not_found",
        });
        return;
      }

      res.json({
        path: file.path,
        language: file.language,
        type: file.type,
        size: file.size,
        content: file.content.substring(0, 5000), // Preview first 5000 chars
        isTruncated: file.content.length > 5000,
        fullSize: file.content.length,
      });
    } catch (error) {
      const err = error as Error;
      log.error({ error: err.message }, "Preview error");
      sendServerError(res, error);
    }
  },
);

export default router;
