/**
 * Events stream service – SSE for desktop to receive ship.completed / codegen.ready.
 * When dispatchWebhook() runs, events are broadcast to all subscribers (optionally filtered by sessionId).
 */

import type { Response } from 'express';

export type StreamEvent = 'ship.completed' | 'codegen.ready' | 'ship.failed' | 'codegen.failed';

interface Subscriber {
  res: Response;
  sessionId?: string;
}

const subscribers: Subscriber[] = [];

/**
 * Subscribe a response (SSE connection) to events. Optional sessionId filters to that session only.
 * Caller must set SSE headers and keep the connection open; we push events via res.write().
 */
export function subscribeToEvents(res: Response, sessionId?: string): void {
  subscribers.push({ res, sessionId });
  res.on('close', () => {
    const i = subscribers.findIndex((s) => s.res === res);
    if (i >= 0) subscribers.splice(i, 1);
  });
}

/**
 * Broadcast an event to all SSE subscribers. If a subscriber has sessionId, only send when payload.sessionId matches.
 */
export function broadcastEvent(event: StreamEvent, payload: Record<string, unknown>): void {
  const data = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  const msg = `data: ${data}\n\n`;
  for (const sub of subscribers.slice()) {
    try {
      if (sub.sessionId != null && payload.sessionId !== sub.sessionId) continue;
      sub.res.write(msg);
    } catch {
      // Connection likely closed; subscriber will be removed on 'close'
    }
  }
}
