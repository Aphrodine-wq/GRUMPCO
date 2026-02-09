/**
 * G-Agent Memory Service
 *
 * Unified memory system for G-Agent that manages:
 * 1. Patterns - Successful task execution patterns for reuse
 * 2. Project Context - Persisted understanding of the codebase
 * 3. Skills - Learned capabilities from task execution
 * 4. Lexicon - Domain-specific terminology
 *
 * Uses vector embeddings for semantic search and retrieval.
 */

import { embed } from "../ai-providers/embeddingService.js";
import { getMemoryStore, type VectorChunk } from "../rag/vectorStoreAdapter.js";
import logger from "../../middleware/logger.js";
import type { Task } from "../intent/intentCliRunner.js";

// ============================================================================
// TYPES
// ============================================================================

export type MemoryCategory = "pattern" | "context" | "skill" | "lexicon";

/**
 * A pattern is a successful task execution that can be reused
 */
export interface TaskPattern {
  id: string;
  name: string;
  description: string;
  category: string;
  goal: string;
  tasks: PatternTask[];
  tools: string[];
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface PatternTask {
  description: string;
  feature: string;
  action: string;
  tools: string[];
  order: number;
}

/**
 * Project context is persisted understanding of a codebase
 */
export interface ProjectContext {
  id: string;
  workspaceRoot: string;
  name: string;
  type: string; // e.g., 'monorepo', 'frontend', 'backend', 'fullstack'
  techStack: string[];
  architecture: string;
  conventions: ProjectConvention[];
  files: ProjectFileInfo[];
  dependencies: string[];
  lastAnalyzedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectConvention {
  type: string; // e.g., 'naming', 'structure', 'testing', 'styling'
  pattern: string;
  description: string;
  examples: string[];
}

export interface ProjectFileInfo {
  path: string;
  type: string; // e.g., 'component', 'service', 'route', 'test', 'config'
  description: string;
  exports?: string[];
}

/**
 * A skill is a learned capability with execution instructions
 */
export interface LearnedSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  trigger: string; // Pattern that triggers this skill
  steps: SkillStep[];
  tools: string[];
  successRate: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  examples: string[];
}

export interface SkillStep {
  order: number;
  action: string;
  tool?: string;
  params?: Record<string, unknown>;
  conditions?: string[];
}

/**
 * Lexicon entry for domain-specific terminology
 */
export interface LexiconEntry {
  id: string;
  term: string;
  definition: string;
  category: string;
  aliases: string[];
  relatedTerms: string[];
  examples: string[];
  source: string; // Where this term was learned
  createdAt: string;
}

// ============================================================================
// MEMORY SERVICE
// ============================================================================

const MEMORY_NAMESPACE = "gagent-memory";
const DEFAULT_TOP_K = 10;

/**
 * G-Agent Memory Service - manages patterns, context, skills, and lexicon
 */
class GAgentMemoryService {
  private patterns: Map<string, TaskPattern> = new Map();
  private contexts: Map<string, ProjectContext> = new Map();
  private skills: Map<string, LearnedSkill> = new Map();
  private lexicon: Map<string, LexiconEntry> = new Map();

  // ============================================================================
  // PATTERN MANAGEMENT
  // ============================================================================

  /**
   * Learn a pattern from successful task execution
   */
  async learnPattern(
    goal: string,
    tasks: Task[],
    durationMs: number,
    success: boolean,
  ): Promise<TaskPattern | null> {
    // Extract pattern key from goal
    const patternKey = this.normalizeGoal(goal);
    const existingPattern = this.patterns.get(patternKey);

    if (existingPattern) {
      // Update existing pattern
      if (success) {
        existingPattern.successCount++;
        existingPattern.avgDurationMs = Math.round(
          (existingPattern.avgDurationMs * (existingPattern.successCount - 1) +
            durationMs) /
          existingPattern.successCount,
        );
      } else {
        existingPattern.failureCount++;
      }
      existingPattern.confidence =
        existingPattern.successCount /
        (existingPattern.successCount + existingPattern.failureCount);
      existingPattern.updatedAt = new Date().toISOString();

      // Persist to vector store
      await this.persistPattern(existingPattern);

      logger.debug(
        {
          patternId: existingPattern.id,
          confidence: existingPattern.confidence,
        },
        "G-Agent: Pattern updated",
      );
      return existingPattern;
    }

    if (!success) {
      // Don't create patterns from failures
      return null;
    }

    // Create new pattern
    const patternTasks: PatternTask[] = tasks.map((t, i) => ({
      description: t.description,
      feature: t.feature,
      action: t.action,
      tools: t.tools,
      order: i,
    }));

    const allTools = [...new Set(tasks.flatMap((t) => t.tools))];
    const category = this.inferCategory(goal, tasks);

    const pattern: TaskPattern = {
      id: `pattern_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: this.generatePatternName(goal),
      description: goal,
      category,
      goal,
      tasks: patternTasks,
      tools: allTools,
      successCount: 1,
      failureCount: 0,
      avgDurationMs: durationMs,
      confidence: 1.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: this.extractTags(goal),
    };

    this.patterns.set(patternKey, pattern);
    await this.persistPattern(pattern);

    logger.info(
      { patternId: pattern.id, name: pattern.name },
      "G-Agent: New pattern learned",
    );
    return pattern;
  }

  /**
   * Find patterns matching a goal
   */
  async findPatterns(goal: string, limit: number = 5): Promise<TaskPattern[]> {
    try {
      const store = getMemoryStore();
      const [embedding] = await embed([goal], { inputType: "query" });
      const results = await store.query(embedding, { topK: limit * 2 });

      const patterns: TaskPattern[] = [];
      for (const r of results) {
        const meta = r.chunk.metadata as Record<string, unknown>;
        if (
          meta?.category === "pattern" &&
          meta?.namespace === MEMORY_NAMESPACE
        ) {
          const pattern = this.chunkToPattern(r.chunk);
          if (pattern && pattern.confidence >= 0.5) {
            patterns.push(pattern);
          }
        }
      }

      return patterns.slice(0, limit);
    } catch (e) {
      logger.warn(
        { error: (e as Error).message },
        "G-Agent: Pattern search failed",
      );
      return [];
    }
  }

  /**
   * Get a specific pattern by ID
   */
  getPattern(patternId: string): TaskPattern | null {
    for (const pattern of this.patterns.values()) {
      if (pattern.id === patternId) return pattern;
    }
    return null;
  }

  /**
   * Get all patterns
   */
  getAllPatterns(): TaskPattern[] {
    return Array.from(this.patterns.values()).sort(
      (a, b) => b.confidence - a.confidence,
    );
  }

  // ============================================================================
  // PROJECT CONTEXT MANAGEMENT
  // ============================================================================

  /**
   * Store or update project context
   */
  async setProjectContext(
    context: Omit<ProjectContext, "id" | "createdAt" | "updatedAt">,
  ): Promise<ProjectContext> {
    const existingContext = this.contexts.get(context.workspaceRoot);

    const now = new Date().toISOString();
    const fullContext: ProjectContext = {
      ...context,
      id:
        existingContext?.id ??
        `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: existingContext?.createdAt ?? now,
      updatedAt: now,
    };

    this.contexts.set(context.workspaceRoot, fullContext);
    await this.persistContext(fullContext);

    logger.info(
      { contextId: fullContext.id, workspace: context.workspaceRoot },
      "G-Agent: Project context updated",
    );
    return fullContext;
  }

  /**
   * Get project context by workspace root
   */
  async getProjectContext(
    workspaceRoot: string,
  ): Promise<ProjectContext | null> {
    // Check in-memory cache first
    const cached = this.contexts.get(workspaceRoot);
    if (cached) return cached;

    // Try to load from vector store
    try {
      const store = getMemoryStore();
      const [embedding] = await embed([workspaceRoot], { inputType: "query" });
      const results = await store.query(embedding, { topK: 5 });

      for (const r of results) {
        const meta = r.chunk.metadata as Record<string, unknown>;
        if (
          meta?.category === "context" &&
          meta?.workspaceRoot === workspaceRoot
        ) {
          const context = this.chunkToContext(r.chunk);
          if (context) {
            this.contexts.set(workspaceRoot, context);
            return context;
          }
        }
      }
    } catch (e) {
      logger.warn(
        { error: (e as Error).message },
        "G-Agent: Context retrieval failed",
      );
    }

    return null;
  }

  /**
   * Add a convention to project context
   */
  async addConvention(
    workspaceRoot: string,
    convention: ProjectConvention,
  ): Promise<void> {
    const context = await this.getProjectContext(workspaceRoot);
    if (!context) {
      logger.warn(
        { workspaceRoot },
        "G-Agent: Cannot add convention - no context found",
      );
      return;
    }

    // Check for duplicate
    const existing = context.conventions.find(
      (c) => c.type === convention.type && c.pattern === convention.pattern,
    );
    if (!existing) {
      context.conventions.push(convention);
      context.updatedAt = new Date().toISOString();
      await this.persistContext(context);
      logger.debug(
        { workspaceRoot, convention: convention.type },
        "G-Agent: Convention added",
      );
    }
  }

  // ============================================================================
  // SKILL MANAGEMENT
  // ============================================================================

  /**
   * Create or update a skill from successful execution
   */
  async learnSkill(
    name: string,
    description: string,
    trigger: string,
    steps: SkillStep[],
    success: boolean,
  ): Promise<LearnedSkill> {
    const skillKey = this.normalizeSkillName(name);
    const existing = this.skills.get(skillKey);

    if (existing) {
      existing.usageCount++;
      if (success) {
        existing.successRate =
          (existing.successRate * (existing.usageCount - 1) + 1) /
          existing.usageCount;
      } else {
        existing.successRate =
          (existing.successRate * (existing.usageCount - 1)) /
          existing.usageCount;
      }
      existing.updatedAt = new Date().toISOString();
      await this.persistSkill(existing);
      return existing;
    }

    const skill: LearnedSkill = {
      id: `skill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      description,
      category: this.inferSkillCategory(steps),
      trigger,
      steps,
      tools: [
        ...new Set(steps.filter((s) => s.tool).map((s) => s.tool as string)),
      ],
      successRate: success ? 1.0 : 0.0,
      usageCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      examples: [],
    };

    this.skills.set(skillKey, skill);
    await this.persistSkill(skill);

    logger.info({ skillId: skill.id, name }, "G-Agent: New skill learned");
    return skill;
  }

  /**
   * Find skills matching a query
   */
  async findSkills(query: string, limit: number = 5): Promise<LearnedSkill[]> {
    try {
      const store = getMemoryStore();
      const [embedding] = await embed([query], { inputType: "query" });
      const results = await store.query(embedding, { topK: limit * 2 });

      const skills: LearnedSkill[] = [];
      for (const r of results) {
        const meta = r.chunk.metadata as Record<string, unknown>;
        if (
          meta?.category === "skill" &&
          meta?.namespace === MEMORY_NAMESPACE
        ) {
          const skill = this.chunkToSkill(r.chunk);
          if (skill) skills.push(skill);
        }
      }

      return skills
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, limit);
    } catch (e) {
      logger.warn(
        { error: (e as Error).message },
        "G-Agent: Skill search failed",
      );
      return [];
    }
  }

  /**
   * Get all skills
   */
  getAllSkills(): LearnedSkill[] {
    return Array.from(this.skills.values()).sort(
      (a, b) => b.usageCount - a.usageCount,
    );
  }

  // ============================================================================
  // LEXICON MANAGEMENT
  // ============================================================================

  /**
   * Add a term to the lexicon
   */
  async addLexiconEntry(
    entry: Omit<LexiconEntry, "id" | "createdAt">,
  ): Promise<LexiconEntry> {
    const termKey = entry.term.toLowerCase();

    const fullEntry: LexiconEntry = {
      ...entry,
      id: `lex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };

    this.lexicon.set(termKey, fullEntry);
    await this.persistLexiconEntry(fullEntry);

    logger.debug(
      { term: entry.term, category: entry.category },
      "G-Agent: Lexicon entry added",
    );
    return fullEntry;
  }

  /**
   * Look up a term in the lexicon
   */
  getLexiconEntry(term: string): LexiconEntry | null {
    return this.lexicon.get(term.toLowerCase()) ?? null;
  }

  /**
   * Search lexicon for related terms
   */
  async searchLexicon(
    query: string,
    limit: number = 10,
  ): Promise<LexiconEntry[]> {
    try {
      const store = getMemoryStore();
      const [embedding] = await embed([query], { inputType: "query" });
      const results = await store.query(embedding, { topK: limit * 2 });

      const entries: LexiconEntry[] = [];
      for (const r of results) {
        const meta = r.chunk.metadata as Record<string, unknown>;
        if (
          meta?.category === "lexicon" &&
          meta?.namespace === MEMORY_NAMESPACE
        ) {
          const entry = this.chunkToLexiconEntry(r.chunk);
          if (entry) entries.push(entry);
        }
      }

      return entries.slice(0, limit);
    } catch (e) {
      logger.warn(
        { error: (e as Error).message },
        "G-Agent: Lexicon search failed",
      );
      return [];
    }
  }

  /**
   * Get all lexicon entries
   */
  getAllLexiconEntries(): LexiconEntry[] {
    return Array.from(this.lexicon.values());
  }

  // ============================================================================
  // UNIFIED MEMORY RETRIEVAL
  // ============================================================================

  /**
   * Search all memory categories for relevant information
   */
  async search(
    query: string,
    options?: {
      categories?: MemoryCategory[];
      limit?: number;
    },
  ): Promise<{
    patterns: TaskPattern[];
    skills: LearnedSkill[];
    lexicon: LexiconEntry[];
  }> {
    const categories = options?.categories ?? ["pattern", "skill", "lexicon"];
    const limit = options?.limit ?? DEFAULT_TOP_K;

    const results = {
      patterns: [] as TaskPattern[],
      skills: [] as LearnedSkill[],
      lexicon: [] as LexiconEntry[],
    };

    try {
      const store = getMemoryStore();
      const [embedding] = await embed([query], { inputType: "query" });
      const searchResults = await store.query(embedding, { topK: limit * 3 });

      for (const r of searchResults) {
        const meta = r.chunk.metadata as Record<string, unknown>;
        if (meta?.namespace !== MEMORY_NAMESPACE) continue;

        const category = meta?.category as MemoryCategory;
        if (!categories.includes(category)) continue;

        switch (category) {
          case "pattern": {
            const pattern = this.chunkToPattern(r.chunk);
            if (pattern) results.patterns.push(pattern);
            break;
          }
          case "skill": {
            const skill = this.chunkToSkill(r.chunk);
            if (skill) results.skills.push(skill);
            break;
          }
          case "lexicon": {
            const entry = this.chunkToLexiconEntry(r.chunk);
            if (entry) results.lexicon.push(entry);
            break;
          }
        }
      }

      // Sort and limit
      results.patterns = results.patterns.slice(0, limit);
      results.skills = results.skills.slice(0, limit);
      results.lexicon = results.lexicon.slice(0, limit);
    } catch (e) {
      logger.warn(
        { error: (e as Error).message },
        "G-Agent: Memory search failed",
      );
    }

    return results;
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    patterns: number;
    contexts: number;
    skills: number;
    lexicon: number;
    topPatterns: { name: string; confidence: number }[];
    topSkills: { name: string; successRate: number }[];
  } {
    const topPatterns = Array.from(this.patterns.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
      .map((p) => ({ name: p.name, confidence: p.confidence }));

    const topSkills = Array.from(this.skills.values())
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5)
      .map((s) => ({ name: s.name, successRate: s.successRate }));

    return {
      patterns: this.patterns.size,
      contexts: this.contexts.size,
      skills: this.skills.size,
      lexicon: this.lexicon.size,
      topPatterns,
      topSkills,
    };
  }

  // ============================================================================
  // PERSISTENCE HELPERS
  // ============================================================================

  private async persistPattern(pattern: TaskPattern): Promise<void> {
    try {
      const store = getMemoryStore();
      const content = `${pattern.name}: ${pattern.description}. Tools: ${pattern.tools.join(", ")}. Tags: ${pattern.tags.join(", ")}`;
      const [embedding] = await embed([content], { inputType: "passage" });

      const chunk: VectorChunk = {
        id: pattern.id,
        content,
        embedding,
        source: "gagent",
        type: "doc",
        metadata: {
          namespace: MEMORY_NAMESPACE,
          category: "pattern",
          data: JSON.stringify(pattern),
        },
      };
      await store.upsert([chunk]);
    } catch (e) {
      logger.warn(
        { error: (e as Error).message },
        "G-Agent: Pattern persistence failed",
      );
    }
  }

  private async persistContext(context: ProjectContext): Promise<void> {
    try {
      const store = getMemoryStore();
      const content = `Project: ${context.name}. Type: ${context.type}. Tech: ${context.techStack.join(", ")}. Path: ${context.workspaceRoot}`;
      const [embedding] = await embed([content], { inputType: "passage" });

      const chunk: VectorChunk = {
        id: context.id,
        content,
        embedding,
        source: "gagent",
        type: "doc",
        metadata: {
          namespace: MEMORY_NAMESPACE,
          category: "context",
          workspaceRoot: context.workspaceRoot,
          data: JSON.stringify(context),
        },
      };
      await store.upsert([chunk]);
    } catch (e) {
      logger.warn(
        { error: (e as Error).message },
        "G-Agent: Context persistence failed",
      );
    }
  }

  private async persistSkill(skill: LearnedSkill): Promise<void> {
    try {
      const store = getMemoryStore();
      const content = `Skill: ${skill.name}. ${skill.description}. Trigger: ${skill.trigger}. Tools: ${skill.tools.join(", ")}`;
      const [embedding] = await embed([content], { inputType: "passage" });

      const chunk: VectorChunk = {
        id: skill.id,
        content,
        embedding,
        source: "gagent",
        type: "doc",
        metadata: {
          namespace: MEMORY_NAMESPACE,
          category: "skill",
          data: JSON.stringify(skill),
        },
      };
      await store.upsert([chunk]);
    } catch (e) {
      logger.warn(
        { error: (e as Error).message },
        "G-Agent: Skill persistence failed",
      );
    }
  }

  private async persistLexiconEntry(entry: LexiconEntry): Promise<void> {
    try {
      const store = getMemoryStore();
      const content = `${entry.term}: ${entry.definition}. Aliases: ${entry.aliases.join(", ")}. Related: ${entry.relatedTerms.join(", ")}`;
      const [embedding] = await embed([content], { inputType: "passage" });

      const chunk: VectorChunk = {
        id: entry.id,
        content,
        embedding,
        source: "gagent",
        type: "doc",
        metadata: {
          namespace: MEMORY_NAMESPACE,
          category: "lexicon",
          data: JSON.stringify(entry),
        },
      };
      await store.upsert([chunk]);
    } catch (e) {
      logger.warn(
        { error: (e as Error).message },
        "G-Agent: Lexicon persistence failed",
      );
    }
  }

  // ============================================================================
  // CONVERSION HELPERS
  // ============================================================================

  private chunkToPattern(chunk: VectorChunk): TaskPattern | null {
    try {
      const meta = chunk.metadata as Record<string, unknown>;
      return JSON.parse(meta.data as string) as TaskPattern;
    } catch {
      return null;
    }
  }

  private chunkToContext(chunk: VectorChunk): ProjectContext | null {
    try {
      const meta = chunk.metadata as Record<string, unknown>;
      return JSON.parse(meta.data as string) as ProjectContext;
    } catch {
      return null;
    }
  }

  private chunkToSkill(chunk: VectorChunk): LearnedSkill | null {
    try {
      const meta = chunk.metadata as Record<string, unknown>;
      return JSON.parse(meta.data as string) as LearnedSkill;
    } catch {
      return null;
    }
  }

  private chunkToLexiconEntry(chunk: VectorChunk): LexiconEntry | null {
    try {
      const meta = chunk.metadata as Record<string, unknown>;
      return JSON.parse(meta.data as string) as LexiconEntry;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // UTILITY HELPERS
  // ============================================================================

  private normalizeGoal(goal: string): string {
    return goal
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .sort()
      .join("_")
      .slice(0, 100);
  }

  private normalizeSkillName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 50);
  }

  private generatePatternName(goal: string): string {
    const words = goal.split(/\s+/).slice(0, 5);
    return words
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  private extractTags(goal: string): string[] {
    const tags: string[] = [];
    const lowered = goal.toLowerCase();

    // Extract common patterns
    const tagPatterns = [
      { pattern: /auth|login|signup|register/i, tag: "authentication" },
      { pattern: /api|rest|graphql|endpoint/i, tag: "api" },
      { pattern: /database|db|sql|postgres|mongo/i, tag: "database" },
      { pattern: /frontend|ui|react|vue|svelte/i, tag: "frontend" },
      { pattern: /backend|server|node|express/i, tag: "backend" },
      { pattern: /test|spec|jest|vitest/i, tag: "testing" },
      { pattern: /deploy|docker|k8s|ci\/cd/i, tag: "devops" },
      { pattern: /crud|create|read|update|delete/i, tag: "crud" },
      { pattern: /file|upload|download|storage/i, tag: "files" },
      { pattern: /websocket|realtime|socket/i, tag: "realtime" },
    ];

    for (const { pattern, tag } of tagPatterns) {
      if (pattern.test(lowered)) {
        tags.push(tag);
      }
    }

    return tags;
  }

  private inferCategory(goal: string, tasks: Task[]): string {
    const lowered = goal.toLowerCase();

    if (/auth|login|signup/i.test(lowered)) return "authentication";
    if (/api|endpoint|route/i.test(lowered)) return "api";
    if (/component|page|screen/i.test(lowered)) return "ui";
    if (/database|schema|migration/i.test(lowered)) return "database";
    if (/test|spec/i.test(lowered)) return "testing";
    if (/deploy|docker|ci/i.test(lowered)) return "devops";

    // Infer from tools
    const tools = tasks.flatMap((t) => t.tools);
    if (tools.some((t) => t.includes("git"))) return "version-control";
    if (tools.some((t) => t.includes("db"))) return "database";
    if (tools.some((t) => t.includes("test"))) return "testing";

    return "general";
  }

  private inferSkillCategory(steps: SkillStep[]): string {
    const tools = steps.filter((s) => s.tool).map((s) => s.tool as string);

    if (tools.some((t) => t.includes("file"))) return "file-operations";
    if (tools.some((t) => t.includes("git"))) return "version-control";
    if (tools.some((t) => t.includes("bash") || t.includes("terminal")))
      return "shell";
    if (tools.some((t) => t.includes("db"))) return "database";
    if (tools.some((t) => t.includes("browser"))) return "browser-automation";

    return "general";
  }
}

// Singleton instance
export const gAgentMemoryService = new GAgentMemoryService();

export default gAgentMemoryService;
