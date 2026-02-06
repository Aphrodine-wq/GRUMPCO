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
  it("executes tasks with expected concurrency", async () => {
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

    console.log("Starting benchmark execution with concurrency limit 5 (default)...");
    const start = Date.now();

    // Execute plan
    // @ts-ignore
    const generator = executor.executePlan(plan);

    for await (const _event of generator) {
      // Consume events
    }

    const duration = Date.now() - start;
    console.log(`Execution took ${duration}ms for ${taskCount} tasks (100ms each)`);

    // Theoretical minimum with concurrency 5:
    // 10 tasks / 5 concurrent = 2 batches.
    // 2 batches * 100ms = 200ms.
    // Allow some overhead (e.g. 50-100ms)

    // If it was sequential (concurrency 1), it would take ~1000ms.

    // Assert it is much faster than sequential
    expect(duration).toBeLessThan(800);

    // Assert it is roughly around 200-400ms
    expect(duration).toBeGreaterThan(150);
  });
});

  it("respects config batch size", async () => {
    // Change config
    configManager.getConfig().performance.batchSize = 2;

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

    expect(duration).toBeGreaterThan(450);
    expect(duration).toBeLessThan(700);
  });
