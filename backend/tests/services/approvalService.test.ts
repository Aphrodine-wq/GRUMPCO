/**
 * Approval Service Unit Tests
 * Tests human-in-the-loop approval requests for risky actions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Store original Date
const OriginalDate = global.Date;

// Mock database
const mockDb = {
  saveApprovalRequest: vi.fn(),
  getApprovalRequest: vi.fn(),
  getPendingApprovals: vi.fn(),
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

describe('approvalService', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Reset mock defaults
    mockDb.saveApprovalRequest.mockResolvedValue(undefined);
    mockDb.getApprovalRequest.mockResolvedValue(null);
    mockDb.getPendingApprovals.mockResolvedValue([]);
    mockDb.saveAuditLog.mockResolvedValue(undefined);
  });

  afterEach(() => {
    global.Date = OriginalDate;
    vi.useRealTimers();
  });

  describe('createApprovalRequest', () => {
    it('should create an approval request with correct fields', async () => {
      const { createApprovalRequest } = await import('../../src/services/approvalService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      const input = {
        userId: 'user-123',
        action: 'skill.activate',
        riskLevel: 'high' as const,
        reason: 'Activating new skill',
        payload: { skillId: 'skill-456' },
      };

      const result = await createApprovalRequest(input);

      expect(result).toMatchObject({
        user_id: 'user-123',
        status: 'pending',
        action: 'skill.activate',
        risk_level: 'high',
        reason: 'Activating new skill',
        resolved_at: null,
        resolved_by: null,
      });
      expect(result.id).toMatch(/^apr_\d+_[a-z0-9]+$/);
      expect(result.payload).toBe(JSON.stringify({ skillId: 'skill-456' }));
      expect(result.expires_at).toBeDefined();
      expect(mockDb.saveApprovalRequest).toHaveBeenCalledWith(result);
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-123',
        action: 'approval.requested',
        category: 'security',
        target: 'skill.activate',
        metadata: expect.objectContaining({ riskLevel: 'high' }),
      }));
    });

    it('should set expiry based on risk level - high (1 hour)', async () => {
      vi.useFakeTimers();
      const now = new Date('2025-01-15T10:00:00.000Z');
      vi.setSystemTime(now);

      const { createApprovalRequest } = await import('../../src/services/approvalService.js');

      const result = await createApprovalRequest({
        userId: 'user-123',
        action: 'sandbox.execute_untrusted',
        riskLevel: 'high',
      });

      const expiresAt = new Date(result.expires_at!);
      const expectedExpiry = new Date('2025-01-15T11:00:00.000Z');
      expect(expiresAt.getTime()).toBe(expectedExpiry.getTime());

      vi.useRealTimers();
    });

    it('should set expiry based on risk level - medium (4 hours)', async () => {
      vi.useFakeTimers();
      const now = new Date('2025-01-15T10:00:00.000Z');
      vi.setSystemTime(now);

      const { createApprovalRequest } = await import('../../src/services/approvalService.js');

      const result = await createApprovalRequest({
        userId: 'user-123',
        action: 'browser.write',
        riskLevel: 'medium',
      });

      const expiresAt = new Date(result.expires_at!);
      const expectedExpiry = new Date('2025-01-15T14:00:00.000Z');
      expect(expiresAt.getTime()).toBe(expectedExpiry.getTime());

      vi.useRealTimers();
    });

    it('should set expiry based on risk level - low (24 hours)', async () => {
      vi.useFakeTimers();
      const now = new Date('2025-01-15T10:00:00.000Z');
      vi.setSystemTime(now);

      const { createApprovalRequest } = await import('../../src/services/approvalService.js');

      const result = await createApprovalRequest({
        userId: 'user-123',
        action: 'some.action',
        riskLevel: 'low',
      });

      const expiresAt = new Date(result.expires_at!);
      const expectedExpiry = new Date('2025-01-16T10:00:00.000Z');
      expect(expiresAt.getTime()).toBe(expectedExpiry.getTime());

      vi.useRealTimers();
    });

    it('should use custom expiry time when provided', async () => {
      const { createApprovalRequest } = await import('../../src/services/approvalService.js');

      const customExpiry = '2025-12-31T23:59:59.000Z';
      const result = await createApprovalRequest({
        userId: 'user-123',
        action: 'custom.action',
        riskLevel: 'high',
        expiresAt: customExpiry,
      });

      expect(result.expires_at).toBe(customExpiry);
    });

    it('should handle null reason and payload', async () => {
      const { createApprovalRequest } = await import('../../src/services/approvalService.js');

      const result = await createApprovalRequest({
        userId: 'user-123',
        action: 'test.action',
        riskLevel: 'low',
      });

      expect(result.reason).toBeNull();
      expect(result.payload).toBeNull();
    });
  });

  describe('getApprovalRequest', () => {
    it('should return approval request by ID', async () => {
      const mockRecord = {
        id: 'apr_123',
        user_id: 'user-123',
        status: 'pending',
        action: 'skill.activate',
        risk_level: 'high',
        reason: null,
        payload: null,
        expires_at: '2025-01-15T12:00:00.000Z',
        created_at: '2025-01-15T10:00:00.000Z',
        resolved_at: null,
        resolved_by: null,
      };
      mockDb.getApprovalRequest.mockResolvedValueOnce(mockRecord);

      const { getApprovalRequest } = await import('../../src/services/approvalService.js');

      const result = await getApprovalRequest('apr_123');

      expect(result).toEqual(mockRecord);
      expect(mockDb.getApprovalRequest).toHaveBeenCalledWith('apr_123');
    });

    it('should return null when request not found', async () => {
      mockDb.getApprovalRequest.mockResolvedValueOnce(null);

      const { getApprovalRequest } = await import('../../src/services/approvalService.js');

      const result = await getApprovalRequest('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getPendingApprovals', () => {
    it('should return valid pending approvals', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      const mockPending = [
        {
          id: 'apr_1',
          user_id: 'user-123',
          status: 'pending',
          action: 'action1',
          risk_level: 'high',
          expires_at: futureDate,
          created_at: new Date().toISOString(),
        },
        {
          id: 'apr_2',
          user_id: 'user-123',
          status: 'pending',
          action: 'action2',
          risk_level: 'medium',
          expires_at: futureDate,
          created_at: new Date().toISOString(),
        },
      ];
      mockDb.getPendingApprovals.mockResolvedValueOnce(mockPending);

      const { getPendingApprovals } = await import('../../src/services/approvalService.js');

      const result = await getPendingApprovals('user-123');

      expect(result).toHaveLength(2);
      expect(mockDb.getPendingApprovals).toHaveBeenCalledWith('user-123');
    });

    it('should filter out expired requests and mark them as expired', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      const mockPending = [
        {
          id: 'apr_expired',
          user_id: 'user-123',
          status: 'pending',
          action: 'expired.action',
          risk_level: 'high',
          expires_at: pastDate,
          created_at: new Date().toISOString(),
        },
        {
          id: 'apr_valid',
          user_id: 'user-123',
          status: 'pending',
          action: 'valid.action',
          risk_level: 'medium',
          expires_at: futureDate,
          created_at: new Date().toISOString(),
        },
      ];
      mockDb.getPendingApprovals.mockResolvedValueOnce(mockPending);
      mockDb.getApprovalRequest.mockResolvedValue(mockPending[0]);

      const { getPendingApprovals } = await import('../../src/services/approvalService.js');

      const result = await getPendingApprovals('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('apr_valid');
      // Should have tried to expire the first request
      expect(mockDb.saveApprovalRequest).toHaveBeenCalled();
    });

    it('should return empty array when no pending approvals', async () => {
      mockDb.getPendingApprovals.mockResolvedValueOnce([]);

      const { getPendingApprovals } = await import('../../src/services/approvalService.js');

      const result = await getPendingApprovals('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('approveRequest', () => {
    it('should approve a pending request', async () => {
      const mockRecord = {
        id: 'apr_123',
        user_id: 'user-123',
        status: 'pending',
        action: 'skill.activate',
        risk_level: 'high',
        reason: null,
        payload: null,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        created_at: new Date().toISOString(),
        resolved_at: null,
        resolved_by: null,
      };
      mockDb.getApprovalRequest.mockResolvedValueOnce(mockRecord);

      const { approveRequest } = await import('../../src/services/approvalService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      const result = await approveRequest('apr_123', 'admin-user');

      expect(result).toMatchObject({
        id: 'apr_123',
        status: 'approved',
        resolved_by: 'admin-user',
      });
      expect(result!.resolved_at).toBeDefined();
      expect(mockDb.saveApprovalRequest).toHaveBeenCalled();
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-123',
        actor: 'admin-user',
        action: 'approval.approved',
        category: 'security',
      }));
    });

    it('should return null when request not found', async () => {
      mockDb.getApprovalRequest.mockResolvedValueOnce(null);

      const { approveRequest } = await import('../../src/services/approvalService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      const result = await approveRequest('non-existent', 'admin-user');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should return existing record when status is not pending', async () => {
      const mockRecord = {
        id: 'apr_123',
        user_id: 'user-123',
        status: 'approved',
        action: 'skill.activate',
        risk_level: 'high',
        resolved_at: new Date().toISOString(),
        resolved_by: 'someone-else',
      };
      mockDb.getApprovalRequest.mockResolvedValueOnce(mockRecord);

      const { approveRequest } = await import('../../src/services/approvalService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      const result = await approveRequest('apr_123', 'admin-user');

      expect(result).toEqual(mockRecord);
      expect(mockDb.saveApprovalRequest).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should expire request if past expiry time', async () => {
      const mockRecord = {
        id: 'apr_123',
        user_id: 'user-123',
        status: 'pending',
        action: 'skill.activate',
        risk_level: 'high',
        expires_at: new Date(Date.now() - 3600000).toISOString(),
        created_at: new Date().toISOString(),
        resolved_at: null,
        resolved_by: null,
      };
      const expiredRecord = { ...mockRecord, status: 'expired' };
      mockDb.getApprovalRequest
        .mockResolvedValueOnce(mockRecord)
        .mockResolvedValueOnce(mockRecord) // For expire call
        .mockResolvedValueOnce(expiredRecord);

      const { approveRequest } = await import('../../src/services/approvalService.js');

      const result = await approveRequest('apr_123', 'admin-user');

      expect(result).toMatchObject({ status: 'expired' });
    });
  });

  describe('rejectRequest', () => {
    it('should reject a pending request', async () => {
      const mockRecord = {
        id: 'apr_123',
        user_id: 'user-123',
        status: 'pending',
        action: 'skill.activate',
        risk_level: 'high',
        reason: null,
        payload: null,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        created_at: new Date().toISOString(),
        resolved_at: null,
        resolved_by: null,
      };
      mockDb.getApprovalRequest.mockResolvedValueOnce(mockRecord);

      const { rejectRequest } = await import('../../src/services/approvalService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      const result = await rejectRequest('apr_123', 'admin-user', 'Not approved for security reasons');

      expect(result).toMatchObject({
        id: 'apr_123',
        status: 'rejected',
        resolved_by: 'admin-user',
      });
      expect(result!.reason).toContain('Rejection: Not approved for security reasons');
      expect(result!.resolved_at).toBeDefined();
      expect(mockDb.saveApprovalRequest).toHaveBeenCalled();
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'approval.rejected',
        metadata: expect.objectContaining({ reason: 'Not approved for security reasons' }),
      }));
    });

    it('should append rejection reason to existing reason', async () => {
      const mockRecord = {
        id: 'apr_123',
        user_id: 'user-123',
        status: 'pending',
        action: 'skill.activate',
        risk_level: 'high',
        reason: 'Original reason',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        created_at: new Date().toISOString(),
        resolved_at: null,
        resolved_by: null,
      };
      mockDb.getApprovalRequest.mockResolvedValueOnce(mockRecord);

      const { rejectRequest } = await import('../../src/services/approvalService.js');

      const result = await rejectRequest('apr_123', 'admin-user', 'Additional rejection reason');

      expect(result!.reason).toBe('Original reason\nRejection: Additional rejection reason');
    });

    it('should keep existing reason when no rejection reason provided', async () => {
      const mockRecord = {
        id: 'apr_123',
        user_id: 'user-123',
        status: 'pending',
        action: 'skill.activate',
        risk_level: 'high',
        reason: 'Original reason',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        created_at: new Date().toISOString(),
        resolved_at: null,
        resolved_by: null,
      };
      mockDb.getApprovalRequest.mockResolvedValueOnce(mockRecord);

      const { rejectRequest } = await import('../../src/services/approvalService.js');

      const result = await rejectRequest('apr_123', 'admin-user');

      expect(result!.reason).toBe('Original reason');
    });

    it('should return null when request not found', async () => {
      mockDb.getApprovalRequest.mockResolvedValueOnce(null);

      const { rejectRequest } = await import('../../src/services/approvalService.js');

      const result = await rejectRequest('non-existent', 'admin-user');

      expect(result).toBeNull();
    });

    it('should return existing record when status is not pending', async () => {
      const mockRecord = {
        id: 'apr_123',
        user_id: 'user-123',
        status: 'rejected',
        action: 'skill.activate',
        risk_level: 'high',
        resolved_by: 'someone-else',
      };
      mockDb.getApprovalRequest.mockResolvedValueOnce(mockRecord);

      const { rejectRequest } = await import('../../src/services/approvalService.js');

      const result = await rejectRequest('apr_123', 'admin-user');

      expect(result).toEqual(mockRecord);
      expect(mockDb.saveApprovalRequest).not.toHaveBeenCalled();
    });
  });

  describe('requiresApproval', () => {
    it('should require approval for all high-risk actions', async () => {
      const { requiresApproval } = await import('../../src/services/approvalService.js');

      expect(requiresApproval('any.action', 'high')).toBe(true);
      expect(requiresApproval('random.high.risk', 'high')).toBe(true);
    });

    it('should require approval for specific medium-risk actions', async () => {
      const { requiresApproval } = await import('../../src/services/approvalService.js');

      expect(requiresApproval('skill.activate', 'medium')).toBe(true);
      expect(requiresApproval('integration.delete', 'medium')).toBe(true);
      expect(requiresApproval('browser.write', 'medium')).toBe(true);
      expect(requiresApproval('sandbox.execute', 'medium')).toBe(true);
      expect(requiresApproval('cost.exceed_budget', 'medium')).toBe(true);
    });

    it('should not require approval for other medium-risk actions', async () => {
      const { requiresApproval } = await import('../../src/services/approvalService.js');

      expect(requiresApproval('some.random.action', 'medium')).toBe(false);
      expect(requiresApproval('file.read', 'medium')).toBe(false);
    });

    it('should not require approval for low-risk actions', async () => {
      const { requiresApproval } = await import('../../src/services/approvalService.js');

      expect(requiresApproval('any.action', 'low')).toBe(false);
      expect(requiresApproval('skill.activate', 'low')).toBe(false);
    });
  });

  describe('waitForApproval', () => {
    it('should return status when request is resolved', async () => {
      const mockRecord = {
        id: 'apr_123',
        user_id: 'user-123',
        status: 'approved',
        action: 'skill.activate',
        risk_level: 'high',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };
      mockDb.getApprovalRequest.mockResolvedValue(mockRecord);

      const { waitForApproval } = await import('../../src/services/approvalService.js');

      const result = await waitForApproval('apr_123', 1000, 100);

      expect(result).toBe('approved');
    });

    it('should return rejected status', async () => {
      const mockRecord = {
        id: 'apr_123',
        user_id: 'user-123',
        status: 'rejected',
        action: 'skill.activate',
        risk_level: 'high',
      };
      mockDb.getApprovalRequest.mockResolvedValue(mockRecord);

      const { waitForApproval } = await import('../../src/services/approvalService.js');

      const result = await waitForApproval('apr_123', 1000, 100);

      expect(result).toBe('rejected');
    });

    it('should return expired when request not found', async () => {
      mockDb.getApprovalRequest.mockResolvedValue(null);

      const { waitForApproval } = await import('../../src/services/approvalService.js');

      const result = await waitForApproval('non-existent', 1000, 100);

      expect(result).toBe('expired');
    });

    it('should expire request during polling if past expiry', async () => {
      const pastExpiry = new Date(Date.now() - 1000).toISOString();
      const mockRecord = {
        id: 'apr_123',
        user_id: 'user-123',
        status: 'pending',
        action: 'skill.activate',
        risk_level: 'high',
        expires_at: pastExpiry,
        created_at: new Date().toISOString(),
      };
      mockDb.getApprovalRequest.mockResolvedValue(mockRecord);

      const { waitForApproval } = await import('../../src/services/approvalService.js');

      const result = await waitForApproval('apr_123', 1000, 100);

      expect(result).toBe('expired');
    });

    it('should return pending when timeout is reached', async () => {
      vi.useFakeTimers();
      const futureExpiry = new Date(Date.now() + 3600000).toISOString();
      const mockRecord = {
        id: 'apr_123',
        user_id: 'user-123',
        status: 'pending',
        action: 'skill.activate',
        risk_level: 'high',
        expires_at: futureExpiry,
      };
      mockDb.getApprovalRequest.mockResolvedValue(mockRecord);

      const { waitForApproval } = await import('../../src/services/approvalService.js');

      const promise = waitForApproval('apr_123', 500, 100);
      
      // Advance timers to exceed timeout
      await vi.advanceTimersByTimeAsync(600);
      
      const result = await promise;
      expect(result).toBe('pending');

      vi.useRealTimers();
    });
  });

  describe('requestAndWaitForApproval', () => {
    it('should create request and wait for approval', async () => {
      const { requestAndWaitForApproval } = await import('../../src/services/approvalService.js');

      // First call creates the request, subsequent calls return approved
      let callCount = 0;
      mockDb.getApprovalRequest.mockImplementation(async (id: string) => {
        callCount++;
        if (callCount === 1) {
          return {
            id,
            user_id: 'user-123',
            status: 'approved',
            action: 'skill.activate',
            risk_level: 'high',
          };
        }
        return {
          id,
          user_id: 'user-123',
          status: 'approved',
          action: 'skill.activate',
          risk_level: 'high',
        };
      });

      const result = await requestAndWaitForApproval({
        userId: 'user-123',
        action: 'skill.activate',
        riskLevel: 'high',
      }, 1000);

      expect(result.approved).toBe(true);
      expect(result.request).toBeDefined();
    });

    it('should return not approved when rejected', async () => {
      const { requestAndWaitForApproval } = await import('../../src/services/approvalService.js');

      mockDb.getApprovalRequest.mockResolvedValue({
        id: 'apr_123',
        user_id: 'user-123',
        status: 'rejected',
        action: 'skill.activate',
        risk_level: 'high',
      });

      const result = await requestAndWaitForApproval({
        userId: 'user-123',
        action: 'skill.activate',
        riskLevel: 'high',
      }, 1000);

      expect(result.approved).toBe(false);
    });
  });

  describe('assessRiskLevel', () => {
    it('should return high for high-risk actions', async () => {
      const { assessRiskLevel } = await import('../../src/services/approvalService.js');

      expect(assessRiskLevel('skill.create')).toBe('high');
      expect(assessRiskLevel('skill.activate')).toBe('high');
      expect(assessRiskLevel('sandbox.execute_untrusted')).toBe('high');
      expect(assessRiskLevel('browser.navigate_untrusted')).toBe('high');
      // integration.write_external matches the pattern ^integration\.(write|post|put|patch) which is 'medium'
      expect(assessRiskLevel('integration.write_external')).toBe('medium');
      expect(assessRiskLevel('system.modify_config')).toBe('high');
    });

    it('should return medium for medium-risk actions', async () => {
      const { assessRiskLevel } = await import('../../src/services/approvalService.js');

      expect(assessRiskLevel('skill.update')).toBe('medium');
      expect(assessRiskLevel('sandbox.execute')).toBe('medium');
      expect(assessRiskLevel('browser.write')).toBe('medium');
      expect(assessRiskLevel('integration.write_external')).toBe('medium');
      expect(assessRiskLevel('integration.send_message')).toBe('medium');
      expect(assessRiskLevel('memory.delete_bulk')).toBe('medium');
      expect(assessRiskLevel('heartbeat.create')).toBe('medium');
    });

    it('should return low for unclassified actions', async () => {
      const { assessRiskLevel } = await import('../../src/services/approvalService.js');

      expect(assessRiskLevel('file.read')).toBe('low');
      expect(assessRiskLevel('user.get_profile')).toBe('low');
      expect(assessRiskLevel('random.action')).toBe('low');
    });

    it('should elevate to medium for external context', async () => {
      const { assessRiskLevel } = await import('../../src/services/approvalService.js');

      expect(assessRiskLevel('file.read', { external: true })).toBe('medium');
    });

    it('should elevate to medium for destructive context', async () => {
      const { assessRiskLevel } = await import('../../src/services/approvalService.js');

      expect(assessRiskLevel('file.read', { destructive: true })).toBe('medium');
    });

    it('should not override high risk with context', async () => {
      const { assessRiskLevel } = await import('../../src/services/approvalService.js');

      // High risk action should stay high regardless of context
      expect(assessRiskLevel('skill.create', { external: false, destructive: false })).toBe('high');
    });
  });
});
