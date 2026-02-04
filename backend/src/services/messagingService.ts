/**
 * Messaging Service
 * Shared logic for Telegram, Discord, Twilio: chat, ship intent parsing, execution.
 * Now with Free Agent integration for tool execution via messaging.
 * Uses persistent conversation memory from conversationMemoryService.
 */

import { claudeServiceWithTools } from "./claudeServiceWithTools.js";
import { startShipMode } from "./shipModeService.js";
import { enqueueShipJob } from "./jobQueue.js";
import {
  subscribe as subscribeShipNotifier,
  type MessagingPlatform,
} from "./messagingShipNotifier.js";
import {
  getOrCreateConversation as getOrCreateConversationMem,
  saveConversation,
  type ConversationMessage,
} from "./conversationMemoryService.js";
import logger from "../middleware/logger.js";
import { getDatabase } from "../db/database.js";
import {
  getEffectivePermissions,
  checkRateLimit,
  confirmRequest,
  cancelRequest,
  getUserPermissions,
} from "../config/messagingPermissions.js";
import type { FreeAgentCapabilityKey } from "../types/settings.js";

/** @deprecated Use getOrCreateConversationMem from conversationMemoryService */
export async function getOrCreateConversation(
  platform: MessagingPlatform,
  platformUserId: string,
  userId?: string | null,
): Promise<ConversationMessage[]> {
  return getOrCreateConversationMem(platform, platformUserId, userId);
}

export type MessageIntent =
  | { action: "ship"; projectDescription: string }
  | { action: "chat" }
  | { action: "freeagent"; command: string }
  | { action: "confirm"; confirmationId: string }
  | { action: "cancel"; confirmationId?: string }
  | { action: "status" }
  | { action: "remind"; content: string; dueAt?: string }
  | { action: "code"; description: string };

export function parseIntent(text: string): MessageIntent {
  const t = text.trim().toLowerCase();

  // SHIP command
  const shipMatch = t.match(/^ship\s*:?\s*(.+)/s) || t.match(/^\/ship\s+(.+)/s);
  if (shipMatch && shipMatch[1]?.trim()) {
    return { action: "ship", projectDescription: shipMatch[1].trim() };
  }

  // Free Agent command: /fa or /freeagent
  const faMatch = t.match(/^\/(?:fa|freeagent)\s+(.+)/s);
  if (faMatch && faMatch[1]?.trim()) {
    return { action: "freeagent", command: faMatch[1].trim() };
  }

  // Code / G-Agent: /code or run code:
  const codeMatch =
    t.match(/^\/(?:code|agent)\s+(.+)/s) || t.match(/^run\s+code\s*:?\s*(.+)/s);
  if (codeMatch && codeMatch[1]?.trim()) {
    return { action: "code", description: codeMatch[1].trim() };
  }

  // Confirmation response
  const confirmMatch = t.match(/^yes\s+(confirm_\w+)/i);
  if (confirmMatch) {
    return { action: "confirm", confirmationId: confirmMatch[1] };
  }

  // Cancel response
  if (t === "no" || t === "cancel") {
    return { action: "cancel" };
  }
  const cancelMatch = t.match(/^(?:no|cancel)\s+(confirm_\w+)/i);
  if (cancelMatch) {
    return { action: "cancel", confirmationId: cancelMatch[1] };
  }

  // Status check
  if (t === "/status" || t === "status") {
    return { action: "status" };
  }

  // Reminder: "remind me at 3pm" or "remind me in 2 hours" or "/remind X"
  const remindMatch =
    t.match(/^remind\s+me\s+(?:at|in)\s+(.+)/i) ||
    t.match(/^\/remind\s+(.+)/i) ||
    t.match(/^remind\s+(.+)/i);
  if (remindMatch && remindMatch[1]?.trim()) {
    return { action: "remind", content: remindMatch[1].trim() };
  }

  return { action: "chat" };
}

export async function runChatAndGetReply(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  let lastText = "";
  try {
    const stream = claudeServiceWithTools.generateChatStream(
      messages,
      undefined,
      undefined,
      "normal",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    for await (const ev of stream) {
      if (ev.type === "text" && ev.text) lastText += ev.text;
      if (ev.type === "error")
        lastText += (ev as { message?: string }).message ?? "Error.";
      if (ev.type === "done") break;
    }
  } catch (err) {
    logger.warn({ err }, "Messaging chat stream error");
    lastText = "Sorry, something went wrong.";
  }
  return lastText.trim().slice(0, 1600) || "Done.";
}

export async function executeShipFromMessaging(
  projectDescription: string,
  platform: MessagingPlatform,
  platformUserId: string,
): Promise<{ sessionId: string; ok: boolean; error?: string }> {
  try {
    const session = await startShipMode({
      projectDescription,
      preferences: undefined,
      projectId: undefined,
    });
    await enqueueShipJob(session.id);
    subscribeShipNotifier(session.id, platform, platformUserId);
    return { sessionId: session.id, ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    logger.warn(
      { err: msg, platform, platformUserId },
      "Messaging ship start failed",
    );
    return { sessionId: "", ok: false, error: msg };
  }
}

/**
 * Get user's Free Agent preferences from database
 */
async function getUserFreeAgentPrefs(userId: string): Promise<{
  enabled: boolean;
  capabilities: FreeAgentCapabilityKey[];
  allowlist: string[];
  tier: string;
}> {
  try {
    const db = getDatabase();
    const settings = await db.getSettings(userId);
    const prefs = settings?.preferences;

    return {
      enabled: !!(
        prefs?.freeAgentCapabilities && prefs.freeAgentCapabilities.length > 0
      ),
      capabilities: prefs?.freeAgentCapabilities || [],
      allowlist: prefs?.freeAgentExternalAllowlist || [],
      tier: settings?.tier || "free",
    };
  } catch {
    return { enabled: false, capabilities: [], allowlist: [], tier: "free" };
  }
}

/**
 * Process Free Agent command via messaging
 */
async function processFreeAgentCommand(
  platform: MessagingPlatform,
  userId: string,
  command: string,
): Promise<string> {
  // Get effective permissions for this platform
  const userPerms = getUserPermissions(userId);
  const effective = getEffectivePermissions(
    platform as MessagingPlatform,
    userPerms || undefined,
  );

  if (!effective.freeAgentEnabled) {
    return `Free Agent is not enabled for ${platform}. Enable it in settings or ask an admin.`;
  }

  // Check rate limit
  const rateCheck = checkRateLimit(
    platform as MessagingPlatform,
    userId,
    userPerms || undefined,
  );
  if (!rateCheck.allowed) {
    const resetMin = Math.ceil(rateCheck.resetIn / 60000);
    return `Rate limit exceeded. Try again in ${resetMin} minutes.`;
  }

  // Get user's Free Agent preferences
  const userPrefs = await getUserFreeAgentPrefs(userId);

  const conv = await getOrCreateConversationMem(
    platform as MessagingPlatform,
    userId,
  );
  const messages: ConversationMessage[] = [
    ...conv,
    { role: "user" as const, content: command },
  ];

  try {
    let lastText = "";
    const stream = claudeServiceWithTools.generateChatStream(
      messages,
      undefined,
      undefined,
      "normal",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "freeAgent",
      effective.allowedCapabilities,
      userPrefs.allowlist,
    );

    for await (const ev of stream) {
      if (ev.type === "text" && ev.text) lastText += ev.text;
      if (ev.type === "tool_call") {
        // Log tool usage
        logger.info(
          { platform, userId, tool: (ev as { name?: string }).name },
          "Free Agent tool use via messaging",
        );
      }
      if (ev.type === "error")
        lastText += (ev as { message?: string }).message ?? "Error.";
      if (ev.type === "done") break;
    }

    const reply = lastText.trim().slice(0, 1600) || "Done.";

    // Persist conversation
    const updated = [
      ...messages,
      { role: "assistant" as const, content: reply },
    ];
    await saveConversation(platform as MessagingPlatform, userId, updated);

    return reply;
  } catch (err) {
    logger.error({ err, platform, userId }, "Free Agent messaging error");
    return "Sorry, an error occurred while processing your request.";
  }
}

/**
 * Handle code/G-Agent intent - start SHIP or codegen from messaging
 */
async function handleCodeIntent(
  platform: MessagingPlatform,
  platformUserId: string,
  description: string,
): Promise<string> {
  const result = await executeShipFromMessaging(
    description,
    platform,
    platformUserId,
  );
  if (result.ok) {
    return "Code task started! I'll message you when it's done.";
  }
  return `Failed to start: ${result.error ?? "Unknown error"}`;
}

/**
 * Handle reminder intent - create a reminder from messaging
 */
async function handleReminderIntent(
  platform: MessagingPlatform,
  platformUserId: string,
  content: string,
): Promise<string> {
  const { createReminder } = await import("./reminderService.js");

  // Parse "at 3pm" / "in 2 hours" / "tomorrow 9am" or plain text
  let dueAt = new Date(Date.now() + 60 * 60 * 1000); // Default: 1 hour
  const lower = content.toLowerCase();

  const inMatch = content.match(
    /in\s+(\d+)\s*(min|mins|minute|minutes|hr|hrs|hour|hours|day|days)/i,
  );
  if (inMatch) {
    const n = parseInt(inMatch[1], 10);
    const unit = inMatch[2].toLowerCase();
    if (unit.startsWith("min")) dueAt = new Date(Date.now() + n * 60 * 1000);
    else if (unit.startsWith("hr"))
      dueAt = new Date(Date.now() + n * 60 * 60 * 1000);
    else if (unit.startsWith("day"))
      dueAt = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
    content = content.replace(inMatch[0], "").trim() || "Reminder";
  }

  const atMatch = content.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (atMatch) {
    let h = parseInt(atMatch[1], 10);
    const m = atMatch[2] ? parseInt(atMatch[2], 10) : 0;
    const ampm = atMatch[3]?.toLowerCase();
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    dueAt = new Date();
    dueAt.setHours(h, m, 0, 0);
    if (dueAt <= new Date()) dueAt.setDate(dueAt.getDate() + 1);
    content = content.replace(atMatch[0], "").trim() || "Reminder";
  }

  const userId = platformUserId; // Use platform user as fallback
  await createReminder(
    userId,
    content || "Reminder",
    dueAt,
    platform,
    platformUserId,
  );
  return `Reminder set for ${dueAt.toLocaleString()}: ${content || "Reminder"}`;
}

/**
 * Get status for messaging user
 */
async function getMessagingStatus(
  platform: MessagingPlatform,
  userId: string,
): Promise<string> {
  const userPerms = getUserPermissions(userId);
  const effective = getEffectivePermissions(platform, userPerms || undefined);

  const lines = [
    `Platform: ${platform}`,
    `Free Agent: ${effective.freeAgentEnabled ? "Enabled" : "Disabled"}`,
    `Capabilities: ${effective.allowedCapabilities.join(", ") || "None"}`,
    `Rate limit: ${effective.rateLimitPerHour}/hour`,
  ];

  return lines.join("\n");
}

export async function processMessage(
  platform: MessagingPlatform,
  platformUserId: string,
  text: string,
): Promise<string> {
  const intent = parseIntent(text);

  // SHIP command
  if (intent.action === "ship") {
    const result = await executeShipFromMessaging(
      intent.projectDescription,
      platform,
      platformUserId,
    );
    if (result.ok) {
      return "SHIP started! I'll message you when it's done.";
    }
    return `Failed to start SHIP: ${result.error ?? "Unknown error"}`;
  }

  // Free Agent command
  if (intent.action === "freeagent") {
    return processFreeAgentCommand(platform, platformUserId, intent.command);
  }

  // Confirmation response
  if (intent.action === "confirm") {
    const confirmed = confirmRequest(intent.confirmationId, platformUserId);
    if (confirmed) {
      // Execute the confirmed action
      return `Confirmed. Executing ${confirmed.tool}...`;
    }
    return "Confirmation not found or expired.";
  }

  // Cancel response
  if (intent.action === "cancel") {
    if (intent.confirmationId) {
      cancelRequest(intent.confirmationId, platformUserId);
    }
    return "Cancelled.";
  }

  // Status check
  if (intent.action === "status") {
    return getMessagingStatus(platform, platformUserId);
  }

  // Reminder
  if (intent.action === "remind") {
    return handleReminderIntent(platform, platformUserId, intent.content);
  }

  // Code / G-Agent
  if (intent.action === "code") {
    return handleCodeIntent(platform, platformUserId, intent.description);
  }

  // Regular chat - check if Free Agent should handle it
  const userPerms = getUserPermissions(platformUserId);
  const effective = getEffectivePermissions(platform, userPerms || undefined);

  if (effective.freeAgentEnabled) {
    // Route through Free Agent for tool access
    return processFreeAgentCommand(platform, platformUserId, text);
  }

  // Standard chat without tools
  const conv = await getOrCreateConversationMem(platform, platformUserId);
  const nextMessages: ConversationMessage[] = [
    ...conv,
    { role: "user" as const, content: text || "(empty)" },
  ];

  const reply = await runChatAndGetReply(nextMessages);
  const updated = [
    ...nextMessages,
    { role: "assistant" as const, content: reply },
  ];
  await saveConversation(platform, platformUserId, updated);
  return reply;
}
