/**
 * Events stream – SSE for desktop to receive ship.completed / codegen.ready.
 * GET /api/events/stream?sessionId=... – optional sessionId filters events to that session.
 */

import { Router, type Request, type Response } from "express";
import { subscribeToEvents } from "../services/eventsStreamService.js";
import { db as supabaseDb, isMockMode } from "../services/supabaseClient.js";
import { isServerlessRuntime } from "../config/runtime.js";

const router = Router();

/**
 * GET /stream
 * Server-Sent Events: same shape as outbound webhooks – { event, payload, timestamp }.
 * Events: ship.completed, codegen.ready, ship.failed, codegen.failed.
 */
router.get("/stream", (req: Request, res: Response) => {
  if (isServerlessRuntime) {
    res
      .status(400)
      .json({
        error: "SSE not supported in serverless mode. Use /api/events/poll.",
      });
    return;
  }
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  subscribeToEvents(res, sessionId);
});

/**
 * GET /poll
 * Poll event log (serverless-friendly). Query: sessionId, since (ISO), limit
 */
router.get("/poll", async (req: Request, res: Response) => {
  if (isMockMode) {
    res.status(503).json({ error: "Events polling requires Supabase" });
    return;
  }
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  const since =
    typeof req.query.since === "string" ? req.query.since : undefined;
  const parsedLimit =
    typeof req.query.limit === "string" ? Number(req.query.limit) : 100;
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100;

  try {
    const table = supabaseDb.from("events");
    let query = table
      .select("*")
      .order("created_at", { ascending: true })
      .limit(limit || 100);
    if (sessionId) query = query.eq("session_id", sessionId);
    if (since) query = query.gt("created_at", since);
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ events: data || [] });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

export default router;
