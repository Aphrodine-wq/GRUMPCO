/**
 * Workspace API integration tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';

const mockLoadRemoteWorkspace = vi.fn();

vi.mock('../../src/services/remoteWorkspaceService.js', () => ({
  loadRemoteWorkspace: (...args: unknown[]) => mockLoadRemoteWorkspace(...args),
}));

const workspaceRoutes = (await import('../../src/routes/workspace.js')).default;
const app: Express = express();
app.use(express.json());
app.use('/api/workspace', workspaceRoutes);

describe('Workspace API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/workspace/remote', () => {
    it('returns 400 when repoUrl missing', async () => {
      const res = await request(app)
        .post('/api/workspace/remote')
        .send({})
        .expect(400);
      expect(res.body.error).toContain('repoUrl');
    });

    it('returns 200 with workspace when load succeeds', async () => {
      mockLoadRemoteWorkspace.mockResolvedValue({ path: '/tmp/repo', files: [] });

      const res = await request(app)
        .post('/api/workspace/remote')
        .send({ repoUrl: 'https://github.com/user/repo.git' })
        .expect(200);
      expect(res.body).toHaveProperty('path');
      expect(mockLoadRemoteWorkspace).toHaveBeenCalledWith('https://github.com/user/repo.git');
    });

    it('returns 500 when load fails', async () => {
      mockLoadRemoteWorkspace.mockRejectedValue(new Error('Clone failed'));

      const res = await request(app)
        .post('/api/workspace/remote')
        .send({ repoUrl: 'https://invalid.repo' })
        .expect(500);
      expect(res.body.error).toBeDefined();
    });
  });
});
