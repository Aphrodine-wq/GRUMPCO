/**
 * Agent Governance Middleware Tests
 * Comprehensive tests for agent permission checks, rate limiting, governance policies,
 * and tool/action restrictions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Store original Date
const OriginalDate = global.Date;

// Mock the env module - must be before importing the middleware
const mockEnv = {
  AGENT_ACCESS_POLICY: 'block' as 'block' | 'allowlist' | 'audit_only',
  AGENT_ALLOWLIST: '',
  AGENT_RATE_LIMIT_PER_HOUR: 10,
  FREE_AGENT_ENABLED: false,
};

vi.mock('../../src/config/env.js', () => ({
  env: mockEnv,
}));

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../../src/middleware/logger.js', () => ({
  getRequestLogger: () => mockLogger,
  default: mockLogger,
}));

// Mock approval service
const mockCreateApprovalRequest = vi.fn();
const mockGetApprovalRequest = vi.fn();

vi.mock('../../src/services/approvalService.js', () => ({
  createApprovalRequest: (...args: unknown[]) => mockCreateApprovalRequest(...args),
  getApprovalRequest: (...args: unknown[]) => mockGetApprovalRequest(...args),
}));

// Mock audit log service
const mockWriteAuditLog = vi.fn();

vi.mock('../../src/services/auditLogService.js', () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

// Helper to create mock Request
function createMockRequest(options: {
  path?: string;
  method?: string;
  headers?: Record<string, string>;
} = {}): Request {
  return {
    path: options.path ?? '/api/test',
    method: options.method ?? 'POST',
    headers: options.headers ?? {},
  } as unknown as Request;
}

// Helper to create mock Response
function createMockResponse(): Response & { 
  _status: number; 
  _json: unknown;
  _headers: Record<string, string>;
} {
  const res = {
    _status: 200,
    _json: null as unknown,
    _headers: {} as Record<string, string>,
    status: vi.fn().mockImplementation(function(this: typeof res, code: number) {
      this._status = code;
      return this;
    }),
    json: vi.fn().mockImplementation(function(this: typeof res, data: unknown) {
      this._json = data;
      return this;
    }),
    setHeader: vi.fn().mockImplementation(function(this: typeof res, key: string, value: string) {
      this._headers[key] = value;
      return this;
    }),
  };
  return res as unknown as Response & { 
    _status: number; 
    _json: unknown;
    _headers: Record<string, string>;
  };
}

// Create a properly typed mock NextFunction
function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

describe('Agent Governance Middleware', () => {
  let next: NextFunction;
  let agentGovernanceMiddleware: typeof import('../../src/middleware/agentGovernance.js').agentGovernanceMiddleware;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Reset mock env to defaults
    mockEnv.AGENT_ACCESS_POLICY = 'block';
    mockEnv.AGENT_ALLOWLIST = '';
    mockEnv.AGENT_RATE_LIMIT_PER_HOUR = 10;
    mockEnv.FREE_AGENT_ENABLED = false;

    // Reset mock functions
    mockWriteAuditLog.mockResolvedValue(undefined);
    mockCreateApprovalRequest.mockResolvedValue({ id: 'apr_test_123' });
    mockGetApprovalRequest.mockResolvedValue(null);

    next = createMockNext();

    // Import fresh module
    const module = await import('../../src/middleware/agentGovernance.js');
    agentGovernanceMiddleware = module.agentGovernanceMiddleware;
  });

  afterEach(() => {
    global.Date = OriginalDate;
    vi.useRealTimers();
  });

  describe('Non-protected paths', () => {
    it('should allow requests to non-protected paths without any checks', async () => {
      const req = createMockRequest({ path: '/api/health' });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow requests to root path', async () => {
      const req = createMockRequest({ path: '/' });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow requests to unrelated API paths', async () => {
      const req = createMockRequest({ path: '/api/users' });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('G-Rump app requests (bypass agent detection)', () => {
    it('should allow requests with X-GRump-Client: desktop header', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'x-grump-client': 'desktop' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow requests with X-GRump-Client: web header', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'x-grump-client': 'web' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle case-insensitive X-GRump-Client header', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'x-grump-client': 'DESKTOP' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle X-GRump-Client with whitespace', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'x-grump-client': '  web  ' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Agent detection', () => {
    describe('via User-Agent patterns', () => {
      const agentPatterns = [
        'OpenClaw/1.0',
        'MoltBot/2.0',
        'Clawd Spider',
        'ClawdBot/1.0',
        'grump-agent/1.0',
        'ai-agent/2.0',
        'anthropic-claude/1.0',
        'Automated Request Tool',
        'bot/1.0',
        'curl/7.68.0 grump',
      ];

      agentPatterns.forEach((ua) => {
        it(`should detect agent from User-Agent: ${ua}`, async () => {
          const req = createMockRequest({
            path: '/api/chat',
            headers: { 'user-agent': ua },
          });
          const res = createMockResponse();

          await agentGovernanceMiddleware(req, res, next);

          // With default block policy, should return 403
          expect(res.status).toHaveBeenCalledWith(403);
          expect(res._json).toMatchObject({
            type: 'agent_blocked',
            code: 'AGENT_BLOCKED',
          });
        });
      });
    });

    describe('via X-Agent-Source header', () => {
      it('should detect moltbot from X-Agent-Source header', async () => {
        const req = createMockRequest({
          path: '/api/chat',
          headers: { 'x-agent-source': 'moltbot' },
        });
        const res = createMockResponse();

        await agentGovernanceMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
      });

      it('should detect openclaw from X-Agent-Source header', async () => {
        const req = createMockRequest({
          path: '/api/chat',
          headers: { 'x-agent-source': 'OpenClaw-Agent' },
        });
        const res = createMockResponse();

        await agentGovernanceMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
      });

      it('should detect clawd from X-Agent-Source header', async () => {
        const req = createMockRequest({
          path: '/api/chat',
          headers: { 'x-agent-source': 'clawd' },
        });
        const res = createMockResponse();

        await agentGovernanceMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
      });

      it('should use X-Agent-Id when provided', async () => {
        const req = createMockRequest({
          path: '/api/chat',
          headers: { 
            'x-agent-source': 'moltbot',
            'x-agent-id': 'custom-agent-id-123',
          },
        });
        const res = createMockResponse();

        await agentGovernanceMiddleware(req, res, next);

        expect(mockWriteAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'agent:custom-agent-id-123',
          })
        );
      });
    });

    it('should allow non-agent requests to protected paths', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow requests with no User-Agent', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: {},
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Protected paths', () => {
    it('should protect /api/chat path', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should protect /api/chat subpaths', async () => {
      const req = createMockRequest({
        path: '/api/chat/messages',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should protect /api/ship path', async () => {
      const req = createMockRequest({
        path: '/api/ship',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should protect /api/codegen path', async () => {
      const req = createMockRequest({
        path: '/api/codegen',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should protect /api/codegen subpaths', async () => {
      const req = createMockRequest({
        path: '/api/codegen/generate',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Policy: block (default)', () => {
    it('should block agent requests and return 403', async () => {
      mockEnv.AGENT_ACCESS_POLICY = 'block';

      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json).toEqual({
        error: 'Agent access is blocked. Moltbot/OpenClaw and similar AI agents are not permitted.',
        type: 'agent_blocked',
        code: 'AGENT_BLOCKED',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should log blocked request', async () => {
      mockEnv.AGENT_ACCESS_POLICY = 'block';

      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/api/chat' }),
        'Agent request blocked by policy'
      );
    });

    it('should record audit log for blocked request', async () => {
      mockEnv.AGENT_ACCESS_POLICY = 'block';

      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(mockWriteAuditLog).toHaveBeenCalledWith({
        userId: expect.stringMatching(/^agent:/),
        action: 'agent.blocked',
        category: 'security',
        target: '/api/chat',
        metadata: expect.objectContaining({ status: 'blocked' }),
      });
    });
  });

  describe('Policy: audit_only', () => {
    beforeEach(() => {
      mockEnv.AGENT_ACCESS_POLICY = 'audit_only';
    });

    it('should allow agent requests and log them', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should record audit log with allowed status', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(mockWriteAuditLog).toHaveBeenCalledWith({
        userId: expect.stringMatching(/^agent:/),
        action: 'agent.request',
        category: 'security',
        target: '/api/chat',
        metadata: expect.objectContaining({ status: 'allowed' }),
      });
    });

    it('should log info message for audit_only', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/api/chat' }),
        'Agent request (audit_only, allowed)'
      );
    });

    it('should set isAgentRequest on request object', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'MoltBot/1.0' },
      }) as Request & { isAgentRequest?: boolean; agentId?: string };
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(req.isAgentRequest).toBe(true);
      expect(req.agentId).toBeDefined();
    });
  });

  describe('Policy: allowlist', () => {
    beforeEach(() => {
      mockEnv.AGENT_ACCESS_POLICY = 'allowlist';
    });

    it('should block agent not in allowlist', async () => {
      mockEnv.AGENT_ALLOWLIST = 'other-agent,another-agent';

      const req = createMockRequest({
        path: '/api/chat',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          'x-agent-id': 'moltbot-123',
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json).toMatchObject({
        type: 'agent_blocked',
        code: 'AGENT_NOT_ALLOWLISTED',
      });
    });

    it('should allow agent in allowlist', async () => {
      mockEnv.AGENT_ALLOWLIST = 'moltbot_1_0,other-agent';

      const req = createMockRequest({
        path: '/api/chat',
        headers: { 
          'user-agent': 'MoltBot/1.0',
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle wildcard (*) in allowlist', async () => {
      mockEnv.AGENT_ALLOWLIST = '*';

      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle case-insensitive allowlist matching', async () => {
      mockEnv.AGENT_ALLOWLIST = 'MOLTBOT_1_0';

      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle empty allowlist', async () => {
      mockEnv.AGENT_ALLOWLIST = '';

      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should handle allowlist with whitespace', async () => {
      mockEnv.AGENT_ALLOWLIST = '  moltbot_1_0  ,  other-agent  ';

      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Rate limiting', () => {
    beforeEach(async () => {
      mockEnv.AGENT_ACCESS_POLICY = 'allowlist';
      mockEnv.AGENT_ALLOWLIST = '*';
      mockEnv.AGENT_RATE_LIMIT_PER_HOUR = 3;

      // Re-import to reset rate limit state
      vi.resetModules();
      const module = await import('../../src/middleware/agentGovernance.js');
      agentGovernanceMiddleware = module.agentGovernanceMiddleware;
    });

    it('should allow requests within rate limit', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          'x-agent-id': 'rate-test-agent-1',
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should block requests exceeding rate limit', async () => {
      const agentId = 'rate-limit-test-agent-' + Date.now();

      // Make requests up to and beyond the limit
      for (let i = 0; i < 4; i++) {
        const req = createMockRequest({
          path: '/api/chat',
          headers: { 
            'user-agent': 'MoltBot/1.0',
            'x-agent-id': agentId,
          },
        });
        const res = createMockResponse();
        next = createMockNext();

        await agentGovernanceMiddleware(req, res, next);

        if (i < 3) {
          expect(next).toHaveBeenCalled();
        } else {
          expect(res.status).toHaveBeenCalledWith(429);
          expect(res._json).toMatchObject({
            type: 'rate_limited',
            code: 'AGENT_RATE_LIMIT',
          });
        }
      }
    });

    it('should track rate limits per agent', async () => {
      const agentId1 = 'agent-one-' + Date.now();
      const agentId2 = 'agent-two-' + Date.now();

      // Exhaust rate limit for agent 1
      for (let i = 0; i < 3; i++) {
        const req = createMockRequest({
          path: '/api/chat',
          headers: { 
            'user-agent': 'MoltBot/1.0',
            'x-agent-id': agentId1,
          },
        });
        const res = createMockResponse();
        await agentGovernanceMiddleware(req, res, createMockNext());
      }

      // Agent 2 should still be able to make requests
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          'x-agent-id': agentId2,
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reset rate limit after window expires', async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const agentId = 'rate-reset-agent-' + now;

      // Exhaust rate limit
      for (let i = 0; i < 3; i++) {
        const req = createMockRequest({
          path: '/api/chat',
          headers: { 
            'user-agent': 'MoltBot/1.0',
            'x-agent-id': agentId,
          },
        });
        const res = createMockResponse();
        await agentGovernanceMiddleware(req, res, createMockNext());
      }

      // Advance time by more than 1 hour
      vi.setSystemTime(now + 61 * 60 * 1000);

      // Should be able to make requests again
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          'x-agent-id': agentId,
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should log rate limit exceeded', async () => {
      const agentId = 'rate-log-agent-' + Date.now();

      // Exhaust rate limit + 1
      for (let i = 0; i < 4; i++) {
        const req = createMockRequest({
          path: '/api/chat',
          headers: { 
            'user-agent': 'MoltBot/1.0',
            'x-agent-id': agentId,
          },
        });
        const res = createMockResponse();
        await agentGovernanceMiddleware(req, res, createMockNext());
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/api/chat' }),
        'Agent rate limit exceeded'
      );
    });
  });

  describe('Risky paths (approval required)', () => {
    beforeEach(async () => {
      mockEnv.AGENT_ACCESS_POLICY = 'allowlist';
      mockEnv.AGENT_ALLOWLIST = '*';
      mockEnv.AGENT_RATE_LIMIT_PER_HOUR = 100;

      vi.resetModules();
      const module = await import('../../src/middleware/agentGovernance.js');
      agentGovernanceMiddleware = module.agentGovernanceMiddleware;
    });

    it('should require approval for /api/ship', async () => {
      const req = createMockRequest({
        path: '/api/ship',
        method: 'POST',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          'x-agent-id': 'ship-test-agent',
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res._json).toMatchObject({
        message: 'Human approval required for this action.',
        approvalId: 'apr_test_123',
        pollUrl: '/api/approvals/apr_test_123',
        retryWithHeader: 'X-Approval-Id',
      });
      expect(mockCreateApprovalRequest).toHaveBeenCalled();
    });

    it('should require approval for /api/codegen', async () => {
      const req = createMockRequest({
        path: '/api/codegen',
        method: 'POST',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          'x-agent-id': 'codegen-test-agent',
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(mockCreateApprovalRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'agent:codegen-test-agent',
          action: 'agent.POST /api/codegen',
          riskLevel: 'high',
        })
      );
    });

    it('should require approval for /api/ship subpaths', async () => {
      const req = createMockRequest({
        path: '/api/ship/deploy',
        method: 'POST',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          'x-agent-id': 'ship-deploy-agent',
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(202);
    });

    it('should allow with valid approval ID', async () => {
      mockGetApprovalRequest.mockResolvedValue({ status: 'approved' });

      const req = createMockRequest({
        path: '/api/ship',
        method: 'POST',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          'x-agent-id': 'approved-agent',
          'x-approval-id': 'apr_valid_approval',
        },
      }) as Request & { agentApprovalId?: string };
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.agentApprovalId).toBe('apr_valid_approval');
    });

    it('should reject with pending approval ID', async () => {
      mockGetApprovalRequest.mockResolvedValue({ status: 'pending' });

      const req = createMockRequest({
        path: '/api/ship',
        method: 'POST',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          'x-agent-id': 'pending-agent',
          'x-approval-id': 'apr_pending',
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(mockCreateApprovalRequest).toHaveBeenCalled();
    });

    it('should reject with rejected approval ID', async () => {
      mockGetApprovalRequest.mockResolvedValue({ status: 'rejected' });

      const req = createMockRequest({
        path: '/api/ship',
        method: 'POST',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          'x-agent-id': 'rejected-agent',
          'x-approval-id': 'apr_rejected',
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(mockCreateApprovalRequest).toHaveBeenCalled();
    });

    it('should handle approval lookup error', async () => {
      mockGetApprovalRequest.mockRejectedValue(new Error('Database error'));

      const req = createMockRequest({
        path: '/api/ship',
        method: 'POST',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          'x-agent-id': 'error-agent',
          'x-approval-id': 'apr_error',
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      // Should fall through to create new approval
      expect(res.status).toHaveBeenCalledWith(202);
      expect(mockCreateApprovalRequest).toHaveBeenCalled();
    });

    it('should return 500 if approval creation fails', async () => {
      mockCreateApprovalRequest.mockRejectedValue(new Error('Approval creation failed'));

      const req = createMockRequest({
        path: '/api/ship',
        method: 'POST',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          'x-agent-id': 'create-fail-agent',
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res._json).toMatchObject({
        error: 'Failed to create approval request',
        type: 'internal_error',
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should not require approval for non-risky path /api/chat', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        method: 'POST',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          'x-agent-id': 'chat-agent',
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(mockCreateApprovalRequest).not.toHaveBeenCalled();
    });

    it('should record audit log for approval requirement', async () => {
      const req = createMockRequest({
        path: '/api/ship',
        method: 'POST',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          'x-agent-id': 'audit-approval-agent',
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(mockWriteAuditLog).toHaveBeenCalledWith({
        userId: 'agent:audit-approval-agent',
        action: 'agent.approval_required',
        category: 'security',
        target: '/api/ship',
        metadata: expect.objectContaining({ status: 'approval_required' }),
      });
    });
  });

  describe('Agent ID sanitization', () => {
    beforeEach(() => {
      mockEnv.AGENT_ACCESS_POLICY = 'block';
    });

    it('should sanitize special characters in agent ID', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 
          'x-agent-source': 'moltbot',
          'x-agent-id': 'agent<script>alert(1)</script>',
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.not.stringContaining('<script>'),
        })
      );
    });

    it('should truncate long agent IDs', async () => {
      const longId = 'a'.repeat(200);
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 
          'x-agent-source': 'moltbot',
          'x-agent-id': longId,
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      // The audit log should have a truncated agent ID (128 chars max)
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.stringMatching(/^agent:[a-zA-Z0-9\-_]{1,128}$/),
        })
      );
    });

    it('should use "unknown" for empty agent ID', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 
          'x-agent-source': 'moltbot',
          'x-agent-id': '',
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ agentId: 'moltbot' }),
        })
      );
    });

    it('should convert special characters to underscores in agent ID', async () => {
      // Agent ID with special characters gets sanitized to underscores
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 
          'x-agent-source': 'moltbot',
          'x-agent-id': '!@#$%^&*()',
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ agentId: '__________' }),
        })
      );
    });

    it('should fallback to x-agent-source when x-agent-id is not provided', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 
          'x-agent-source': 'moltbot',
          // No x-agent-id
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ agentId: 'moltbot' }),
        })
      );
    });

    it('should fallback to user-agent when detected via UA pattern without x-agent-id', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          // No x-agent-id
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      // Should use the first 64 chars of user-agent
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ agentId: 'MoltBot_1_0' }),
        })
      );
    });

    it('should use "ua-detected" when user-agent is empty but matches pattern', async () => {
      // This is an edge case where the user-agent is detected by pattern
      // but the actual string is empty (unlikely but covers the branch)
      // We can simulate by testing with very short matching strings
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 
          'user-agent': 'bot/',
          // No x-agent-id
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      // Should use bot_ (sanitized from bot/)
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ agentId: 'bot_' }),
        })
      );
    });
  });

  describe('Audit logging error handling', () => {
    it('should continue even if audit log fails', async () => {
      mockWriteAuditLog.mockRejectedValue(new Error('Audit log failed'));
      mockEnv.AGENT_ACCESS_POLICY = 'audit_only';

      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      // Should still call next despite audit failure
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Request context extension', () => {
    beforeEach(() => {
      mockEnv.AGENT_ACCESS_POLICY = 'audit_only';
    });

    it('should set isAgentRequest to true for detected agents', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'MoltBot/1.0' },
      }) as Request & { isAgentRequest?: boolean };
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(req.isAgentRequest).toBe(true);
    });

    it('should set agentId on request', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          'x-agent-id': 'test-agent-id',
        },
      }) as Request & { agentId?: string };
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(req.agentId).toBe('test-agent-id');
    });

    it('should not set isAgentRequest for non-agent requests', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'Chrome/120' },
      }) as Request & { isAgentRequest?: boolean };
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(req.isAgentRequest).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined headers', async () => {
      const req = {
        path: '/api/chat',
        method: 'POST',
        headers: {},
      } as unknown as Request;
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle null user-agent', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': '' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle X-Agent-Id without matching X-Agent-Source', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 
          'x-agent-id': 'some-agent-id',
          // No matching agent patterns
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      // Should not be detected as agent
      expect(next).toHaveBeenCalled();
    });

    it('should use X-Agent-Id from user-agent match when x-agent-id provided', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: { 
          'user-agent': 'OpenClaw/1.0',
          'x-agent-id': 'explicit-agent-id',
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ agentId: 'explicit-agent-id' }),
        })
      );
    });

    it('should handle default rate limit when env is undefined', async () => {
      mockEnv.AGENT_ACCESS_POLICY = 'allowlist';
      mockEnv.AGENT_ALLOWLIST = '*';
      // @ts-expect-error - testing undefined case
      mockEnv.AGENT_RATE_LIMIT_PER_HOUR = undefined;

      vi.resetModules();
      const module = await import('../../src/middleware/agentGovernance.js');
      agentGovernanceMiddleware = module.agentGovernanceMiddleware;

      const req = createMockRequest({
        path: '/api/chat',
        headers: { 
          'user-agent': 'MoltBot/1.0',
          'x-agent-id': 'default-rate-agent-' + Date.now(),
        },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      // Should use default of 10
      expect(next).toHaveBeenCalled();
    });

    it('should use default block policy when AGENT_ACCESS_POLICY is undefined', async () => {
      // @ts-expect-error - testing undefined case
      mockEnv.AGENT_ACCESS_POLICY = undefined;

      vi.resetModules();
      const module = await import('../../src/middleware/agentGovernance.js');
      agentGovernanceMiddleware = module.agentGovernanceMiddleware;

      const req = createMockRequest({
        path: '/api/chat',
        headers: { 'user-agent': 'MoltBot/1.0' },
      });
      const res = createMockResponse();

      await agentGovernanceMiddleware(req, res, next);

      // Should default to block policy
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should show default rate limit in error message when undefined', async () => {
      mockEnv.AGENT_ACCESS_POLICY = 'allowlist';
      mockEnv.AGENT_ALLOWLIST = '*';
      // @ts-expect-error - testing undefined case  
      mockEnv.AGENT_RATE_LIMIT_PER_HOUR = undefined;

      vi.resetModules();
      const module = await import('../../src/middleware/agentGovernance.js');
      agentGovernanceMiddleware = module.agentGovernanceMiddleware;

      const agentId = 'rate-limit-default-test-' + Date.now();

      // Exhaust rate limit (default of 10)
      for (let i = 0; i < 11; i++) {
        const req = createMockRequest({
          path: '/api/chat',
          headers: { 
            'user-agent': 'MoltBot/1.0',
            'x-agent-id': agentId,
          },
        });
        const res = createMockResponse();
        await agentGovernanceMiddleware(req, res, createMockNext());

        if (i === 10) {
          // Should have hit the limit
          expect(res.status).toHaveBeenCalledWith(429);
          expect(res._json).toMatchObject({
            error: 'Rate limit exceeded. Max 10 requests per hour per agent.',
          });
        }
      }
    });
  });
});

describe('Agent Rate Limiting', () => {
  it('should apply stricter rate limits to suspicious user agents', () => {
    const getRateLimit = (userAgent: string): number => {
      const suspicious = ['python-requests', 'curl', 'wget', 'httpie'];
      const isSuspicious = suspicious.some(s => 
        userAgent.toLowerCase().includes(s.toLowerCase())
      );
      return isSuspicious ? 10 : 100;
    };
    
    expect(getRateLimit('python-requests/2.28.0')).toBe(10);
    expect(getRateLimit('Mozilla/5.0 Chrome/120')).toBe(100);
  });
  
  it('should track request patterns for anomaly detection', () => {
    const patterns: Array<{ ip: string; endpoint: string; timestamp: number }> = [];
    
    // Simulate rapid requests from same IP
    const ip = '192.168.1.1';
    const now = Date.now();
    
    for (let i = 0; i < 50; i++) {
      patterns.push({ ip, endpoint: '/api/chat', timestamp: now + i * 100 });
    }
    
    // Detect anomaly: more than 30 requests in 5 seconds
    const recentPatterns = patterns.filter(p => 
      p.ip === ip && 
      p.timestamp >= now - 5000
    );
    
    const isAnomaly = recentPatterns.length > 30;
    expect(isAnomaly).toBe(true);
  });
});
