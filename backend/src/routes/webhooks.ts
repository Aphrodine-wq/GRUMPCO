/**
 * Webhooks API
 * POST /api/webhooks/trigger - Inbound trigger (CI, Slack, etc.). Auth via X-Webhook-Secret or body.secret.
 * Body: { action: 'ship'|'chat', params: object }. Enqueues job, returns 202 + jobId.
 */

import { Router, type Request, type Response } from "express";
import { enqueueShipJob } from "../services/jobQueue.js";
import { getRequestLogger } from "../middleware/logger.js";
import { sendServerError } from "../utils/errorResponse.js";
import {
  registerWebhook,
  type WebhookEvent,
} from "../services/webhookService.js";
import { timingSafeEqualString } from "../utils/security.js";

const router = Router();
const WEBHOOK_SECRET = process.env.GRUMP_WEBHOOK_SECRET || "";
const isProduction = process.env.NODE_ENV === "production";

interface TriggerBody {
  action: "ship" | "chat";
  params?: {
    sessionId?: string;
    projectDescription?: string;
    [k: string]: unknown;
  };
  secret?: string;
}

/**
 * POST /api/webhooks/trigger
 * Inbound trigger: enqueue job, return 202 + jobId.
 * In production, GRUMP_WEBHOOK_SECRET must be set; otherwise requests are rejected.
 */
router.post(
  "/trigger",
  async (
    req: Request<Record<string, never>, object, TriggerBody>,
    res: Response,
  ) => {
    const log = getRequestLogger();
    if (isProduction && !WEBHOOK_SECRET) {
      log.warn("Webhook secret not configured in production");
      res
        .status(503)
        .json({ error: "Webhook secret not configured", type: "config_error" });
      return;
    }
    const secret =
      (req.headers["x-webhook-secret"] as string) || req.body?.secret || "";
    if (WEBHOOK_SECRET && !timingSafeEqualString(secret, WEBHOOK_SECRET)) {
      res
        .status(401)
        .json({ error: "Invalid webhook secret", type: "auth_error" });
      return;
    }
    const { action, params = {} } = req.body ?? {};
    if (!action || !["ship", "chat"].includes(action)) {
      res
        .status(400)
        .json({
          error: "Missing or invalid action (ship|chat)",
          type: "validation_error",
        });
      return;
    }
    try {
      if (action === "ship") {
        const sessionId = params.sessionId as string | undefined;
        if (!sessionId) {
          res
            .status(400)
            .json({
              error: "ship action requires params.sessionId",
              type: "validation_error",
            });
          return;
        }
        const jobId = await enqueueShipJob(sessionId);
        log.info({ jobId, sessionId }, "Webhook trigger: ship job enqueued");
        res.status(202).json({ jobId, action: "ship" });
        return;
      }
      if (action === "chat") {
        res.status(202).json({
          jobId: null,
          action: "chat",
          message: "Chat trigger not yet implemented; use /api/chat/stream",
        });
        return;
      }
      res
        .status(400)
        .json({ error: "Unknown action", type: "validation_error" });
    } catch (e) {
      const err = e as Error;
      log.error({ error: err.message }, "Webhook trigger failed");
      sendServerError(res, err);
    }
  },
);

/**
 * POST /api/webhooks/outbound
 * Register outbound webhook URL (in-memory). Body: { url: string, events?: string[], secret?: string }
 * In production, GRUMP_WEBHOOK_SECRET must be set.
 */
router.post(
  "/outbound",
  (
    req: Request<
      Record<string, never>,
      object,
      { url?: string; events?: string[]; secret?: string }
    >,
    res: Response,
  ) => {
    const log = getRequestLogger();
    if (isProduction && !WEBHOOK_SECRET) {
      log.warn("Webhook secret not configured in production");
      res
        .status(503)
        .json({ error: "Webhook secret not configured", type: "config_error" });
      return;
    }
    const secret =
      (req.headers["x-webhook-secret"] as string) || req.body?.secret || "";
    if (WEBHOOK_SECRET && !timingSafeEqualString(secret, WEBHOOK_SECRET)) {
      res
        .status(401)
        .json({ error: "Invalid webhook secret", type: "auth_error" });
      return;
    }
    const { url, events } = req.body ?? {};
    if (!url || typeof url !== "string") {
      res
        .status(400)
        .json({ error: "Missing or invalid url", type: "validation_error" });
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      res
        .status(400)
        .json({ error: "Invalid url format", type: "validation_error" });
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      res
        .status(400)
        .json({
          error: "url must use http or https",
          type: "validation_error",
        });
      return;
    }
    if (isProduction && parsed.protocol !== "https:") {
      res.status(400).json({
        error: "In production, outbound webhook url must use https",
        type: "validation_error",
      });
      return;
    }
    registerWebhook(url, events as WebhookEvent[] | undefined);
    res.json({
      ok: true,
      url,
      events: events ?? [
        "ship.completed",
        "codegen.ready",
        "architecture.generated",
        "prd.generated",
      ],
    });
  },
);

export default router;
