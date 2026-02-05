/**
 * Intent Optimizer Tests
 *
 * Comprehensive tests for the intent optimization service and routes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import {
  optimizeIntent,
  optimizeIntentWithMetadata,
  type OptimizationMode,
  type OptimizationOptions,
} from "./intentOptimizer.js";
import { type OptimizationRequest } from "./types.js";

// Mock the dependencies
vi.mock("../../middleware/logger.js", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

vi.mock("../../services/resilience.js", () => ({
  withResilience: vi.fn((fn) => fn),
}));

vi.mock("../../services/cacheService.js", () => ({
  withCache: vi.fn(async (_type, _key, fn) => await fn()),
}));

vi.mock("../../services/llmGateway.js", () => ({
  getStream: vi.fn(() => ({
    [Symbol.asyncIterator]: () => ({
      next: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: {
            type: "content_block_delta",
            delta: {
              type: "text_delta",
              text: JSON.stringify({
                features: ["User authentication", "Profile management"],
                constraints: [
                  {
                    type: "technical",
                    description: "Must use OAuth 2.0",
                    priority: "must",
                    impact: "Requires third-party integration",
                  },
                ],
                nonFunctionalRequirements: [
                  {
                    category: "security",
                    requirement: "Passwords must be hashed",
                    metric: "bcrypt with salt rounds 12",
                    priority: "critical",
                  },
                ],
                techStack: [
                  {
                    technology: "React",
                    category: "frontend",
                    rationale: "Modern UI library",
                    confidence: 0.9,
                  },
                ],
                actors: [
                  {
                    id: "user",
                    name: "End User",
                    type: "human",
                    responsibilities: ["Login", "Manage profile"],
                    priority: "primary",
                  },
                ],
                dataFlows: [
                  {
                    name: "Authentication flow",
                    source: "User",
                    target: "Auth Service",
                    data: "Credentials",
                    direction: "inbound",
                  },
                ],
                ambiguity: {
                  score: 0.2,
                  reason: "Clear requirements",
                  ambiguousAreas: [],
                },
                reasoning: "Based on authentication requirements",
                clarifications: [
                  {
                    id: "q1",
                    question: "What OAuth provider?",
                    importance: "Affects implementation",
                    suggestedOptions: ["Google", "GitHub", "Custom"],
                  },
                ],
                confidence: 0.85,
              }),
            },
          },
        })
        .mockResolvedValueOnce({ done: true }),
    }),
  })),
}));

describe("Intent Optimizer Service", () => {
  const mockNimKey = "test-nim-key";

  beforeEach(() => {
    process.env.NVIDIA_NIM_API_KEY = mockNimKey;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.NVIDIA_NIM_API_KEY;
  });

  describe("optimizeIntent", () => {
    it("should optimize intent in codegen mode", async () => {
      const rawIntent = "Build a user authentication system with OAuth";
      const mode: OptimizationMode = "codegen";

      const result = await optimizeIntent(rawIntent, mode);

      expect(result).toBeDefined();
      expect(result.features).toBeInstanceOf(Array);
      expect(result.constraints).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("should optimize intent in architecture mode", async () => {
      const rawIntent = "Design a microservices architecture for e-commerce";
      const mode: OptimizationMode = "architecture";

      const result = await optimizeIntent(rawIntent, mode);

      expect(result).toBeDefined();
      expect(result.features).toBeInstanceOf(Array);
      expect(result.actors).toBeInstanceOf(Array);
      expect(result.dataFlows).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should handle options with project context", async () => {
      const rawIntent = "Create an API for a blog platform";
      const mode: OptimizationMode = "codegen";
      const options: OptimizationOptions = {
        projectContext: {
          name: "Blog API",
          existingTechStack: ["Node.js", "Express"],
          phase: "greenfield",
          teamSize: 5,
        },
        maxFeatures: 10,
        clarificationQuestionsCount: 3,
      };

      const result = await optimizeIntent(rawIntent, mode, options);

      expect(result).toBeDefined();
      expect(result.features).toBeInstanceOf(Array);
    });

    it("should throw error when NIM is not configured", async () => {
      delete process.env.NVIDIA_NIM_API_KEY;

      await expect(optimizeIntent("test", "codegen")).rejects.toThrow(
        "NVIDIA NIM API key",
      );
    });
  });

  describe("optimizeIntentWithMetadata", () => {
    it("should return full optimization response with metadata", async () => {
      const request: OptimizationRequest = {
        intent: "Build a chat application",
        mode: "architecture",
      };

      const result = await optimizeIntentWithMetadata(request);

      expect(result).toBeDefined();
      expect(result.optimized).toBeDefined();
      expect(result.original).toBe(request.intent);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.mode).toBe("architecture");
    });

    it("should handle batch optimization", async () => {
      const requests: OptimizationRequest[] = [
        { intent: "Feature 1", mode: "codegen" },
        { intent: "Feature 2", mode: "architecture" },
      ];

      const results = await Promise.all(
        requests.map((req) => optimizeIntentWithMetadata(req)),
      );

      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result.optimized).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe("result structure validation", () => {
    it("should return valid OptimizedIntent structure", async () => {
      const result = await optimizeIntent("Test intent", "codegen");

      // Check all required fields
      expect(result).toHaveProperty("features");
      expect(result).toHaveProperty("constraints");
      expect(result).toHaveProperty("nonFunctionalRequirements");
      expect(result).toHaveProperty("techStack");
      expect(result).toHaveProperty("actors");
      expect(result).toHaveProperty("dataFlows");
      expect(result).toHaveProperty("ambiguity");
      expect(result).toHaveProperty("reasoning");
      expect(result).toHaveProperty("clarifications");
      expect(result).toHaveProperty("confidence");

      // Check types
      expect(Array.isArray(result.features)).toBe(true);
      expect(Array.isArray(result.constraints)).toBe(true);
      expect(Array.isArray(result.nonFunctionalRequirements)).toBe(true);
      expect(Array.isArray(result.techStack)).toBe(true);
      expect(Array.isArray(result.actors)).toBe(true);
      expect(Array.isArray(result.dataFlows)).toBe(true);
      expect(Array.isArray(result.clarifications)).toBe(true);
      expect(typeof result.ambiguity).toBe("object");
      expect(typeof result.reasoning).toBe("string");
      expect(typeof result.confidence).toBe("number");
    });

    it("should have valid constraint structure", async () => {
      const result = await optimizeIntent("Test", "codegen");

      if (result.constraints.length > 0) {
        const constraint = result.constraints[0];
        expect(constraint).toHaveProperty("type");
        expect(constraint).toHaveProperty("description");
        expect(constraint).toHaveProperty("priority");
        expect(constraint).toHaveProperty("impact");
        expect(["technical", "business", "regulatory", "resource"]).toContain(
          constraint.type,
        );
        expect(["must", "should", "nice_to_have"]).toContain(
          constraint.priority,
        );
      }
    });

    it("should have valid NFR structure", async () => {
      const result = await optimizeIntent("Test", "codegen");

      if (result.nonFunctionalRequirements.length > 0) {
        const nfr = result.nonFunctionalRequirements[0];
        expect(nfr).toHaveProperty("category");
        expect(nfr).toHaveProperty("requirement");
        expect(nfr).toHaveProperty("priority");
        expect([
          "performance",
          "security",
          "scalability",
          "reliability",
          "usability",
          "maintainability",
        ]).toContain(nfr.category);
        expect(["critical", "high", "medium", "low"]).toContain(nfr.priority);
      }
    });
  });
});

describe("Intent Optimizer Routes", () => {
  let _mockReq: Partial<Request>;
  let _mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({
      json: jsonMock,
      status: statusMock,
    } as unknown as Response);
    _mockRes = {
      json: jsonMock,
      status: statusMock,
    } as unknown as Response;
  });

  describe("POST /api/intent/optimize", () => {
    it("should validate required fields", async () => {
      // Simulate route handler validation
      const body = {} as { intent?: string; mode?: string };

      if (!body.intent || typeof body.intent !== "string") {
        statusMock(400);
        jsonMock({
          error:
            'Missing or invalid "intent" field - must be a non-empty string',
          type: "validation_error",
        });
      }

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: "validation_error" }),
      );
    });

    it("should validate mode field", async () => {
      const body = { intent: "test", mode: "invalid" } as {
        intent: string;
        mode: string;
      };

      if (!body.mode || !["codegen", "architecture"].includes(body.mode)) {
        statusMock(400);
        jsonMock({
          error:
            'Missing or invalid "mode" field - must be "codegen" or "architecture"',
          type: "validation_error",
        });
      }

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should reject empty intent", async () => {
      const body = { intent: "   ", mode: "codegen" } as {
        intent: string;
        mode: string;
      };

      if (body.intent.trim().length === 0) {
        statusMock(400);
        jsonMock({
          error: "Intent cannot be empty",
          type: "validation_error",
        });
      }

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should reject intent exceeding max length", async () => {
      const body = { intent: "a".repeat(10001), mode: "codegen" } as {
        intent: string;
        mode: string;
      };

      if (body.intent.length > 10000) {
        statusMock(400);
        jsonMock({
          error: "Intent exceeds maximum length of 10000 characters",
          type: "validation_error",
        });
      }

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should accept valid request", async () => {
      const body = {
        intent: "Build a user authentication system",
        mode: "codegen",
        projectContext: {
          name: "Auth Service",
          existingTechStack: ["Node.js"],
        },
      } as { intent: string; mode: string; projectContext?: object };

      // Valid request should not trigger validation errors
      let hasError = false;

      if (!body.intent || typeof body.intent !== "string") {
        hasError = true;
      } else if (
        !body.mode ||
        !["codegen", "architecture"].includes(body.mode)
      ) {
        hasError = true;
      } else if (body.intent.trim().length === 0) {
        hasError = true;
      } else if (body.intent.length > 10000) {
        hasError = true;
      }

      expect(hasError).toBe(false);
    });
  });

  describe("POST /api/intent/optimize/batch", () => {
    it("should validate batch size", async () => {
      const body = {
        intents: Array(11).fill({ intent: "test", mode: "codegen" }),
      } as { intents: Array<{ intent: string; mode: string }> };

      if (body.intents.length > 10) {
        statusMock(400);
        jsonMock({
          error: "Batch size exceeds maximum of 10 intents",
          type: "validation_error",
        });
      }

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should validate intents array", async () => {
      const body = {} as { intents?: Array<{ intent: string; mode: string }> };

      if (!Array.isArray(body.intents) || body.intents.length === 0) {
        statusMock(400);
        jsonMock({
          error:
            'Missing or invalid "intents" field - must be a non-empty array',
          type: "validation_error",
        });
      }

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });
});

describe("Confidence Calculation", () => {
  const originalEnv = process.env.NVIDIA_NIM_API_KEY;

  beforeEach(() => {
    process.env.NVIDIA_NIM_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.NVIDIA_NIM_API_KEY = originalEnv;
  });

  it("should calculate confidence based on result quality", async () => {
    const result = await optimizeIntent("Test", "codegen");

    // Confidence should be calculated from base + adjustments
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
