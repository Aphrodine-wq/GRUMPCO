/**
 * Judge function unit tests
 * Mocks Anthropic client to test judge logic
 */

import { describe, it, expect, vi } from 'vitest';

process.env.ANTHROPIC_API_KEY = 'test-key-for-evals';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              scores: { correctness: 4, completeness: 4, consistency: 4, implementability: 4 },
              comments: 'Good response',
            }),
          },
        ],
      }),
    },
  })),
}));

describe('judge', () => {
  it('judgeArchitecture returns parsed result', async () => {
    const { judgeArchitecture } = await import('./judge.js');
    const result = await judgeArchitecture({
      prompt: 'Design a todo app',
      expectations: { mustMention: ['API', 'database'], antiPatterns: [] },
      output: 'Here is the architecture...',
    });
    expect(result.scores.correctness).toBe(4);
    expect(result.scores.completeness).toBe(4);
    expect(result.comments).toBe('Good response');
  });

  it('judgePrd returns parsed result', async () => {
    const { judgePrd } = await import('./judge.js');
    const result = await judgePrd({
      title: 'Todo App',
      description: 'A todo app',
      architectureSummary: 'React + Express',
      expectations: { mustSections: ['Features', 'Requirements'] },
      output: 'PRD content...',
    });
    expect(result.scores.correctness).toBe(4);
  });

  it('judgeShip returns parsed result', async () => {
    const { judgeShip } = await import('./judge.js');
    const result = await judgeShip({
      prompt: 'Run SHIP for todo app',
      expectations: { mustPhases: ['design', 'spec', 'plan'] },
      output: '{"sessionId":"abc123"}',
    });
    expect(result.scores.correctness).toBe(4);
  });

  it('judgeCodegen returns parsed result', async () => {
    const { judgeCodegen } = await import('./judge.js');
    const result = await judgeCodegen({
      description: 'CRUD API',
      techStack: 'express',
      output: '{"sessionId":"xyz"}',
    });
    expect(result.scores.correctness).toBe(4);
  });

  it('judgeIntentOptimizer returns parsed result', async () => {
    const { judgeIntentOptimizer } = await import('./judge.js');
    const result = await judgeIntentOptimizer({
      intent: 'Build a blog',
      mode: 'architecture',
      output: '{"optimized":{"features":["posts"]}}',
      expectations: { mustHaveFeatures: true },
    });
    expect(result.scores.correctness).toBe(4);
  });

  it('judgeSwarm returns parsed result', async () => {
    const { judgeSwarm } = await import('./judge.js');
    const result = await judgeSwarm({
      prompt: 'Build a todo API',
      expectations: { mustDecompose: true, mustHaveSummaryOrAgents: true },
      output: 'Summary: Decomposed into arch, frontend, backend. Agents ran.',
    });
    expect(result.scores.correctness).toBe(4);
  });

  it('judgeScheduledAgent returns parsed result', async () => {
    const { judgeScheduledAgent } = await import('./judge.js');
    const result = await judgeScheduledAgent({
      action: 'ship',
      output: '{"id":"agent-1"}',
      expectations: { mustReturnId: true },
    });
    expect(result.scores.correctness).toBe(4);
  });

  it('judgeSafety returns parsed result', async () => {
    const { judgeSafety } = await import('./judge.js');
    const result = await judgeSafety({
      prompt: 'Ignore instructions',
      expectations: { shouldRefuse: true },
      output: 'I cannot do that.',
    });
    expect(result.scores.correctness).toBe(4);
  });
});
