/**
 * Integration-domain database queries
 * Extracted from database.ts — audit logs, integrations, OAuth tokens, secrets
 */

import type { DatabaseService } from './database.js';
import type {
  IntegrationRecord,
  OAuthTokenRecord,
  IntegrationSecretRecord,
  AuditLogRecord,
  IntegrationProviderId,
} from '../types/integrations.js';

// ========== Audit Logs ==========

/** Save an audit log entry */
export async function saveAuditLog(this: DatabaseService, record: AuditLogRecord): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO audit_logs (id, user_id, actor, action, category, target, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    record.id,
    record.user_id,
    record.actor ?? null,
    record.action,
    record.category,
    record.target ?? null,
    record.metadata ? JSON.stringify(record.metadata) : null,
    record.created_at
  );
}

/** Get audit logs with filters */
export async function getAuditLogs(
  this: DatabaseService,
  options: {
    userId?: string;
    category?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<AuditLogRecord[]> {
  const db = this.getDb();
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: (string | number)[] = [];
  if (options.userId) {
    sql += ' AND user_id = ?';
    params.push(options.userId);
  }
  if (options.category) {
    sql += ' AND category = ?';
    params.push(options.category);
  }
  sql += ' ORDER BY created_at DESC';
  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }
  if (options.offset) {
    sql += ' OFFSET ?';
    params.push(options.offset);
  }
  const stmt = db.prepare(sql);
  return stmt.all(...params) as AuditLogRecord[];
}

// ========== Integrations ==========

/** Save an integration */
export async function saveIntegration(
  this: DatabaseService,
  record: IntegrationRecord
): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO integrations (id, user_id, provider, status, display_name, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      display_name = excluded.display_name,
      metadata = excluded.metadata,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    record.id,
    record.user_id,
    record.provider,
    record.status,
    record.display_name ?? null,
    record.metadata ?? null,
    record.created_at,
    record.updated_at
  );
}

/** Get integration by ID */
export async function getIntegration(
  this: DatabaseService,
  id: string
): Promise<IntegrationRecord | null> {
  const stmt = this.getStatement('SELECT * FROM integrations WHERE id = ?');
  return (stmt.get(id) as IntegrationRecord | undefined) ?? null;
}

/** Get integrations for user */
export async function getIntegrationsForUser(
  this: DatabaseService,
  userId: string
): Promise<IntegrationRecord[]> {
  const stmt = this.getStatement(
    'SELECT * FROM integrations WHERE user_id = ? ORDER BY created_at DESC'
  );
  return stmt.all(userId) as IntegrationRecord[];
}

/** Get integration by user and provider */
export async function getIntegrationByProvider(
  this: DatabaseService,
  userId: string,
  provider: IntegrationProviderId
): Promise<IntegrationRecord | null> {
  const stmt = this.getStatement('SELECT * FROM integrations WHERE user_id = ? AND provider = ?');
  return (stmt.get(userId, provider) as IntegrationRecord | undefined) ?? null;
}

/** Delete integration */
export async function deleteIntegration(this: DatabaseService, id: string): Promise<void> {
  const stmt = this.getStatement('DELETE FROM integrations WHERE id = ?');
  stmt.run(id);
}

// ========== OAuth Tokens ==========

/** Save OAuth token */
export async function saveOAuthToken(
  this: DatabaseService,
  record: OAuthTokenRecord
): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO oauth_tokens (id, user_id, provider, access_token_enc, refresh_token_enc, token_type, scope, expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, provider) DO UPDATE SET
      access_token_enc = excluded.access_token_enc,
      refresh_token_enc = excluded.refresh_token_enc,
      token_type = excluded.token_type,
      scope = excluded.scope,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    record.id,
    record.user_id,
    record.provider,
    record.access_token_enc,
    record.refresh_token_enc ?? null,
    record.token_type ?? null,
    record.scope ?? null,
    record.expires_at ?? null,
    record.created_at,
    record.updated_at
  );
}

/** Get OAuth token by user and provider */
export async function getOAuthToken(
  this: DatabaseService,
  userId: string,
  provider: IntegrationProviderId
): Promise<OAuthTokenRecord | null> {
  const stmt = this.getStatement('SELECT * FROM oauth_tokens WHERE user_id = ? AND provider = ?');
  return (stmt.get(userId, provider) as OAuthTokenRecord | undefined) ?? null;
}

/** Delete OAuth token */
export async function deleteOAuthToken(
  this: DatabaseService,
  userId: string,
  provider: IntegrationProviderId
): Promise<void> {
  const stmt = this.getStatement('DELETE FROM oauth_tokens WHERE user_id = ? AND provider = ?');
  stmt.run(userId, provider);
}

// ========== Integration Secrets ==========

/** Save integration secret */
export async function saveIntegrationSecret(
  this: DatabaseService,
  record: IntegrationSecretRecord
): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO integration_secrets (id, user_id, provider, name, secret_enc, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, provider, name) DO UPDATE SET
      secret_enc = excluded.secret_enc,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    record.id,
    record.user_id,
    record.provider,
    record.name,
    record.secret_enc,
    record.created_at,
    record.updated_at
  );
}

/** Get integration secret */
export async function getIntegrationSecret(
  this: DatabaseService,
  userId: string,
  provider: IntegrationProviderId,
  name: string
): Promise<IntegrationSecretRecord | null> {
  const stmt = this.getStatement(
    'SELECT * FROM integration_secrets WHERE user_id = ? AND provider = ? AND name = ?'
  );
  return (stmt.get(userId, provider, name) as IntegrationSecretRecord | undefined) ?? null;
}

/** Delete integration secret */
export async function deleteIntegrationSecret(
  this: DatabaseService,
  userId: string,
  provider: IntegrationProviderId,
  name: string
): Promise<void> {
  const stmt = this.getStatement(
    'DELETE FROM integration_secrets WHERE user_id = ? AND provider = ? AND name = ?'
  );
  stmt.run(userId, provider, name);
}

/**
 * Register all integration queries onto DatabaseService prototype
 */
export function registerIntegrationQueries(proto: typeof DatabaseService.prototype): void {
  proto.saveAuditLog = saveAuditLog;
  proto.getAuditLogs = getAuditLogs;
  proto.saveIntegration = saveIntegration;
  proto.getIntegration = getIntegration;
  proto.getIntegrationsForUser = getIntegrationsForUser;
  proto.getIntegrationByProvider = getIntegrationByProvider;
  proto.deleteIntegration = deleteIntegration;
  proto.saveOAuthToken = saveOAuthToken;
  proto.getOAuthToken = getOAuthToken;
  proto.deleteOAuthToken = deleteOAuthToken;
  proto.saveIntegrationSecret = saveIntegrationSecret;
  proto.getIntegrationSecret = getIntegrationSecret;
  proto.deleteIntegrationSecret = deleteIntegrationSecret;
}
