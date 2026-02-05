import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GAgentTaskExecutor } from '../src/services/gAgentTaskExecutor.js';

// Mock dependencies
vi.mock('../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../src/services/gAgentMemoryService.js', () => ({
  gAgentMemoryService: {
    learnPattern: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../src/services/gAgentSelfImprovement.js', () => ({
  gAgentSelfImprovement: {
    runSelfImprovementCycle: vi.fn().mockResolvedValue({ skillsLearned: [], termsLearned: [], suggestions: [] }),
  },
}));

// Mock ClaudeServiceWithTools
vi.mock('../src/services/claudeServiceWithTools.js', () => {
  return {
    ClaudeServiceWithTools: class {
      async *generateChatStream(...args: any[]) {
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 100));
        yield { type: 'text', text: 'Task completed' };
        yield { type: 'done' };
      }
    },
    claudeServiceWithTools: {
      generateChatStream: vi.fn().mockImplementation(async function* () {
            await new Promise(resolve => setTimeout(resolve, 100));
            yield { type: 'text', text: 'Task completed' };
            yield { type: 'done' };
      })
    }
  };
});

describe('GAgentTaskExecutor Performance', () => {
  let executor: GAgentTaskExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new GAgentTaskExecutor();
  });

  it('runs tasks in parallel for batch > 2 (Optimized behavior)', async () => {
    const taskCount = 5;
    const tasks = Array.from({ length: taskCount }, (_, i) => ({
      id: `task-${i}`,
      description: `Task ${i}`,
      tools: [],
      depends_on: [],
      feature: 'test',
      action: 'test'
    }));

    const plan = {
      id: 'plan-perf-test',
      goal: 'Benchmark',
      tasks: tasks as any[],
      steps: []
    };

    const state = {
      planId: plan.id,
      plan: plan as any,
      taskStatuses: new Map(),
      taskOutputs: new Map(),
      taskErrors: new Map(),
      currentBatchIndex: 0,
      cancelled: false
    };

    const startTime = Date.now();

    // Access private method
    await (executor as any).executeBatch(state, tasks.map(t => t.id));

    const duration = Date.now() - startTime;
    console.log(`Batch of ${taskCount} tasks took ${duration}ms`);

    // Expectation: Parallel execution means duration is closer to single task duration (100ms)
    // plus some overhead.
    // 505ms was sequential.
    // Should be < 200ms now.
    expect(duration).toBeLessThan(250);
    // Also ensure it took at least 100ms
    expect(duration).toBeGreaterThanOrEqual(100);
  });
});
