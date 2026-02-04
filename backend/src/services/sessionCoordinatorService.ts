/**
 * Session Coordinator Service
 * Agent-to-agent coordination: sessions_list, sessions_history, sessions_send.
 * Tracks active sessions and enables cross-session messaging with reply-back support.
 */

import { getDatabase } from "../db/database.js";
import logger from "../middleware/logger.js";

export interface AgentSessionMeta {
  id: string;
  type: "chat" | "ship" | "codegen" | "talk";
  model?: string;
  startedAt: string;
  status: "active" | "completed" | "failed";
  userId?: string;
}

export interface SessionMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

// In-memory session store (supplements DB for active sessions)
const activeSessions = new Map<
  string,
  { meta: AgentSessionMeta; messages: SessionMessage[] }
>();

/**
 * Register a session (called when chat/ship/codegen starts)
 */
export function registerSession(
  id: string,
  type: AgentSessionMeta["type"],
  options?: { model?: string; userId?: string },
): void {
  const existing = activeSessions.get(id);
  if (existing) return;

  activeSessions.set(id, {
    meta: {
      id,
      type,
      model: options?.model,
      startedAt: new Date().toISOString(),
      status: "active",
      userId: options?.userId,
    },
    messages: [],
  });
  logger.debug({ sessionId: id, type }, "Session registered");
}

/**
 * Update session with messages (called during chat stream)
 */
export function appendSessionMessages(
  sessionId: string,
  messages: SessionMessage[],
): void {
  const s = activeSessions.get(sessionId);
  if (!s) return;
  s.messages.push(...messages);
}

/**
 * Mark session completed
 */
export function completeSession(
  sessionId: string,
  status: "completed" | "failed" = "completed",
): void {
  const s = activeSessions.get(sessionId);
  if (s) {
    s.meta.status = status;
    logger.debug({ sessionId, status }, "Session completed");
  }
}

/**
 * sessions_list: Discover active sessions with metadata
 */
export async function sessionsList(options?: {
  limit?: number;
}): Promise<AgentSessionMeta[]> {
  const limit = options?.limit ?? 50;
  const fromMemory = Array.from(activeSessions.values())
    .map((s) => s.meta)
    .filter((m) => m.status === "active" || m.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )
    .slice(0, limit);

  return fromMemory
    .sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )
    .slice(0, limit);
}

/**
 * sessions_history: Fetch transcript/logs for a session
 */
export async function sessionsHistory(
  sessionId: string,
): Promise<{
  sessionId: string;
  messages: SessionMessage[];
  meta?: AgentSessionMeta;
} | null> {
  const fromMemory = activeSessions.get(sessionId);
  if (fromMemory) {
    return {
      sessionId,
      messages: fromMemory.messages,
      meta: fromMemory.meta,
    };
  }

  // Try DB for ship/codegen sessions
  try {
    const db = getDatabase();
    const ship = await db.getShipSession(sessionId);
    if (ship) {
      const messages: SessionMessage[] = [];
      if (ship.projectDescription) {
        messages.push({
          role: "user",
          content: ship.projectDescription,
          timestamp: ship.createdAt,
        });
      }
      const summary =
        ship.planResult?.plan?.description ??
        ship.specResult?.specification?.description ??
        ship.designResult?.architecture?.projectDescription ??
        `SHIP session: ${ship.phase}`;
      messages.push({ role: "assistant", content: summary });
      return {
        sessionId,
        messages,
        meta: {
          id: sessionId,
          type: "ship",
          startedAt: ship.createdAt ?? new Date().toISOString(),
          status: ship.status === "completed" ? "completed" : "active",
        },
      };
    }
  } catch (e) {
    logger.debug(
      { sessionId, err: (e as Error).message },
      "DB session history skipped",
    );
  }

  return null;
}

/**
 * sessions_send: Send message to another session with reply-back support.
 * If the session has an active context, we run chat and return the assistant reply.
 * Otherwise we queue the message and return a placeholder.
 */
export async function sessionsSend(
  sessionId: string,
  message: string,
  options?: { runChat?: boolean },
): Promise<{
  ok: boolean;
  reply?: string;
  error?: string;
  queued?: boolean;
}> {
  let s = activeSessions.get(sessionId);
  if (!s) {
    registerSession(sessionId, "chat");
    s = activeSessions.get(sessionId);
  }
  if (s) {
    s.messages.push({
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    });
  }

  const runChat = options?.runChat !== false;
  if (runChat) {
    try {
      const { claudeServiceWithTools } =
        await import("./claudeServiceWithTools.js");
      const { route } = await import("./modelRouter.js");
      const history = await sessionsHistory(sessionId);
      const priorMessages = history?.messages ?? [];
      const allMessages = [
        ...priorMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: message },
      ];

      const routed = route({
        messageChars: allMessages.reduce((sum, m) => sum + m.content.length, 0),
        messageCount: allMessages.length,
        mode: "normal",
        toolsRequested: false,
      });

      const stream = claudeServiceWithTools.generateChatStream(
        allMessages,
        undefined,
        undefined,
        "normal",
        undefined,
        undefined,
        undefined,
        routed.provider,
        routed.modelId,
      );

      let reply = "";
      for await (const event of stream as AsyncIterable<{
        type: string;
        text?: string;
      }>) {
        if (event.type === "text" && event.text) reply += event.text;
        if (event.type === "done") break;
      }

      if (s) {
        s.messages.push({
          role: "assistant",
          content: reply,
          timestamp: new Date().toISOString(),
        });
      }

      return { ok: true, reply };
    } catch (e) {
      logger.warn(
        { sessionId, err: (e as Error).message },
        "sessions_send chat failed",
      );
      return { ok: false, error: (e as Error).message };
    }
  }

  return { ok: true, queued: true };
}
