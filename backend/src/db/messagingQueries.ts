/**
 * Messaging-domain database queries
 * Extracted from database.ts — Slack, conversation memory, messaging subscriptions, reminders
 */

import type { DatabaseService } from './database.js';
import type {
  SlackTokenRecord,
  ConversationMemoryRecord,
  MessagingSubscriptionRecord,
  SlackUserPairingRecord,
  ReminderRecord,
} from '../types/integrations.js';

// ========== Slack Tokens ==========

/** Save or update Slack token */
export async function saveSlackToken(
  this: DatabaseService,
  record: SlackTokenRecord
): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO slack_tokens (id, user_id, workspace_id, workspace_name, access_token_enc, bot_user_id, scope, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, workspace_id) DO UPDATE SET
      workspace_name = excluded.workspace_name,
      access_token_enc = excluded.access_token_enc,
      bot_user_id = excluded.bot_user_id,
      scope = excluded.scope,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    record.id,
    record.user_id,
    record.workspace_id,
    record.workspace_name ?? null,
    record.access_token_enc,
    record.bot_user_id ?? null,
    record.scope ?? null,
    record.created_at,
    record.updated_at
  );
}

/** Get Slack token by user and workspace */
export async function getSlackToken(
  this: DatabaseService,
  userId: string,
  workspaceId: string
): Promise<SlackTokenRecord | null> {
  const stmt = this.getStatement(
    'SELECT * FROM slack_tokens WHERE user_id = ? AND workspace_id = ?'
  );
  return (stmt.get(userId, workspaceId) as SlackTokenRecord | undefined) ?? null;
}

/** Get any Slack token for a workspace (for replying to messages from any user in the workspace) */
export async function getSlackTokenByWorkspace(
  this: DatabaseService,
  workspaceId: string
): Promise<SlackTokenRecord | null> {
  const stmt = this.getStatement(
    'SELECT * FROM slack_tokens WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 1'
  );
  return (stmt.get(workspaceId) as SlackTokenRecord | undefined) ?? null;
}

/** Get all Slack tokens for a user */
export async function getSlackTokensForUser(
  this: DatabaseService,
  userId: string
): Promise<SlackTokenRecord[]> {
  const stmt = this.getStatement(
    'SELECT * FROM slack_tokens WHERE user_id = ? ORDER BY created_at DESC'
  );
  return stmt.all(userId) as SlackTokenRecord[];
}

/** Delete Slack token */
export async function deleteSlackToken(
  this: DatabaseService,
  userId: string,
  workspaceId: string
): Promise<void> {
  const stmt = this.getStatement('DELETE FROM slack_tokens WHERE user_id = ? AND workspace_id = ?');
  stmt.run(userId, workspaceId);
}

// ========== Conversation Memories ==========

/** Get or create conversation memory */
export async function getConversationMemory(
  this: DatabaseService,
  platform: string,
  platformUserId: string
): Promise<ConversationMemoryRecord | null> {
  const stmt = this.getStatement(
    'SELECT * FROM conversation_memories WHERE platform = ? AND platform_user_id = ?'
  );
  return (stmt.get(platform, platformUserId) as ConversationMemoryRecord | undefined) ?? null;
}

/** Save conversation memory */
export async function saveConversationMemory(
  this: DatabaseService,
  record: ConversationMemoryRecord
): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO conversation_memories (id, platform, platform_user_id, user_id, messages, summary, updated_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(platform, platform_user_id) DO UPDATE SET
      user_id = excluded.user_id,
      messages = excluded.messages,
      summary = excluded.summary,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    record.id,
    record.platform,
    record.platform_user_id,
    record.user_id ?? null,
    record.messages,
    record.summary ?? null,
    record.updated_at,
    record.created_at
  );
}

// ========== Messaging Subscriptions ==========

/** Get messaging subscriptions for a user */
export async function getMessagingSubscriptions(
  this: DatabaseService,
  userId: string
): Promise<MessagingSubscriptionRecord[]> {
  const stmt = this.getStatement(
    'SELECT * FROM messaging_subscriptions WHERE user_id = ? ORDER BY created_at DESC'
  );
  return stmt.all(userId) as MessagingSubscriptionRecord[];
}

/** Save messaging subscription */
export async function saveMessagingSubscription(
  this: DatabaseService,
  record: MessagingSubscriptionRecord
): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO messaging_subscriptions (id, user_id, platform, platform_user_id, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, platform, platform_user_id) DO NOTHING
  `);
  stmt.run(record.id, record.user_id, record.platform, record.platform_user_id, record.created_at);
}

/** Delete messaging subscription */
export async function deleteMessagingSubscription(
  this: DatabaseService,
  userId: string,
  platform: string,
  platformUserId: string
): Promise<void> {
  const stmt = this.getStatement(
    'DELETE FROM messaging_subscriptions WHERE user_id = ? AND platform = ? AND platform_user_id = ?'
  );
  stmt.run(userId, platform, platformUserId);
}

// ========== Slack User Pairings ==========

/** Save Slack user pairing */
export async function saveSlackUserPairing(
  this: DatabaseService,
  record: SlackUserPairingRecord
): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO slack_user_pairings (slack_user_id, workspace_id, grump_user_id, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(slack_user_id, workspace_id) DO UPDATE SET
      grump_user_id = excluded.grump_user_id,
      created_at = excluded.created_at
  `);
  stmt.run(record.slack_user_id, record.workspace_id, record.grump_user_id, record.created_at);
}

/** Get G-Rump user ID from Slack user and workspace */
export async function getGrumpUserIdFromSlack(
  this: DatabaseService,
  slackUserId: string,
  workspaceId: string
): Promise<string | null> {
  const stmt = this.getStatement(
    'SELECT grump_user_id FROM slack_user_pairings WHERE slack_user_id = ? AND workspace_id = ?'
  );
  const row = stmt.get(slackUserId, workspaceId) as { grump_user_id: string } | undefined;
  return row?.grump_user_id ?? null;
}

// ========== Reminders ==========

export async function saveReminder(this: DatabaseService, record: ReminderRecord): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO reminders (id, user_id, content, due_at, platform, platform_user_id, notified, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      due_at = excluded.due_at,
      notified = excluded.notified,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    record.id,
    record.user_id,
    record.content,
    record.due_at,
    record.platform ?? null,
    record.platform_user_id ?? null,
    record.notified ?? 0,
    record.created_at,
    record.updated_at
  );
}

export async function getDueReminders(
  this: DatabaseService,
  before: string
): Promise<ReminderRecord[]> {
  const stmt = this.getStatement(
    'SELECT * FROM reminders WHERE due_at <= ? AND notified = 0 ORDER BY due_at ASC'
  );
  const rows = stmt.all(before) as ReminderRecord[];
  return rows.map((r) => ({ ...r, notified: r.notified ?? 0 }));
}

export async function getRemindersForUser(
  this: DatabaseService,
  userId: string
): Promise<ReminderRecord[]> {
  const stmt = this.getStatement('SELECT * FROM reminders WHERE user_id = ? ORDER BY due_at ASC');
  const rows = stmt.all(userId) as ReminderRecord[];
  return rows.map((r) => ({ ...r, notified: r.notified ?? 0 }));
}

export async function setReminderNotified(this: DatabaseService, id: string): Promise<void> {
  const stmt = this.getStatement('UPDATE reminders SET notified = 1, updated_at = ? WHERE id = ?');
  stmt.run(new Date().toISOString(), id);
}

/**
 * Register all messaging queries onto DatabaseService prototype
 */
export function registerMessagingQueries(proto: typeof DatabaseService.prototype): void {
  proto.saveSlackToken = saveSlackToken;
  proto.getSlackToken = getSlackToken;
  proto.getSlackTokenByWorkspace = getSlackTokenByWorkspace;
  proto.getSlackTokensForUser = getSlackTokensForUser;
  proto.deleteSlackToken = deleteSlackToken;
  proto.getConversationMemory = getConversationMemory;
  proto.saveConversationMemory = saveConversationMemory;
  proto.getMessagingSubscriptions = getMessagingSubscriptions;
  proto.saveMessagingSubscription = saveMessagingSubscription;
  proto.deleteMessagingSubscription = deleteMessagingSubscription;
  proto.saveSlackUserPairing = saveSlackUserPairing;
  proto.getGrumpUserIdFromSlack = getGrumpUserIdFromSlack;
  proto.saveReminder = saveReminder;
  proto.getDueReminders = getDueReminders;
  proto.getRemindersForUser = getRemindersForUser;
  proto.setReminderNotified = setReminderNotified;
}
