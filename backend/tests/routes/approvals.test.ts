/**
 * Approvals Route Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock approval service
vi.mock('../../src/services/approvalService.js', () => ({
  createApprovalRequest: vi.fn(),
  getApprovalRequest: vi.fn(),
  getPendingApprovals: vi.fn(),
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
  assessRiskLevel: vi.fn(),
}));

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import approvalsRouter from '../../src/routes/approvals.js';
import {
  createApprovalRequest,
  getApprovalRequest,
  getPendingApprovals,
  approveRequest,
  rejectRequest,
  assessRiskLevel,
} from '../../src/services/approvalService.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/approvals', approvalsRouter);
  return app;
}

describe('Approvals Route', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /approvals', () => {
    it('should return list of pending approvals', async () => {
      const mockApprovals = [
        {
          id: 'apr_1',
          user_id: 'default',
          status: 'pending',
          action: 'skill.activate',
          risk_level: 'high',
          reason: 'Activating risky skill',
          payload: JSON.stringify({ skillId: 'sk_123' }),
          expires_at: '2025-01-31T12:00:00.000Z',
          created_at: '2025-01-31T10:00:00.000Z',
          resolved_at: null,
          resolved_by: null,
        },
      ];

      vi.mocked(getPendingApprovals).mockResolvedValue(mockApprovals);

      const response = await request(app).get('/approvals');

      expect(response.status).toBe(200);
      expect(response.body.approvals).toHaveLength(1);
      expect(response.body.approvals[0].action).toBe('skill.activate');
      expect(response.body.approvals[0].payload).toEqual({ skillId: 'sk_123' });
      expect(getPendingApprovals).toHaveBeenCalledWith('default');
    });

    it('should return empty list', async () => {
      vi.mocked(getPendingApprovals).mockResolvedValue([]);

      const response = await request(app).get('/approvals');

      expect(response.status).toBe(200);
      expect(response.body.approvals).toEqual([]);
    });

    it('should return 500 on service error', async () => {
      vi.mocked(getPendingApprovals).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/approvals');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to list approvals');
    });
  });

  describe('GET /approvals/:id', () => {
    it('should return approval by id', async () => {
      const mockApproval = {
        id: 'apr_123',
        user_id: 'default',
        status: 'pending',
        action: 'sandbox.execute',
        risk_level: 'medium',
        reason: 'Execute untrusted code',
        payload: JSON.stringify({ code: 'console.log("test")' }),
        expires_at: '2025-01-31T14:00:00.000Z',
        created_at: '2025-01-31T10:00:00.000Z',
        resolved_at: null,
        resolved_by: null,
      };

      vi.mocked(getApprovalRequest).mockResolvedValue(mockApproval);

      const response = await request(app).get('/approvals/apr_123');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('apr_123');
      expect(response.body.action).toBe('sandbox.execute');
      expect(response.body.payload).toEqual({ code: 'console.log("test")' });
      expect(getApprovalRequest).toHaveBeenCalledWith('apr_123');
    });

    it('should return 404 if approval not found', async () => {
      vi.mocked(getApprovalRequest).mockResolvedValue(null);

      const response = await request(app).get('/approvals/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Approval request not found');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(getApprovalRequest).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/approvals/apr_123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get approval');
    });
  });

  describe('POST /approvals', () => {
    it('should create approval request with risk level', async () => {
      const mockApproval = {
        id: 'apr_new',
        user_id: 'default',
        status: 'pending',
        action: 'skill.create',
        risk_level: 'high',
        reason: 'Creating new skill',
        payload: JSON.stringify({ name: 'test-skill' }),
        expires_at: '2025-01-31T11:00:00.000Z',
        created_at: '2025-01-31T10:00:00.000Z',
        resolved_at: null,
        resolved_by: null,
      };

      vi.mocked(createApprovalRequest).mockResolvedValue(mockApproval);

      const response = await request(app)
        .post('/approvals')
        .send({
          action: 'skill.create',
          riskLevel: 'high',
          reason: 'Creating new skill',
          payload: { name: 'test-skill' },
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('apr_new');
      expect(response.body.risk_level).toBe('high');
      expect(createApprovalRequest).toHaveBeenCalledWith({
        userId: 'default',
        action: 'skill.create',
        riskLevel: 'high',
        reason: 'Creating new skill',
        payload: { name: 'test-skill' },
        expiresAt: undefined,
      });
    });

    it('should auto-assess risk level if not provided', async () => {
      vi.mocked(assessRiskLevel).mockReturnValue('medium');
      
      const mockApproval = {
        id: 'apr_auto',
        user_id: 'default',
        status: 'pending',
        action: 'sandbox.execute',
        risk_level: 'medium',
        reason: null,
        payload: null,
        expires_at: '2025-01-31T14:00:00.000Z',
        created_at: '2025-01-31T10:00:00.000Z',
        resolved_at: null,
        resolved_by: null,
      };

      vi.mocked(createApprovalRequest).mockResolvedValue(mockApproval);

      const response = await request(app)
        .post('/approvals')
        .send({
          action: 'sandbox.execute',
        });

      expect(response.status).toBe(201);
      expect(assessRiskLevel).toHaveBeenCalledWith('sandbox.execute', undefined);
      expect(createApprovalRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          riskLevel: 'medium',
        })
      );
    });

    it('should accept custom expiresAt', async () => {
      const mockApproval = {
        id: 'apr_exp',
        user_id: 'default',
        status: 'pending',
        action: 'browser.write',
        risk_level: 'low',
        reason: null,
        payload: null,
        expires_at: '2025-02-01T00:00:00.000Z',
        created_at: '2025-01-31T10:00:00.000Z',
        resolved_at: null,
        resolved_by: null,
      };

      vi.mocked(createApprovalRequest).mockResolvedValue(mockApproval);

      const response = await request(app)
        .post('/approvals')
        .send({
          action: 'browser.write',
          riskLevel: 'low',
          expiresAt: '2025-02-01T00:00:00.000Z',
        });

      expect(response.status).toBe(201);
      expect(createApprovalRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: '2025-02-01T00:00:00.000Z',
        })
      );
    });

    it('should return 400 for missing action', async () => {
      const response = await request(app)
        .post('/approvals')
        .send({
          riskLevel: 'high',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
      expect(response.body.details).toBeDefined();
    });

    it('should return 400 for invalid riskLevel', async () => {
      const response = await request(app)
        .post('/approvals')
        .send({
          action: 'test.action',
          riskLevel: 'extreme',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(assessRiskLevel).mockReturnValue('low');
      vi.mocked(createApprovalRequest).mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/approvals')
        .send({
          action: 'test.action',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create approval');
    });
  });

  describe('POST /approvals/:id/approve', () => {
    it('should approve request', async () => {
      const approvedRequest = {
        id: 'apr_123',
        user_id: 'default',
        status: 'approved',
        action: 'skill.activate',
        risk_level: 'high',
        reason: 'User requested skill activation',
        payload: JSON.stringify({ skillId: 'sk_1' }),
        expires_at: '2025-01-31T12:00:00.000Z',
        created_at: '2025-01-31T10:00:00.000Z',
        resolved_at: '2025-01-31T10:30:00.000Z',
        resolved_by: 'default',
      };

      vi.mocked(approveRequest).mockResolvedValue(approvedRequest);

      const response = await request(app).post('/approvals/apr_123/approve');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('approved');
      expect(response.body.resolved_by).toBe('default');
      expect(approveRequest).toHaveBeenCalledWith('apr_123', 'default');
    });

    it('should return 404 if approval not found', async () => {
      vi.mocked(approveRequest).mockResolvedValue(null);

      const response = await request(app).post('/approvals/nonexistent/approve');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Approval request not found');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(approveRequest).mockRejectedValue(new Error('DB error'));

      const response = await request(app).post('/approvals/apr_123/approve');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to approve request');
    });
  });

  describe('POST /approvals/:id/reject', () => {
    it('should reject request', async () => {
      const rejectedRequest = {
        id: 'apr_123',
        user_id: 'default',
        status: 'rejected',
        action: 'skill.activate',
        risk_level: 'high',
        reason: 'User requested skill activation\nRejection: Too risky',
        payload: JSON.stringify({ skillId: 'sk_1' }),
        expires_at: '2025-01-31T12:00:00.000Z',
        created_at: '2025-01-31T10:00:00.000Z',
        resolved_at: '2025-01-31T10:30:00.000Z',
        resolved_by: 'default',
      };

      vi.mocked(rejectRequest).mockResolvedValue(rejectedRequest);

      const response = await request(app)
        .post('/approvals/apr_123/reject')
        .send({
          reason: 'Too risky',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('rejected');
      expect(rejectRequest).toHaveBeenCalledWith('apr_123', 'default', 'Too risky');
    });

    it('should reject without reason', async () => {
      const rejectedRequest = {
        id: 'apr_123',
        user_id: 'default',
        status: 'rejected',
        action: 'skill.activate',
        risk_level: 'high',
        reason: null,
        payload: null,
        expires_at: '2025-01-31T12:00:00.000Z',
        created_at: '2025-01-31T10:00:00.000Z',
        resolved_at: '2025-01-31T10:30:00.000Z',
        resolved_by: 'default',
      };

      vi.mocked(rejectRequest).mockResolvedValue(rejectedRequest);

      const response = await request(app)
        .post('/approvals/apr_123/reject')
        .send({});

      expect(response.status).toBe(200);
      expect(rejectRequest).toHaveBeenCalledWith('apr_123', 'default', undefined);
    });

    it('should return 404 if approval not found', async () => {
      vi.mocked(rejectRequest).mockResolvedValue(null);

      const response = await request(app)
        .post('/approvals/nonexistent/reject')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Approval request not found');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(rejectRequest).mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/approvals/apr_123/reject')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to reject request');
    });
  });

  describe('GET /approvals/count/pending', () => {
    it('should return count of pending approvals by risk level', async () => {
      const mockApprovals = [
        {
          id: 'apr_1',
          user_id: 'default',
          status: 'pending',
          action: 'skill.create',
          risk_level: 'high',
          reason: null,
          payload: null,
          expires_at: '2025-01-31T12:00:00.000Z',
          created_at: '2025-01-31T10:00:00.000Z',
          resolved_at: null,
          resolved_by: null,
        },
        {
          id: 'apr_2',
          user_id: 'default',
          status: 'pending',
          action: 'sandbox.execute',
          risk_level: 'medium',
          reason: null,
          payload: null,
          expires_at: '2025-01-31T14:00:00.000Z',
          created_at: '2025-01-31T10:00:00.000Z',
          resolved_at: null,
          resolved_by: null,
        },
        {
          id: 'apr_3',
          user_id: 'default',
          status: 'pending',
          action: 'browser.read',
          risk_level: 'low',
          reason: null,
          payload: null,
          expires_at: '2025-02-01T10:00:00.000Z',
          created_at: '2025-01-31T10:00:00.000Z',
          resolved_at: null,
          resolved_by: null,
        },
      ];

      vi.mocked(getPendingApprovals).mockResolvedValue(mockApprovals);

      const response = await request(app).get('/approvals/count/pending');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(3);
      expect(response.body.highRisk).toBe(1);
      expect(response.body.mediumRisk).toBe(1);
      expect(response.body.lowRisk).toBe(1);
    });

    it('should return zero counts when no pending approvals', async () => {
      vi.mocked(getPendingApprovals).mockResolvedValue([]);

      const response = await request(app).get('/approvals/count/pending');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
      expect(response.body.highRisk).toBe(0);
      expect(response.body.mediumRisk).toBe(0);
      expect(response.body.lowRisk).toBe(0);
    });

    it('should return 500 on service error', async () => {
      vi.mocked(getPendingApprovals).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/approvals/count/pending');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to count approvals');
    });
  });
});
