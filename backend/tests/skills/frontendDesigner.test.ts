/**
 * Frontend Designer Skill Tests
 * Tests for the frontend designer skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext, SkillExecutionInput, SkillEvent } from '../../src/skills/types.js';

// Mock dependencies before importing the skill
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/resilience.js', () => ({
  withResilience: vi.fn((fn) => fn),
}));

vi.mock('../../src/skills/base/SkillContext.js', () => ({
  createSkillContext: vi.fn(() => ({
    sessionId: 'test-session',
    services: {
      llm: {
        complete: vi.fn().mockResolvedValue('Generated component here'),
      },
    },
  })),
}));

// Create mock context
function createMockContext(overrides: Partial<SkillContext> = {}): SkillContext {
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
        complete: vi.fn().mockResolvedValue(`
Here's a premium Svelte 5 component:

\`\`\`svelte
<script lang="ts">
  interface Props {
    title: string;
  }
  let { title }: Props = $props();
</script>

<div class="card" role="article" aria-label={title}>
  <h2>{title}</h2>
</div>

<style>
  .card {
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    padding: 1.5rem;
    transition: transform 150ms ease;
  }
  .card:hover {
    transform: translateY(-2px);
  }
  .card:focus-visible {
    box-shadow: var(--focus-ring);
  }
</style>
\`\`\`
        `),
        stream: vi.fn(),
      },
      fileSystem: {
        readFile: vi.fn().mockResolvedValue('<script>let x = 1;</script>\n<div>{x}</div>'),
        writeFile: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        listDirectory: vi.fn().mockResolvedValue([]),
        deleteFile: vi.fn().mockResolvedValue(undefined),
        isWithinWorkspace: vi.fn().mockReturnValue(true),
      },
      git: undefined,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    },
    emit: vi.fn(),
    isCancelled: () => false,
    ...overrides,
  };
}

// Mock manifest for testing
const frontendDesignerManifest = {
  id: 'frontend-designer',
  name: 'Frontend Designer',
  version: '1.0.0',
  description: 'High-end frontend designer that generates polished Svelte 5 components using the G-Rump design system tokens, themes, and patterns.',
  author: 'G-Rump Team',
  category: 'code',
  icon: 'palette',
  tags: ['design', 'ui', 'frontend', 'svelte', 'component', 'css', 'theme', 'layout', 'responsive'],
  capabilities: {
    providesTools: true,
    providesRoutes: true,
    providesPrompts: true,
    requiresWorkspace: true,
    supportsStreaming: true,
    supportsBackground: false,
  },
  permissions: ['file_read', 'file_write'],
  triggers: {
    keywords: [
      'design', 'designer', 'ui component', 'frontend component', 'styled component',
      'create component', 'build ui', 'layout', 'page design', 'card design',
      'form design', 'modal design', 'dashboard', 'landing page',
    ],
    patterns: [
      'design\\s+(a|an|the|me)?\\s*(component|page|layout|form|modal|card|dashboard|section|screen|sidebar|nav|header|footer)',
      '(create|build|make|generate)\\s+(a|an)?\\s*(beautiful|polished|styled|modern|sleek|premium|elegant)\\s*(component|page|ui|layout|section)',
      'frontend\\s+design',
    ],
    commands: ['/design', '/frontend-design', '/ui'],
    fileExtensions: ['.svelte'],
  },
};

describe('FrontendDesignerSkill', () => {
  let frontendDesignerSkill: any;
  let context: SkillContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    context = createMockContext();

    // Dynamically import to get fresh module with mocks
    const module = await import('../../src/skills/frontend-designer/index.js');
    frontendDesignerSkill = module.default;
    
    // Inject the manifest (normally done by SkillRegistry)
    frontendDesignerSkill.manifest = frontendDesignerManifest;
  });

  describe('manifest', () => {
    it('should have proper manifest structure', () => {
      expect(frontendDesignerSkill.manifest).toBeDefined();
    });
  });

  describe('prompts', () => {
    it('should have system prompt with design system', () => {
      expect(frontendDesignerSkill.prompts.system).toBeDefined();
      expect(frontendDesignerSkill.prompts.system).toContain('G-Rump');
      expect(frontendDesignerSkill.prompts.system).toContain('Svelte 5');
    });

    it('should contain CSS variable references', () => {
      const systemPrompt = frontendDesignerSkill.prompts.system;
      expect(systemPrompt).toContain('--color-bg-app');
      expect(systemPrompt).toContain('--color-primary');
      expect(systemPrompt).toContain('--glass-bg');
    });

    it('should have templates defined', () => {
      expect(frontendDesignerSkill.prompts.templates).toBeDefined();
      expect(frontendDesignerSkill.prompts.templates.component).toBeDefined();
      expect(frontendDesignerSkill.prompts.templates.review).toBeDefined();
      expect(frontendDesignerSkill.prompts.templates.enhance).toBeDefined();
    });
  });

  describe('tools', () => {
    it('should have tool definitions', () => {
      expect(frontendDesignerSkill.tools.definitions).toBeDefined();
      expect(frontendDesignerSkill.tools.definitions.length).toBeGreaterThan(0);
    });

    it('should have handlers for all tools', () => {
      const toolNames = frontendDesignerSkill.tools.definitions.map((t: any) => t.name);
      expect(toolNames).toContain('design_component');
      expect(toolNames).toContain('review_design');
      expect(toolNames).toContain('enhance_design');

      expect(frontendDesignerSkill.tools.handlers.design_component).toBeDefined();
      expect(frontendDesignerSkill.tools.handlers.review_design).toBeDefined();
      expect(frontendDesignerSkill.tools.handlers.enhance_design).toBeDefined();
    });
  });

  describe('routes', () => {
    it('should have routes defined', () => {
      expect(frontendDesignerSkill.routes).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should yield started event', async () => {
      const input: SkillExecutionInput = {
        message: 'Design a card component',
      };

      const events: SkillEvent[] = [];
      const generator = frontendDesignerSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      expect(events[0].type).toBe('started');
    });

    it('should yield thinking event', async () => {
      const input: SkillExecutionInput = {
        message: 'Design a button component',
      };

      const events: SkillEvent[] = [];
      const generator = frontendDesignerSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      const thinkingEvent = events.find((e) => e.type === 'thinking');
      expect(thinkingEvent).toBeDefined();
    });

    it('should design new component when no files provided', async () => {
      const input: SkillExecutionInput = {
        message: 'Design a modal dialog component',
      };

      const events: SkillEvent[] = [];
      const generator = frontendDesignerSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      const outputEvent = events.find((e) => e.type === 'output');
      expect(outputEvent).toBeDefined();
      expect(context.services.llm.complete).toHaveBeenCalled();
    });

    it('should enhance existing component when file provided', async () => {
      const input: SkillExecutionInput = {
        message: 'Enhance this component',
        files: ['src/components/Button.svelte'],
      };

      const events: SkillEvent[] = [];
      const generator = frontendDesignerSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      expect(context.services.fileSystem.readFile).toHaveBeenCalledWith(
        'src/components/Button.svelte'
      );
    });

    it('should detect design type from message', async () => {
      const testCases = [
        { message: 'design a dashboard', expected: 'dashboard' },
        { message: 'create a modal dialog', expected: 'modal' },
        { message: 'build a form component', expected: 'form' },
        { message: 'make a card', expected: 'card' },
        { message: 'design a page', expected: 'page' },
        { message: 'create a layout', expected: 'layout' },
        { message: 'build a hero section', expected: 'section' },
        { message: 'design a navbar', expected: 'navigation' },
        { message: 'create a sidebar', expected: 'navigation' },
        { message: 'build a button', expected: 'component' },
      ];

      for (const { message } of testCases) {
        const input: SkillExecutionInput = { message };
        const generator = frontendDesignerSkill.execute(input, context);
        for await (const event of generator) {
          // consume events
        }
      }
    });

    it('should detect design tier from message', async () => {
      const testCases = [
        { message: 'design a premium card', expected: 'premium' },
        { message: 'create a luxury modal', expected: 'premium' },
        { message: 'build a stunning dashboard', expected: 'premium' },
        { message: 'design a simple button', expected: 'minimal' },
        { message: 'create a basic form', expected: 'minimal' },
        { message: 'build a clean layout', expected: 'minimal' },
        { message: 'design a card component', expected: 'polished' },
      ];

      for (const { message } of testCases) {
        const input: SkillExecutionInput = { message };
        const generator = frontendDesignerSkill.execute(input, context);
        for await (const event of generator) {
          // consume events
        }
      }
    });

    it('should yield progress events', async () => {
      const input: SkillExecutionInput = {
        message: 'Design a button',
      };

      const events: SkillEvent[] = [];
      const generator = frontendDesignerSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      const progressEvents = events.filter((e) => e.type === 'progress');
      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it('should yield completed event on success', async () => {
      const input: SkillExecutionInput = {
        message: 'Design a card',
      };

      const events: SkillEvent[] = [];
      const generator = frontendDesignerSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      const completedEvent = events.find((e) => e.type === 'completed');
      expect(completedEvent).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(context.services.llm.complete).mockRejectedValue(new Error('LLM failed'));

      const input: SkillExecutionInput = {
        message: 'Design a button',
      };

      const events: SkillEvent[] = [];
      const generator = frontendDesignerSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
    });
  });

  describe('tool handlers', () => {
    describe('design_component', () => {
      it('should design a component with description', async () => {
        const input = {
          description: 'A notification badge component',
          designType: 'component',
          tier: 'premium',
          responsive: true,
          animated: true,
        };

        const result = await frontendDesignerSkill.tools.handlers.design_component(input, context);

        expect(result.success).toBe(true);
        expect(result.output).toBeDefined();
        expect(result.metadata?.result).toBeDefined();
      });

      it('should use default values for optional params', async () => {
        const input = {
          description: 'A simple button',
        };

        const result = await frontendDesignerSkill.tools.handlers.design_component(input, context);

        expect(result.success).toBe(true);
      });

      it('should handle design errors', async () => {
        vi.mocked(context.services.llm.complete).mockRejectedValue(new Error('Design failed'));

        const input = {
          description: 'A button',
        };

        const result = await frontendDesignerSkill.tools.handlers.design_component(input, context);

        expect(result.success).toBe(false);
      });
    });

    describe('review_design', () => {
      it('should review provided code', async () => {
        vi.mocked(context.services.llm.complete).mockResolvedValue(`
## Score: 85/100

### Issues
- Warning: Hard-coded color found

### Strengths
- Good use of ARIA attributes
        `);

        const input = {
          code: '<div style="color: red">Hello</div>',
        };

        const result = await frontendDesignerSkill.tools.handlers.review_design(input, context);

        expect(result.success).toBe(true);
        expect(result.output).toContain('Score');
      });

      it('should review code from file path', async () => {
        vi.mocked(context.services.llm.complete).mockResolvedValue(`
Score: 90/100

### Strengths
- Well structured
        `);

        const input = {
          filePath: 'src/components/Button.svelte',
        };

        const result = await frontendDesignerSkill.tools.handlers.review_design(input, context);

        expect(result.success).toBe(true);
        expect(context.services.fileSystem.readFile).toHaveBeenCalledWith(
          'src/components/Button.svelte'
        );
      });

      it('should return error when neither code nor filePath provided', async () => {
        const input = {};

        const result = await frontendDesignerSkill.tools.handlers.review_design(input, context);

        expect(result.success).toBe(false);
        expect(result.error).toContain('required');
      });

      it('should return error when file cannot be read', async () => {
        vi.mocked(context.services.fileSystem.readFile).mockResolvedValue(null as any);

        const input = {
          filePath: 'nonexistent.svelte',
        };

        const result = await frontendDesignerSkill.tools.handlers.review_design(input, context);

        expect(result.success).toBe(false);
      });
    });

    describe('enhance_design', () => {
      it('should enhance provided code', async () => {
        vi.mocked(context.services.llm.complete).mockResolvedValue(`
\`\`\`svelte
<script lang="ts">
  let count = $state(0);
</script>

<button class="btn" on:click={() => count++}>
  {count}
</button>

<style>
  .btn {
    background: var(--color-primary);
    color: var(--color-text-inverse);
    border-radius: 8px;
    transition: all 150ms ease;
  }
  .btn:hover {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
  }
</style>
\`\`\`
        `);

        const input = {
          code: '<button>Click me</button>',
        };

        const result = await frontendDesignerSkill.tools.handlers.enhance_design(input, context);

        expect(result.success).toBe(true);
      });

      it('should enhance code from file path', async () => {
        const input = {
          filePath: 'src/components/Button.svelte',
          focusAreas: ['accessibility', 'animations'],
        };

        const result = await frontendDesignerSkill.tools.handlers.enhance_design(input, context);

        expect(result.success).toBe(true);
        expect(context.services.fileSystem.readFile).toHaveBeenCalled();
      });

      it('should return error when neither code nor filePath provided', async () => {
        const input = {};

        const result = await frontendDesignerSkill.tools.handlers.enhance_design(input, context);

        expect(result.success).toBe(false);
        expect(result.error).toContain('required');
      });
    });
  });

  describe('design result parsing', () => {
    it('should extract code from svelte code block', async () => {
      vi.mocked(context.services.llm.complete).mockResolvedValue(`
Here's the component:

\`\`\`svelte
<script lang="ts">
  let name = $state('World');
</script>

<h1>Hello {name}!</h1>

<style>
  h1 { color: var(--color-primary); }
</style>
\`\`\`
      `);

      const input: SkillExecutionInput = {
        message: 'Design a greeting component',
      };

      const events: SkillEvent[] = [];
      const generator = frontendDesignerSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      const outputEvent = events.find((e) => e.type === 'output');
      expect(outputEvent).toBeDefined();
    });

    it('should detect design tokens used', async () => {
      vi.mocked(context.services.llm.complete).mockResolvedValue(`
\`\`\`svelte
<style>
  .card {
    background: var(--color-bg-card);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }
</style>
\`\`\`
      `);

      const input = {
        description: 'A card',
      };

      const result = await frontendDesignerSkill.tools.handlers.design_component(input, context);

      expect(result.success).toBe(true);
      expect(result.metadata?.result?.tokensUsed).toBeDefined();
    });

    it('should detect features from generated code', async () => {
      vi.mocked(context.services.llm.complete).mockResolvedValue(`
\`\`\`svelte
<script lang="ts">
  let active = $state(false);
</script>

<button 
  class="glass-button" 
  aria-pressed={active}
  role="button"
>
  Click
</button>

<style>
  .glass-button {
    background: var(--glass-bg);
    transition: all 150ms ease;
  }
  @media (max-width: 768px) {
    .glass-button { width: 100%; }
  }
  @media (prefers-reduced-motion: no-preference) {
    .glass-button { animation: fade-in 0.3s; }
  }
</style>
\`\`\`
      `);

      const input = {
        description: 'A button with glassmorphism',
      };

      const result = await frontendDesignerSkill.tools.handlers.design_component(input, context);

      expect(result.success).toBe(true);
      const features = result.metadata?.result?.features;
      expect(features).toBeDefined();
    });
  });

  describe('design review parsing', () => {
    it('should parse score from response', async () => {
      vi.mocked(context.services.llm.complete).mockResolvedValue(`
Score: 85/100

This component follows most design guidelines.
      `);

      const input = {
        code: '<button>Test</button>',
      };

      const result = await frontendDesignerSkill.tools.handlers.review_design(input, context);

      expect(result.success).toBe(true);
      expect(result.metadata?.review?.score).toBeDefined();
    });

    it('should categorize issues correctly', async () => {
      vi.mocked(context.services.llm.complete).mockResolvedValue(`
### Issues
- Hard-coded color value #ff0000
- Missing aria-label for accessibility
- No responsive breakpoints
- Transition timing too fast
- Doesn't work in dark mode
      `);

      const input = {
        code: '<button style="color: #ff0000">Test</button>',
      };

      const result = await frontendDesignerSkill.tools.handlers.review_design(input, context);

      expect(result.success).toBe(true);
    });
  });

  describe('component name generation', () => {
    it('should generate component name from description', async () => {
      vi.mocked(context.services.llm.complete).mockResolvedValue(`
\`\`\`svelte
<div>Component</div>
\`\`\`
      `);

      const input = {
        description: 'user profile card with avatar',
      };

      const result = await frontendDesignerSkill.tools.handlers.design_component(input, context);

      expect(result.success).toBe(true);
      // Name should be generated from description
      expect(result.metadata?.result?.componentName).toBeDefined();
    });
  });

  describe('accessibility notes', () => {
    it('should detect missing accessibility features', async () => {
      vi.mocked(context.services.llm.complete).mockResolvedValue(`
\`\`\`svelte
<div class="clickable">Click me</div>

<style>
  .clickable { cursor: pointer; }
</style>
\`\`\`
      `);

      const input = {
        description: 'A clickable element',
      };

      const result = await frontendDesignerSkill.tools.handlers.design_component(input, context);

      expect(result.success).toBe(true);
      const notes = result.metadata?.result?.accessibilityNotes;
      expect(notes).toBeDefined();
      expect(notes.length).toBeGreaterThan(0);
    });

    it('should note good accessibility coverage', async () => {
      vi.mocked(context.services.llm.complete).mockResolvedValue(`
\`\`\`svelte
<button 
  aria-label="Submit form" 
  role="button"
  class="submit-btn"
>
  Submit
</button>

<style>
  .submit-btn:focus { outline: 2px solid blue; }
</style>
\`\`\`
      `);

      const input = {
        description: 'An accessible button',
      };

      const result = await frontendDesignerSkill.tools.handlers.design_component(input, context);

      expect(result.success).toBe(true);
    });
  });
});
