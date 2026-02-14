/**
 * Integration Tests - Chat Stream Validation
 * Tests request validation, provider restrictions, and schema enforcement.
 *
 * These tests focus on Zod schema validation (returns 400 for invalid requests).
 * Full SSE streaming is NOT tested here — that requires complete service mocking
 * and is covered by e2e tests.
 *
 * @module tests/routes/chatStream.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import express from "express";

// Mock AI services
vi.mock("../../src/services/ai-providers/claudeServiceWithTools.js", () => ({
    generateChatStream: vi.fn(async function* () {
        yield { type: "text", content: "Mock response" };
    }),
    generateChat: vi.fn().mockResolvedValue({ content: "Mock response" }),
}));

// Mock model router
vi.mock("../../src/services/ai-providers/modelRouter.js", () => ({
    route: vi.fn().mockReturnValue({
        provider: "mock",
        modelId: "mock-model",
        reason: "test routing",
    }),
}));

// Mock cache
vi.mock("../../src/services/caching/chatCache.js", () => ({
    getCachedChatResponse: vi.fn().mockResolvedValue(null),
    setCachedChatResponse: vi.fn().mockResolvedValue(undefined),
}));

// Mock metrics
vi.mock("../../src/middleware/metrics.js", () => ({
    recordLlmRouterSelection: vi.fn(),
    recordChatRequest: vi.fn(),
}));

// Mock OpenTelemetry
vi.mock("@opentelemetry/api", () => ({
    trace: {
        getTracer: () => ({
            startActiveSpan: (_name: string, fn: (span: unknown) => unknown) =>
                fn({ setAttribute: vi.fn(), setStatus: vi.fn(), end: vi.fn() }),
        }),
    },
}));

// Mock database
vi.mock("../../src/db/database.js", () => ({
    getDatabase: () => ({
        isInitialized: () => true,
        getSession: vi.fn().mockResolvedValue(null),
        saveSession: vi.fn().mockResolvedValue(undefined),
        getSettings: vi.fn().mockReturnValue({ model: "test-model", provider: "mock" }),
    }),
}));

// Mock stream buffer
vi.mock("../../src/services/infra/streamBuffer.js", () => ({
    StreamBuffer: vi.fn().mockImplementation(() => ({
        push: vi.fn(),
        flush: vi.fn(),
        close: vi.fn(),
    })),
}));

// Mock validator
vi.mock("../../src/middleware/validator.js", () => ({
    MAX_CHAT_MESSAGE_LENGTH: 100000,
    MAX_CHAT_MESSAGES: 100,
    MAX_CHAT_MESSAGE_LENGTH_LARGE: 200000,
    MAX_CHAT_MESSAGES_LARGE: 200,
    checkSuspiciousInMessages: vi.fn().mockReturnValue({ isSuspicious: false }),
}));

describe("Chat Stream Validation", () => {
    let app: express.Express;

    beforeEach(async () => {
        vi.clearAllMocks();
        process.env.NODE_ENV = "test";
        process.env.BLOCK_SUSPICIOUS_PROMPTS = "false";

        app = express();
        app.use(express.json());

        const chatRoutes = (await import("../../src/routes/chat.js")).default;
        app.use("/api/chat", chatRoutes);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // ─── Request Validation (400 rejection tests) ────────────────────────

    describe("Request Validation", () => {
        it("rejects empty messages array", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({ messages: [] })
                .expect("Content-Type", /json/);

            expect(res.status).toBe(400);
        });

        it("rejects missing messages field", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({})
                .expect("Content-Type", /json/);

            expect(res.status).toBe(400);
        });

        it("rejects invalid provider value", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({
                    messages: [{ role: "user", content: "Hello" }],
                    provider: "invalid_provider",
                })
                .expect("Content-Type", /json/);

            expect(res.status).toBe(400);
        });

        it("rejects invalid mode value", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({
                    messages: [{ role: "user", content: "Hello" }],
                    mode: "invalid_mode",
                })
                .expect("Content-Type", /json/);

            expect(res.status).toBe(400);
        });

        it("rejects invalid role in messages", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({
                    messages: [{ role: "system", content: "You are helpful" }],
                })
                .expect("Content-Type", /json/);

            expect(res.status).toBe(400);
        });

        it("rejects negative maxLatencyMs", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({
                    messages: [{ role: "user", content: "Hello" }],
                    maxLatencyMs: -100,
                })
                .expect("Content-Type", /json/);

            expect(res.status).toBe(400);
        });

        it("rejects invalid tier value", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({
                    messages: [{ role: "user", content: "Hello" }],
                    tier: "premium",
                })
                .expect("Content-Type", /json/);

            expect(res.status).toBe(400);
        });

        it("rejects invalid modelPreset value", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({
                    messages: [{ role: "user", content: "Hello" }],
                    modelPreset: "ultra",
                })
                .expect("Content-Type", /json/);

            expect(res.status).toBe(400);
        });
    });

    // ─── Removed Provider Enforcement ─────────────────────────────────────

    describe("Removed Provider Enforcement", () => {
        it("rejects removed provider 'google'", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({
                    messages: [{ role: "user", content: "Hello" }],
                    provider: "google",
                })
                .expect("Content-Type", /json/);

            expect(res.status).toBe(400);
        });

        it("rejects removed provider 'github_copilot'", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({
                    messages: [{ role: "user", content: "Hello" }],
                    provider: "github_copilot",
                })
                .expect("Content-Type", /json/);

            expect(res.status).toBe(400);
        });

        it("rejects removed provider 'jan'", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({
                    messages: [{ role: "user", content: "Hello" }],
                    provider: "jan",
                })
                .expect("Content-Type", /json/);

            expect(res.status).toBe(400);
        });

        it("rejects removed provider 'mistral'", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({
                    messages: [{ role: "user", content: "Hello" }],
                    provider: "mistral",
                })
                .expect("Content-Type", /json/);

            expect(res.status).toBe(400);
        });
    });

    // ─── Multimodal Schema Validation ─────────────────────────────────────

    describe("Multimodal Schema Validation", () => {
        it("rejects invalid image URL in multimodal content", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "image_url", image_url: { url: "not-a-url" } },
                            ],
                        },
                    ],
                });

            expect(res.status).toBe(400);
        });

        it("rejects unknown multimodal content type", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "video", url: "https://example.com/video.mp4" },
                            ],
                        },
                    ],
                });

            expect(res.status).toBe(400);
        });

        it("rejects multimodal content missing text field", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text" },  // missing "text" field
                            ],
                        },
                    ],
                });

            expect(res.status).toBe(400);
        });
    });

    // ─── Session Type Validation ──────────────────────────────────────────

    describe("Session Type Validation", () => {
        it("rejects invalid sessionType", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({
                    messages: [{ role: "user", content: "Hello" }],
                    sessionType: "invalid",
                });

            expect(res.status).toBe(400);
        });

        it("rejects invalid agentProfile", async () => {
            const res = await request(app)
                .post("/api/chat/stream")
                .send({
                    messages: [{ role: "user", content: "Hello" }],
                    agentProfile: "hacker",
                });

            expect(res.status).toBe(400);
        });
    });
});
