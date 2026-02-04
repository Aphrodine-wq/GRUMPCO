/**
 * Conversation Memory Service
 * Stub implementation for persistent conversation memory.
 */

import logger from "../middleware/logger.js";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface ConversationStore {
  messages: ConversationMessage[];
  userId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// In-memory store (replace with database in production)
const conversations = new Map<string, ConversationStore>();

function getConversationKey(platform: string, platformUserId: string): string {
  return `${platform}:${platformUserId}`;
}

/**
 * Get or create a conversation, returns the messages array.
 */
export async function getOrCreateConversation(
  platform: string,
  platformUserId: string,
  _userId?: string | null,
): Promise<ConversationMessage[]> {
  const key = getConversationKey(platform, platformUserId);
  
  if (conversations.has(key)) {
    return conversations.get(key)!.messages;
  }

  const store: ConversationStore = {
    messages: [],
    userId: _userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  conversations.set(key, store);
  logger.debug({ platform, platformUserId }, "Created new conversation");
  
  return store.messages;
}

/**
 * Save conversation messages.
 */
export async function saveConversation(
  platform: string,
  platformUserId: string,
  messages: ConversationMessage[],
  _userId?: string | null,
  _metadata?: Record<string, unknown>,
): Promise<void> {
  const key = getConversationKey(platform, platformUserId);
  const existing = conversations.get(key);
  
  const store: ConversationStore = {
    messages,
    userId: _userId ?? existing?.userId,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  conversations.set(key, store);
  logger.debug({ key, messageCount: messages.length }, "Saved conversation");
}

export async function deleteConversation(
  platform: string,
  platformUserId: string,
): Promise<boolean> {
  const key = getConversationKey(platform, platformUserId);
  return conversations.delete(key);
}

export async function getConversationHistory(
  platform: string,
  platformUserId: string,
  limit = 50,
): Promise<ConversationMessage[]> {
  const messages = await getOrCreateConversation(platform, platformUserId);
  return messages.slice(-limit);
}

export async function addMessage(
  platform: string,
  platformUserId: string,
  message: ConversationMessage,
): Promise<void> {
  const messages = await getOrCreateConversation(platform, platformUserId);
  messages.push({
    ...message,
    timestamp: message.timestamp || new Date().toISOString(),
  });
}

export async function clearConversation(
  platform: string,
  platformUserId: string,
): Promise<void> {
  const key = getConversationKey(platform, platformUserId);
  const existing = conversations.get(key);
  if (existing) {
    existing.messages = [];
    existing.updatedAt = new Date().toISOString();
  }
}
