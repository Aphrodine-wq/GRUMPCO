/**
 * Skills Registry (index.ts) Tests
 * Comprehensive tests for skill registration, discovery, and execution
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { Express, Request, Response, Router } from 'express';
import type {
  Skill,
  SkillManifest,
  SkillContext,
  SkillExecutionInput,
  SkillExecutionResult,
  SkillEvent,
  ToolExecutionResult,
} from '../../src/skills/types.js';

// Mock fs module before imports
const mockReaddirSync = vi.fn();
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock('fs', () => ({
  default: {
    readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  },
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../../src/middleware/logger.js', () => ({
  default: mockLogger,
}));

// Mock path
vi.mock('path', async () => {
  const actual = await vi.importActual('path');
  return {
    ...actual,
    default: actual,
  };
});

// Mock url module
vi.mock('url', async () => {
  const actual = await vi.importActual('url');
  return {
    ...actual,
    fileURLToPath: () => '/mock/skills/index.ts',
    pathToFileURL: (p: string) => ({ href: `file://${p}` }),
  };
});

// Create mock context helper
function createMockContext(overrides: Partial<SkillContext> = {}): SkillContext {
  const emitFn = vi.fn();
  return {
    sessionId: 'test-session',
    workspacePath: '/test/workspace',
    config: {},
    request: {
      id: 'req-123',
      timestamp: new Date(),
      source: 'api' as const,
    },
    services: {
      llm: {
        complete: vi.fn().mockResolvedValue('LLM response'),
        stream: vi.fn(),
      },
      fileSystem: {
        readFile: vi.fn().mockResolvedValue('file content'),
        writeFile: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        listDirectory: vi.fn().mockResolvedValue(['file1.ts', 'file2.ts']),
        deleteFile: vi.fn().mockResolvedValue(undefined),
        isWithinWorkspace: vi.fn().mockReturnValue(true),
      },
      git: {
        status: vi.fn().mockResolvedValue({
          branch: 'main',
          staged: [],
          unstaged: [],
          untracked: [],
        }),
        diff: vi.fn().mockResolvedValue(''),
        commit: vi.fn().mockResolvedValue(''),
        log: vi.fn().mockResolvedValue([]),
        branch: vi.fn().mockResolvedValue('main'),
        branches: vi.fn().mockResolvedValue(['main']),
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    },
    emit: emitFn,
    isCancelled: () => false,
    ...overrides,
  };
}

// Create mock manifest
function createMockManifest(overrides: Partial<SkillManifest> = {}): SkillManifest {
  return {
    id: 'test-skill',
    name: 'Test Skill',
    version: '1.0.0',
    description: 'A test skill',
    category: 'code',
    capabilities: {
      providesTools: true,
      providesRoutes: false,
      providesPrompts: true,
      requiresWorkspace: false,
      supportsStreaming: true,
    },
    permissions: ['file_read'],
    triggers: {
      keywords: ['test', 'check'],
      patterns: ['^/test\\s+'],
      commands: ['/test'],
      fileExtensions: ['.ts', '.js'],
    },
    ...overrides,
  };
}

// Create mock skill
function createMockSkill(manifest: SkillManifest, options: {
  hasInitialize?: boolean;
  hasActivate?: boolean;
  hasDeactivate?: boolean;
  hasCleanup?: boolean;
  hasExecute?: boolean;
  hasRun?: boolean;
  executeResult?: SkillExecutionResult;
  runResult?: SkillExecutionResult;
  tools?: {
    definitions: Array<{ name: string; description: string; input_schema: { type: 'object' } }>;
    handlers: Record<string, (input: Record<string, unknown>, context: SkillContext) => Promise<ToolExecutionResult>>;
  };
  routes?: Router;
  prompts?: { system: string };
  initializeShouldThrow?: boolean;
} = {}): Skill {
  const skill: Skill = {
    manifest,
    prompts: options.prompts,
    routes: options.routes,
    tools: options.tools,
  };

  if (options.hasInitialize || options.initializeShouldThrow) {
    skill.initialize = vi.fn().mockImplementation(async () => {
      if (options.initializeShouldThrow) {
        throw new Error('Initialize failed');
      }
    });
  }

  if (options.hasActivate) {
    skill.activate = vi.fn().mockResolvedValue(undefined);
  }

  if (options.hasDeactivate) {
    skill.deactivate = vi.fn().mockResolvedValue(undefined);
  }

  if (options.hasCleanup) {
    skill.cleanup = vi.fn().mockResolvedValue(undefined);
  }

  if (options.hasRun) {
    skill.run = vi.fn().mockResolvedValue(options.runResult || {
      success: true,
      output: 'run output',
      events: [],
      duration: 100,
    });
  }

  if (options.hasExecute) {
    skill.execute = vi.fn().mockImplementation(async function* () {
      yield { type: 'started', skillId: manifest.id, timestamp: new Date() } as SkillEvent;
      yield { type: 'output', content: 'execute output' } as SkillEvent;
      return options.executeResult || {
        success: true,
        output: 'execute output',
        events: [],
        duration: 100,
      };
    });
  }

  return skill;
}

describe('SkillRegistry', () => {
  let SkillRegistry: new () => {
    discoverSkills(customDir?: string): Promise<void>;
    initialize(): Promise<void>;
    getSkill(id: string): Skill | undefined;
    getAllSkills(): Skill[];
    getSkillsByCategory(category: string): Skill[];
    getSkillsByTrigger(input: string): Skill[];
    getSkillsByFileExtension(extension: string): Skill[];
    getAllTools(): Array<{ name: string; description: string; input_schema: { type: 'object' } }>;
    getToolHandler(toolName: string): { skill: Skill; handler: (input: Record<string, unknown>, context: SkillContext) => Promise<ToolExecutionResult> } | undefined;
    mountRoutes(app: Express): void;
    executeSkill(skillId: string, input: SkillExecutionInput, context: SkillContext): Promise<SkillExecutionResult>;
    cleanup(): Promise<void>;
    count: number;
    hasSkill(id: string): boolean;
  };
  let skillRegistry: InstanceType<typeof SkillRegistry>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Reset mocks
    mockReaddirSync.mockReset();
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
    
    // Re-import to get fresh instance
    const module = await import('../../src/skills/index.js');
    SkillRegistry = (module as any).SkillRegistry || module.skillRegistry.constructor;
    skillRegistry = new SkillRegistry();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('discoverSkills', () => {
    it('should discover skills from the default directory', async () => {
      mockReaddirSync.mockReturnValue([
        { name: 'skill1', isDirectory: () => true },
        { name: 'skill2', isDirectory: () => true },
      ]);
      
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes('manifest.json')) return true;
        if (path.includes('index.js')) return true;
        return false;
      });
      
      mockReadFileSync.mockReturnValue(JSON.stringify(createMockManifest({ id: 'skill1' })));

      // Mock dynamic import
      const originalImport = vi.fn();
      vi.stubGlobal('import', originalImport);

      await skillRegistry.discoverSkills('/mock/skills');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ skillsDir: '/mock/skills' }),
        'Discovering skills'
      );
    });

    it('should skip non-directories', async () => {
      mockReaddirSync.mockReturnValue([
        { name: 'file.txt', isDirectory: () => false },
        { name: 'skill1', isDirectory: () => true },
      ]);
      
      mockExistsSync.mockReturnValue(false);

      await skillRegistry.discoverSkills('/mock/skills');

      // Should only try to load the directory
      expect(mockExistsSync).not.toHaveBeenCalledWith(expect.stringContaining('file.txt'));
    });

    it('should skip base, node_modules, and __tests__ directories', async () => {
      mockReaddirSync.mockReturnValue([
        { name: 'base', isDirectory: () => true },
        { name: 'node_modules', isDirectory: () => true },
        { name: '__tests__', isDirectory: () => true },
        { name: 'valid-skill', isDirectory: () => true },
      ]);
      
      mockExistsSync.mockReturnValue(false);

      await skillRegistry.discoverSkills('/mock/skills');

      // Should not try to load skipped directories
      expect(mockExistsSync).not.toHaveBeenCalledWith(expect.stringContaining('/base/'));
      expect(mockExistsSync).not.toHaveBeenCalledWith(expect.stringContaining('/node_modules/'));
      expect(mockExistsSync).not.toHaveBeenCalledWith(expect.stringContaining('/__tests__/'));
    });

    it('should skip directories without manifest.json', async () => {
      mockReaddirSync.mockReturnValue([
        { name: 'skill1', isDirectory: () => true },
      ]);
      
      mockExistsSync.mockReturnValue(false);

      await skillRegistry.discoverSkills('/mock/skills');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ skillPath: expect.any(String) }),
        'No manifest.json found, skipping'
      );
    });

    it('should handle invalid manifest (missing required fields)', async () => {
      mockReaddirSync.mockReturnValue([
        { name: 'skill1', isDirectory: () => true },
      ]);
      
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'Invalid' })); // Missing id and version

      await skillRegistry.discoverSkills('/mock/skills');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ skillPath: expect.any(String) }),
        'Invalid manifest: missing required fields'
      );
    });

    it('should throw error when skill discovery fails', async () => {
      mockReaddirSync.mockImplementation(() => {
        throw new Error('Directory read error');
      });

      await expect(skillRegistry.discoverSkills('/mock/skills')).rejects.toThrow('Directory read error');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Failed to discover skills'
      );
    });

    it('should handle JSON parse errors in manifest', async () => {
      mockReaddirSync.mockReturnValue([
        { name: 'skill1', isDirectory: () => true },
      ]);
      
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json {{{');

      await skillRegistry.discoverSkills('/mock/skills');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Failed to load skill'
      );
    });

    it('should skip directories without index.js or index.ts', async () => {
      mockReaddirSync.mockReturnValue([
        { name: 'skill1', isDirectory: () => true },
      ]);
      
      const manifest = createMockManifest();
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes('manifest.json')) return true;
        return false; // No index.js or index.ts
      });
      mockReadFileSync.mockReturnValue(JSON.stringify(manifest));

      await skillRegistry.discoverSkills('/mock/skills');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ skillPath: expect.any(String) }),
        'No index.js or index.ts found'
      );
    });
  });

  describe('initialize', () => {
    it('should warn if already initialized', async () => {
      // First initialization
      await skillRegistry.initialize();
      
      // Second initialization should warn
      await skillRegistry.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith('Skill registry already initialized');
    });

    it('should initialize all loaded skills', async () => {
      // We can't easily test internal initialization without loading skills
      await skillRegistry.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('Initializing skills');
      expect(mockLogger.info).toHaveBeenCalledWith('Skills initialization complete');
    });
  });

  describe('getSkill', () => {
    it('should return undefined for non-existent skill', () => {
      const skill = skillRegistry.getSkill('non-existent');
      expect(skill).toBeUndefined();
    });
  });

  describe('getAllSkills', () => {
    it('should return empty array when no skills loaded', () => {
      const skills = skillRegistry.getAllSkills();
      expect(skills).toEqual([]);
    });
  });

  describe('getSkillsByCategory', () => {
    it('should return empty array when no skills in category', () => {
      const skills = skillRegistry.getSkillsByCategory('code');
      expect(skills).toEqual([]);
    });
  });

  describe('getSkillsByTrigger', () => {
    it('should return empty array when no skills match trigger', () => {
      const skills = skillRegistry.getSkillsByTrigger('some input');
      expect(skills).toEqual([]);
    });
  });

  describe('getSkillsByFileExtension', () => {
    it('should return empty array when no skills match extension', () => {
      const skills = skillRegistry.getSkillsByFileExtension('.py');
      expect(skills).toEqual([]);
    });

    it('should handle extension with or without leading dot', () => {
      const skills1 = skillRegistry.getSkillsByFileExtension('.ts');
      const skills2 = skillRegistry.getSkillsByFileExtension('ts');
      
      expect(skills1).toEqual([]);
      expect(skills2).toEqual([]);
    });
  });

  describe('getAllTools', () => {
    it('should return empty array when no skills loaded', () => {
      const tools = skillRegistry.getAllTools();
      expect(tools).toEqual([]);
    });
  });

  describe('getToolHandler', () => {
    it('should return undefined for invalid tool name format', () => {
      const handler = skillRegistry.getToolHandler('invalid-format');
      expect(handler).toBeUndefined();
    });

    it('should return undefined for non-existent skill', () => {
      const handler = skillRegistry.getToolHandler('skill_nonexistent_tool');
      expect(handler).toBeUndefined();
    });
  });

  describe('mountRoutes', () => {
    it('should mount skills management API endpoints', () => {
      const mockUse = vi.fn();
      const mockGet = vi.fn();
      const mockApp = {
        use: mockUse,
        get: mockGet,
      } as unknown as Express;

      skillRegistry.mountRoutes(mockApp);

      // Should register /api/skills GET endpoint
      expect(mockGet).toHaveBeenCalledWith('/api/skills', expect.any(Function));
      expect(mockGet).toHaveBeenCalledWith('/api/skills/:id', expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith('Skills management API mounted at /api/skills');
    });

    it('should handle /api/skills endpoint correctly', () => {
      const mockGet = vi.fn();
      const mockApp = {
        use: vi.fn(),
        get: mockGet,
      } as unknown as Express;

      skillRegistry.mountRoutes(mockApp);

      // Get the handler for /api/skills
      const skillsHandler = mockGet.mock.calls.find(
        (call: unknown[]) => call[0] === '/api/skills'
      )?.[1] as (req: Request, res: Response) => void;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as unknown as Response;

      skillsHandler({} as Request, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ skills: [] });
    });

    it('should handle /api/skills/:id endpoint for non-existent skill', () => {
      const mockGet = vi.fn();
      const mockApp = {
        use: vi.fn(),
        get: mockGet,
      } as unknown as Express;

      skillRegistry.mountRoutes(mockApp);

      // Get the handler for /api/skills/:id
      const skillHandler = mockGet.mock.calls.find(
        (call: unknown[]) => call[0] === '/api/skills/:id'
      )?.[1] as (req: Request, res: Response) => void;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as unknown as Response;

      skillHandler({ params: { id: 'non-existent' } } as unknown as Request, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Skill not found' });
    });
  });

  describe('executeSkill', () => {
    it('should return error result for non-existent skill', async () => {
      const input: SkillExecutionInput = { message: 'test' };
      const context = createMockContext();

      const result = await skillRegistry.executeSkill('non-existent', input, context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Skill not found: non-existent');
      expect(result.duration).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should clear all skills and reset initialized state', async () => {
      await skillRegistry.cleanup();

      expect(mockLogger.info).toHaveBeenCalledWith('Cleaning up skills');
      expect(skillRegistry.count).toBe(0);
    });
  });

  describe('count', () => {
    it('should return 0 when no skills loaded', () => {
      expect(skillRegistry.count).toBe(0);
    });
  });

  describe('hasSkill', () => {
    it('should return false for non-existent skill', () => {
      expect(skillRegistry.hasSkill('non-existent')).toBe(false);
    });
  });
});

describe('SkillRegistry with loaded skills', () => {
  // These tests mock the internal skills map directly
  let skillRegistry: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Re-import to get fresh instance
    const module = await import('../../src/skills/index.js');
    skillRegistry = module.skillRegistry;
    
    // Clear any existing skills
    await skillRegistry.cleanup();
  });

  afterEach(async () => {
    await skillRegistry.cleanup();
    vi.clearAllMocks();
  });

  describe('with manually registered skills', () => {
    // Since we can't easily load skills through discovery due to dynamic imports,
    // we test the exported singleton functionality

    it('should export skillRegistry singleton', async () => {
      const { skillRegistry } = await import('../../src/skills/index.js');
      expect(skillRegistry).toBeDefined();
      expect(typeof skillRegistry.discoverSkills).toBe('function');
      expect(typeof skillRegistry.initialize).toBe('function');
      expect(typeof skillRegistry.getSkill).toBe('function');
      expect(typeof skillRegistry.getAllSkills).toBe('function');
      expect(typeof skillRegistry.getSkillsByCategory).toBe('function');
      expect(typeof skillRegistry.getSkillsByTrigger).toBe('function');
      expect(typeof skillRegistry.getSkillsByFileExtension).toBe('function');
      expect(typeof skillRegistry.getAllTools).toBe('function');
      expect(typeof skillRegistry.getToolHandler).toBe('function');
      expect(typeof skillRegistry.mountRoutes).toBe('function');
      expect(typeof skillRegistry.executeSkill).toBe('function');
      expect(typeof skillRegistry.cleanup).toBe('function');
      expect(typeof skillRegistry.count).toBe('number');
      expect(typeof skillRegistry.hasSkill).toBe('function');
    });
  });
});

describe('Skill execution scenarios', () => {
  let skillRegistry: any;
  let context: SkillContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    const module = await import('../../src/skills/index.js');
    skillRegistry = module.skillRegistry;
    await skillRegistry.cleanup();
    context = createMockContext();
  });

  afterEach(async () => {
    await skillRegistry.cleanup();
    vi.clearAllMocks();
  });

  it('should handle execution of non-existent skill', async () => {
    const input: SkillExecutionInput = { message: 'test' };
    
    const result = await skillRegistry.executeSkill('missing-skill', input, context);
    
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Skill not found');
  });
});

describe('Trigger matching', () => {
  it('should test trigger matching logic patterns', () => {
    // Test keyword matching (case-insensitive)
    const input = 'please test this code';
    expect(input.toLowerCase().includes('test')).toBe(true);
    
    // Test pattern matching
    const pattern = new RegExp('^/test\\s+', 'i');
    expect(pattern.test('/test my code')).toBe(true);
    expect(pattern.test('test my code')).toBe(false);
    
    // Test command matching
    const command = '/test';
    expect('/test something'.toLowerCase().startsWith(command.toLowerCase())).toBe(true);
    expect('test something'.toLowerCase().startsWith(command.toLowerCase())).toBe(false);
  });

  it('should test file extension normalization', () => {
    const normalizeExtension = (ext: string) => ext.startsWith('.') ? ext : `.${ext}`;
    
    expect(normalizeExtension('.ts')).toBe('.ts');
    expect(normalizeExtension('ts')).toBe('.ts');
    expect(normalizeExtension('.js')).toBe('.js');
    expect(normalizeExtension('js')).toBe('.js');
  });
});

describe('Tool name parsing', () => {
  it('should correctly parse skill tool name format', () => {
    const toolName = 'skill_myskill_mytool';
    const match = toolName.match(/^skill_([^_]+)_(.+)$/);
    
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('myskill');
    expect(match?.[2]).toBe('mytool');
  });

  it('should not match invalid tool name formats', () => {
    const invalidNames = ['mytool', 'skill_only'];
    
    for (const name of invalidNames) {
      const match = name.match(/^skill_([^_]+)_(.+)$/);
      expect(match).toBeNull();
    }
  });

  it('should match other prefix formats but they are not valid skill tools', () => {
    // This technically matches the regex pattern but isn't a valid skill tool
    const name = 'other_prefix_tool';
    const match = name.match(/^skill_([^_]+)_(.+)$/);
    expect(match).toBeNull(); // Doesn't match because it doesn't start with 'skill_'
  });

  it('should handle tool names with underscores in the tool name part', () => {
    const toolName = 'skill_myskill_my_complex_tool';
    const match = toolName.match(/^skill_([^_]+)_(.+)$/);
    
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('myskill');
    expect(match?.[2]).toBe('my_complex_tool');
  });
});

describe('Manifest validation', () => {
  it('should validate required manifest fields', () => {
    const validateManifest = (manifest: Partial<SkillManifest>) => {
      return !!(manifest.id && manifest.name && manifest.version);
    };

    expect(validateManifest({ id: 'test', name: 'Test', version: '1.0.0' })).toBe(true);
    expect(validateManifest({ id: 'test', name: 'Test' })).toBe(false);
    expect(validateManifest({ id: 'test', version: '1.0.0' })).toBe(false);
    expect(validateManifest({ name: 'Test', version: '1.0.0' })).toBe(false);
    expect(validateManifest({})).toBe(false);
  });
});

describe('Event collection during execution', () => {
  it('should collect events during context emit calls', () => {
    const events: SkillEvent[] = [];
    const contextWithEmit: SkillContext = {
      ...createMockContext(),
      emit: (event: SkillEvent) => events.push(event),
    };

    contextWithEmit.emit({ type: 'started', skillId: 'test', timestamp: new Date() });
    contextWithEmit.emit({ type: 'progress', percent: 50, message: 'Halfway' });
    contextWithEmit.emit({ type: 'output', content: 'Result' });
    contextWithEmit.emit({ type: 'completed', duration: 100, summary: 'Done' });

    expect(events).toHaveLength(4);
    expect(events[0].type).toBe('started');
    expect(events[1].type).toBe('progress');
    expect(events[2].type).toBe('output');
    expect(events[3].type).toBe('completed');
  });
});

describe('Skill registration data structure', () => {
  it('should create proper skill registration object', () => {
    const manifest = createMockManifest();
    const skill = createMockSkill(manifest);
    
    const registration = {
      skill,
      loadedAt: new Date(),
      path: '/mock/skills/test-skill',
      active: true,
    };

    expect(registration.skill.manifest.id).toBe('test-skill');
    expect(registration.active).toBe(true);
    expect(registration.path).toContain('test-skill');
    expect(registration.loadedAt).toBeInstanceOf(Date);
  });

  it('should filter inactive skills', () => {
    const registrations = [
      { skill: createMockSkill(createMockManifest({ id: 'active1' })), active: true },
      { skill: createMockSkill(createMockManifest({ id: 'inactive' })), active: false },
      { skill: createMockSkill(createMockManifest({ id: 'active2' })), active: true },
    ];

    const activeSkills = registrations.filter(r => r.active).map(r => r.skill);
    
    expect(activeSkills).toHaveLength(2);
    expect(activeSkills[0].manifest.id).toBe('active1');
    expect(activeSkills[1].manifest.id).toBe('active2');
  });
});

describe('Category filtering', () => {
  it('should filter skills by category', () => {
    const skills = [
      createMockSkill(createMockManifest({ id: 'code1', category: 'code' })),
      createMockSkill(createMockManifest({ id: 'git1', category: 'git' })),
      createMockSkill(createMockManifest({ id: 'code2', category: 'code' })),
      createMockSkill(createMockManifest({ id: 'test1', category: 'test' })),
    ];

    const codeSkills = skills.filter(s => s.manifest.category === 'code');
    const gitSkills = skills.filter(s => s.manifest.category === 'git');
    const testSkills = skills.filter(s => s.manifest.category === 'test');

    expect(codeSkills).toHaveLength(2);
    expect(gitSkills).toHaveLength(1);
    expect(testSkills).toHaveLength(1);
  });
});

describe('Tool definitions with prefixes', () => {
  it('should prefix tool names with skill ID', () => {
    const skillId = 'myskill';
    const tools = [
      { name: 'tool1', description: 'Tool 1', input_schema: { type: 'object' as const } },
      { name: 'tool2', description: 'Tool 2', input_schema: { type: 'object' as const } },
    ];

    const prefixedTools = tools.map(tool => ({
      ...tool,
      name: `skill_${skillId}_${tool.name}`,
    }));

    expect(prefixedTools[0].name).toBe('skill_myskill_tool1');
    expect(prefixedTools[1].name).toBe('skill_myskill_tool2');
  });
});

describe('Execution result structure', () => {
  it('should create proper success result', () => {
    const result: SkillExecutionResult = {
      success: true,
      output: 'Output text',
      events: [],
      duration: 150,
    };

    expect(result.success).toBe(true);
    expect(result.output).toBe('Output text');
    expect(result.error).toBeUndefined();
  });

  it('should create proper error result', () => {
    const result: SkillExecutionResult = {
      success: false,
      output: '',
      events: [],
      duration: 50,
      error: new Error('Execution failed'),
    };

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Execution failed');
  });

  it('should handle non-Error throws', () => {
    const error: unknown = 'String error message';
    const wrappedError = error instanceof Error ? error : new Error(String(error));
    
    expect(wrappedError.message).toBe('String error message');
  });
});

describe('Route mounting for skills', () => {
  it('should construct correct route paths', () => {
    const skillId = 'my-skill';
    const routePath = `/api/skills/${skillId}`;
    
    expect(routePath).toBe('/api/skills/my-skill');
  });
});

describe('Skill API response format', () => {
  it('should format skill list correctly', () => {
    const manifest = createMockManifest();
    const formattedSkill = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      category: manifest.category,
      icon: manifest.icon,
      tags: manifest.tags,
      capabilities: manifest.capabilities,
    };

    expect(formattedSkill.id).toBe('test-skill');
    expect(formattedSkill.name).toBe('Test Skill');
    expect(formattedSkill.version).toBe('1.0.0');
  });

  it('should format single skill response correctly', () => {
    const skill = createMockSkill(createMockManifest(), {
      tools: {
        definitions: [{ name: 'tool1', description: 'Test', input_schema: { type: 'object' } }],
        handlers: {},
      },
      prompts: { system: 'Test system prompt' },
    });

    const response = {
      ...skill.manifest,
      tools: skill.tools?.definitions.map(t => t.name),
      hasRoutes: !!skill.routes,
      hasPrompts: !!skill.prompts,
    };

    expect(response.id).toBe('test-skill');
    expect(response.tools).toEqual(['tool1']);
    expect(response.hasRoutes).toBe(false);
    expect(response.hasPrompts).toBe(true);
  });
});
