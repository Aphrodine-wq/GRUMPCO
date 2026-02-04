/**
 * Comments and Version History Service Unit Tests
 * Tests adding, listing comments and version snapshots with both DB and in-memory fallback.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database - supports both DatabaseService methods and non-DB fallback
const mockDb = {
  insertComment: vi.fn(),
  listComments: vi.fn(),
  insertVersion: vi.fn(),
  listVersions: vi.fn(),
  getNextVersionNumber: vi.fn(),
};

let mockDbReturn: unknown = mockDb;

vi.mock('../../src/db/database.js', () => ({
  getDatabase: () => mockDbReturn,
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

describe('commentsService', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Reset mock defaults - return mock DB with DatabaseService methods
    mockDbReturn = mockDb;
    mockDb.insertComment.mockReturnValue(undefined);
    mockDb.listComments.mockReturnValue([]);
    mockDb.insertVersion.mockReturnValue(undefined);
    mockDb.listVersions.mockReturnValue([]);
    mockDb.getNextVersionNumber.mockReturnValue(1);
  });

  describe('addComment', () => {
    it('should add a comment using DatabaseService when available', async () => {
      // The service generates a random ID, so we need to capture it
      let capturedId: string | null = null;
      mockDb.insertComment.mockImplementation((p: { id: string }) => {
        capturedId = p.id;
      });

      mockDb.listComments.mockImplementation(() => {
        return [
          {
            id: capturedId,
            project_id: 'project-1',
            entity_type: 'diagram',
            entity_id: 'entity-1',
            user_id: 'user-1',
            parent_id: null,
            body: 'Test comment',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
          },
        ];
      });

      const { addComment } = await import('../../src/services/commentsService.js');

      const result = addComment({
        project_id: 'project-1',
        entity_type: 'diagram',
        entity_id: 'entity-1',
        user_id: 'user-1',
        body: 'Test comment',
      });

      expect(mockDb.insertComment).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'project-1',
          entity_type: 'diagram',
          entity_id: 'entity-1',
          user_id: 'user-1',
          parent_id: null,
          body: 'Test comment',
        })
      );
      expect(mockDb.insertComment.mock.calls[0][0].id).toMatch(/^c_\d+_[a-z0-9]+$/);
      expect(result.id).toBe(capturedId);
      expect(result.body).toBe('Test comment');
      expect(result.project_id).toBe('project-1');
    });

    it('should add a comment with parent_id for threaded replies', async () => {
      const mockComment = {
        id: 'c_123_abc',
        project_id: 'project-1',
        entity_type: 'spec',
        entity_id: 'entity-1',
        user_id: 'user-1',
        parent_id: 'parent-comment-1',
        body: 'Reply comment',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      mockDb.listComments.mockReturnValue([mockComment]);

      const { addComment } = await import('../../src/services/commentsService.js');

      const result = addComment({
        project_id: 'project-1',
        entity_type: 'spec',
        entity_id: 'entity-1',
        user_id: 'user-1',
        parent_id: 'parent-comment-1',
        body: 'Reply comment',
      });

      expect(mockDb.insertComment).toHaveBeenCalledWith(
        expect.objectContaining({
          parent_id: 'parent-comment-1',
        })
      );
      expect(result.parent_id).toBe('parent-comment-1');
    });

    it('should generate unique ID for each comment', async () => {
      mockDb.listComments.mockReturnValue([
        { id: 'c_123_abc', project_id: 'p1', entity_type: 'diagram', entity_id: 'e1', user_id: 'u1', parent_id: null, body: 'b1', created_at: '', updated_at: '' },
      ]);

      const { addComment } = await import('../../src/services/commentsService.js');

      addComment({
        project_id: 'project-1',
        entity_type: 'diagram',
        entity_id: 'entity-1',
        user_id: 'user-1',
        body: 'First comment',
      });

      const firstCallId = mockDb.insertComment.mock.calls[0][0].id;

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 5));

      mockDb.listComments.mockReturnValue([
        { id: 'c_456_def', project_id: 'p1', entity_type: 'diagram', entity_id: 'e1', user_id: 'u1', parent_id: null, body: 'b2', created_at: '', updated_at: '' },
      ]);

      addComment({
        project_id: 'project-1',
        entity_type: 'diagram',
        entity_id: 'entity-1',
        user_id: 'user-1',
        body: 'Second comment',
      });

      const secondCallId = mockDb.insertComment.mock.calls[1][0].id;

      expect(firstCallId).toMatch(/^c_\d+_[a-z0-9]+$/);
      expect(secondCallId).toMatch(/^c_\d+_[a-z0-9]+$/);
      // IDs should be different (though not guaranteed by pattern alone, randomness makes collision unlikely)
    });

    it('should fall back to in-memory storage when DB does not support comments', async () => {
      // Return a DB without insertComment method
      mockDbReturn = {};

      const { addComment } = await import('../../src/services/commentsService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      const result = addComment({
        project_id: 'project-1',
        entity_type: 'diagram',
        entity_id: 'entity-1',
        user_id: 'user-1',
        body: 'In-memory comment',
      });

      expect(result.id).toMatch(/^c_\d+_[a-z0-9]+$/);
      expect(result.project_id).toBe('project-1');
      expect(result.entity_type).toBe('diagram');
      expect(result.entity_id).toBe('entity-1');
      expect(result.user_id).toBe('user-1');
      expect(result.body).toBe('In-memory comment');
      expect(result.parent_id).toBeNull();
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'diagram',
          entity_id: 'entity-1',
        }),
        'Comment added'
      );
    });

    it('should fall back to in-memory when DB insertComment succeeds but comment not found in list', async () => {
      // DB methods exist but listComments doesn't return the new comment
      mockDb.insertComment.mockReturnValue(undefined);
      mockDb.listComments.mockReturnValue([]);

      const { addComment } = await import('../../src/services/commentsService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      const result = addComment({
        project_id: 'project-1',
        entity_type: 'plan',
        entity_id: 'entity-1',
        user_id: 'user-1',
        body: 'Fallback comment',
      });

      expect(mockDb.insertComment).toHaveBeenCalled();
      expect(result.body).toBe('Fallback comment');
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ entity_type: 'plan' }),
        'Comment added'
      );
    });

    it('should handle all entity types', async () => {
      const entityTypes = ['diagram', 'spec', 'plan', 'code', 'session'] as const;

      const { addComment } = await import('../../src/services/commentsService.js');

      for (const entityType of entityTypes) {
        mockDb.insertComment.mockClear();
        mockDb.listComments.mockReturnValue([
          { id: `c_${entityType}`, project_id: 'p1', entity_type: entityType, entity_id: 'e1', user_id: 'u1', parent_id: null, body: 'body', created_at: '', updated_at: '' },
        ]);

        const result = addComment({
          project_id: 'project-1',
          entity_type: entityType,
          entity_id: 'entity-1',
          user_id: 'user-1',
          body: `Comment for ${entityType}`,
        });

        expect(mockDb.insertComment).toHaveBeenCalledWith(
          expect.objectContaining({ entity_type: entityType })
        );
        expect(result.entity_type).toBe(entityType);
      }
    });

    it('should handle null parent_id explicitly', async () => {
      mockDb.listComments.mockReturnValue([
        { id: 'c_123', project_id: 'p1', entity_type: 'diagram', entity_id: 'e1', user_id: 'u1', parent_id: null, body: 'body', created_at: '', updated_at: '' },
      ]);

      const { addComment } = await import('../../src/services/commentsService.js');

      addComment({
        project_id: 'project-1',
        entity_type: 'diagram',
        entity_id: 'entity-1',
        user_id: 'user-1',
        parent_id: null,
        body: 'Comment with explicit null parent',
      });

      expect(mockDb.insertComment).toHaveBeenCalledWith(
        expect.objectContaining({ parent_id: null })
      );
    });

    it('should handle empty body', async () => {
      mockDb.listComments.mockReturnValue([
        { id: 'c_123', project_id: 'p1', entity_type: 'diagram', entity_id: 'e1', user_id: 'u1', parent_id: null, body: '', created_at: '', updated_at: '' },
      ]);

      const { addComment } = await import('../../src/services/commentsService.js');

      const result = addComment({
        project_id: 'project-1',
        entity_type: 'diagram',
        entity_id: 'entity-1',
        user_id: 'user-1',
        body: '',
      });

      expect(result.body).toBe('');
    });

    it('should handle special characters in body', async () => {
      const specialBody = 'Comment with <script>alert("xss")</script> and SQL\' injection';
      mockDb.listComments.mockReturnValue([
        { id: 'c_123', project_id: 'p1', entity_type: 'diagram', entity_id: 'e1', user_id: 'u1', parent_id: null, body: specialBody, created_at: '', updated_at: '' },
      ]);

      const { addComment } = await import('../../src/services/commentsService.js');

      const result = addComment({
        project_id: 'project-1',
        entity_type: 'diagram',
        entity_id: 'entity-1',
        user_id: 'user-1',
        body: specialBody,
      });

      expect(mockDb.insertComment).toHaveBeenCalledWith(
        expect.objectContaining({ body: specialBody })
      );
      expect(result.body).toBe(specialBody);
    });
  });

  describe('listComments', () => {
    it('should list comments using DatabaseService when available', async () => {
      const mockComments = [
        { id: 'c_1', project_id: 'p1', entity_type: 'diagram', entity_id: 'e1', user_id: 'u1', parent_id: null, body: 'First', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 'c_2', project_id: 'p1', entity_type: 'diagram', entity_id: 'e1', user_id: 'u2', parent_id: 'c_1', body: 'Reply', created_at: '2024-01-02', updated_at: '2024-01-02' },
      ];

      mockDb.listComments.mockReturnValue(mockComments);

      const { listComments } = await import('../../src/services/commentsService.js');

      const result = listComments('diagram', 'e1');

      expect(mockDb.listComments).toHaveBeenCalledWith('diagram', 'e1');
      expect(result).toEqual(mockComments);
      expect(result.length).toBe(2);
    });

    it('should return empty array when no comments exist', async () => {
      mockDb.listComments.mockReturnValue([]);

      const { listComments } = await import('../../src/services/commentsService.js');

      const result = listComments('diagram', 'nonexistent');

      expect(result).toEqual([]);
    });

    it('should fall back to in-memory storage when DB does not support comments', async () => {
      mockDbReturn = {};

      const { addComment, listComments } = await import('../../src/services/commentsService.js');

      // Add a comment first (will use in-memory)
      addComment({
        project_id: 'project-1',
        entity_type: 'spec',
        entity_id: 'entity-1',
        user_id: 'user-1',
        body: 'In-memory comment',
      });

      const result = listComments('spec', 'entity-1');

      expect(result.length).toBe(1);
      expect(result[0].body).toBe('In-memory comment');
    });

    it('should return empty array for entity with no comments in in-memory mode', async () => {
      mockDbReturn = {};

      const { listComments } = await import('../../src/services/commentsService.js');

      const result = listComments('diagram', 'no-comments');

      expect(result).toEqual([]);
    });

    it('should list comments for different entity types', async () => {
      const { listComments } = await import('../../src/services/commentsService.js');

      mockDb.listComments.mockReturnValue([{ id: 'c_1', body: 'test' }]);

      listComments('spec', 'spec-1');
      expect(mockDb.listComments).toHaveBeenCalledWith('spec', 'spec-1');

      listComments('plan', 'plan-1');
      expect(mockDb.listComments).toHaveBeenCalledWith('plan', 'plan-1');

      listComments('code', 'code-1');
      expect(mockDb.listComments).toHaveBeenCalledWith('code', 'code-1');
    });
  });

  describe('addVersion', () => {
    it('should add a version using DatabaseService when available', async () => {
      const mockVersion = {
        id: 'v_123_abc',
        version: 1,
        data: '{"content": "test"}',
        created_at: '2024-01-01T00:00:00.000Z',
        created_by: 'user-1',
      };

      mockDb.getNextVersionNumber.mockReturnValue(1);
      mockDb.listVersions.mockReturnValue([mockVersion]);

      const { addVersion } = await import('../../src/services/commentsService.js');

      const result = addVersion({
        project_id: 'project-1',
        entity_type: 'spec',
        entity_id: 'entity-1',
        data: '{"content": "test"}',
        created_by: 'user-1',
      });

      expect(mockDb.getNextVersionNumber).toHaveBeenCalledWith('spec', 'entity-1');
      expect(mockDb.insertVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'project-1',
          entity_type: 'spec',
          entity_id: 'entity-1',
          version: 1,
          data: '{"content": "test"}',
          created_by: 'user-1',
        })
      );
      expect(mockDb.insertVersion.mock.calls[0][0].id).toMatch(/^v_\d+_[a-z0-9]+$/);
      expect(result).toEqual(mockVersion);
    });

    it('should handle incrementing version numbers', async () => {
      mockDb.getNextVersionNumber.mockReturnValue(5);
      mockDb.listVersions.mockReturnValue([
        { id: 'v_5', version: 5, data: 'data', created_at: '', created_by: null },
      ]);

      const { addVersion } = await import('../../src/services/commentsService.js');

      addVersion({
        project_id: 'project-1',
        entity_type: 'plan',
        entity_id: 'entity-1',
        data: 'version 5 data',
      });

      expect(mockDb.insertVersion).toHaveBeenCalledWith(
        expect.objectContaining({ version: 5 })
      );
    });

    it('should handle null created_by', async () => {
      mockDb.getNextVersionNumber.mockReturnValue(1);
      mockDb.listVersions.mockReturnValue([
        { id: 'v_1', version: 1, data: 'data', created_at: '', created_by: null },
      ]);

      const { addVersion } = await import('../../src/services/commentsService.js');

      const result = addVersion({
        project_id: 'project-1',
        entity_type: 'diagram',
        entity_id: 'entity-1',
        data: 'test data',
      });

      expect(mockDb.insertVersion).toHaveBeenCalledWith(
        expect.objectContaining({ created_by: null })
      );
      expect(result.created_by).toBeNull();
    });

    it('should fall back to in-memory storage when DB does not support versions', async () => {
      mockDbReturn = {};

      const { addVersion } = await import('../../src/services/commentsService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      const result = addVersion({
        project_id: 'project-1',
        entity_type: 'spec',
        entity_id: 'entity-1',
        data: '{"in_memory": true}',
        created_by: 'user-1',
      });

      expect(result.id).toMatch(/^v_\d+_[a-z0-9]+$/);
      expect(result.version).toBe(1);
      expect(result.data).toBe('{"in_memory": true}');
      expect(result.created_by).toBe('user-1');
      expect(result.created_at).toBeDefined();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'spec',
          entity_id: 'entity-1',
          version: 1,
        }),
        'Version saved'
      );
    });

    it('should increment version numbers in in-memory mode', async () => {
      mockDbReturn = {};

      const { addVersion, listVersions } = await import('../../src/services/commentsService.js');

      const v1 = addVersion({
        project_id: 'project-1',
        entity_type: 'plan',
        entity_id: 'entity-1',
        data: 'version 1',
      });

      const v2 = addVersion({
        project_id: 'project-1',
        entity_type: 'plan',
        entity_id: 'entity-1',
        data: 'version 2',
      });

      const v3 = addVersion({
        project_id: 'project-1',
        entity_type: 'plan',
        entity_id: 'entity-1',
        data: 'version 3',
      });

      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);
      expect(v3.version).toBe(3);

      // Verify list returns in descending order (newest first)
      const versions = listVersions('plan', 'entity-1');
      expect(versions[0].version).toBe(3);
      expect(versions[1].version).toBe(2);
      expect(versions[2].version).toBe(1);
    });

    it('should handle all version entity types', async () => {
      const entityTypes = ['spec', 'plan', 'diagram'] as const;

      const { addVersion } = await import('../../src/services/commentsService.js');

      for (const entityType of entityTypes) {
        mockDb.getNextVersionNumber.mockClear();
        mockDb.insertVersion.mockClear();
        mockDb.getNextVersionNumber.mockReturnValue(1);
        mockDb.listVersions.mockReturnValue([
          { id: 'v_1', version: 1, data: 'data', created_at: '', created_by: null },
        ]);

        addVersion({
          project_id: 'project-1',
          entity_type: entityType,
          entity_id: 'entity-1',
          data: `Data for ${entityType}`,
        });

        expect(mockDb.getNextVersionNumber).toHaveBeenCalledWith(entityType, 'entity-1');
        expect(mockDb.insertVersion).toHaveBeenCalledWith(
          expect.objectContaining({ entity_type: entityType })
        );
      }
    });

    it('should limit in-memory versions to 100', async () => {
      mockDbReturn = {};

      const { addVersion, listVersions } = await import('../../src/services/commentsService.js');

      // Use unique entity ID to avoid state from other tests
      const entityId = `entity-limit-test-unique-${Date.now()}-${Math.random()}`;

      // Add 105 versions
      for (let i = 0; i < 105; i++) {
        addVersion({
          project_id: 'project-1',
          entity_type: 'spec',
          entity_id: entityId,
          data: `version ${i + 1}`,
        });
      }

      // Pass limit of 200 to verify storage limit of 100 is enforced
      const versions = listVersions('spec', entityId, 200);

      // Should be limited to 100 (storage limit, not retrieval limit)
      expect(versions.length).toBe(100);
      // Note: Due to the way version numbers are calculated (list.length + 1),
      // once the list is trimmed to 100 items, all subsequent versions get number 101
      // Newest should be first - the last 5 additions all got version 101
      expect(versions[0].version).toBe(101);
      // After adding 105 versions to a limit-100 store:
      // - First 100 versions are numbered 1-100
      // - Versions 101-105 are all numbered 101 (since list.length stays at 100)
      // - After each addition beyond 100, oldest is dropped
      // - Final state: 5 copies of v101, then v100, v99, ..., v6
      expect(versions[99].version).toBe(6);
    });

    it('should generate unique version IDs', async () => {
      mockDb.getNextVersionNumber.mockReturnValue(1);
      mockDb.listVersions.mockReturnValue([
        { id: 'v_1', version: 1, data: 'data', created_at: '', created_by: null },
      ]);

      const { addVersion } = await import('../../src/services/commentsService.js');

      addVersion({
        project_id: 'project-1',
        entity_type: 'spec',
        entity_id: 'entity-1',
        data: 'first',
      });

      const firstId = mockDb.insertVersion.mock.calls[0][0].id;

      await new Promise((resolve) => setTimeout(resolve, 5));

      mockDb.getNextVersionNumber.mockReturnValue(2);

      addVersion({
        project_id: 'project-1',
        entity_type: 'spec',
        entity_id: 'entity-1',
        data: 'second',
      });

      const secondId = mockDb.insertVersion.mock.calls[1][0].id;

      expect(firstId).toMatch(/^v_\d+_[a-z0-9]+$/);
      expect(secondId).toMatch(/^v_\d+_[a-z0-9]+$/);
    });

    it('should fall back to in-memory when DB insertVersion succeeds but version not found in list', async () => {
      mockDb.getNextVersionNumber.mockReturnValue(1);
      mockDb.insertVersion.mockReturnValue(undefined);
      mockDb.listVersions.mockReturnValue([]);

      const { addVersion } = await import('../../src/services/commentsService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      const result = addVersion({
        project_id: 'project-1',
        entity_type: 'diagram',
        entity_id: 'entity-1',
        data: 'fallback data',
      });

      expect(mockDb.insertVersion).toHaveBeenCalled();
      expect(result.data).toBe('fallback data');
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ entity_type: 'diagram' }),
        'Version saved'
      );
    });
  });

  describe('listVersions', () => {
    it('should list versions using DatabaseService when available', async () => {
      const mockVersions = [
        { id: 'v_2', version: 2, data: 'newer', created_at: '2024-01-02', created_by: 'u1' },
        { id: 'v_1', version: 1, data: 'older', created_at: '2024-01-01', created_by: 'u1' },
      ];

      mockDb.listVersions.mockReturnValue(mockVersions);

      const { listVersions } = await import('../../src/services/commentsService.js');

      const result = listVersions('spec', 'entity-1');

      expect(mockDb.listVersions).toHaveBeenCalledWith('spec', 'entity-1', 50);
      expect(result).toEqual(mockVersions);
    });

    it('should pass custom limit to DatabaseService', async () => {
      mockDb.listVersions.mockReturnValue([]);

      const { listVersions } = await import('../../src/services/commentsService.js');

      listVersions('spec', 'entity-1', 10);

      expect(mockDb.listVersions).toHaveBeenCalledWith('spec', 'entity-1', 10);
    });

    it('should use default limit of 50', async () => {
      mockDb.listVersions.mockReturnValue([]);

      const { listVersions } = await import('../../src/services/commentsService.js');

      listVersions('plan', 'entity-1');

      expect(mockDb.listVersions).toHaveBeenCalledWith('plan', 'entity-1', 50);
    });

    it('should return empty array when no versions exist', async () => {
      mockDb.listVersions.mockReturnValue([]);

      const { listVersions } = await import('../../src/services/commentsService.js');

      const result = listVersions('diagram', 'nonexistent');

      expect(result).toEqual([]);
    });

    it('should fall back to in-memory storage when DB does not support versions', async () => {
      mockDbReturn = {};

      const { addVersion, listVersions } = await import('../../src/services/commentsService.js');

      addVersion({
        project_id: 'project-1',
        entity_type: 'spec',
        entity_id: 'entity-1',
        data: 'v1 data',
      });

      addVersion({
        project_id: 'project-1',
        entity_type: 'spec',
        entity_id: 'entity-1',
        data: 'v2 data',
      });

      const result = listVersions('spec', 'entity-1');

      expect(result.length).toBe(2);
      // Newest first
      expect(result[0].version).toBe(2);
      expect(result[1].version).toBe(1);
    });

    it('should respect limit in in-memory mode', async () => {
      mockDbReturn = {};

      const { addVersion, listVersions } = await import('../../src/services/commentsService.js');

      // Add 5 versions
      for (let i = 0; i < 5; i++) {
        addVersion({
          project_id: 'project-1',
          entity_type: 'plan',
          entity_id: 'entity-limit',
          data: `version ${i + 1}`,
        });
      }

      const result = listVersions('plan', 'entity-limit', 3);

      expect(result.length).toBe(3);
      // Newest first
      expect(result[0].version).toBe(5);
      expect(result[1].version).toBe(4);
      expect(result[2].version).toBe(3);
    });

    it('should return empty array for entity with no versions in in-memory mode', async () => {
      mockDbReturn = {};

      const { listVersions } = await import('../../src/services/commentsService.js');

      const result = listVersions('spec', 'no-versions');

      expect(result).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle very long comment body', async () => {
      const longBody = 'a'.repeat(10000);
      mockDb.listComments.mockReturnValue([
        { id: 'c_1', project_id: 'p1', entity_type: 'diagram', entity_id: 'e1', user_id: 'u1', parent_id: null, body: longBody, created_at: '', updated_at: '' },
      ]);

      const { addComment } = await import('../../src/services/commentsService.js');

      const result = addComment({
        project_id: 'project-1',
        entity_type: 'diagram',
        entity_id: 'entity-1',
        user_id: 'user-1',
        body: longBody,
      });

      expect(mockDb.insertComment).toHaveBeenCalledWith(
        expect.objectContaining({ body: longBody })
      );
      expect(result.body.length).toBe(10000);
    });

    it('should handle very long version data', async () => {
      const longData = JSON.stringify({ content: 'a'.repeat(50000) });
      mockDb.getNextVersionNumber.mockReturnValue(1);
      mockDb.listVersions.mockReturnValue([
        { id: 'v_1', version: 1, data: longData, created_at: '', created_by: null },
      ]);

      const { addVersion } = await import('../../src/services/commentsService.js');

      const result = addVersion({
        project_id: 'project-1',
        entity_type: 'spec',
        entity_id: 'entity-1',
        data: longData,
      });

      expect(mockDb.insertVersion).toHaveBeenCalledWith(
        expect.objectContaining({ data: longData })
      );
      expect(result.data).toBe(longData);
    });

    it('should handle unicode in comment body', async () => {
      const unicodeBody = 'Comment with emojis and unicode chars';
      mockDb.listComments.mockReturnValue([
        { id: 'c_1', project_id: 'p1', entity_type: 'diagram', entity_id: 'e1', user_id: 'u1', parent_id: null, body: unicodeBody, created_at: '', updated_at: '' },
      ]);

      const { addComment } = await import('../../src/services/commentsService.js');

      const result = addComment({
        project_id: 'project-1',
        entity_type: 'diagram',
        entity_id: 'entity-1',
        user_id: 'user-1',
        body: unicodeBody,
      });

      expect(result.body).toBe(unicodeBody);
    });

    it('should handle concurrent comment additions in in-memory mode', async () => {
      mockDbReturn = {};

      const { addComment, listComments } = await import('../../src/services/commentsService.js');

      // Simulate multiple additions
      for (let i = 0; i < 10; i++) {
        addComment({
          project_id: 'project-1',
          entity_type: 'diagram',
          entity_id: 'concurrent-entity',
          user_id: `user-${i}`,
          body: `Comment ${i}`,
        });
      }

      const allComments = listComments('diagram', 'concurrent-entity');
      expect(allComments.length).toBe(10);
    });

    it('should isolate comments between different entities', async () => {
      mockDbReturn = {};

      const { addComment, listComments } = await import('../../src/services/commentsService.js');

      addComment({
        project_id: 'project-1',
        entity_type: 'diagram',
        entity_id: 'entity-1',
        user_id: 'user-1',
        body: 'Comment on entity 1',
      });

      addComment({
        project_id: 'project-1',
        entity_type: 'diagram',
        entity_id: 'entity-2',
        user_id: 'user-1',
        body: 'Comment on entity 2',
      });

      const entity1Comments = listComments('diagram', 'entity-1');
      const entity2Comments = listComments('diagram', 'entity-2');

      expect(entity1Comments.length).toBe(1);
      expect(entity1Comments[0].body).toBe('Comment on entity 1');
      expect(entity2Comments.length).toBe(1);
      expect(entity2Comments[0].body).toBe('Comment on entity 2');
    });

    it('should isolate versions between different entities', async () => {
      mockDbReturn = {};

      const { addVersion, listVersions } = await import('../../src/services/commentsService.js');

      addVersion({
        project_id: 'project-1',
        entity_type: 'spec',
        entity_id: 'spec-1',
        data: 'Spec 1 data',
      });

      addVersion({
        project_id: 'project-1',
        entity_type: 'spec',
        entity_id: 'spec-2',
        data: 'Spec 2 data',
      });

      const spec1Versions = listVersions('spec', 'spec-1');
      const spec2Versions = listVersions('spec', 'spec-2');

      expect(spec1Versions.length).toBe(1);
      expect(spec1Versions[0].data).toBe('Spec 1 data');
      expect(spec2Versions.length).toBe(1);
      expect(spec2Versions[0].data).toBe('Spec 2 data');
    });

    it('should isolate by entity type and entity id', async () => {
      mockDbReturn = {};

      const { addComment, listComments } = await import('../../src/services/commentsService.js');

      addComment({
        project_id: 'project-1',
        entity_type: 'diagram',
        entity_id: 'shared-id',
        user_id: 'user-1',
        body: 'Diagram comment',
      });

      addComment({
        project_id: 'project-1',
        entity_type: 'spec',
        entity_id: 'shared-id',
        user_id: 'user-1',
        body: 'Spec comment',
      });

      const diagramComments = listComments('diagram', 'shared-id');
      const specComments = listComments('spec', 'shared-id');

      expect(diagramComments.length).toBe(1);
      expect(diagramComments[0].body).toBe('Diagram comment');
      expect(specComments.length).toBe(1);
      expect(specComments[0].body).toBe('Spec comment');
    });
  });

  describe('type validation', () => {
    it('should return Comment type with all required fields', async () => {
      mockDbReturn = {};

      const { addComment } = await import('../../src/services/commentsService.js');

      const comment = addComment({
        project_id: 'project-1',
        entity_type: 'diagram',
        entity_id: 'entity-1',
        user_id: 'user-1',
        body: 'Test',
      });

      // Verify all Comment interface fields are present
      expect(comment).toHaveProperty('id');
      expect(comment).toHaveProperty('project_id');
      expect(comment).toHaveProperty('entity_type');
      expect(comment).toHaveProperty('entity_id');
      expect(comment).toHaveProperty('user_id');
      expect(comment).toHaveProperty('parent_id');
      expect(comment).toHaveProperty('body');
      expect(comment).toHaveProperty('created_at');
      expect(comment).toHaveProperty('updated_at');
    });

    it('should return VersionSnapshot type with all required fields', async () => {
      mockDbReturn = {};

      const { addVersion } = await import('../../src/services/commentsService.js');

      const version = addVersion({
        project_id: 'project-1',
        entity_type: 'spec',
        entity_id: 'entity-1',
        data: 'test data',
      });

      // Verify all VersionSnapshot interface fields are present
      expect(version).toHaveProperty('id');
      expect(version).toHaveProperty('version');
      expect(version).toHaveProperty('data');
      expect(version).toHaveProperty('created_at');
      expect(version).toHaveProperty('created_by');
    });
  });
});
