/**
 * Session coordination and planning tool definitions
 */

import type { Tool } from "../types.js";

// ============================================================================
// SESSION COORDINATION TOOLS
// ============================================================================

export const sessionsListTool: Tool = {
  name: "sessions_list",
  description: "Discover active sessions for agent coordination.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max sessions" },
    },
  },
};

export const sessionsHistoryTool: Tool = {
  name: "sessions_history",
  description: "Fetch session transcript/logs.",
  input_schema: {
    type: "object",
    properties: {
      sessionId: { type: "string", description: "Session ID" },
    },
    required: ["sessionId"],
  },
};

export const sessionsSendTool: Tool = {
  name: "sessions_send",
  description: "Send message to another session.",
  input_schema: {
    type: "object",
    properties: {
      sessionId: { type: "string", description: "Target session ID" },
      message: { type: "string", description: "Message to send" },
    },
    required: ["sessionId", "message"],
  },
};

// ============================================================================
// EXPORT ALL PLANNING TOOLS
// ============================================================================

export const PLANNING_TOOLS: Tool[] = [
  sessionsListTool,
  sessionsHistoryTool,
  sessionsSendTool,
];
