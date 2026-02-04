/**
 * Tests for integrationsApi
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listIntegrations,
  getIntegration,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  getOAuthUrl,
  setApiKey,
  setBotToken,
  listApprovals,
  getPendingApprovals,
  getApproval,
  approveRequest,
  rejectRequest,
  listHeartbeats,
  getHeartbeat,
  createHeartbeat,
  updateHeartbeat,
  deleteHeartbeat,
  enableHeartbeat,
  disableHeartbeat,
  getHeartbeatTemplates,
  createFromTemplate,
  listMemories,
  createMemory,
  deleteMemory,
  searchMemories,
  listAuditLogs,
  listSwarmAgents,
  createSwarmAgent,
  cancelSwarmAgent,
  getCostBudget,
  setCostBudget,
  PROVIDER_METADATA,
  type IntegrationProvider,
} from './integrationsApi';

// Mock the api module
vi.mock('./api', () => ({
  fetchApi: vi.fn(),
}));

import { fetchApi } from './api';

const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

describe('integrationsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Integrations', () => {
    it('should list integrations', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            integrations: [
              {
                id: 'int-1',
                provider: 'github',
                status: 'active',
                userId: 'user-1',
                createdAt: '2024-01-01',
                updatedAt: '2024-01-01',
              },
            ],
          }),
      });

      const result = await listIntegrations();

      expect(result).toHaveLength(1);
      expect(result[0].provider).toBe('github');
    });

    it('should get single integration', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'int-1',
            provider: 'github',
            status: 'active',
            userId: 'user-1',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          }),
      });

      const result = await getIntegration('int-1');

      expect(result.id).toBe('int-1');
    });

    it('should create integration', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'int-2',
            provider: 'slack',
            status: 'pending',
            userId: 'user-1',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          }),
      });

      const result = await createIntegration('slack', 'My Slack');

      expect(result.provider).toBe('slack');
    });

    it('should update integration', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'int-1',
            provider: 'github',
            status: 'disabled',
            userId: 'user-1',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          }),
      });

      const result = await updateIntegration('int-1', { status: 'disabled' });

      expect(result.status).toBe('disabled');
    });

    it('should delete integration', async () => {
      mockFetchApi.mockResolvedValue({ ok: true });

      await expect(deleteIntegration('int-1')).resolves.not.toThrow();
    });

    it('should get OAuth URL', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: 'https://oauth.provider.com/authorize' }),
      });

      const result = await getOAuthUrl('github');

      expect(result.url).toBe('https://oauth.provider.com/authorize');
    });

    it('should set API key', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'int-1',
            provider: 'home_assistant',
            status: 'active',
            userId: 'user-1',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          }),
      });

      const result = await setApiKey('home_assistant', 'secret-key-123');

      expect(result.provider).toBe('home_assistant');
    });

    it('should set bot token', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'int-1',
            provider: 'discord',
            status: 'active',
            userId: 'user-1',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          }),
      });

      const result = await setBotToken('discord', 'bot-token-123');

      expect(result.provider).toBe('discord');
    });
  });

  describe('Approvals', () => {
    it('should list approvals', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            approvals: [
              {
                id: 'app-1',
                action: 'deploy',
                status: 'pending',
                userId: 'user-1',
                riskLevel: 'medium',
                createdAt: '2024-01-01',
              },
            ],
          }),
      });

      const result = await listApprovals('pending');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });

    it('should get pending approvals', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            approvals: [
              {
                id: 'app-1',
                action: 'deploy',
                status: 'pending',
                userId: 'user-1',
                riskLevel: 'high',
                createdAt: '2024-01-01',
              },
            ],
          }),
      });

      const result = await getPendingApprovals();

      expect(result[0].riskLevel).toBe('high');
    });

    it('should get single approval', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'app-1',
            action: 'deploy',
            status: 'pending',
            userId: 'user-1',
            riskLevel: 'medium',
            createdAt: '2024-01-01',
          }),
      });

      const result = await getApproval('app-1');

      expect(result.id).toBe('app-1');
    });

    it('should approve request', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'app-1',
            action: 'deploy',
            status: 'approved',
            userId: 'user-1',
            riskLevel: 'medium',
            createdAt: '2024-01-01',
            resolvedAt: '2024-01-02',
          }),
      });

      const result = await approveRequest('app-1', 'admin');

      expect(result.status).toBe('approved');
    });

    it('should reject request', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'app-1',
            action: 'deploy',
            status: 'rejected',
            userId: 'user-1',
            riskLevel: 'high',
            createdAt: '2024-01-01',
            resolvedAt: '2024-01-02',
          }),
      });

      const result = await rejectRequest('app-1', 'Too risky');

      expect(result.status).toBe('rejected');
    });
  });

  describe('Heartbeats', () => {
    it('should list heartbeats', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            heartbeats: [
              {
                id: 'hb-1',
                name: 'Daily Backup',
                cronExpression: '0 0 * * *',
                enabled: true,
                userId: 'user-1',
                createdAt: '2024-01-01',
                updatedAt: '2024-01-01',
              },
            ],
          }),
      });

      const result = await listHeartbeats();

      expect(result).toHaveLength(1);
    });

    it('should get single heartbeat', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'hb-1',
            name: 'Daily Backup',
            cronExpression: '0 0 * * *',
            enabled: true,
            userId: 'user-1',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          }),
      });

      const result = await getHeartbeat('hb-1');

      expect(result.id).toBe('hb-1');
    });

    it('should create heartbeat', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'hb-2',
            name: 'Weekly Report',
            cronExpression: '0 9 * * 1',
            enabled: true,
            userId: 'user-1',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          }),
      });

      const result = await createHeartbeat('Weekly Report', '0 9 * * 1', {
        reportType: 'analytics',
      });

      expect(result.name).toBe('Weekly Report');
    });

    it('should update heartbeat', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'hb-1',
            name: 'Daily Backup',
            cronExpression: '0 0 * * *',
            enabled: false,
            userId: 'user-1',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-02',
          }),
      });

      const result = await updateHeartbeat('hb-1', { enabled: false });

      expect(result.enabled).toBe(false);
    });

    it('should delete heartbeat', async () => {
      mockFetchApi.mockResolvedValue({ ok: true });

      await expect(deleteHeartbeat('hb-1')).resolves.not.toThrow();
    });

    it('should enable heartbeat', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'hb-1',
            name: 'Daily Backup',
            cronExpression: '0 0 * * *',
            enabled: true,
            userId: 'user-1',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          }),
      });

      const result = await enableHeartbeat('hb-1');

      expect(result.enabled).toBe(true);
    });

    it('should disable heartbeat', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'hb-1',
            name: 'Daily Backup',
            cronExpression: '0 0 * * *',
            enabled: false,
            userId: 'user-1',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          }),
      });

      const result = await disableHeartbeat('hb-1');

      expect(result.enabled).toBe(false);
    });

    it('should get heartbeat templates', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            templates: [
              {
                id: 'tmpl-1',
                name: 'Daily Cleanup',
                description: 'Clean up old files',
                cronExpression: '0 2 * * *',
                payload: {},
              },
            ],
          }),
      });

      const result = await getHeartbeatTemplates();

      expect(result).toHaveLength(1);
    });

    it('should create from template', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'hb-3',
            name: 'My Daily Cleanup',
            cronExpression: '0 2 * * *',
            enabled: true,
            userId: 'user-1',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          }),
      });

      const result = await createFromTemplate('tmpl-1', 'My Daily Cleanup');

      expect(result.name).toBe('My Daily Cleanup');
    });
  });

  describe('Memories', () => {
    it('should list memories', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            memories: [
              {
                id: 'mem-1',
                type: 'fact',
                content: 'Important fact',
                importance: 0.8,
                accessCount: 5,
                userId: 'user-1',
                createdAt: '2024-01-01',
                updatedAt: '2024-01-01',
              },
            ],
          }),
      });

      const result = await listMemories('fact', 10);

      expect(result).toHaveLength(1);
    });

    it('should create memory', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'mem-2',
            type: 'preference',
            content: 'User prefers compact layout',
            importance: 0.9,
            accessCount: 0,
            userId: 'user-1',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          }),
      });

      const result = await createMemory('preference', 'User prefers compact layout', 0.9, {
        category: 'ui',
      });

      expect(result.type).toBe('preference');
    });

    it('should delete memory', async () => {
      mockFetchApi.mockResolvedValue({ ok: true });

      await expect(deleteMemory('mem-1')).resolves.not.toThrow();
    });

    it('should search memories', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            memories: [
              {
                id: 'mem-1',
                type: 'fact',
                content: 'Search result',
                importance: 0.7,
                accessCount: 3,
                userId: 'user-1',
                createdAt: '2024-01-01',
                updatedAt: '2024-01-01',
              },
            ],
          }),
      });

      const result = await searchMemories('search query', 5);

      expect(result).toHaveLength(1);
    });
  });

  describe('Audit Logs', () => {
    it('should list audit logs', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            logs: [
              {
                id: 'log-1',
                userId: 'user-1',
                action: 'integration.created',
                category: 'integration',
                createdAt: '2024-01-01',
              },
            ],
          }),
      });

      const result = await listAuditLogs({ category: 'integration', limit: 10 });

      expect(result).toHaveLength(1);
    });
  });

  describe('Swarm Agents', () => {
    it('should list swarm agents', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            agents: [
              {
                id: 'agent-1',
                name: 'Worker 1',
                status: 'running',
                agentType: 'worker',
                userId: 'user-1',
                createdAt: '2024-01-01',
                updatedAt: '2024-01-01',
              },
            ],
          }),
      });

      const result = await listSwarmAgents('running');

      expect(result).toHaveLength(1);
    });

    it('should create swarm agent', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'agent-2',
            name: 'New Worker',
            status: 'pending',
            agentType: 'worker',
            taskDescription: 'Process data',
            userId: 'user-1',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          }),
      });

      const result = await createSwarmAgent('New Worker', 'worker', 'Process data', 'agent-1');

      expect(result.name).toBe('New Worker');
    });

    it('should cancel swarm agent', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'agent-1',
            name: 'Worker 1',
            status: 'failed',
            agentType: 'worker',
            userId: 'user-1',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          }),
      });

      const result = await cancelSwarmAgent('agent-1');

      expect(result.status).toBe('failed');
    });
  });

  describe('Cost Budget', () => {
    it('should get cost budget', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'budget-1',
            userId: 'user-1',
            period: 'monthly',
            limitCents: 5000,
            spentCents: 2500,
            periodStart: '2024-01-01',
            periodEnd: '2024-01-31',
            notifyAtPercent: 80,
            createdAt: '2024-01-01',
            updatedAt: '2024-01-15',
          }),
      });

      const result = await getCostBudget();

      expect(result?.limitCents).toBe(5000);
    });

    it('should return null if no budget (404)', async () => {
      mockFetchApi.mockResolvedValue({
        status: 404,
      });

      const result = await getCostBudget();

      expect(result).toBeNull();
    });

    it('should set cost budget', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'budget-1',
            userId: 'user-1',
            period: 'monthly',
            limitCents: 10000,
            spentCents: 0,
            periodStart: '2024-02-01',
            periodEnd: '2024-02-29',
            notifyAtPercent: 90,
            createdAt: '2024-02-01',
            updatedAt: '2024-02-01',
          }),
      });

      const result = await setCostBudget(10000, 'monthly', 90);

      expect(result.limitCents).toBe(10000);
      expect(result.notifyAtPercent).toBe(90);
    });
  });

  describe('PROVIDER_METADATA', () => {
    it('should have metadata for all providers', () => {
      const providers: IntegrationProvider[] = [
        'discord',
        'slack',
        'spotify',
        'obsidian',
        'gmail',
        'google_calendar',
        'notion',
        'twitter',
        'github',
        'linear',
        'figma',
        'home_assistant',
        'elevenlabs',
        'twilio',
        'sendgrid',
        'stripe',
        'custom',
      ];

      providers.forEach((provider) => {
        expect(PROVIDER_METADATA[provider]).toBeDefined();
        expect(PROVIDER_METADATA[provider].name).toBeDefined();
        expect(PROVIDER_METADATA[provider].icon).toBeDefined();
        expect(PROVIDER_METADATA[provider].color).toBeDefined();
        expect(PROVIDER_METADATA[provider].authType).toBeDefined();
      });
    });

    it('should have valid auth types', () => {
      const validAuthTypes = ['oauth', 'api_key', 'bot_token', 'local'];

      Object.values(PROVIDER_METADATA).forEach((meta) => {
        expect(validAuthTypes).toContain(meta.authType);
      });
    });
  });
});
