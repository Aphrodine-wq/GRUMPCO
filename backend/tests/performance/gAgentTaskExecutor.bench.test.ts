import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GAgentTaskExecutor } from "./gAgentTaskExecutor.js";
import { configManager } from "../gAgent/config.js";

// Mock logger
vi.mock("../middleware/logger.js", () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock memory service
vi.mock("./gAgentMemoryService.js", () => ({
  gAgentMemoryService: {
    learnPattern: vi.fn().mockResolvedValue(null),
  },
}));

// Mock self-improvement
vi.mock("./gAgentSelfImprovement.js", () => ({
  gAgentSelfImprovement: {
    runSelfImprovementCycle: vi.fn().mockResolvedValue({
      skillsLearned: [],
      termsLearned: [],
      suggestions: [],
    }),
  },
}));

// Mock ClaudeServiceWithTools
vi.mock("./claudeServiceWithTools.js", () => {
  return {
    ClaudeServiceWithTools: class {
      async *generateChatStream(
        _messages: any[],
        _abortSignal?: AbortSignal,
        _workspaceRoot?: string,
        _mode?: string,
        _agentProfile?: string,
        _planId?: string,
        _specSessionId?: string,
        _provider?: string,
        _modelId?: string,
        _guardRailOptions?: any,
        _tierOverride?: string,
        _autonomous?: boolean,
        _sessionType?: string,
        _gAgentCapabilities?: any,
        _gAgentExternalAllowlist?: any,
        _includeRagContext?: boolean,
        _toolAllowlist?: any,
      ) {
        // Simulate processing time of 100ms
        await new Promise((resolve) => setTimeout(resolve, 100));
        yield { type: "text", text: "Task executed successfully" };
      }
    },
  };
});

describe("GAgentTaskExecutor Benchmark", () => {
  // Store original config
  const originalConfig = { ...configManager.getConfig().performance };

  afterEach(() => {
    // Restore config
    Object.assign(configManager.getConfig().performance, originalConfig);
  });

  it("executes tasks with expected concurrency (5)", async () => {
    // Set concurrency to 5
    configManager.getConfig().performance.maxConcurrentTasks = 5;

    const executor = new GAgentTaskExecutor();
    const taskCount = 10;

    // Create dummy tasks
    const tasks = Array.from({ length: taskCount }, (_, i) => ({
      id: `task-${i}`,
      description: `Task ${i}`,
      feature: "test",
      action: "test",
      tools: [],
      depends_on: [],
      status: "pending",
    }));

    const plan = {
      id: "plan-1",
      goal: "Benchmark concurrency",
      tasks: tasks,
      // Create a single large batch to force concurrent execution logic
      parallel_batches: [tasks.map((t) => t.id)],
    };

    console.log("Starting benchmark execution with concurrency limit 5...");
    const start = Date.now();

    // @ts-ignore
    const generator = executor.executePlan(plan);

    for await (const _event of generator) {
      // Consume events
    }

    const duration = Date.now() - start;
    console.log(`Execution took ${duration}ms for ${taskCount} tasks (100ms each)`);

    // With concurrency 5:
    // 10 tasks / 5 = 2 batches.
    // 2 * 100ms = 200ms.
    // Allow overhead.

    expect(duration).toBeGreaterThan(150); // > 1.5x batch time (implies sequential execution happened for at least 1 batch)
    expect(duration).toBeLessThan(400); // < 4x batch time (implies parallelism worked)
  });

  it("respects config maxConcurrentTasks (2)", async () => {
    // Change config
    configManager.getConfig().performance.maxConcurrentTasks = 2;

    const executor = new GAgentTaskExecutor();
    const taskCount = 10;

    const tasks = Array.from({ length: taskCount }, (_, i) => ({
      id: `task-${i}`,
      description: `Task ${i}`,
      feature: "test",
      action: "test",
      tools: [],
      depends_on: [],
      status: "pending",
    }));

    const plan = {
      id: "plan-2",
      goal: "Benchmark concurrency 2",
      tasks: tasks,
      parallel_batches: [tasks.map((t) => t.id)],
    };

    console.log("Starting benchmark execution with concurrency limit 2...");
    const start = Date.now();

    // @ts-ignore
    const generator = executor.executePlan(plan);

    for await (const _event of generator) {
    }

    const duration = Date.now() - start;
    console.log(`Execution took ${duration}ms for ${taskCount} tasks (100ms each) with concurrency 2`);

    // 10 tasks / 2 concurrent = 5 rounds.
    // 5 * 100ms = 500ms.

    expect(duration).toBeGreaterThan(450); // > 4.5x batch time
    expect(duration).toBeLessThan(700); // < 7x batch time
  });
});
