/**
 * Webhook Service
 * Outbound: dispatch events (ship.completed, codegen.ready) to configured URLs.
 * Also broadcasts to SSE subscribers (desktop) via eventsStreamService.
 */

import logger from '../middleware/logger.js';
import { broadcastEvent } from './eventsStreamService.js';

export type WebhookEvent = 'ship.completed' | 'codegen.ready' | 'ship.failed' | 'codegen.failed';

const webhookUrls: { url: string; events?: WebhookEvent[] }[] = [];

function getUrls(): string[] {
  const env = process.env.GRUMP_WEBHOOK_URLS;
  if (env && env.trim()) {
    return env.split(',').map((u) => u.trim()).filter(Boolean);
  }
  return webhookUrls.map((w) => w.url);
}

/**
 * Register an outbound webhook URL (in-memory; per-user/store would use DB).
 */
export function registerWebhook(url: string, events?: WebhookEvent[]): void {
  const existing = webhookUrls.find((w) => w.url === url);
  if (existing) {
    existing.events = events ?? existing.events;
  } else {
    webhookUrls.push({ url, events });
  }
}

/**
 * Dispatch an event to all registered URLs and to SSE subscribers (desktop).
 * Runs async so caller is not blocked.
 */
export function dispatchWebhook(event: WebhookEvent, payload: Record<string, unknown>): void {
  broadcastEvent(event, payload);

  const urls = getUrls();
  if (urls.length === 0) return;
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  urls.forEach((url) => {
    setImmediate(() => {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }).then((res) => {
        if (!res.ok) logger.warn({ url, status: res.status, event }, 'Webhook delivery failed');
      }).catch((e) => {
        logger.warn({ url, err: (e as Error).message, event }, 'Webhook delivery error');
      });
    });
  });
}
