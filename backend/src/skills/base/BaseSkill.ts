/**
 * G-Rump Skills System - Base Skill Class
 * Abstract base class that skills can extend for common functionality
 */

import type Anthropic from '@anthropic-ai/sdk';
import type {
  Skill,
  SkillManifest,
  SkillTools,
  SkillPrompts,
  SkillContext,
  SkillEvent,
  SkillExecutionInput,
  SkillExecutionResult,
  ToolExecutionResult,
} from '../types.js';
import type { Router } from 'express';

/**
 * Abstract base class for skills
 * Provides common functionality and a structured way to build skills
 */
export abstract class BaseSkill implements Skill {
  abstract manifest: SkillManifest;

  tools?: SkillTools;
  prompts?: SkillPrompts;
  routes?: Router;

  /**
   * Initialize the skill (called once on load)
   */
  async initialize(_context: Partial<SkillContext>): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Activate for a session
   */
  async activate(_context: SkillContext): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Deactivate from a session
   */
  async deactivate(_context: SkillContext): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Cleanup on unload
   */
  async cleanup(): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Check if this skill should handle the input
   */
  shouldHandle(input: string, _context: SkillContext): boolean {
    const triggers = this.manifest.triggers;
    if (!triggers) return false;

    const inputLower = input.toLowerCase();

    // Check keywords
    if (triggers.keywords?.some((k) => inputLower.includes(k.toLowerCase()))) {
      return true;
    }

    // Check patterns
    if (triggers.patterns?.some((p) => new RegExp(p, 'i').test(input))) {
      return true;
    }

    // Check commands
    if (triggers.commands?.some((c) => inputLower.startsWith(c.toLowerCase()))) {
      return true;
    }

    return false;
  }

  /**
   * Quick execution (non-streaming)
   * Override this for simple skills
   */
  async run(
    input: SkillExecutionInput,
    context: SkillContext
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    try {
      const output = await this.process(input, context);

      return {
        success: true,
        output,
        events: [],
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        events: [],
        duration: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Override this method for simple processing
   */
  protected async process(
    _input: SkillExecutionInput,
    _context: SkillContext
  ): Promise<string> {
    throw new Error('Skill must implement process() or execute()');
  }

  /**
   * Streaming execution
   * Override this for complex skills that need streaming
   */
  async *execute(
    input: SkillExecutionInput,
    context: SkillContext
  ): AsyncGenerator<SkillEvent, SkillExecutionResult, undefined> {
    const startTime = Date.now();

    yield {
      type: 'started',
      skillId: this.manifest.id,
      timestamp: new Date(),
    };

    try {
      // Default implementation calls run()
      const result = await this.run(input, context);

      yield {
        type: 'output',
        content: result.output,
      };

      yield {
        type: 'completed',
        summary: result.output.slice(0, 100),
        duration: Date.now() - startTime,
      };

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      yield {
        type: 'error',
        error: err,
        recoverable: false,
      };

      return {
        success: false,
        output: '',
        events: [],
        duration: Date.now() - startTime,
        error: err,
      };
    }
  }

  // Helper methods for subclasses

  /**
   * Create a tool definition
   */
  protected createTool(
    name: string,
    description: string,
    inputSchema: Record<string, unknown>
  ): Anthropic.Tool {
    return {
      name,
      description,
      input_schema: inputSchema as Anthropic.Tool.InputSchema,
    };
  }

  /**
   * Create a successful tool result
   */
  protected successResult(output: string, metadata?: Record<string, unknown>): ToolExecutionResult {
    return {
      success: true,
      output,
      metadata,
    };
  }

  /**
   * Create an error tool result
   */
  protected errorResult(error: string, metadata?: Record<string, unknown>): ToolExecutionResult {
    return {
      success: false,
      output: '',
      error,
      metadata,
    };
  }

  /**
   * Emit a progress event
   */
  protected emitProgress(
    context: SkillContext,
    percent: number,
    message?: string
  ): void {
    context.emit({
      type: 'progress',
      percent,
      message,
    });
  }

  /**
   * Emit a thinking event
   */
  protected emitThinking(context: SkillContext, content: string): void {
    context.emit({
      type: 'thinking',
      content,
    });
  }

  /**
   * Emit an output event
   */
  protected emitOutput(context: SkillContext, content: string): void {
    context.emit({
      type: 'output',
      content,
    });
  }

  /**
   * Read a file safely within workspace
   */
  protected async readFile(
    context: SkillContext,
    filePath: string
  ): Promise<string | null> {
    try {
      if (!context.services.fileSystem.isWithinWorkspace(filePath)) {
        context.services.logger.warn('Path outside workspace', { filePath });
        return null;
      }
      return await context.services.fileSystem.readFile(filePath);
    } catch (error) {
      context.services.logger.error('Failed to read file', { filePath, error: String(error) });
      return null;
    }
  }

  /**
   * Write a file safely within workspace
   */
  protected async writeFile(
    context: SkillContext,
    filePath: string,
    content: string
  ): Promise<boolean> {
    try {
      if (!context.services.fileSystem.isWithinWorkspace(filePath)) {
        context.services.logger.warn('Path outside workspace', { filePath });
        return false;
      }
      await context.services.fileSystem.writeFile(filePath, content);

      context.emit({
        type: 'file_change',
        path: filePath,
        action: 'modified',
      });

      return true;
    } catch (error) {
      context.services.logger.error('Failed to write file', { filePath, error: String(error) });
      return false;
    }
  }

  /**
   * Call Claude with the skill's system prompt
   */
  protected async callClaude(
    context: SkillContext,
    userMessage: string,
    options?: {
      includeTools?: boolean;
      maxTokens?: number;
    }
  ): Promise<string> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: userMessage },
    ];

    const response = await context.services.claude.createMessage({
      messages,
      system: this.prompts?.system,
      tools: options?.includeTools ? this.tools?.definitions : undefined,
      maxTokens: options?.maxTokens || 4096,
    });

    // Extract text from response
    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text : '';
  }
}
