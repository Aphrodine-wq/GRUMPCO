/**
 * Auto-Deploy API Routes
 * Provides endpoints for deploying user-generated apps to Docker
 */

import {
  Router,
  // discord.js types have known issues with GatewayIntentBits exportFunction,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { autoDeployService } from "../services/workspace/autoDeployService.js";
import logger from "../middleware/logger.js";

const router = Router();

/**
 * POST /api/auto-deploy
 * Deploy a user-generated app to Docker
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { appDirectory, appName, port, envVars } = req.body;

    if (!appDirectory) {
      res.status(400).json({ error: "appDirectory is required" });
      return;
    }

    logger.info({ appDirectory, appName, port }, "Received deployment request");

    const result = await autoDeployService.deployApp({
      appDirectory,
      appName,
      port,
      envVars,
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auto-deploy/status
 * Check if Docker is available
 */
router.get(
  "/status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const available = await autoDeployService.isDockerAvailable();
      res.json({ available });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/auto-deploy/apps
 * List all deployed apps
 */
router.get("/apps", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apps = await autoDeployService.listDeployedApps();
    res.json({ apps });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auto-deploy/apps/:appName
 * Get status of a specific app
 */
router.get(
  "/apps/:appName",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { appName } = req.params;
      const status = await autoDeployService.getAppStatus(appName);
      res.json(status);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/auto-deploy/apps/:appName/logs
 * Get logs from a deployed app
 */
router.get(
  "/apps/:appName/logs",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { appName } = req.params;
      const lines = parseInt(req.query.lines as string) || 100;
      const logs = await autoDeployService.getAppLogs(appName, lines);
      res.json({ logs });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/auto-deploy/apps/:appName/stop
 * Stop a deployed app
 */
router.post(
  "/apps/:appName/stop",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { appName } = req.params;
      const result = await autoDeployService.stopApp(appName);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/auto-deploy/apps/:appName
 * Remove a deployed app
 */
router.delete(
  "/apps/:appName",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { appName } = req.params;
      const result = await autoDeployService.removeApp(appName);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
