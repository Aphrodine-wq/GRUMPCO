/**
 * Approvals API integration tests.
 * Tests /api/approvals endpoints for managing action approval requests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';
process.env.NVIDIA_NIM_API_KEY = 'test_key';

// Mock approval storage
const mockApprovals: Array<{
  id: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  action: string;
  riskLevel: 'low' | 'medium' | 'high';
  reason?: string;
  payload?: string;
  createdAt: string;
}> = [];

// Mock approval service with correct export names
vi.mock('../../src/services/approvalService.js', () => ({
  createApprovalRequest: vi.fn().mockImplementation((input) => {
    const approval = {
      id: `apr_${Date.now()}`,
      userId: input.userId || 'default',
      status: 'pending' as const,
      action: input.action,
      riskLevel: input.riskLevel || 'medium',
      reason: input.reason,
      payload: input.payload ? JSON.stringify(input.payload) : null,
      createdAt: new Date().toISOString(),
    };
    mockApprovals.push(approval);
    return Promise.resolve(approval);
  }),
  getApprovalRequest: vi.fn().mockImplementation((id) => 
    Promise.resolve(mockApprovals.find(a => a.id === id) || null)
  ),
  getPendingApprovals: vi.fn().mockImplementation((userId) => {
    const filtered = mockApprovals.filter(a => a.userId === userId && a.status === 'pending');
    return Promise.resolve(filtered);
  }),
  approveRequest: vi.fn().mockImplementation((id, _approvedBy) => {
    const approval = mockApprovals.find(a => a.id === id);
    if (approval) {
      approval.status = 'approved';
      return Promise.resolve(approval);
    }
    return Promise.resolve(null);
  }),
  rejectRequest: vi.fn().mockImplementation((id, reason) => {
    const approval = mockApprovals.find(a => a.id === id);
    if (approval) {
      approval.status = 'rejected';
      approval.reason = reason;
      return Promise.resolve(approval);
    }
    return Promise.resolve(null);
  }),
  assessRiskLevel: vi.fn().mockReturnValue('medium'),
  requiresApproval: vi.fn().mockReturnValue(true),
  waitForApproval: vi.fn().mockResolvedValue({ status: 'approved' }),
  requestAndWaitForApproval: vi.fn().mockResolvedValue({ status: 'approved' }),
}));

// Mock the database
vi.mock('../../src/db/database.js', () => ({
  getDatabase: vi.fn(() => ({
    getDb: () => ({
      prepare: () => ({
        get: () => null,
        run: () => ({ changes: 1 }),
        all: () => [],
      }),
    }),
  })),
}));

// Import and setup
const approvalsRoutes = (await import('../../src/routes/approvals.js')).default;
const app: Express = express();
app.use(express.json());
app.use('/api/approvals', approvalsRoutes);

describe('Approvals API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApprovals.length = 0;
  });

  describe('GET /api/approvals', () => {
    it('returns 200 with approvals array', async () => {
      const res = await request(app).get('/api/approvals').expect(200);
      expect(res.body).toHaveProperty('approvals');
      expect(Array.isArray(res.body.approvals)).toBe(true);
    });

    it('accepts status filter query parameter', async () => {
      const res = await request(app)
        .get('/api/approvals?status=pending')
        .expect(200);
      expect(res.body).toHaveProperty('approvals');
    });

    it('returns empty array when no approvals exist', async () => {
      const res = await request(app).get('/api/approvals').expect(200);
      expect(res.body.approvals).toHaveLength(0);
    });
  });

  describe('GET /api/approvals/:id', () => {
    it('returns 404 for non-existent approval', async () => {
      const res = await request(app)
        .get('/api/approvals/non-existent-id')
        .expect(404);
      expect(res.body).toHaveProperty('error');
    });

    it('returns approval details for valid ID', async () => {
      // First create an approval
      mockApprovals.push({
        id: 'apr_test123',
        userId: 'default',
        status: 'pending',
        action: 'delete_file',
        riskLevel: 'high',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app)
        .get('/api/approvals/apr_test123')
        .expect(200);
      expect(res.body).toHaveProperty('id', 'apr_test123');
      expect(res.body).toHaveProperty('action', 'delete_file');
      expect(res.body).toHaveProperty('riskLevel', 'high');
    });
  });

  describe('POST /api/approvals', () => {
    it('returns 400 when action is missing', async () => {
      const res = await request(app)
        .post('/api/approvals')
        .send({})
        .expect(400);
      expect(res.body).toHaveProperty('error');
    });

    it('creates a new approval request', async () => {
      const res = await request(app)
        .post('/api/approvals')
        .send({
          action: 'delete_file',
          riskLevel: 'high',
          reason: 'Deleting important file',
        })
        .expect(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('status', 'pending');
    });
  });

  describe('POST /api/approvals/:id/approve', () => {
    it('returns 404 for non-existent approval', async () => {
      const res = await request(app)
        .post('/api/approvals/non-existent-id/approve')
        .send({})
        .expect(404);
      expect(res.body).toHaveProperty('error');
    });

    it('approves pending request', async () => {
      // First create an approval
      mockApprovals.push({
        id: 'apr_approve_test',
        userId: 'default',
        status: 'pending',
        action: 'send_email',
        riskLevel: 'medium',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/api/approvals/apr_approve_test/approve')
        .send({ approvedBy: 'user@example.com' })
        .expect(200);
      expect(res.body).toHaveProperty('status', 'approved');
    });
  });

  describe('POST /api/approvals/:id/reject', () => {
    it('returns 404 for non-existent approval', async () => {
      const res = await request(app)
        .post('/api/approvals/non-existent-id/reject')
        .send({})
        .expect(404);
      expect(res.body).toHaveProperty('error');
    });

    it('rejects pending request with reason', async () => {
      // First create an approval
      mockApprovals.push({
        id: 'apr_reject_test',
        userId: 'default',
        status: 'pending',
        action: 'send_email',
        riskLevel: 'medium',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/api/approvals/apr_reject_test/reject')
        .send({ reason: 'Not authorized for this action' })
        .expect(200);
      expect(res.body).toHaveProperty('status', 'rejected');
    });
  });
});
