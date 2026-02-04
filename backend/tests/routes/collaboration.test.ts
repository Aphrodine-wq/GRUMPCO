/**
 * Collaboration Route Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock auth middleware
vi.mock('../../src/middleware/authMiddleware.js', () => ({
  requireAuth: vi.fn((req, _res, next) => {
    // Default to authenticated user
    if (req.headers['x-test-user-id']) {
      req.user = { id: req.headers['x-test-user-id'] as string };
    }
    next();
  }),
}));

// Mock collaboration service
vi.mock('../../src/services/collaborationService.js', () => ({
  addMember: vi.fn(),
  getMembers: vi.fn(),
  removeMember: vi.fn(),
  canAccess: vi.fn(),
}));

// Mock comments service
vi.mock('../../src/services/commentsService.js', () => ({
  addComment: vi.fn(),
  listComments: vi.fn(),
  addVersion: vi.fn(),
  listVersions: vi.fn(),
}));

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  getRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import collaborationRouter from '../../src/routes/collaboration.js';
import {
  addMember,
  getMembers,
  removeMember,
  canAccess,
  type ProjectMember,
} from '../../src/services/collaborationService.js';
import {
  addComment,
  listComments,
  addVersion,
  listVersions,
} from '../../src/services/commentsService.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/collab', collaborationRouter);
  return app;
}

describe('Collaboration Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /collab/projects/:projectId/members', () => {
    it('should return members list when user has viewer access', async () => {
      const mockMembers: ProjectMember[] = [
        { userId: 'user1', projectId: 'proj1', role: 'owner', addedAt: '2025-01-31T10:00:00.000Z' },
        { userId: 'user2', projectId: 'proj1', role: 'editor', addedAt: '2025-01-31T11:00:00.000Z' },
      ];

      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(getMembers).mockReturnValue(mockMembers);

      const response = await request(app)
        .get('/collab/projects/proj1/members')
        .set('x-test-user-id', 'user1');

      expect(response.status).toBe(200);
      expect(response.body.members).toHaveLength(2);
      expect(response.body.members[0].userId).toBe('user1');
      expect(canAccess).toHaveBeenCalledWith('user1', 'proj1', 'viewer');
      expect(getMembers).toHaveBeenCalledWith('proj1');
    });

    it('should return 401 when user is not authenticated', async () => {
      // No user set (no x-test-user-id header)
      const response = await request(app)
        .get('/collab/projects/proj1/members');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks viewer access', async () => {
      vi.mocked(canAccess).mockReturnValue(false);

      const response = await request(app)
        .get('/collab/projects/proj1/members')
        .set('x-test-user-id', 'user1');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
      expect(canAccess).toHaveBeenCalledWith('user1', 'proj1', 'viewer');
    });

    it('should return empty array when project has no members', async () => {
      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(getMembers).mockReturnValue([]);

      const response = await request(app)
        .get('/collab/projects/proj1/members')
        .set('x-test-user-id', 'user1');

      expect(response.status).toBe(200);
      expect(response.body.members).toEqual([]);
    });
  });

  describe('POST /collab/projects/:projectId/members', () => {
    it('should add member when requester is owner', async () => {
      vi.mocked(canAccess).mockReturnValue(true);

      const response = await request(app)
        .post('/collab/projects/proj1/members')
        .set('x-test-user-id', 'owner1')
        .send({ userId: 'newuser', role: 'editor' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(canAccess).toHaveBeenCalledWith('owner1', 'proj1', 'owner');
      expect(addMember).toHaveBeenCalledWith('proj1', 'newuser', 'editor');
    });

    it('should return 400 when userId is missing', async () => {
      const response = await request(app)
        .post('/collab/projects/proj1/members')
        .set('x-test-user-id', 'owner1')
        .send({ role: 'editor' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('userId and role required');
    });

    it('should return 400 when role is missing', async () => {
      const response = await request(app)
        .post('/collab/projects/proj1/members')
        .set('x-test-user-id', 'owner1')
        .send({ userId: 'newuser' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('userId and role required');
    });

    it('should return 400 when both userId and role are missing', async () => {
      const response = await request(app)
        .post('/collab/projects/proj1/members')
        .set('x-test-user-id', 'owner1')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('userId and role required');
    });

    it('should return 403 when requester is not owner', async () => {
      vi.mocked(canAccess).mockReturnValue(false);

      const response = await request(app)
        .post('/collab/projects/proj1/members')
        .set('x-test-user-id', 'editor1')
        .send({ userId: 'newuser', role: 'viewer' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Only owners can add members');
      expect(addMember).not.toHaveBeenCalled();
    });

    it('should add viewer role member', async () => {
      vi.mocked(canAccess).mockReturnValue(true);

      const response = await request(app)
        .post('/collab/projects/proj1/members')
        .set('x-test-user-id', 'owner1')
        .send({ userId: 'newviewer', role: 'viewer' });

      expect(response.status).toBe(201);
      expect(addMember).toHaveBeenCalledWith('proj1', 'newviewer', 'viewer');
    });

    it('should add owner role member', async () => {
      vi.mocked(canAccess).mockReturnValue(true);

      const response = await request(app)
        .post('/collab/projects/proj1/members')
        .set('x-test-user-id', 'owner1')
        .send({ userId: 'newowner', role: 'owner' });

      expect(response.status).toBe(201);
      expect(addMember).toHaveBeenCalledWith('proj1', 'newowner', 'owner');
    });
  });

  describe('DELETE /collab/projects/:projectId/members/:userId', () => {
    it('should remove member when requester is owner', async () => {
      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(removeMember).mockReturnValue(true);

      const response = await request(app)
        .delete('/collab/projects/proj1/members/user2')
        .set('x-test-user-id', 'owner1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(removeMember).toHaveBeenCalledWith('proj1', 'user2');
    });

    it('should allow user to remove themselves', async () => {
      vi.mocked(canAccess).mockReturnValue(false); // Not owner
      vi.mocked(removeMember).mockReturnValue(true);

      const response = await request(app)
        .delete('/collab/projects/proj1/members/user1')
        .set('x-test-user-id', 'user1'); // Same user

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(removeMember).toHaveBeenCalledWith('proj1', 'user1');
    });

    it('should return 401 when user is not authenticated', async () => {
      const response = await request(app)
        .delete('/collab/projects/proj1/members/user2');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 403 when non-owner tries to remove another user', async () => {
      vi.mocked(canAccess).mockReturnValue(false);

      const response = await request(app)
        .delete('/collab/projects/proj1/members/user2')
        .set('x-test-user-id', 'user1'); // Different user, not owner

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
      expect(removeMember).not.toHaveBeenCalled();
    });

    it('should return 404 when member not found', async () => {
      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(removeMember).mockReturnValue(false);

      const response = await request(app)
        .delete('/collab/projects/proj1/members/nonexistent')
        .set('x-test-user-id', 'owner1');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /collab/projects/:projectId/entities/:entityType/:entityId/comments', () => {
    it('should return comments for valid entity type', async () => {
      const mockComments = [
        {
          id: 'c1',
          project_id: 'proj1',
          entity_type: 'diagram',
          entity_id: 'diag1',
          user_id: 'user1',
          parent_id: null,
          body: 'Great diagram!',
          created_at: '2025-01-31T10:00:00.000Z',
          updated_at: '2025-01-31T10:00:00.000Z',
        },
      ];

      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(listComments).mockReturnValue(mockComments);

      const response = await request(app)
        .get('/collab/projects/proj1/entities/diagram/diag1/comments')
        .set('x-test-user-id', 'user1');

      expect(response.status).toBe(200);
      expect(response.body.comments).toHaveLength(1);
      expect(response.body.comments[0].body).toBe('Great diagram!');
      expect(listComments).toHaveBeenCalledWith('diagram', 'diag1');
    });

    it('should return comments for all valid entity types', async () => {
      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(listComments).mockReturnValue([]);

      const entityTypes = ['diagram', 'spec', 'plan', 'code', 'session'];

      for (const entityType of entityTypes) {
        const response = await request(app)
          .get(`/collab/projects/proj1/entities/${entityType}/entity1/comments`)
          .set('x-test-user-id', 'user1');

        expect(response.status).toBe(200);
        expect(response.body.comments).toEqual([]);
      }
    });

    it('should return 401 when user is not authenticated', async () => {
      const response = await request(app)
        .get('/collab/projects/proj1/entities/diagram/diag1/comments');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks viewer access', async () => {
      vi.mocked(canAccess).mockReturnValue(false);

      const response = await request(app)
        .get('/collab/projects/proj1/entities/diagram/diag1/comments')
        .set('x-test-user-id', 'user1');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should return 400 for invalid entity type', async () => {
      vi.mocked(canAccess).mockReturnValue(true);

      const response = await request(app)
        .get('/collab/projects/proj1/entities/invalid/entity1/comments')
        .set('x-test-user-id', 'user1');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid entityType');
    });
  });

  describe('POST /collab/projects/:projectId/entities/:entityType/:entityId/comments', () => {
    it('should add comment with valid body', async () => {
      const mockComment = {
        id: 'c_new',
        project_id: 'proj1',
        entity_type: 'spec',
        entity_id: 'spec1',
        user_id: 'user1',
        parent_id: null,
        body: 'This looks good!',
        created_at: '2025-01-31T10:00:00.000Z',
        updated_at: '2025-01-31T10:00:00.000Z',
      };

      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(addComment).mockReturnValue(mockComment);

      const response = await request(app)
        .post('/collab/projects/proj1/entities/spec/spec1/comments')
        .set('x-test-user-id', 'user1')
        .send({ body: 'This looks good!' });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('c_new');
      expect(response.body.body).toBe('This looks good!');
      expect(addComment).toHaveBeenCalledWith({
        project_id: 'proj1',
        entity_type: 'spec',
        entity_id: 'spec1',
        user_id: 'user1',
        parent_id: undefined,
        body: 'This looks good!',
      });
    });

    it('should add reply comment with parent_id', async () => {
      const mockComment = {
        id: 'c_reply',
        project_id: 'proj1',
        entity_type: 'plan',
        entity_id: 'plan1',
        user_id: 'user2',
        parent_id: 'c_parent',
        body: 'I agree with this',
        created_at: '2025-01-31T11:00:00.000Z',
        updated_at: '2025-01-31T11:00:00.000Z',
      };

      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(addComment).mockReturnValue(mockComment);

      const response = await request(app)
        .post('/collab/projects/proj1/entities/plan/plan1/comments')
        .set('x-test-user-id', 'user2')
        .send({ body: 'I agree with this', parent_id: 'c_parent' });

      expect(response.status).toBe(201);
      expect(response.body.parent_id).toBe('c_parent');
      expect(addComment).toHaveBeenCalledWith({
        project_id: 'proj1',
        entity_type: 'plan',
        entity_id: 'plan1',
        user_id: 'user2',
        parent_id: 'c_parent',
        body: 'I agree with this',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      const response = await request(app)
        .post('/collab/projects/proj1/entities/diagram/diag1/comments')
        .send({ body: 'Test comment' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks editor access', async () => {
      vi.mocked(canAccess).mockReturnValue(false);

      const response = await request(app)
        .post('/collab/projects/proj1/entities/diagram/diag1/comments')
        .set('x-test-user-id', 'viewer1')
        .send({ body: 'Test comment' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
      expect(canAccess).toHaveBeenCalledWith('viewer1', 'proj1', 'editor');
    });

    it('should return 400 for invalid entity type', async () => {
      vi.mocked(canAccess).mockReturnValue(true);

      const response = await request(app)
        .post('/collab/projects/proj1/entities/invalid/entity1/comments')
        .set('x-test-user-id', 'user1')
        .send({ body: 'Test comment' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid entityType or body required');
    });

    it('should return 400 when body is missing', async () => {
      vi.mocked(canAccess).mockReturnValue(true);

      const response = await request(app)
        .post('/collab/projects/proj1/entities/diagram/diag1/comments')
        .set('x-test-user-id', 'user1')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid entityType or body required');
    });

    it('should return 400 when body is empty string', async () => {
      vi.mocked(canAccess).mockReturnValue(true);

      const response = await request(app)
        .post('/collab/projects/proj1/entities/diagram/diag1/comments')
        .set('x-test-user-id', 'user1')
        .send({ body: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid entityType or body required');
    });

    it('should return 400 when body is only whitespace', async () => {
      vi.mocked(canAccess).mockReturnValue(true);

      const response = await request(app)
        .post('/collab/projects/proj1/entities/diagram/diag1/comments')
        .set('x-test-user-id', 'user1')
        .send({ body: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid entityType or body required');
    });

    it('should return 400 when body is not a string', async () => {
      vi.mocked(canAccess).mockReturnValue(true);

      const response = await request(app)
        .post('/collab/projects/proj1/entities/diagram/diag1/comments')
        .set('x-test-user-id', 'user1')
        .send({ body: 123 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid entityType or body required');
    });

    it('should trim whitespace from comment body', async () => {
      const mockComment = {
        id: 'c_trimmed',
        project_id: 'proj1',
        entity_type: 'code',
        entity_id: 'code1',
        user_id: 'user1',
        parent_id: null,
        body: 'Trimmed comment',
        created_at: '2025-01-31T10:00:00.000Z',
        updated_at: '2025-01-31T10:00:00.000Z',
      };

      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(addComment).mockReturnValue(mockComment);

      await request(app)
        .post('/collab/projects/proj1/entities/code/code1/comments')
        .set('x-test-user-id', 'user1')
        .send({ body: '  Trimmed comment  ' });

      expect(addComment).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Trimmed comment',
        })
      );
    });

    it('should handle null parent_id', async () => {
      const mockComment = {
        id: 'c_null_parent',
        project_id: 'proj1',
        entity_type: 'session',
        entity_id: 'sess1',
        user_id: 'user1',
        parent_id: null,
        body: 'Top level comment',
        created_at: '2025-01-31T10:00:00.000Z',
        updated_at: '2025-01-31T10:00:00.000Z',
      };

      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(addComment).mockReturnValue(mockComment);

      const response = await request(app)
        .post('/collab/projects/proj1/entities/session/sess1/comments')
        .set('x-test-user-id', 'user1')
        .send({ body: 'Top level comment', parent_id: null });

      expect(response.status).toBe(201);
      expect(addComment).toHaveBeenCalledWith(
        expect.objectContaining({
          parent_id: undefined,
        })
      );
    });
  });

  describe('GET /collab/projects/:projectId/entities/:entityType/:entityId/versions', () => {
    it('should return versions for valid entity type', async () => {
      const mockVersions = [
        {
          id: 'v1',
          version: 2,
          data: '{"title":"Updated spec"}',
          created_at: '2025-01-31T11:00:00.000Z',
          created_by: 'user1',
        },
        {
          id: 'v0',
          version: 1,
          data: '{"title":"Initial spec"}',
          created_at: '2025-01-31T10:00:00.000Z',
          created_by: 'user1',
        },
      ];

      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(listVersions).mockReturnValue(mockVersions);

      const response = await request(app)
        .get('/collab/projects/proj1/entities/spec/spec1/versions')
        .set('x-test-user-id', 'user1');

      expect(response.status).toBe(200);
      expect(response.body.versions).toHaveLength(2);
      expect(response.body.versions[0].version).toBe(2);
      expect(listVersions).toHaveBeenCalledWith('spec', 'spec1', 50);
    });

    it('should return versions for all valid version entity types', async () => {
      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(listVersions).mockReturnValue([]);

      const entityTypes = ['spec', 'plan', 'diagram'];

      for (const entityType of entityTypes) {
        const response = await request(app)
          .get(`/collab/projects/proj1/entities/${entityType}/entity1/versions`)
          .set('x-test-user-id', 'user1');

        expect(response.status).toBe(200);
        expect(response.body.versions).toEqual([]);
      }
    });

    it('should respect limit query parameter', async () => {
      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(listVersions).mockReturnValue([]);

      const response = await request(app)
        .get('/collab/projects/proj1/entities/spec/spec1/versions?limit=10')
        .set('x-test-user-id', 'user1');

      expect(response.status).toBe(200);
      expect(listVersions).toHaveBeenCalledWith('spec', 'spec1', 10);
    });

    it('should cap limit at 100', async () => {
      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(listVersions).mockReturnValue([]);

      const response = await request(app)
        .get('/collab/projects/proj1/entities/spec/spec1/versions?limit=200')
        .set('x-test-user-id', 'user1');

      expect(response.status).toBe(200);
      expect(listVersions).toHaveBeenCalledWith('spec', 'spec1', 100);
    });

    it('should use default limit of 50 when not specified', async () => {
      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(listVersions).mockReturnValue([]);

      await request(app)
        .get('/collab/projects/proj1/entities/plan/plan1/versions')
        .set('x-test-user-id', 'user1');

      expect(listVersions).toHaveBeenCalledWith('plan', 'plan1', 50);
    });

    it('should use default limit when limit is invalid', async () => {
      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(listVersions).mockReturnValue([]);

      await request(app)
        .get('/collab/projects/proj1/entities/plan/plan1/versions?limit=invalid')
        .set('x-test-user-id', 'user1');

      expect(listVersions).toHaveBeenCalledWith('plan', 'plan1', 50);
    });

    it('should return 401 when user is not authenticated', async () => {
      const response = await request(app)
        .get('/collab/projects/proj1/entities/spec/spec1/versions');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks viewer access', async () => {
      vi.mocked(canAccess).mockReturnValue(false);

      const response = await request(app)
        .get('/collab/projects/proj1/entities/spec/spec1/versions')
        .set('x-test-user-id', 'user1');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should return 400 for invalid entity type (code is not allowed for versions)', async () => {
      vi.mocked(canAccess).mockReturnValue(true);

      const response = await request(app)
        .get('/collab/projects/proj1/entities/code/code1/versions')
        .set('x-test-user-id', 'user1');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid entityType for versions');
    });

    it('should return 400 for invalid entity type (session is not allowed for versions)', async () => {
      vi.mocked(canAccess).mockReturnValue(true);

      const response = await request(app)
        .get('/collab/projects/proj1/entities/session/sess1/versions')
        .set('x-test-user-id', 'user1');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid entityType for versions');
    });
  });

  describe('POST /collab/projects/:projectId/entities/:entityType/:entityId/versions', () => {
    it('should create version with string data', async () => {
      const mockVersion = {
        id: 'v_new',
        version: 3,
        data: '{"content":"new version data"}',
        created_at: '2025-01-31T12:00:00.000Z',
        created_by: 'user1',
      };

      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(addVersion).mockReturnValue(mockVersion);

      const response = await request(app)
        .post('/collab/projects/proj1/entities/spec/spec1/versions')
        .set('x-test-user-id', 'user1')
        .send({ data: '{"content":"new version data"}' });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('v_new');
      expect(response.body.version).toBe(3);
      expect(addVersion).toHaveBeenCalledWith({
        project_id: 'proj1',
        entity_type: 'spec',
        entity_id: 'spec1',
        data: '{"content":"new version data"}',
        created_by: 'user1',
      });
    });

    it('should stringify object data when data is not a string', async () => {
      const mockVersion = {
        id: 'v_obj',
        version: 1,
        data: '{"title":"My Plan","steps":[]}',
        created_at: '2025-01-31T12:00:00.000Z',
        created_by: 'user1',
      };

      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(addVersion).mockReturnValue(mockVersion);

      const response = await request(app)
        .post('/collab/projects/proj1/entities/plan/plan1/versions')
        .set('x-test-user-id', 'user1')
        .send({ title: 'My Plan', steps: [] });

      expect(response.status).toBe(201);
      expect(addVersion).toHaveBeenCalledWith({
        project_id: 'proj1',
        entity_type: 'plan',
        entity_id: 'plan1',
        data: JSON.stringify({ title: 'My Plan', steps: [] }),
        created_by: 'user1',
      });
    });

    it('should create version for diagram entity type', async () => {
      const mockVersion = {
        id: 'v_diag',
        version: 1,
        data: '{"nodes":[],"edges":[]}',
        created_at: '2025-01-31T12:00:00.000Z',
        created_by: 'user1',
      };

      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(addVersion).mockReturnValue(mockVersion);

      const response = await request(app)
        .post('/collab/projects/proj1/entities/diagram/diag1/versions')
        .set('x-test-user-id', 'user1')
        .send({ data: '{"nodes":[],"edges":[]}' });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('v_diag');
    });

    it('should return 401 when user is not authenticated', async () => {
      const response = await request(app)
        .post('/collab/projects/proj1/entities/spec/spec1/versions')
        .send({ data: '{}' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks editor access', async () => {
      vi.mocked(canAccess).mockReturnValue(false);

      const response = await request(app)
        .post('/collab/projects/proj1/entities/spec/spec1/versions')
        .set('x-test-user-id', 'viewer1')
        .send({ data: '{}' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
      expect(canAccess).toHaveBeenCalledWith('viewer1', 'proj1', 'editor');
    });

    it('should return 400 for invalid entity type (code)', async () => {
      vi.mocked(canAccess).mockReturnValue(true);

      const response = await request(app)
        .post('/collab/projects/proj1/entities/code/code1/versions')
        .set('x-test-user-id', 'user1')
        .send({ data: '{}' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid entityType for versions');
    });

    it('should return 400 for invalid entity type (session)', async () => {
      vi.mocked(canAccess).mockReturnValue(true);

      const response = await request(app)
        .post('/collab/projects/proj1/entities/session/sess1/versions')
        .set('x-test-user-id', 'user1')
        .send({ data: '{}' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid entityType for versions');
    });

    it('should handle empty body by stringifying it', async () => {
      const mockVersion = {
        id: 'v_empty',
        version: 1,
        data: '{}',
        created_at: '2025-01-31T12:00:00.000Z',
        created_by: 'user1',
      };

      vi.mocked(canAccess).mockReturnValue(true);
      vi.mocked(addVersion).mockReturnValue(mockVersion);

      const response = await request(app)
        .post('/collab/projects/proj1/entities/spec/spec1/versions')
        .set('x-test-user-id', 'user1')
        .send({});

      expect(response.status).toBe(201);
      expect(addVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          data: '{}',
        })
      );
    });
  });
});
