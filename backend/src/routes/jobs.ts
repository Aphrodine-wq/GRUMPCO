import { Router, type Request, type Response } from "express";
import { processShipJob, processCodegenJob } from "../services/infra/jobQueue.js";
import logger from "../middleware/logger.js";
import { timingSafeEqualString } from "../utils/security.js";

const router = Router();

function verifyWorkerAuth(req: Request, res: Response): boolean {
  const secret = process.env.JOB_WORKER_SECRET;
  if (!secret) return true;
  const auth = req.headers.authorization;
  const token =
    typeof auth === "string" ? auth.replace(/^Bearer\s+/i, "") : null;
  const alt =
    typeof req.headers["x-job-secret"] === "string"
      ? req.headers["x-job-secret"]
      : null;
  const tokenMatch = token ? timingSafeEqualString(token, secret) : false;
  const altMatch = alt ? timingSafeEqualString(alt, secret) : false;
  if (tokenMatch || altMatch) return true;
  res.status(401).json({ error: "Unauthorized" });
  return false;
}

router.post("/ship", async (req: Request, res: Response) => {
  if (!verifyWorkerAuth(req, res)) return;
  const { jobId, sessionId } = req.body as {
    jobId?: string;
    sessionId?: string;
  };
  if (!jobId && !sessionId) {
    res.status(400).json({ error: "jobId or sessionId required" });
    return;
  }
  try {
    if (!jobId) {
      res.status(400).json({ error: "jobId required for serverless worker" });
      return;
    }
    await processShipJob(jobId);
    res.json({ status: "ok", jobId });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message, jobId }, "Ship job worker failed");
    res.status(500).json({ error: err.message });
  }
});

router.post("/codegen", async (req: Request, res: Response) => {
  if (!verifyWorkerAuth(req, res)) return;
  const { jobId, sessionId } = req.body as {
    jobId?: string;
    sessionId?: string;
  };
  if (!jobId && !sessionId) {
    res.status(400).json({ error: "jobId or sessionId required" });
    return;
  }
  try {
    if (!jobId) {
      res.status(400).json({ error: "jobId required for serverless worker" });
      return;
    }
    await processCodegenJob(jobId);
    res.json({ status: "ok", jobId });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message, jobId }, "Codegen job worker failed");
    res.status(500).json({ error: err.message });
  }
});

export default router;
