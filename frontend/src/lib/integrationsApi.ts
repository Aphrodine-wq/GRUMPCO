/**
 * Integrations Platform API Client
 * Handles all communication with the integrations, approvals, heartbeats, and memory APIs
 */

import { fetchApi } from './api';

// ============================================================================
// Types
// ============================================================================

export type IntegrationProvider =
  | 'discord'
  | 'slack'
  | 'spotify'
  | 'obsidian'
  | 'gmail'
  | 'google_calendar'
  | 'notion'
  | 'twitter'
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'linear'
  | 'jira'
  | 'atlassian'
  | 'figma'
  | 'vercel'
  | 'netlify'
  | 'aws'
  | 'gcp'
  | 'azure'
  | 'supabase'
  | 'firebase'
  | 'home_assistant'
  | 'elevenlabs'
  | 'twilio'
  | 'telegram'
  | 'sendgrid'
  | 'stripe'
  | 'sentry'
  | 'datadog'
  | 'postman'
  | 'custom';

export type IntegrationStatus = 'active' | 'disabled' | 'error' | 'pending';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type RiskLevel = 'low' | 'medium' | 'high';
export type SwarmStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type MemoryType = 'conversation' | 'preference' | 'task' | 'fact' | 'context';

export interface Integration {
  id: string;
  userId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  displayName?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRequest {
  id: string;
  userId: string;
  status: ApprovalStatus;
  action: string;
  riskLevel: RiskLevel;
  reason?: string;
  payload?: Record<string, unknown>;
  expiresAt?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface Heartbeat {
  id: string;
  userId: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  payload?: Record<string, unknown>;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HeartbeatTemplate {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  payload: Record<string, unknown>;
}

export interface MemoryRecord {
  id: string;
  userId: string;
  type: MemoryType;
  content: string;
  importance: number;
  accessCount: number;
  lastAccessedAt?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SwarmAgent {
  id: string;
  userId: string;
  parentId?: string;
  name: string;
  status: SwarmStatus;
  agentType: string;
  taskDescription?: string;
  result?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  actor?: string;
  action: string;
  category: 'integration' | 'system' | 'security' | 'automation' | 'billing' | 'agent';
  target?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CostBudget {
  id: string;
  userId: string;
  period: 'daily' | 'weekly' | 'monthly';
  limitCents: number;
  spentCents: number;
  periodStart: string;
  periodEnd: string;
  notifyAtPercent: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Integrations API
// ============================================================================

export async function listIntegrations(): Promise<Integration[]> {
  const res = await fetchApi('/api/integrations-v2');
  if (!res.ok) throw new Error(`Failed to list integrations: ${res.status}`);
  const data = await res.json();
  return data.integrations || [];
}

export async function getIntegration(id: string): Promise<Integration> {
  const res = await fetchApi(`/api/integrations-v2/${id}`);
  if (!res.ok) throw new Error(`Failed to get integration: ${res.status}`);
  return res.json();
}

export async function createIntegration(
  provider: IntegrationProvider,
  displayName?: string,
  metadata?: Record<string, unknown>
): Promise<Integration> {
  const res = await fetchApi('/api/integrations-v2', {
    method: 'POST',
    body: JSON.stringify({ provider, displayName, metadata }),
  });
  if (!res.ok) throw new Error(`Failed to create integration: ${res.status}`);
  return res.json();
}

export async function updateIntegration(
  id: string,
  updates: { status?: IntegrationStatus; displayName?: string; metadata?: Record<string, unknown> }
): Promise<Integration> {
  const res = await fetchApi(`/api/integrations-v2/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Failed to update integration: ${res.status}`);
  return res.json();
}

export async function deleteIntegration(id: string): Promise<void> {
  const res = await fetchApi(`/api/integrations-v2/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete integration: ${res.status}`);
}

export async function getOAuthUrl(provider: IntegrationProvider): Promise<{ url: string }> {
  const res = await fetchApi(`/api/integrations-v2/oauth/${provider}/authorize`);
  if (!res.ok) throw new Error(`Failed to get OAuth URL: ${res.status}`);
  return res.json();
}

export async function setApiKey(
  provider: IntegrationProvider,
  apiKey: string,
  keyName: string = 'api_key'
): Promise<Integration> {
  const res = await fetchApi(`/api/integrations-v2/${provider}/api-key`, {
    method: 'POST',
    body: JSON.stringify({ apiKey, keyName }),
  });
  if (!res.ok) throw new Error(`Failed to set API key: ${res.status}`);
  return res.json();
}

export async function setBotToken(
  provider: IntegrationProvider,
  botToken: string
): Promise<Integration> {
  const res = await fetchApi(`/api/integrations-v2/${provider}/bot-token`, {
    method: 'POST',
    body: JSON.stringify({ botToken }),
  });
  if (!res.ok) throw new Error(`Failed to set bot token: ${res.status}`);
  return res.json();
}

// ============================================================================
// Approvals API
// ============================================================================

export async function listApprovals(status?: ApprovalStatus): Promise<ApprovalRequest[]> {
  const params = status ? `?status=${status}` : '';
  const res = await fetchApi(`/api/approvals${params}`);
  if (!res.ok) throw new Error(`Failed to list approvals: ${res.status}`);
  const data = await res.json();
  return data.approvals || [];
}

export async function getPendingApprovals(): Promise<ApprovalRequest[]> {
  return listApprovals('pending');
}

export async function getApproval(id: string): Promise<ApprovalRequest> {
  const res = await fetchApi(`/api/approvals/${id}`);
  if (!res.ok) throw new Error(`Failed to get approval: ${res.status}`);
  return res.json();
}

export async function approveRequest(id: string, approvedBy?: string): Promise<ApprovalRequest> {
  const res = await fetchApi(`/api/approvals/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvedBy }),
  });
  if (!res.ok) throw new Error(`Failed to approve request: ${res.status}`);
  return res.json();
}

export async function rejectRequest(id: string, reason?: string): Promise<ApprovalRequest> {
  const res = await fetchApi(`/api/approvals/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`Failed to reject request: ${res.status}`);
  return res.json();
}

// ============================================================================
// Figma API (Design-to-Code / Architecture mode)
// ============================================================================

export interface FigmaFile {
  key: string;
  name: string;
  thumbnail_url?: string;
  last_modified?: string;
}

export async function getFigmaAuthUrl(): Promise<{ url: string }> {
  const res = await fetchApi('/api/figma/auth-url');
  if (!res.ok) throw new Error('Failed to get Figma auth URL');
  return res.json();
}

export async function getFigmaMe(): Promise<{ connected: boolean }> {
  const res = await fetchApi('/api/figma/me');
  if (!res.ok) throw new Error('Failed to get Figma connection status');
  return res.json();
}

export async function getFigmaFiles(): Promise<FigmaFile[]> {
  const res = await fetchApi('/api/figma/files');
  if (!res.ok) throw new Error('Failed to list Figma files');
  const data = await res.json();
  return data.files ?? [];
}

// ============================================================================
// Heartbeats API
// ============================================================================

export async function listHeartbeats(): Promise<Heartbeat[]> {
  const res = await fetchApi('/api/heartbeats');
  if (!res.ok) throw new Error(`Failed to list heartbeats: ${res.status}`);
  const data = await res.json();
  return data.heartbeats || [];
}

export async function getHeartbeat(id: string): Promise<Heartbeat> {
  const res = await fetchApi(`/api/heartbeats/${id}`);
  if (!res.ok) throw new Error(`Failed to get heartbeat: ${res.status}`);
  return res.json();
}

export async function createHeartbeat(
  name: string,
  cronExpression: string,
  payload?: Record<string, unknown>
): Promise<Heartbeat> {
  const res = await fetchApi('/api/heartbeats', {
    method: 'POST',
    body: JSON.stringify({ name, cronExpression, payload }),
  });
  if (!res.ok) throw new Error(`Failed to create heartbeat: ${res.status}`);
  return res.json();
}

export async function updateHeartbeat(
  id: string,
  updates: {
    name?: string;
    cronExpression?: string;
    enabled?: boolean;
    payload?: Record<string, unknown>;
  }
): Promise<Heartbeat> {
  const res = await fetchApi(`/api/heartbeats/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Failed to update heartbeat: ${res.status}`);
  return res.json();
}

export async function deleteHeartbeat(id: string): Promise<void> {
  const res = await fetchApi(`/api/heartbeats/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete heartbeat: ${res.status}`);
}

export async function enableHeartbeat(id: string): Promise<Heartbeat> {
  const res = await fetchApi(`/api/heartbeats/${id}/enable`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to enable heartbeat: ${res.status}`);
  return res.json();
}

export async function disableHeartbeat(id: string): Promise<Heartbeat> {
  const res = await fetchApi(`/api/heartbeats/${id}/disable`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to disable heartbeat: ${res.status}`);
  return res.json();
}

export async function getHeartbeatTemplates(): Promise<HeartbeatTemplate[]> {
  const res = await fetchApi('/api/heartbeats/templates');
  if (!res.ok) throw new Error(`Failed to get templates: ${res.status}`);
  const data = await res.json();
  return data.templates || [];
}

export async function createFromTemplate(templateId: string, name?: string): Promise<Heartbeat> {
  const res = await fetchApi('/api/heartbeats/from-template', {
    method: 'POST',
    body: JSON.stringify({ templateId, name }),
  });
  if (!res.ok) throw new Error(`Failed to create from template: ${res.status}`);
  return res.json();
}

// ============================================================================
// Memory API (via existing /api/memory endpoint)
// ============================================================================

export async function listMemories(type?: MemoryType, limit?: number): Promise<MemoryRecord[]> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (limit) params.set('limit', limit.toString());
  const query = params.toString() ? `?${params}` : '';
  const res = await fetchApi(`/api/memory${query}`);
  if (!res.ok) throw new Error(`Failed to list memories: ${res.status}`);
  const data = await res.json();
  return data.memories || [];
}

export async function createMemory(
  type: MemoryType,
  content: string,
  importance?: number,
  metadata?: Record<string, unknown>
): Promise<MemoryRecord> {
  const res = await fetchApi('/api/memory', {
    method: 'POST',
    body: JSON.stringify({ type, content, importance, metadata }),
  });
  if (!res.ok) throw new Error(`Failed to create memory: ${res.status}`);
  return res.json();
}

export async function deleteMemory(id: string): Promise<void> {
  const res = await fetchApi(`/api/memory/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete memory: ${res.status}`);
}

export async function searchMemories(query: string, limit?: number): Promise<MemoryRecord[]> {
  const res = await fetchApi('/api/memory/search', {
    method: 'POST',
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) throw new Error(`Failed to search memories: ${res.status}`);
  const data = await res.json();
  return data.memories || [];
}

// ============================================================================
// Audit Log API
// ============================================================================

export async function listAuditLogs(options?: {
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  if (options?.category) params.set('category', options.category);
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.offset) params.set('offset', options.offset.toString());
  const query = params.toString() ? `?${params}` : '';
  const res = await fetchApi(`/api/integrations-v2/audit-logs${query}`);
  if (!res.ok) throw new Error(`Failed to list audit logs: ${res.status}`);
  const data = await res.json();
  return data.logs || [];
}

// ============================================================================
// Swarm API
// ============================================================================

export async function listSwarmAgents(status?: SwarmStatus): Promise<SwarmAgent[]> {
  const params = status ? `?status=${status}` : '';
  const res = await fetchApi(`/api/agents/swarm${params}`);
  if (!res.ok) throw new Error(`Failed to list swarm agents: ${res.status}`);
  const data = await res.json();
  return data.agents || [];
}

export async function createSwarmAgent(
  name: string,
  agentType: string,
  taskDescription?: string,
  parentId?: string
): Promise<SwarmAgent> {
  const res = await fetchApi('/api/agents/swarm', {
    method: 'POST',
    body: JSON.stringify({ name, agentType, taskDescription, parentId }),
  });
  if (!res.ok) throw new Error(`Failed to create swarm agent: ${res.status}`);
  return res.json();
}

export async function cancelSwarmAgent(id: string): Promise<SwarmAgent> {
  const res = await fetchApi(`/api/agents/swarm/${id}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to cancel swarm agent: ${res.status}`);
  return res.json();
}

// ============================================================================
// Cost Budget API
// ============================================================================

export async function getCostBudget(): Promise<CostBudget | null> {
  const res = await fetchApi('/api/cost/budget');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get cost budget: ${res.status}`);
  return res.json();
}

export async function setCostBudget(
  limitCents: number,
  period: 'daily' | 'weekly' | 'monthly' = 'monthly',
  notifyAtPercent: number = 80
): Promise<CostBudget> {
  const res = await fetchApi('/api/cost/budget', {
    method: 'POST',
    body: JSON.stringify({ limitCents, period, notifyAtPercent }),
  });
  if (!res.ok) throw new Error(`Failed to set cost budget: ${res.status}`);
  return res.json();
}

// ============================================================================
// Provider Icons & Metadata
// ============================================================================

export const PROVIDER_METADATA: Record<
  IntegrationProvider,
  {
    name: string;
    icon: string;
    color: string;
    description: string;
    authType: 'oauth' | 'api_key' | 'bot_token' | 'local';
  }
> = {
  discord: {
    name: 'Discord',
    icon: 'M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z',
    color: '#5865F2',
    description:
      'Send messages, manage servers, and interact with Discord communities (OAuth for user access, bot token for bots)',
    authType: 'oauth',
  },
  slack: {
    name: 'Slack',
    icon: 'M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z',
    color: '#4A154B',
    description: 'Send messages, manage channels, and automate Slack workflows',
    authType: 'oauth',
  },
  spotify: {
    name: 'Spotify',
    icon: 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z',
    color: '#1DB954',
    description: 'Control playback, search music, and manage playlists',
    authType: 'oauth',
  },
  obsidian: {
    name: 'Obsidian',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    color: '#7C3AED',
    description: 'Read and write notes, search your knowledge base',
    authType: 'local',
  },
  gmail: {
    name: 'Gmail',
    icon: 'M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z',
    color: '#EA4335',
    description: 'Read, send, and manage emails',
    authType: 'oauth',
  },
  google_calendar: {
    name: 'Google Calendar',
    icon: 'M18 4V3h-2v1H8V3H6v1H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1zM5 8h14v12H5V8z',
    color: '#4285F4',
    description: 'View and manage calendar events',
    authType: 'oauth',
  },
  notion: {
    name: 'Notion',
    icon: 'M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zM5.253 7.51v14.035c0 .746.373 1.026 1.213.98l14.523-.84c.84-.046.932-.56.932-1.166V6.622c0-.606-.233-.886-.746-.84l-15.176.886c-.56.046-.746.28-.746.84zm14.336.886c.093.42 0 .84-.42.886l-.7.14v10.398c-.606.326-1.166.513-1.633.513-.746 0-.932-.233-1.492-.933l-4.571-7.178v6.945l1.446.326s0 .84-1.166.84l-3.219.186c-.093-.186 0-.653.326-.746l.84-.233v-9.18l-1.166-.093s0-.84.746-.886l3.452-.233 4.758 7.271v-6.432l-1.212-.14c-.093-.513.28-.886.746-.932l3.265-.187zM2.665 1.455l13.542-.886c1.679-.14 2.1.046 2.8.56l3.779 2.661c.466.326.606.746.606 1.213v16.042c0 1.026-.373 1.633-1.679 1.726l-15.456.933c-.98.046-1.446-.093-1.96-.746l-3.126-4.061c-.56-.746-.793-1.306-.793-1.959V2.667c0-.84.373-1.166 1.306-1.212h.981z',
    color: '#000000',
    description: 'Access and update Notion databases and pages',
    authType: 'oauth',
  },
  twitter: {
    name: 'Twitter/X',
    icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
    color: '#000000',
    description: 'Post tweets and interact with Twitter/X',
    authType: 'oauth',
  },
  github: {
    name: 'GitHub',
    icon: 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z',
    color: '#181717',
    description: 'Manage repositories, issues, and pull requests',
    authType: 'oauth',
  },
  linear: {
    name: 'Linear',
    icon: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-.5 5h1v7h-1V5zm0 9h1v2h-1v-2z',
    color: '#5E6AD2',
    description: 'Manage issues and projects in Linear',
    authType: 'oauth',
  },
  gitlab: {
    name: 'GitLab',
    icon: 'M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z',
    color: '#FC6D26',
    description: 'Git repos, CI/CD, and issue tracking',
    authType: 'oauth',
  },
  bitbucket: {
    name: 'Bitbucket',
    icon: 'M2.65 3.16l.07.09 2.52 6.98c.06.2.09.4.09.6 0 .2-.03.4-.09.6L.07 20.84l-.07.09c.22.13.48.2.74.2h20.52c.26 0 .52-.07.74-.2l-.07-.09-2.52-6.98a2.1 2.1 0 0 1-.09-.6c0-.2.03-.4.09-.6l2.52-6.98.07-.09c-.22-.13-.48-.2-.74-.2H3.39c-.26 0-.52.07-.74.2zM14 14.5H10l-1.5 4.5h-3L11 3.5h2l5.5 15.5h-3L14 14.5z',
    color: '#0052CC',
    description: 'Git repositories and pull requests',
    authType: 'oauth',
  },
  jira: {
    name: 'Jira',
    icon: 'M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214h2.129A5.215 5.215 0 0 0 24 12.518V7.758a1.001 1.001 0 0 0-1.001-1.001h-.705z',
    color: '#0052CC',
    description: 'Issue tracking and project management',
    authType: 'oauth',
  },
  atlassian: {
    name: 'Atlassian',
    icon: 'M7.12 11.084a.683.683 0 0 0-1.16.126L.075 22.974a.703.703 0 0 0 .63 1.018h8.19a.69.69 0 0 0 .627-.396l2.618-6.033-4.992-6.48zM23.925 11.084l-5.885-9.872a.683.683 0 0 0-1.16-.126L6.014 12.11l4.992 6.48 6.005-13.807a.704.704 0 0 0-.086-.699z',
    color: '#0052CC',
    description: 'Jira, Confluence, Trello, and more',
    authType: 'oauth',
  },
  telegram: {
    name: 'Telegram',
    icon: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
    color: '#26A5E4',
    description: 'Send and receive messages via Telegram bots',
    authType: 'api_key',
  },
  vercel: {
    name: 'Vercel',
    icon: 'M24 22.525H0l12-21.05 12 21.05z',
    color: '#000000',
    description: 'Deploy and manage frontend projects',
    authType: 'oauth',
  },
  netlify: {
    name: 'Netlify',
    icon: 'M15.519 0H8.481C3.77 0 0 3.77 0 8.481v7.038C0 20.23 3.77 24 8.481 24h7.038C20.23 24 24 20.23 24 15.519V8.481C24 3.77 20.23 0 15.519 0zM12 17.25a5.25 5.25 0 1 1 0-10.5 5.25 5.25 0 0 1 0 10.5z',
    color: '#00C7B7',
    description: 'Deploy and host static sites',
    authType: 'oauth',
  },
  aws: {
    name: 'AWS',
    icon: 'M6.763 10.036c0 .296.032.535.088.71.064.184.152.368.272.536.128.176.28.336.456.464.176.136.376.24.6.328.224.08.464.136.712.168.248.032.496.048.744.048.272 0 .536-.024.792-.072.256-.048.488-.12.696-.216.208-.096.384-.216.528-.36.144-.152.248-.336.312-.552.032-.112.048-.248.048-.408 0-.208-.04-.408-.12-.6-.08-.2-.208-.384-.384-.552-.176-.168-.416-.312-.72-.432-.304-.12-.688-.208-1.152-.264-.416-.048-.848-.072-1.296-.072-.448 0-.896.024-1.344.072-.448.056-.872.144-1.272.264-.392.12-.736.272-1.032.456-.296.184-.536.4-.72.648-.184.248-.296.528-.336.84h1.248c.016-.152.064-.288.144-.408.08-.128.176-.24.296-.336.12-.096.256-.168.416-.216.16-.056.336-.088.528-.096.192-.016.392-.008.6.024.208.032.408.088.6.168.192.08.368.184.528.312.16.128.288.28.384.456.096.176.144.376.144.6 0 .224-.04.44-.12.648-.08.208-.2.4-.36.576-.16.176-.36.336-.6.48-.24.144-.52.264-.84.36-.32.096-.672.168-1.056.216-.384.056-.792.088-1.224.096v1.056h.768c.448 0 .872.048 1.272.144.4.096.752.24 1.056.432.304.192.544.44.72.744.176.304.264.672.264 1.104 0 .416-.088.8-.264 1.152-.176.352-.424.656-.744.912-.32.256-.704.456-1.152.6-.448.144-.952.216-1.512.216-.576 0-1.112-.08-1.608-.24-.496-.16-.928-.392-1.296-.696-.368-.304-.656-.672-.864-1.104-.208-.432-.312-.912-.312-1.44h-1.272c0 .592.12 1.136.36 1.632.24.496.576.92 1.008 1.272.432.352.944.624 1.536.816.592.192 1.248.288 1.968.288.688 0 1.328-.088 1.92-.264.592-.176 1.112-.432 1.56-.768.448-.344.816-.752 1.104-1.224.288-.472.432-1 .432-1.584 0-.576-.12-1.088-.36-1.536-.24-.456-.576-.848-1.008-1.176-.432-.328-.944-.576-1.536-.744-.592-.168-1.248-.252-1.968-.252-.224 0-.456.008-.696.024-.24.016-.472.04-.696.072v-1.2c.272-.032.552-.056.84-.072.288-.016.576-.024.864-.024z',
    color: '#FF9900',
    description: 'Amazon Web Services – deploy and manage cloud resources',
    authType: 'oauth',
  },
  gcp: {
    name: 'Google Cloud',
    icon: 'M12.19 2.38a9.34 9.34 0 0 0-9.5 9.5 9.34 9.34 0 0 0 9.5 9.5 9.34 9.34 0 0 0 9.5-9.5 9.34 9.34 0 0 0-9.5-9.5zm5.3 13.6a9.51 9.51 0 0 1-7.27 2.09 6.73 6.73 0 0 1 3.8-6.32 5.65 5.65 0 0 0-3.51 1 5.66 5.66 0 0 0-2.09 4.24 5.66 5.66 0 0 0 5.66 5.66 5.66 5.66 0 0 0 4.41-2.09 9.51 9.51 0 0 1-1.1 1.82zm.49-5.84a6.73 6.73 0 0 1-2.09 7.27 9.51 9.51 0 0 1-1.82-1.1 5.66 5.66 0 0 0 4.41-2.09 5.66 5.66 0 0 0 0-8.02 9.51 9.51 0 0 1 1.5 1.94zm-10.78 4.41a6.73 6.73 0 0 1 2.09-7.27 9.51 9.51 0 0 1 1.82 1.1 5.66 5.66 0 0 0-4.41 2.09 5.66 5.66 0 0 0 0 8.02 9.51 9.51 0 0 1-1.5-1.94zm13.56 2.09a6.73 6.73 0 0 1-7.27 2.09 9.51 9.51 0 0 1 1.1-1.82 5.66 5.66 0 0 0 4.41 2.09 5.66 5.66 0 0 0 5.66-5.66 9.51 9.51 0 0 1 1.1 1.3z',
    color: '#4285F4',
    description: 'Google Cloud Platform – compute, storage, and APIs',
    authType: 'oauth',
  },
  azure: {
    name: 'Azure',
    icon: 'M5.483 21.3H24L14.025 4.013l-3.038 8.347 5.836 6.94L5.483 21.3zM13.23 2.7L6.105 8.677 0 21.253h5.505v.014L13.23 2.7z',
    color: '#0089D6',
    description: 'Microsoft Azure – cloud services',
    authType: 'oauth',
  },
  supabase: {
    name: 'Supabase',
    icon: 'M3.5 3.5v17l8.5 4 8.5-4v-17l-8.5-4-8.5 4zm8.5 10.5l-5-5h3V5h4v4h3l-5 5z',
    color: '#3ECF8E',
    description: 'Database, auth, and realtime backend',
    authType: 'api_key',
  },
  firebase: {
    name: 'Firebase',
    icon: 'M3.89 15.673L6.255 2.02a.453.453 0 0 1 .847-.145l2.12 3.98 4.4-4.399-.001-.001 1.414 1.414-5.814 5.814-2.122-2.12-2.475 4.94-3.75-3.768zm15.716 2.292l-1.414-1.414 4.4-4.4-2.12-3.98a.454.454 0 0 0-.847.145L17.11 15.673l-3.75 3.768 2.475 4.94-2.122 2.12-5.814-5.814.001-.001 1.414-1.414 4.4 4.4 2.12 3.98a.453.453 0 0 0 .847.145l2.365-13.652z',
    color: '#FFCA28',
    description: 'Google Firebase – app backend and analytics',
    authType: 'api_key',
  },
  figma: {
    name: 'Figma',
    icon: 'M5 5.5A5.5 5.5 0 0 1 10.5 0H12v11H10.5A5.5 5.5 0 0 1 5 5.5zm5.5-3A3 3 0 0 0 7.5 5.5a3 3 0 0 0 3 3H12V2.5h-1.5zM12 0h1.5a5.5 5.5 0 1 1 0 11H12V0zm0 2.5V8h1.5a2.75 2.75 0 1 0 0-5.5H12zM5 18.5A5.5 5.5 0 0 1 10.5 13H12v5.5a5.5 5.5 0 1 1-7-5.286V18.5zm5.5-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5 12a5.5 5.5 0 1 1 5.5 5.5H12V6.5H10.5A5.5 5.5 0 0 1 5 12zm5.5-3a3 3 0 1 0 0 6h1.5V9h-1.5z',
    color: '#F24E1E',
    description: 'Access Figma designs and components',
    authType: 'oauth',
  },
  home_assistant: {
    name: 'Home Assistant',
    icon: 'M12 0L1.75 6v12L12 24l10.25-6V6L12 0zm0 3.4L18.5 7v4l-5.25 3.05v6.1L8.5 17V7L12 3.4z',
    color: '#41BDF5',
    description: 'Control smart home devices and automations',
    authType: 'api_key',
  },
  elevenlabs: {
    name: 'ElevenLabs',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    color: '#000000',
    description: 'Text-to-speech and voice synthesis',
    authType: 'api_key',
  },
  twilio: {
    name: 'Twilio',
    icon: 'M12 0C5.381 0 0 5.381 0 12s5.381 12 12 12 12-5.381 12-12S18.619 0 12 0zm0 4.5c1.657 0 3 1.343 3 3s-1.343 3-3 3-3-1.343-3-3 1.343-3 3-3zm0 15c-2.761 0-5-2.239-5-5h10c0 2.761-2.239 5-5 5z',
    color: '#F22F46',
    description: 'Send SMS, make calls, and manage communications',
    authType: 'oauth',
  },
  sendgrid: {
    name: 'SendGrid',
    icon: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.514 0 10 4.486 10 10s-4.486 10-10 10S2 17.514 2 12 6.486 2 12 2z',
    color: '#1A82E2',
    description: 'Send transactional and marketing emails',
    authType: 'api_key',
  },
  stripe: {
    name: 'Stripe',
    icon: 'M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z',
    color: '#635BFF',
    description: 'Manage payments and subscriptions via Stripe Connect',
    authType: 'oauth',
  },
  sentry: {
    name: 'Sentry',
    icon: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8zm-1 4h2v6h-2V8zm0 8h2v2h-2v-2z',
    color: '#362D59',
    description: 'Error tracking and performance monitoring for applications',
    authType: 'api_key',
  },
  datadog: {
    name: 'Datadog',
    icon: 'M12 0L0 6v2h2v10h4V8h4V6h2V4L12 0zm0 6v12l10-6V6L12 6z',
    color: '#632CA6',
    description: 'Infrastructure monitoring, APM, and log management',
    authType: 'api_key',
  },
  postman: {
    name: 'Postman',
    icon: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.514 0 10 4.486 10 10s-4.486 10-10 10S2 17.514 2 12 6.486 2 12 2zm0 4v12l8-6-8-6z',
    color: '#FF6C37',
    description: 'API development, testing, and documentation',
    authType: 'api_key',
  },
  custom: {
    name: 'Custom Integration',
    icon: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5a1 1 0 0 1 1-1z',
    color: '#6B7280',
    description: 'Connect any custom API or service',
    authType: 'api_key',
  },
};
