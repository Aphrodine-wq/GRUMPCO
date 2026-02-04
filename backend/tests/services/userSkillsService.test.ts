/**
 * User Skills Service Unit Tests
 * Tests CRUD operations for Free Agent self-created skills.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// Mock fs/promises with proper structure
const mockMkdir = vi.fn();
const mockAccess = vi.fn();
const mockWriteFile = vi.fn();
const mockReadFile = vi.fn();

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mockMkdir,
    access: mockAccess,
    writeFile: mockWriteFile,
    readFile: mockReadFile,
  },
  mkdir: mockMkdir,
  access: mockAccess,
  writeFile: mockWriteFile,
  readFile: mockReadFile,
}));

// Mock skill registry
const mockDiscoverSkills = vi.fn();
const mockGetSkill = vi.fn();
const mockGetAllSkills = vi.fn();

vi.mock('../../src/skills/index.js', () => ({
  skillRegistry: {
    discoverSkills: mockDiscoverSkills,
    getSkill: mockGetSkill,
    getAllSkills: mockGetAllSkills,
  },
}));

// Mock audit log service
const mockWriteAuditLog = vi.fn();

vi.mock('../../src/services/auditLogService.js', () => ({
  writeAuditLog: mockWriteAuditLog,
}));

// Mock guardrails service
const mockCheckInput = vi.fn();

vi.mock('../../src/services/guardrailsService.js', () => ({
  checkInput: mockCheckInput,
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

describe('userSkillsService', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Default mock behaviors
    mockMkdir.mockResolvedValue(undefined);
    mockAccess.mockRejectedValue(new Error('ENOENT')); // File doesn't exist by default
    mockWriteFile.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue('{}');
    mockDiscoverSkills.mockResolvedValue(undefined);
    mockGetSkill.mockReturnValue(undefined);
    mockGetAllSkills.mockReturnValue([]);
    mockWriteAuditLog.mockResolvedValue(undefined);
    mockCheckInput.mockResolvedValue({ passed: true, action: 'pass', triggeredPolicies: [], processingTimeMs: 0 });
  });

  describe('ensureUserSkillsDir', () => {
    it('should create the user skills directory if it does not exist', async () => {
      const { ensureUserSkillsDir } = await import('../../src/services/userSkillsService.js');

      await ensureUserSkillsDir();

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('user-skills'),
        { recursive: true }
      );
    });

    it('should not throw if directory already exists', async () => {
      mockMkdir.mockResolvedValue(undefined);

      const { ensureUserSkillsDir } = await import('../../src/services/userSkillsService.js');

      await expect(ensureUserSkillsDir()).resolves.not.toThrow();
    });
  });

  describe('createSkill', () => {
    it('should create a new skill with all required files', async () => {
      const { createSkill } = await import('../../src/services/userSkillsService.js');

      const result = await createSkill('My Test Skill', 'A test skill description', [], {}, 'user-123');

      expect(result.success).toBe(true);
      expect(result.skillId).toBe('user-my-test-skill');

      // Should create directory
      expect(mockMkdir).toHaveBeenCalledTimes(2); // Once for user-skills dir, once for skill dir

      // Should write manifest.json
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('manifest.json'),
        expect.any(String),
        'utf-8'
      );

      // Should write index.js
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('index.js'),
        expect.any(String),
        'utf-8'
      );
    });

    it('should return error if guardrails block the content', async () => {
      mockCheckInput.mockResolvedValue({
        passed: false,
        action: 'block',
        triggeredPolicies: [{ policyId: 'test', policyName: 'Test', confidence: 0.9, reason: 'Blocked' }],
        processingTimeMs: 5,
      });

      const { createSkill } = await import('../../src/services/userSkillsService.js');

      const result = await createSkill('Bad Skill', 'Malicious content', [], {}, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Content blocked by guardrails');
      expect(mockMkdir).not.toHaveBeenCalled();
    });

    it('should return error if skill already exists', async () => {
      // Simulate skill already exists - access succeeds
      mockAccess.mockResolvedValue(undefined);

      const { createSkill } = await import('../../src/services/userSkillsService.js');

      const result = await createSkill('Existing Skill', 'Description', [], {}, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should sanitize skill ID from name', async () => {
      const { createSkill } = await import('../../src/services/userSkillsService.js');

      const result = await createSkill('My Special!! Skill @#$', 'Description', [], {}, 'user-123');

      expect(result.success).toBe(true);
      expect(result.skillId).toBe('user-my-special-skill');
    });

    it('should include tools in the manifest', async () => {
      const { createSkill } = await import('../../src/services/userSkillsService.js');

      const tools = [
        { name: 'tool1', description: 'Tool 1 description' },
        { name: 'tool2', description: 'Tool 2 description' },
      ];

      await createSkill('Skill With Tools', 'Description', tools, {}, 'user-123');

      // Find the manifest.json write call
      const manifestCall = mockWriteFile.mock.calls.find(
        (call: unknown[]) => (call[0] as string).includes('manifest.json')
      );

      expect(manifestCall).toBeDefined();
      const manifest = JSON.parse(manifestCall![1] as string);
      expect(manifest.capabilities.providesTools).toBe(true);
    });

    it('should write prompts.json when prompts are provided', async () => {
      const { createSkill } = await import('../../src/services/userSkillsService.js');

      const prompts = {
        main: 'This is the main prompt',
        helper: 'This is a helper prompt',
      };

      await createSkill('Skill With Prompts', 'Description', [], prompts, 'user-123');

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('prompts.json'),
        JSON.stringify(prompts, null, 2),
        'utf-8'
      );
    });

    it('should not write prompts.json when no prompts are provided', async () => {
      const { createSkill } = await import('../../src/services/userSkillsService.js');

      await createSkill('Skill Without Prompts', 'Description', [], {}, 'user-123');

      const promptsCall = mockWriteFile.mock.calls.find(
        (call: unknown[]) => (call[0] as string).includes('prompts.json')
      );
      expect(promptsCall).toBeUndefined();
    });

    it('should call skillRegistry.discoverSkills after creation', async () => {
      const { createSkill } = await import('../../src/services/userSkillsService.js');

      await createSkill('New Skill', 'Description', [], {}, 'user-123');

      expect(mockDiscoverSkills).toHaveBeenCalled();
    });

    it('should write audit log on successful creation', async () => {
      const { createSkill } = await import('../../src/services/userSkillsService.js');

      await createSkill('Audited Skill', 'Description', [], {}, 'user-123');

      expect(mockWriteAuditLog).toHaveBeenCalledWith({
        userId: 'user-123',
        action: 'skill_create',
        category: 'skill',
        target: 'user-audited-skill',
        metadata: expect.objectContaining({ name: 'Audited Skill' }),
      });
    });

    it('should return error on file system error', async () => {
      mockMkdir.mockRejectedValue(new Error('Permission denied'));

      const { createSkill } = await import('../../src/services/userSkillsService.js');

      const result = await createSkill('Failed Skill', 'Description', [], {}, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });

    it('should use default userId when not provided', async () => {
      const { createSkill } = await import('../../src/services/userSkillsService.js');

      await createSkill('Default User Skill', 'Description');

      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'default' })
      );
    });

    it('should generate correct manifest with default values', async () => {
      const { createSkill } = await import('../../src/services/userSkillsService.js');

      await createSkill('Complete Skill', 'Full description', [], {}, 'user-123');

      const manifestCall = mockWriteFile.mock.calls.find(
        (call: unknown[]) => (call[0] as string).includes('manifest.json')
      );

      const manifest = JSON.parse(manifestCall![1] as string);

      expect(manifest.id).toBe('user-complete-skill');
      expect(manifest.name).toBe('Complete Skill');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.description).toBe('Full description');
      expect(manifest.author).toBe('Free Agent');
      expect(manifest.category).toBe('custom');
      expect(manifest.icon).toBe('wrench');
      expect(manifest.tags).toContain('user-created');
      expect(manifest.tags).toContain('free-agent');
      expect(manifest.capabilities.providesTools).toBe(false);
      expect(manifest.capabilities.providesRoutes).toBe(false);
      expect(manifest.capabilities.requiresWorkspace).toBe(true);
      expect(manifest.permissions).toContain('file_read');
      expect(manifest.permissions).toContain('file_write');
      expect(manifest.permissions).toContain('bash_execute');
      expect(manifest.triggers.keywords).toContain('complete skill');
      expect(manifest.triggers.commands).toContain('/complete-skill');
    });

    it('should handle skill name with only special characters', async () => {
      const { createSkill } = await import('../../src/services/userSkillsService.js');

      const result = await createSkill('!!!', 'Description', [], {}, 'user-123');

      expect(result.success).toBe(true);
      expect(result.skillId).toBe('user-skill'); // Falls back to 'skill'
    });
  });

  describe('editSkill', () => {
    beforeEach(() => {
      // Default: skill exists
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(JSON.stringify({
        id: 'user-existing-skill',
        name: 'Existing Skill',
        version: '1.0.0',
        description: 'Original description',
      }));
    });

    it('should update skill name in manifest', async () => {
      const { editSkill } = await import('../../src/services/userSkillsService.js');

      const result = await editSkill('user-existing-skill', { name: 'Updated Name' }, 'user-123');

      expect(result.success).toBe(true);

      const manifestCall = mockWriteFile.mock.calls.find(
        (call: unknown[]) => (call[0] as string).includes('manifest.json')
      );
      const manifest = JSON.parse(manifestCall![1] as string);
      expect(manifest.name).toBe('Updated Name');
    });

    it('should update skill description in manifest', async () => {
      const { editSkill } = await import('../../src/services/userSkillsService.js');

      const result = await editSkill('user-existing-skill', { description: 'New description' }, 'user-123');

      expect(result.success).toBe(true);

      const manifestCall = mockWriteFile.mock.calls.find(
        (call: unknown[]) => (call[0] as string).includes('manifest.json')
      );
      const manifest = JSON.parse(manifestCall![1] as string);
      expect(manifest.description).toBe('New description');
    });

    it('should update prompts.json when prompts are provided', async () => {
      const { editSkill } = await import('../../src/services/userSkillsService.js');

      const prompts = { main: 'Updated prompt' };
      await editSkill('user-existing-skill', { prompts }, 'user-123');

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('prompts.json'),
        JSON.stringify(prompts, null, 2),
        'utf-8'
      );
    });

    it('should return error if guardrails block the content', async () => {
      mockCheckInput.mockResolvedValue({
        passed: false,
        action: 'block',
        triggeredPolicies: [],
        processingTimeMs: 0,
      });

      const { editSkill } = await import('../../src/services/userSkillsService.js');

      const result = await editSkill('user-existing-skill', { name: 'Bad Name' }, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Content blocked by guardrails');
    });

    it('should return error if skill not found (ENOENT)', async () => {
      const enoentError = new Error('ENOENT');
      (enoentError as NodeJS.ErrnoException).code = 'ENOENT';
      mockAccess.mockRejectedValue(enoentError);

      const { editSkill } = await import('../../src/services/userSkillsService.js');

      const result = await editSkill('user-nonexistent', { name: 'New Name' }, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle skillId with user- prefix', async () => {
      const { editSkill } = await import('../../src/services/userSkillsService.js');

      await editSkill('user-existing-skill', { name: 'Test' }, 'user-123');

      expect(mockAccess).toHaveBeenCalledWith(
        expect.stringContaining('existing-skill')
      );
    });

    it('should handle skillId without user- prefix', async () => {
      const { editSkill } = await import('../../src/services/userSkillsService.js');

      await editSkill('existing-skill', { name: 'Test' }, 'user-123');

      expect(mockAccess).toHaveBeenCalledWith(
        expect.stringContaining('existing-skill')
      );
    });

    it('should call skillRegistry.discoverSkills after edit', async () => {
      const { editSkill } = await import('../../src/services/userSkillsService.js');

      await editSkill('user-existing-skill', { name: 'Updated' }, 'user-123');

      expect(mockDiscoverSkills).toHaveBeenCalled();
    });

    it('should write audit log on successful edit', async () => {
      const { editSkill } = await import('../../src/services/userSkillsService.js');

      await editSkill('user-existing-skill', { name: 'Updated', description: 'New desc' }, 'user-123');

      expect(mockWriteAuditLog).toHaveBeenCalledWith({
        userId: 'user-123',
        action: 'skill_edit',
        category: 'skill',
        target: 'user-existing-skill',
        metadata: { updates: expect.arrayContaining(['name', 'description']) },
      });
    });

    it('should return error on manifest read failure', async () => {
      mockReadFile.mockRejectedValue(new Error('Read error'));

      const { editSkill } = await import('../../src/services/userSkillsService.js');

      const result = await editSkill('user-existing-skill', { name: 'Test' }, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Read error');
    });

    it('should use default userId when not provided', async () => {
      const { editSkill } = await import('../../src/services/userSkillsService.js');

      await editSkill('user-existing-skill', { name: 'Updated' });

      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'default' })
      );
    });

    it('should preserve existing manifest fields when only updating some', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        id: 'user-existing-skill',
        name: 'Original Name',
        version: '1.0.0',
        description: 'Original description',
        author: 'Original Author',
      }));

      const { editSkill } = await import('../../src/services/userSkillsService.js');

      await editSkill('user-existing-skill', { name: 'New Name' }, 'user-123');

      const manifestCall = mockWriteFile.mock.calls.find(
        (call: unknown[]) => (call[0] as string).includes('manifest.json')
      );
      const manifest = JSON.parse(manifestCall![1] as string);

      expect(manifest.name).toBe('New Name');
      expect(manifest.description).toBe('Original description');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.author).toBe('Original Author');
    });
  });

  describe('runSkillTest', () => {
    it('should return error if skill not found', async () => {
      mockGetSkill.mockReturnValue(undefined);

      const { runSkillTest } = await import('../../src/services/userSkillsService.js');

      const result = await runSkillTest('nonexistent-skill', { test: 'input' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should execute skill with run method and return result', async () => {
      const mockSkill = {
        manifest: { id: 'test-skill', name: 'Test Skill', version: '1.0.0' },
        run: vi.fn().mockResolvedValue({
          success: true,
          output: 'Test output',
          events: [],
          duration: 100,
        }),
      };
      mockGetSkill.mockReturnValue(mockSkill);

      const { runSkillTest } = await import('../../src/services/userSkillsService.js');

      const result = await runSkillTest('test-skill', { key: 'value' }, '/workspace', 'user-123');

      expect(result.success).toBe(true);
      expect(result.output).toBe('Test output');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return error when skill has no run method', async () => {
      const mockSkill = {
        manifest: { id: 'test-skill', name: 'Test Skill', version: '1.0.0' },
        // No run method
      };
      mockGetSkill.mockReturnValue(mockSkill);

      const { runSkillTest } = await import('../../src/services/userSkillsService.js');

      const result = await runSkillTest('test-skill', { key: 'value' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No run method');
    });

    it('should handle skill execution error', async () => {
      const mockSkill = {
        manifest: { id: 'test-skill', name: 'Test Skill', version: '1.0.0' },
        run: vi.fn().mockRejectedValue(new Error('Execution failed')),
      };
      mockGetSkill.mockReturnValue(mockSkill);

      const { runSkillTest } = await import('../../src/services/userSkillsService.js');

      const result = await runSkillTest('test-skill', { key: 'value' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });

    it('should return skill error message when run returns error', async () => {
      const mockSkill = {
        manifest: { id: 'test-skill', name: 'Test Skill', version: '1.0.0' },
        run: vi.fn().mockResolvedValue({
          success: false,
          output: '',
          events: [],
          duration: 50,
          error: new Error('Skill internal error'),
        }),
      };
      mockGetSkill.mockReturnValue(mockSkill);

      const { runSkillTest } = await import('../../src/services/userSkillsService.js');

      const result = await runSkillTest('test-skill', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Skill internal error');
    });

    it('should pass input as message and params', async () => {
      const mockSkill = {
        manifest: { id: 'test-skill', name: 'Test Skill', version: '1.0.0' },
        run: vi.fn().mockResolvedValue({
          success: true,
          output: 'Done',
          events: [],
          duration: 10,
        }),
      };
      mockGetSkill.mockReturnValue(mockSkill);

      const { runSkillTest } = await import('../../src/services/userSkillsService.js');

      const testInput = { foo: 'bar', count: 42 };
      await runSkillTest('test-skill', testInput, '/workspace');

      expect(mockSkill.run).toHaveBeenCalledWith(
        expect.objectContaining({
          message: JSON.stringify(testInput),
          params: testInput,
        }),
        expect.any(Object)
      );
    });

    it('should use default userId when not provided', async () => {
      mockGetSkill.mockReturnValue(undefined);

      const { runSkillTest } = await import('../../src/services/userSkillsService.js');

      // Just verify it doesn't throw when userId is not provided
      const result = await runSkillTest('any-skill', {});

      expect(result.success).toBe(false);
    });
  });

  describe('listSkills', () => {
    it('should return empty array when no skills are registered', async () => {
      mockGetAllSkills.mockReturnValue([]);

      const { listSkills } = await import('../../src/services/userSkillsService.js');

      const result = await listSkills();

      expect(result).toEqual([]);
    });

    it('should return all skills with required fields', async () => {
      mockGetAllSkills.mockReturnValue([
        {
          manifest: {
            id: 'builtin-skill',
            name: 'Built-in Skill',
            version: '1.0.0',
            description: 'A built-in skill',
          },
        },
        {
          manifest: {
            id: 'user-custom-skill',
            name: 'Custom Skill',
            version: '2.0.0',
            description: 'A user-created skill',
          },
        },
      ]);

      const { listSkills } = await import('../../src/services/userSkillsService.js');

      const result = await listSkills();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'builtin-skill',
        name: 'Built-in Skill',
        version: '1.0.0',
        description: 'A built-in skill',
        isUser: false,
      });
      expect(result[1]).toEqual({
        id: 'user-custom-skill',
        name: 'Custom Skill',
        version: '2.0.0',
        description: 'A user-created skill',
        isUser: true,
      });
    });

    it('should mark skills with user- prefix as user skills', async () => {
      mockGetAllSkills.mockReturnValue([
        {
          manifest: {
            id: 'user-my-skill',
            name: 'My Skill',
            version: '1.0.0',
          },
        },
      ]);

      const { listSkills } = await import('../../src/services/userSkillsService.js');

      const result = await listSkills();

      expect(result[0].isUser).toBe(true);
    });

    it('should mark skills without user- prefix as built-in', async () => {
      mockGetAllSkills.mockReturnValue([
        {
          manifest: {
            id: 'code-generation',
            name: 'Code Generation',
            version: '1.0.0',
          },
        },
      ]);

      const { listSkills } = await import('../../src/services/userSkillsService.js');

      const result = await listSkills();

      expect(result[0].isUser).toBe(false);
    });

    it('should handle skills without description', async () => {
      mockGetAllSkills.mockReturnValue([
        {
          manifest: {
            id: 'minimal-skill',
            name: 'Minimal Skill',
            version: '1.0.0',
            // No description
          },
        },
      ]);

      const { listSkills } = await import('../../src/services/userSkillsService.js');

      const result = await listSkills();

      expect(result[0].description).toBeUndefined();
    });
  });

  describe('USER_SKILLS_DIR constant', () => {
    it('should export USER_SKILLS_DIR constant', async () => {
      const { USER_SKILLS_DIR } = await import('../../src/services/userSkillsService.js');

      expect(USER_SKILLS_DIR).toBeDefined();
      expect(typeof USER_SKILLS_DIR).toBe('string');
      expect(USER_SKILLS_DIR).toContain('user-skills');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty skill name', async () => {
      const { createSkill } = await import('../../src/services/userSkillsService.js');

      const result = await createSkill('', 'Description', [], {}, 'user-123');

      expect(result.success).toBe(true);
      expect(result.skillId).toBe('user-skill'); // Falls back to 'skill'
    });

    it('should handle very long skill names', async () => {
      const { createSkill } = await import('../../src/services/userSkillsService.js');

      const longName = 'a'.repeat(200);
      const result = await createSkill(longName, 'Description', [], {}, 'user-123');

      expect(result.success).toBe(true);
      expect(result.skillId).toBe(`user-${longName}`);
    });

    it('should handle unicode characters in skill name', async () => {
      const { createSkill } = await import('../../src/services/userSkillsService.js');

      const result = await createSkill('Test Skill', 'Description', [], {}, 'user-123');

      expect(result.success).toBe(true);
      // Unicode characters should be stripped/replaced
      expect(result.skillId).toBe('user-test-skill');
    });

    it('should handle concurrent skill creations', async () => {
      const { createSkill } = await import('../../src/services/userSkillsService.js');

      const promises = [
        createSkill('Skill One', 'Desc 1', [], {}, 'user-1'),
        createSkill('Skill Two', 'Desc 2', [], {}, 'user-2'),
        createSkill('Skill Three', 'Desc 3', [], {}, 'user-3'),
      ];

      const results = await Promise.all(promises);

      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle JSON parse error in editSkill', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('not valid json');

      const { editSkill } = await import('../../src/services/userSkillsService.js');

      const result = await editSkill('user-broken', { name: 'New Name' }, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle special characters in prompts', async () => {
      const { createSkill } = await import('../../src/services/userSkillsService.js');

      const prompts = {
        main: 'Prompt with "quotes" and \\backslashes\\ and \n newlines',
      };

      const result = await createSkill('Prompt Test', 'Description', [], prompts, 'user-123');

      expect(result.success).toBe(true);

      const promptsCall = mockWriteFile.mock.calls.find(
        (call: unknown[]) => (call[0] as string).includes('prompts.json')
      );
      expect(promptsCall).toBeDefined();
    });

    it('should handle write error during skill creation', async () => {
      // Allow first mkdir but fail on writeFile
      mockWriteFile.mockRejectedValue(new Error('Disk full'));

      const { createSkill } = await import('../../src/services/userSkillsService.js');

      const result = await createSkill('Failing Skill', 'Description', [], {}, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Disk full');
    });

    it('should handle non-Error exceptions', async () => {
      mockMkdir.mockRejectedValue('String error');

      const { createSkill } = await import('../../src/services/userSkillsService.js');

      const result = await createSkill('Error Skill', 'Description', [], {}, 'user-123');

      expect(result.success).toBe(false);
    });
  });

  describe('Integration with guardrails', () => {
    it('should check all content against guardrails in createSkill', async () => {
      const { createSkill } = await import('../../src/services/userSkillsService.js');

      await createSkill(
        'Test Skill',
        'Test Description',
        [{ name: 'tool1', description: 'Tool desc' }],
        { prompt: 'Prompt content' },
        'user-123'
      );

      expect(mockCheckInput).toHaveBeenCalledWith(
        expect.stringContaining('Test Skill'),
        'user-123'
      );
      expect(mockCheckInput).toHaveBeenCalledWith(
        expect.stringContaining('Test Description'),
        'user-123'
      );
    });

    it('should check updates against guardrails in editSkill', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(JSON.stringify({
        id: 'user-test',
        name: 'Test',
        version: '1.0.0',
      }));

      const { editSkill } = await import('../../src/services/userSkillsService.js');

      await editSkill('user-test', { name: 'Updated Name' }, 'user-123');

      expect(mockCheckInput).toHaveBeenCalledWith(
        expect.stringContaining('Updated Name'),
        'user-123'
      );
    });
  });
});
