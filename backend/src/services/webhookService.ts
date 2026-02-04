/**
 * Webhook Service
 * Outbound: dispatch events (ship.completed, codegen.ready) to configured URLs.
 * Also broadcasts to SSE subscribers (desktop) via eventsStreamService.
 */

import logger from "../middleware/logger.js";
import { broadcastEvent } from "./eventsStreamService.js";
import { db as supabaseDb, isMockMode } from "./supabaseClient.js";
import { isServerlessRuntime } from "../config/runtime.js";

export type WebhookEvent =
  | "ship.completed"
  | "codegen.ready"
  | "ship.failed"
  | "codegen.failed"
  | "architecture.generated"
  | "prd.generated";

const webhookUrls: { url: string; events?: WebhookEvent[] }[] = [];

function getUrls(): string[] {
  const env = process.env.GRUMP_WEBHOOK_URLS;
  if (env && env.trim()) {
    return env
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
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

async function recordEvent(
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!isServerlessRuntime || isMockMode) return;
  try {
    const table = supabaseDb.from("events");
    const { error } = await table.insert({
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      session_id: (payload as Record<string, unknown>).sessionId ?? null,
      event,
      payload,
      created_at: new Date().toISOString(),
    });
    if (error) {
      logger.warn({ error: error.message, event }, "Event log insert failed");
    }
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, event },
      "Event log insert error",
    );
  }
}

/**
 * Dispatch an event to all registered URLs and to SSE subscribers (desktop).
 * Also notifies messaging users (Telegram, Discord, Twilio) on ship.completed/ship.failed.
 * Runs async so caller is not blocked.
 */
export function dispatchWebhook(
  event: WebhookEvent,
  payload: Record<string, unknown>,
): void {
  broadcastEvent(event, payload);
  void recordEvent(event, payload);

  const sessionId = payload.sessionId as string | undefined;
  if (sessionId && (event === "ship.completed" || event === "ship.failed")) {
    const msg =
      event === "ship.completed"
        ? "SHIP completed! Check the app to download your code."
        : `SHIP failed: ${(payload.error as string) ?? "Unknown error"}`;
    void import("./messagingShipNotifier.js").then(({ notify }) =>
      notify(sessionId, msg),
    );
  }

  const urls = getUrls();
  if (urls.length === 0) return;
  const body = JSON.stringify({
    event,
    payload,
    timestamp: new Date().toISOString(),
  });
  urls.forEach((url) => {
    setImmediate(() => {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })
        .then((res) => {
          if (!res.ok)
            logger.warn(
              { url, status: res.status, event },
              "Webhook delivery failed",
            );
        })
        .catch((e) => {
          logger.warn(
            { url, err: (e as Error).message, event },
            "Webhook delivery error",
          );
        });
    });
  });
}
