/**
 * Agent Lightning Task Service
 * Fetches tasks from Agent Lightning for G-Agent orchestration.
 * Configure AGENT_LIGHTNING_TASK_URL and AGENT_LIGHTNING_TASK_POLL_INTERVAL in .env.
 */

import logger from "../../middleware/logger.js";

const TASK_URL = process.env.AGENT_LIGHTNING_TASK_URL;
const POLL_INTERVAL_MS = parseInt(
  process.env.AGENT_LIGHTNING_TASK_POLL_INTERVAL || "60000",
  10,
);

export interface AgentLightningTask {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  priority?: number;
  createdAt?: string;
}

/**
 * Fetch pending tasks from Agent Lightning task API.
 * Returns empty array if not configured or on error.
 */
export async function fetchPendingTasks(): Promise<AgentLightningTask[]> {
  if (!TASK_URL) {
    return [];
  }
  try {
    const res = await fetch(`${TASK_URL}/v1/agl/tasks`, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Agent Lightning task API error");
      return [];
    }
    const data = (await res.json()) as { tasks?: AgentLightningTask[] };
    return data.tasks ?? [];
  } catch (err) {
    logger.debug(
      { err: (err as Error).message },
      "Agent Lightning task fetch failed",
    );
    return [];
  }
}

/**
 * Get poll interval in ms
 */
export function getTaskPollInterval(): number {
  return POLL_INTERVAL_MS;
}

/**
 * Check if Agent Lightning task integration is configured
 */
export function isTaskIntegrationConfigured(): boolean {
  return Boolean(TASK_URL);
}
