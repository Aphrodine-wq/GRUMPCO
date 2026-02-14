/**
 * G-Rump Skills System - Registry
 * Auto-discovery and management of skills
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import type { Express } from 'express';
import logger from '../middleware/logger.js';
import type {
  Skill,
  SkillManifest,
  SkillRegistration,
  SkillContext,
  SkillEvent,
  SkillExecutionInput,
  SkillExecutionResult,
  ToolExecutionResult,
  ToolDefinition,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Skill Registry - Manages all skills in the system
 */
class SkillRegistry {
  private skills: Map<string, SkillRegistration> = new Map();
  private initialized = false;
  private skillsDirectory: string;

  constructor() {
    this.skillsDirectory = __dirname;
  }

  /**
   * Discover and load all skills from the skills directory
   */
  async discoverSkills(customDir?: string): Promise<void> {
    const skillsDir = customDir || this.skillsDirectory;

    logger.info({ skillsDir }, 'Discovering skills');

    try {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip non-directories and base/internal folders
        if (!entry.isDirectory()) continue;
        if (['base', 'node_modules', '__tests__'].includes(entry.name)) continue;

        const skillPath = path.join(skillsDir, entry.name);
        await this.loadSkill(skillPath);
      }

      logger.info({ skillCount: this.skills.size }, 'Skills discovery complete');
    } catch (error) {
      logger.error({ error }, 'Failed to discover skills');
      throw error;
    }
  }

  /**
   * Load a single skill from a directory
   */
  private async loadSkill(skillPath: string): Promise<void> {
    const manifestPath = path.join(skillPath, 'manifest.json');

    // Check for manifest
    if (!fs.existsSync(manifestPath)) {
      logger.debug({ skillPath }, 'No manifest.json found, skipping');
      return;
    }

    try {
      // Load manifest
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest: SkillManifest = JSON.parse(manifestContent);

      // Validate manifest
      if (!manifest.id || !manifest.name || !manifest.version) {
        logger.warn({ skillPath }, 'Invalid manifest: missing required fields');
        return;
      }

      // Check for duplicate
      if (this.skills.has(manifest.id)) {
        logger.warn({ skillId: manifest.id }, 'Skill already registered, skipping duplicate');
        return;
      }

      // Load skill module - try .js first, fall back to .ts for dev mode (tsx)
      let resolvedIndexPath = path.join(skillPath, 'index.js');
      if (!fs.existsSync(resolvedIndexPath)) {
        const tsIndexPath = path.join(skillPath, 'index.ts');
        if (fs.existsSync(tsIndexPath)) {
          resolvedIndexPath = tsIndexPath;
        } else {
          logger.warn({ skillPath }, 'No index.js or index.ts found');
          return;
        }
      }

      const skillModule = await import(pathToFileURL(resolvedIndexPath).href);
      const skillExport = skillModule.default || skillModule;

      // Construct skill object - manifest MUST come after spread to ensure
      // it's never overwritten by a stale/undefined manifest from the export
      const skill: Skill = {
        ...skillExport,
        manifest,
      };

      // Register
      this.skills.set(manifest.id, {
        skill,
        loadedAt: new Date(),
        path: skillPath,
        active: true,
      });

      logger.info(
        {
          skillId: manifest.id,
          name: manifest.name,
          version: manifest.version,
        },
        'Skill loaded'
      );
    } catch (error) {
      logger.error({ skillPath, error }, 'Failed to load skill');
    }
  }

  /**
   * Initialize all loaded skills
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Skill registry already initialized');
      return;
    }

    logger.info('Initializing skills');

    for (const [id, registration] of this.skills) {
      try {
        if (registration.skill.initialize) {
          await registration.skill.initialize({});
          logger.debug({ skillId: id }, 'Skill initialized');
        }
      } catch (error) {
        logger.error({ skillId: id, error }, 'Failed to initialize skill');
        registration.active = false;
      }
    }

    this.initialized = true;
    logger.info('Skills initialization complete');
  }

  /**
   * Get a skill by ID
   */
  getSkill(id: string): Skill | undefined {
    const registration = this.skills.get(id);
    return registration?.active ? registration.skill : undefined;
  }

  /**
   * Get all active skills
   */
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values())
      .filter((r) => r.active)
      .map((r) => r.skill);
  }

  /**
   * Get skills by category
   */
  getSkillsByCategory(category: string): Skill[] {
    return this.getAllSkills().filter((s) => s.manifest.category === category);
  }

  /**
   * Get skills that match a trigger (keyword, pattern, command)
   */
  getSkillsByTrigger(input: string): Skill[] {
    const inputLower = input.toLowerCase();

    return this.getAllSkills().filter((skill) => {
      const triggers = skill.manifest.triggers;
      if (!triggers) return false;

      // Check keywords
      if (triggers.keywords) {
        for (const keyword of triggers.keywords) {
          if (inputLower.includes(keyword.toLowerCase())) {
            return true;
          }
        }
      }

      // Check patterns
      if (triggers.patterns) {
        for (const pattern of triggers.patterns) {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(input)) {
            return true;
          }
        }
      }

      // Check commands
      if (triggers.commands) {
        for (const command of triggers.commands) {
          if (inputLower.startsWith(command.toLowerCase())) {
            return true;
          }
        }
      }

      return false;
    });
  }

  /**
   * Get skills that can handle specific file extensions
   */
  getSkillsByFileExtension(extension: string): Skill[] {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;

    return this.getAllSkills().filter((skill) => {
      const triggers = skill.manifest.triggers;
      return triggers?.fileExtensions?.includes(ext);
    });
  }

  /**
   * Get all tool definitions from all skills
   */
  getAllTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];

    for (const skill of this.getAllSkills()) {
      if (skill.tools?.definitions) {
        // Prefix tool names with skill ID to avoid collisions
        const prefixedTools = skill.tools.definitions.map((tool) => ({
          ...tool,
          name: `skill_${skill.manifest.id}_${tool.name}`,
        }));
        tools.push(...prefixedTools);
      }
    }

    return tools;
  }

  /**
   * Get tool handler for a specific tool name
   */
  getToolHandler(toolName: string):
    | {
        skill: Skill;
        handler: (
          input: Record<string, unknown>,
          context: SkillContext
        ) => Promise<ToolExecutionResult>;
      }
    | undefined {
    // Parse skill_<skillId>_<toolName> format
    const match = toolName.match(/^skill_([^_]+)_(.+)$/);
    if (!match) return undefined;

    const [, skillId, actualToolName] = match;
    const skill = this.getSkill(skillId);

    if (!skill?.tools?.handlers[actualToolName]) {
      return undefined;
    }

    return {
      skill,
      handler: skill.tools.handlers[actualToolName],
    };
  }

  /**
   * Mount skill routes to Express app
   */
  mountRoutes(app: Express): void {
    for (const [id, registration] of this.skills) {
      if (!registration.active) continue;

      const skill = registration.skill;
      if (skill.routes) {
        const routePath = `/api/skills/${id}`;
        app.use(routePath, skill.routes);
        logger.info({ skillId: id, path: routePath }, 'Skill routes mounted');
      }
    }

    // Mount skills management API
    app.get('/api/skills', (req, res) => {
      const skills = this.getAllSkills().map((s) => ({
        id: s.manifest.id,
        name: s.manifest.name,
        version: s.manifest.version,
        description: s.manifest.description,
        category: s.manifest.category,
        icon: s.manifest.icon,
        tags: s.manifest.tags,
        capabilities: s.manifest.capabilities,
      }));
      res.json({ skills });
    });

    app.get('/api/skills/:id', (req, res): void => {
      const skill = this.getSkill(req.params.id);
      if (!skill) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }
      res.json({
        ...skill.manifest,
        tools: skill.tools?.definitions.map((t) => t.name),
        hasRoutes: !!skill.routes,
        hasPrompts: !!skill.prompts,
      });
    });

    logger.info('Skills management API mounted at /api/skills');
  }

  /**
   * Execute a skill
   */
  async executeSkill(
    skillId: string,
    input: SkillExecutionInput,
    context: SkillContext
  ): Promise<SkillExecutionResult> {
    const skill = this.getSkill(skillId);
    if (!skill) {
      return {
        success: false,
        output: '',
        events: [],
        duration: 0,
        error: new Error(`Skill not found: ${skillId}`),
      };
    }

    const startTime = Date.now();
    const events: SkillEvent[] = [];

    // Create context with event emitter
    const contextWithEmit: SkillContext = {
      ...context,
      emit: (event: SkillEvent) => events.push(event),
    };

    try {
      // Activate if needed
      if (skill.activate) {
        await skill.activate(contextWithEmit);
      }

      // Execute
      let result: SkillExecutionResult;

      if (skill.execute) {
        // Streaming execution
        const generator = skill.execute(input, contextWithEmit);
        let finalResult: SkillExecutionResult | undefined;

        for await (const event of generator) {
          events.push(event);
        }

        result = finalResult || {
          success: true,
          output: '',
          events,
          duration: Date.now() - startTime,
        };
      } else if (skill.run) {
        // Non-streaming execution
        result = await skill.run(input, contextWithEmit);
      } else {
        result = {
          success: false,
          output: '',
          events,
          duration: Date.now() - startTime,
          error: new Error('Skill has no execute or run method'),
        };
      }

      // Deactivate
      if (skill.deactivate) {
        await skill.deactivate(contextWithEmit);
      }

      return {
        ...result,
        events,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        events,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Cleanup all skills
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up skills');

    for (const [id, registration] of this.skills) {
      try {
        if (registration.skill.cleanup) {
          await registration.skill.cleanup();
        }
      } catch (error) {
        logger.error({ skillId: id, error }, 'Failed to cleanup skill');
      }
    }

    this.skills.clear();
    this.initialized = false;
  }

  /**
   * Get skill count
   */
  get count(): number {
    return this.skills.size;
  }

  /**
   * Check if a skill is registered
   */
  hasSkill(id: string): boolean {
    return this.skills.has(id);
  }
}

// Singleton instance
export const skillRegistry = new SkillRegistry();

// Export types
export * from './types.js';
