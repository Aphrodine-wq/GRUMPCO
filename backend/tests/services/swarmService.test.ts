/**
 * Swarm Service Unit Tests
 * Tests agent swarm orchestration, dependency resolution, and persistent swarm management.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Mock database
const mockDb = {
  saveSwarmAgent: vi.fn(),
  getSwarmAgent: vi.fn(),
  getSwarmChildren: vi.fn(),
  getRunningSwarmAgents: vi.fn(),
  saveAuditLog: vi.fn(),
};

vi.mock('../../src/db/database.js', () => ({
  getDatabase: () => mockDb,
}));

// Mock audit log service
vi.mock('../../src/services/auditLogService.js', () => ({
  writeAuditLog: vi.fn(),
}));

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock NIM config
vi.mock('../../src/config/nim.js', () => ({
  getNimChatUrl: () => 'https://api.nvidia.com/v1/chat/completions',
}));

// Mock pricing config
vi.mock('../../src/config/pricing.js', () => ({
  getSwarmLimit: vi.fn((tier: string) => {
    switch (tier) {
      case 'free': return 3;
      case 'pro': return 5;
      case 'team': return 10;
      case 'enterprise': return 100;
      default: return 3;
    }
  }),
}));

describe('swarmService', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFetch.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-api-key';
    
    // Reset mock database defaults
    mockDb.saveSwarmAgent.mockResolvedValue(undefined);
    mockDb.getSwarmAgent.mockResolvedValue(null);
    mockDb.getSwarmChildren.mockResolvedValue([]);
    mockDb.getRunningSwarmAgents.mockResolvedValue([]);
    mockDb.saveAuditLog.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('SWARM_AGENT_IDS', () => {
    it('should export all agent IDs', async () => {
      const { SWARM_AGENT_IDS } = await import('../../src/services/swarmService.js');
      
      expect(SWARM_AGENT_IDS).toContain('arch');
      expect(SWARM_AGENT_IDS).toContain('frontend');
      expect(SWARM_AGENT_IDS).toContain('backend');
      expect(SWARM_AGENT_IDS).toContain('devops');
      expect(SWARM_AGENT_IDS).toContain('test');
      expect(SWARM_AGENT_IDS).toContain('docs');
      expect(SWARM_AGENT_IDS).toContain('ux');
      expect(SWARM_AGENT_IDS).toContain('security');
      expect(SWARM_AGENT_IDS).toContain('perf');
      expect(SWARM_AGENT_IDS).toContain('a11y');
      expect(SWARM_AGENT_IDS).toContain('data');
      expect(SWARM_AGENT_IDS).toContain('review');
      expect(SWARM_AGENT_IDS).toHaveLength(12);
    });
  });

  describe('AGENT_DEPENDENCIES', () => {
    it('should define arch as having no dependencies', async () => {
      const { AGENT_DEPENDENCIES } = await import('../../src/services/swarmService.js');
      
      expect(AGENT_DEPENDENCIES.arch).toEqual([]);
    });

    it('should define frontend as depending on arch', async () => {
      const { AGENT_DEPENDENCIES } = await import('../../src/services/swarmService.js');
      
      expect(AGENT_DEPENDENCIES.frontend).toEqual(['arch']);
    });

    it('should define test as depending on frontend and backend', async () => {
      const { AGENT_DEPENDENCIES } = await import('../../src/services/swarmService.js');
      
      expect(AGENT_DEPENDENCIES.test).toEqual(['frontend', 'backend']);
    });

    it('should define review as depending on frontend, backend, and test', async () => {
      const { AGENT_DEPENDENCIES } = await import('../../src/services/swarmService.js');
      
      expect(AGENT_DEPENDENCIES.review).toEqual(['frontend', 'backend', 'test']);
    });

    it('should have dependencies defined for all agents', async () => {
      const { AGENT_DEPENDENCIES, SWARM_AGENT_IDS } = await import('../../src/services/swarmService.js');
      
      for (const agentId of SWARM_AGENT_IDS) {
        expect(AGENT_DEPENDENCIES).toHaveProperty(agentId);
        expect(Array.isArray(AGENT_DEPENDENCIES[agentId])).toBe(true);
      }
    });
  });

  describe('runSwarm', () => {
    it('should throw error when NVIDIA_NIM_API_KEY is not set', async () => {
      delete process.env.NVIDIA_NIM_API_KEY;
      
      const { runSwarm } = await import('../../src/services/swarmService.js');
      
      const generator = runSwarm('Build a todo app');
      const firstEvent = await generator.next();
      
      expect(firstEvent.value).toEqual({ type: 'decompose_start' });
      
      const errorEvent = await generator.next();
      expect(errorEvent.value).toEqual({
        type: 'error',
        message: 'NVIDIA_NIM_API_KEY is not set',
      });
    });

    it('should emit decompose_start event first', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"tasks": [{"agentId": "arch", "task": "design"}]}' } }],
        }),
      });

      const { runSwarm } = await import('../../src/services/swarmService.js');
      
      const generator = runSwarm('Build a todo app');
      const firstEvent = await generator.next();
      
      expect(firstEvent.value).toEqual({ type: 'decompose_start' });
    });

    it('should handle decompose failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { runSwarm } = await import('../../src/services/swarmService.js');
      
      const generator = runSwarm('Build a todo app');
      const events: unknown[] = [];
      
      let result = await generator.next();
      while (!result.done) {
        events.push(result.value);
        result = await generator.next();
      }
      
      expect(events).toContainEqual({ type: 'decompose_start' });
      expect(events).toContainEqual({ type: 'error', message: 'Network error' });
      expect(result.value).toEqual({ summary: '', results: [] });
    });

    it('should parse tasks from JSON response', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  tasks: [
                    { agentId: 'arch', task: 'Design architecture' },
                    { agentId: 'frontend', task: 'Build UI' },
                  ],
                }),
              },
            }],
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Agent output' } }],
          }),
        });

      const { runSwarm } = await import('../../src/services/swarmService.js');
      
      const generator = runSwarm('Build a todo app');
      const events: unknown[] = [];
      
      let result = await generator.next();
      while (!result.done) {
        events.push(result.value);
        result = await generator.next();
      }
      
      const decomposeDone = events.find((e: any) => e.type === 'decompose_done');
      expect(decomposeDone).toBeDefined();
      expect((decomposeDone as any).tasks).toHaveLength(2);
    });

    it('should limit tasks based on user tier', async () => {
      // Create 5 tasks but free tier allows only 3
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  tasks: [
                    { agentId: 'arch', task: 'Design' },
                    { agentId: 'frontend', task: 'Build frontend' },
                    { agentId: 'backend', task: 'Build backend' },
                    { agentId: 'test', task: 'Write tests' },
                    { agentId: 'docs', task: 'Write docs' },
                  ],
                }),
              },
            }],
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Agent output' } }],
          }),
        });

      const { runSwarm } = await import('../../src/services/swarmService.js');
      
      const generator = runSwarm('Build a todo app', { userTier: 'free' });
      const events: unknown[] = [];
      
      let result = await generator.next();
      while (!result.done) {
        events.push(result.value);
        result = await generator.next();
      }
      
      const decomposeDone = events.find((e: any) => e.type === 'decompose_done') as any;
      expect(decomposeDone.tasks.length).toBeLessThanOrEqual(3);
    });

    it('should handle empty tasks response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"tasks": []}' } }],
        }),
      });

      const { runSwarm } = await import('../../src/services/swarmService.js');
      
      const generator = runSwarm('Build a todo app');
      const events: unknown[] = [];
      
      let result = await generator.next();
      while (!result.done) {
        events.push(result.value);
        result = await generator.next();
      }
      
      expect(events).toContainEqual({
        type: 'summary_done',
        text: 'No subtasks were generated. Try rephrasing your request.',
      });
      expect(result.value).toEqual({ summary: 'No subtasks.', results: [] });
    });

    it('should emit agent_start and agent_done events', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  tasks: [{ agentId: 'arch', task: 'Design architecture' }],
                }),
              },
            }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Architecture design complete' } }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Summary of work' } }],
          }),
        });

      const { runSwarm } = await import('../../src/services/swarmService.js');
      
      const generator = runSwarm('Build a todo app');
      const events: unknown[] = [];
      
      let result = await generator.next();
      while (!result.done) {
        events.push(result.value);
        result = await generator.next();
      }
      
      const agentStart = events.find((e: any) => e.type === 'agent_start');
      expect(agentStart).toBeDefined();
      expect((agentStart as any).agentId).toBe('arch');
      
      const agentDone = events.find((e: any) => e.type === 'agent_done');
      expect(agentDone).toBeDefined();
      expect((agentDone as any).agentId).toBe('arch');
      expect((agentDone as any).output).toBe('Architecture design complete');
    });

    it('should emit queue_status events', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  tasks: [{ agentId: 'arch', task: 'Design' }],
                }),
              },
            }],
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Output' } }],
          }),
        });

      const { runSwarm } = await import('../../src/services/swarmService.js');
      
      const generator = runSwarm('Build a todo app');
      const events: unknown[] = [];
      
      let result = await generator.next();
      while (!result.done) {
        events.push(result.value);
        result = await generator.next();
      }
      
      const queueStatus = events.find((e: any) => e.type === 'queue_status');
      expect(queueStatus).toBeDefined();
    });

    it('should handle agent execution errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  tasks: [{ agentId: 'arch', task: 'Design' }],
                }),
              },
            }],
          }),
        })
        .mockRejectedValueOnce(new Error('Agent execution failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Summary' } }],
          }),
        });

      const { runSwarm } = await import('../../src/services/swarmService.js');
      
      const generator = runSwarm('Build a todo app');
      const events: unknown[] = [];
      
      let result = await generator.next();
      while (!result.done) {
        events.push(result.value);
        result = await generator.next();
      }
      
      const agentDone = events.find((e: any) => e.type === 'agent_done') as any;
      expect(agentDone).toBeDefined();
      expect(agentDone.error).toBe('Agent execution failed');
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Not valid JSON' } }],
        }),
      });

      const { runSwarm } = await import('../../src/services/swarmService.js');
      
      const generator = runSwarm('Build a todo app');
      const events: unknown[] = [];
      
      let result = await generator.next();
      while (!result.done) {
        events.push(result.value);
        result = await generator.next();
      }
      
      const errorEvent = events.find((e: any) => e.type === 'error');
      expect(errorEvent).toBeDefined();
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: '```json\n{"tasks": [{"agentId": "arch", "task": "Design"}]}\n```',
              },
            }],
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Output' } }],
          }),
        });

      const { runSwarm } = await import('../../src/services/swarmService.js');
      
      const generator = runSwarm('Build a todo app');
      const events: unknown[] = [];
      
      let result = await generator.next();
      while (!result.done) {
        events.push(result.value);
        result = await generator.next();
      }
      
      const decomposeDone = events.find((e: any) => e.type === 'decompose_done');
      expect(decomposeDone).toBeDefined();
      expect((decomposeDone as any).tasks).toHaveLength(1);
    });

    it('should handle NIM API error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      const { runSwarm } = await import('../../src/services/swarmService.js');
      
      const generator = runSwarm('Build a todo app');
      const events: unknown[] = [];
      
      let result = await generator.next();
      while (!result.done) {
        events.push(result.value);
        result = await generator.next();
      }
      
      const errorEvent = events.find((e: any) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent as any).message).toContain('429');
    });

    it('should respect custom concurrency option', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  tasks: [
                    { agentId: 'arch', task: 'Design' },
                    { agentId: 'frontend', task: 'Build UI' },
                  ],
                }),
              },
            }],
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Output' } }],
          }),
        });

      const { runSwarm } = await import('../../src/services/swarmService.js');
      
      const generator = runSwarm('Build a todo app', { concurrency: 1 });
      const events: unknown[] = [];
      
      let result = await generator.next();
      while (!result.done) {
        events.push(result.value);
        result = await generator.next();
      }
      
      // Should complete without errors
      expect(events.some((e: any) => e.type === 'summary_done')).toBe(true);
    });
  });

  describe('createPersistentSwarmAgent', () => {
    it('should create a new swarm agent record', async () => {
      const { createPersistentSwarmAgent } = await import('../../src/services/swarmService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');
      
      const input = {
        userId: 'user-123',
        name: 'Test Agent',
        agentType: 'arch',
        taskDescription: 'Design the system',
      };
      
      const result = await createPersistentSwarmAgent(input);
      
      expect(result.id).toMatch(/^swarm_\d+_/);
      expect(result.user_id).toBe('user-123');
      expect(result.name).toBe('Test Agent');
      expect(result.agent_type).toBe('arch');
      expect(result.task_description).toBe('Design the system');
      expect(result.status).toBe('pending');
      expect(result.result).toBeNull();
      expect(mockDb.saveSwarmAgent).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-123',
        name: 'Test Agent',
        status: 'pending',
      }));
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-123',
        action: 'swarm.agent_created',
        category: 'agent',
      }));
    });

    it('should handle parent ID for child agents', async () => {
      const { createPersistentSwarmAgent } = await import('../../src/services/swarmService.js');
      
      const input = {
        userId: 'user-123',
        parentId: 'parent-swarm-123',
        name: 'Child Agent',
        agentType: 'frontend',
      };
      
      const result = await createPersistentSwarmAgent(input);
      
      expect(result.parent_id).toBe('parent-swarm-123');
    });

    it('should set null parent_id when not provided', async () => {
      const { createPersistentSwarmAgent } = await import('../../src/services/swarmService.js');
      
      const input = {
        userId: 'user-123',
        name: 'Root Agent',
        agentType: 'arch',
      };
      
      const result = await createPersistentSwarmAgent(input);
      
      expect(result.parent_id).toBeNull();
    });
  });

  describe('getSwarmAgentById', () => {
    it('should return agent when found', async () => {
      const mockAgent = {
        id: 'swarm-123',
        user_id: 'user-123',
        name: 'Test Agent',
        status: 'running',
        agent_type: 'arch',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockDb.getSwarmAgent.mockResolvedValueOnce(mockAgent);
      
      const { getSwarmAgentById } = await import('../../src/services/swarmService.js');
      
      const result = await getSwarmAgentById('swarm-123');
      
      expect(result).toEqual(mockAgent);
      expect(mockDb.getSwarmAgent).toHaveBeenCalledWith('swarm-123');
    });

    it('should return null when agent not found', async () => {
      mockDb.getSwarmAgent.mockResolvedValueOnce(null);
      
      const { getSwarmAgentById } = await import('../../src/services/swarmService.js');
      
      const result = await getSwarmAgentById('non-existent');
      
      expect(result).toBeNull();
    });
  });

  describe('getSwarmChildren', () => {
    it('should return child agents', async () => {
      const mockChildren = [
        { id: 'child-1', parent_id: 'parent-123', status: 'completed' },
        { id: 'child-2', parent_id: 'parent-123', status: 'running' },
      ];
      mockDb.getSwarmChildren.mockResolvedValueOnce(mockChildren);
      
      const { getSwarmChildren } = await import('../../src/services/swarmService.js');
      
      const result = await getSwarmChildren('parent-123');
      
      expect(result).toEqual(mockChildren);
      expect(mockDb.getSwarmChildren).toHaveBeenCalledWith('parent-123');
    });

    it('should return empty array when no children', async () => {
      mockDb.getSwarmChildren.mockResolvedValueOnce([]);
      
      const { getSwarmChildren } = await import('../../src/services/swarmService.js');
      
      const result = await getSwarmChildren('no-children');
      
      expect(result).toEqual([]);
    });
  });

  describe('getRunningSwarmAgents', () => {
    it('should return all running agents', async () => {
      const mockRunning = [
        { id: 'agent-1', status: 'running' },
        { id: 'agent-2', status: 'running' },
      ];
      mockDb.getRunningSwarmAgents.mockResolvedValueOnce(mockRunning);
      
      const { getRunningSwarmAgents } = await import('../../src/services/swarmService.js');
      
      const result = await getRunningSwarmAgents();
      
      expect(result).toEqual(mockRunning);
    });
  });

  describe('updateSwarmAgentStatus', () => {
    it('should update status successfully', async () => {
      const existingAgent = {
        id: 'swarm-123',
        user_id: 'user-123',
        name: 'Test Agent',
        status: 'pending',
        agent_type: 'arch',
        result: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockDb.getSwarmAgent.mockResolvedValueOnce(existingAgent);
      
      const { updateSwarmAgentStatus } = await import('../../src/services/swarmService.js');
      
      await updateSwarmAgentStatus('swarm-123', 'running');
      
      expect(mockDb.saveSwarmAgent).toHaveBeenCalledWith(expect.objectContaining({
        id: 'swarm-123',
        status: 'running',
      }));
    });

    it('should throw error when agent not found', async () => {
      mockDb.getSwarmAgent.mockResolvedValueOnce(null);
      
      const { updateSwarmAgentStatus } = await import('../../src/services/swarmService.js');
      
      await expect(updateSwarmAgentStatus('non-existent', 'running')).rejects.toThrow(
        'Swarm agent not found: non-existent'
      );
    });

    it('should set completed_at for terminal statuses', async () => {
      const existingAgent = {
        id: 'swarm-123',
        user_id: 'user-123',
        name: 'Test Agent',
        status: 'running',
        agent_type: 'arch',
        result: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockDb.getSwarmAgent.mockResolvedValueOnce(existingAgent);
      
      const { updateSwarmAgentStatus } = await import('../../src/services/swarmService.js');
      
      await updateSwarmAgentStatus('swarm-123', 'completed', { success: true });
      
      expect(mockDb.saveSwarmAgent).toHaveBeenCalledWith(expect.objectContaining({
        status: 'completed',
        completed_at: expect.any(String),
        result: JSON.stringify({ success: true }),
      }));
    });

    it('should set completed_at for failed status', async () => {
      const existingAgent = {
        id: 'swarm-123',
        user_id: 'user-123',
        name: 'Test Agent',
        status: 'running',
        agent_type: 'arch',
        result: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockDb.getSwarmAgent.mockResolvedValueOnce(existingAgent);
      
      const { updateSwarmAgentStatus } = await import('../../src/services/swarmService.js');
      
      await updateSwarmAgentStatus('swarm-123', 'failed');
      
      expect(mockDb.saveSwarmAgent).toHaveBeenCalledWith(expect.objectContaining({
        status: 'failed',
        completed_at: expect.any(String),
      }));
    });
  });

  describe('completeSwarmAgent', () => {
    it('should complete agent and write audit log', async () => {
      const existingAgent = {
        id: 'swarm-123',
        user_id: 'user-123',
        name: 'Test Agent',
        status: 'running',
        agent_type: 'arch',
        result: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockDb.getSwarmAgent
        .mockResolvedValueOnce(existingAgent)
        .mockResolvedValueOnce({ ...existingAgent, status: 'completed' });
      
      const { completeSwarmAgent } = await import('../../src/services/swarmService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');
      
      await completeSwarmAgent('swarm-123', { output: 'result' }, 'user-123');
      
      expect(mockDb.saveSwarmAgent).toHaveBeenCalledWith(expect.objectContaining({
        status: 'completed',
      }));
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-123',
        action: 'swarm.agent_completed',
        category: 'agent',
      }));
    });
  });

  describe('failSwarmAgent', () => {
    it('should fail agent and write audit log', async () => {
      const existingAgent = {
        id: 'swarm-123',
        user_id: 'user-123',
        name: 'Test Agent',
        status: 'running',
        agent_type: 'arch',
        result: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockDb.getSwarmAgent
        .mockResolvedValueOnce(existingAgent)
        .mockResolvedValueOnce({ ...existingAgent, status: 'failed' });
      
      const { failSwarmAgent } = await import('../../src/services/swarmService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');
      
      await failSwarmAgent('swarm-123', 'Something went wrong', 'user-123');
      
      expect(mockDb.saveSwarmAgent).toHaveBeenCalledWith(expect.objectContaining({
        status: 'failed',
        result: JSON.stringify({ error: 'Something went wrong' }),
      }));
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'swarm.agent_failed',
        metadata: expect.objectContaining({
          error: 'Something went wrong',
        }),
      }));
    });
  });

  describe('cancelSwarmAgent', () => {
    it('should cancel agent and write audit log', async () => {
      const existingAgent = {
        id: 'swarm-123',
        user_id: 'user-123',
        name: 'Test Agent',
        status: 'running',
        agent_type: 'arch',
        result: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockDb.getSwarmAgent
        .mockResolvedValueOnce(existingAgent)
        .mockResolvedValueOnce({ ...existingAgent, status: 'cancelled' });
      
      const { cancelSwarmAgent } = await import('../../src/services/swarmService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');
      
      await cancelSwarmAgent('swarm-123', 'user-123');
      
      expect(mockDb.saveSwarmAgent).toHaveBeenCalledWith(expect.objectContaining({
        status: 'cancelled',
      }));
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'swarm.agent_cancelled',
      }));
    });
  });

  describe('getSwarmProgress', () => {
    it('should calculate progress correctly', async () => {
      const mockChildren = [
        { id: 'child-1', status: 'pending' },
        { id: 'child-2', status: 'running' },
        { id: 'child-3', status: 'completed' },
        { id: 'child-4', status: 'completed' },
        { id: 'child-5', status: 'failed' },
        { id: 'child-6', status: 'cancelled' },
      ];
      mockDb.getSwarmChildren.mockResolvedValueOnce(mockChildren);
      
      const { getSwarmProgress } = await import('../../src/services/swarmService.js');
      
      const result = await getSwarmProgress('swarm-123');
      
      expect(result).toEqual({
        total: 6,
        pending: 1,
        running: 1,
        completed: 2,
        failed: 1,
        cancelled: 1,
      });
    });

    it('should return zeros for empty swarm', async () => {
      mockDb.getSwarmChildren.mockResolvedValueOnce([]);
      
      const { getSwarmProgress } = await import('../../src/services/swarmService.js');
      
      const result = await getSwarmProgress('empty-swarm');
      
      expect(result).toEqual({
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      });
    });
  });

  describe('isSwarmComplete', () => {
    it('should return true when all children are in terminal states', async () => {
      const mockChildren = [
        { id: 'child-1', status: 'completed' },
        { id: 'child-2', status: 'failed' },
        { id: 'child-3', status: 'cancelled' },
      ];
      mockDb.getSwarmChildren.mockResolvedValueOnce(mockChildren);
      
      const { isSwarmComplete } = await import('../../src/services/swarmService.js');
      
      const result = await isSwarmComplete('swarm-123');
      
      expect(result).toBe(true);
    });

    it('should return false when some children are pending', async () => {
      const mockChildren = [
        { id: 'child-1', status: 'completed' },
        { id: 'child-2', status: 'pending' },
      ];
      mockDb.getSwarmChildren.mockResolvedValueOnce(mockChildren);
      
      const { isSwarmComplete } = await import('../../src/services/swarmService.js');
      
      const result = await isSwarmComplete('swarm-123');
      
      expect(result).toBe(false);
    });

    it('should return false when some children are running', async () => {
      const mockChildren = [
        { id: 'child-1', status: 'completed' },
        { id: 'child-2', status: 'running' },
      ];
      mockDb.getSwarmChildren.mockResolvedValueOnce(mockChildren);
      
      const { isSwarmComplete } = await import('../../src/services/swarmService.js');
      
      const result = await isSwarmComplete('swarm-123');
      
      expect(result).toBe(false);
    });

    it('should return true for empty swarm', async () => {
      mockDb.getSwarmChildren.mockResolvedValueOnce([]);
      
      const { isSwarmComplete } = await import('../../src/services/swarmService.js');
      
      const result = await isSwarmComplete('empty-swarm');
      
      expect(result).toBe(true);
    });
  });
});
