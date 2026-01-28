/**
 * Events stream – SSE for desktop to receive ship.completed / codegen.ready.
 * GET /api/events/stream?sessionId=... – optional sessionId filters events to that session.
 */

import { Router, Request, Response } from 'express';
import { subscribeToEvents } from '../services/eventsStreamService.js';

const router = Router();

/**
 * GET /stream
 * Server-Sent Events: same shape as outbound webhooks – { event, payload, timestamp }.
 * Events: ship.completed, codegen.ready, ship.failed, codegen.failed.
 */
router.get('/stream', (req: Request, res: Response) => {
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  subscribeToEvents(res, sessionId);
});

export default router;
