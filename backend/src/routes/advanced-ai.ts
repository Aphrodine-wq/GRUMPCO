/**
 * Advanced AI API Routes
 *
 * Exposes endpoints for:
 * - Holographic Memory (fixed-size vector memory)
 * - Context Compression (compress long texts to latent vectors)
 * - Swarm Orchestration (distributed micro-agents)
 * - Predictive Preloading (anticipate queries)
 * - Recursive Distillation (user model building)
 */

import { Router, type Request, type Response } from "express";
import logger from "../middleware/logger.js";

// Import services
import { HolographicMemoryService } from "../services/holographicMemory.js";
import { ContextCompressorService } from "../services/contextCompressor.js";
import { SwarmOrchestratorService } from "../services/swarmOrchestrator.js";
import { SupervisedSwarmService } from "../services/supervisedSwarm.js";
import { PredictivePreloaderService } from "../services/predictivePreloader.js";
import {
  RecursiveDistillationService,
  type ConversationTurn,
} from "../services/recursiveDistillation.js";

const router = Router();

// ============================================================================
// Holographic Memory Endpoints
// ============================================================================

/**
 * POST /api/advanced-ai/holographic/store
 * Store a key-value pair in holographic memory
 * Body: { memoryId?: string, key: string, value: string }
 */
router.post("/holographic/store", async (req: Request, res: Response) => {
  try {
    const { memoryId, key, value } = req.body as {
      memoryId?: string;
      key?: string;
      value?: string;
    };

    if (!key || !value) {
      return res.status(400).json({ error: "key and value are required" });
    }

    const service = HolographicMemoryService.getInstance();
    const memory = service.getMemory(memoryId || "default");
    memory.store(key, value);

    const stats = memory.getStats();
    return res.json({
      ok: true,
      memoryId: memoryId || "default",
      entryCount: stats.entryCount,
      dimension: stats.dimension,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Holographic store error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/advanced-ai/holographic/retrieve
 * Retrieve a value by key from holographic memory
 * Body: { memoryId?: string, key: string, expectedValue?: string }
 */
router.post("/holographic/retrieve", async (req: Request, res: Response) => {
  try {
    const { memoryId, key, expectedValue } = req.body as {
      memoryId?: string;
      key?: string;
      expectedValue?: string;
    };

    if (!key) {
      return res.status(400).json({ error: "key is required" });
    }

    const service = HolographicMemoryService.getInstance();
    const memory = service.getMemory(memoryId || "default");

    if (expectedValue) {
      // If expected value provided, compute similarity
      const result = memory.retrieveWithSimilarity(key, expectedValue);
      return res.json({
        ok: true,
        key,
        similarity: result.similarity,
        vectorMagnitude: result.retrieved.magnitude(),
      });
    } else {
      const result = memory.retrieve(key);
      return res.json({
        ok: true,
        key,
        vectorMagnitude: result.magnitude(),
      });
    }
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Holographic retrieve error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/advanced-ai/holographic/stats
 * Get holographic memory statistics
 */
router.get("/holographic/stats", async (req: Request, res: Response) => {
  try {
    const service = HolographicMemoryService.getInstance();
    const allStats = service.listAll();

    return res.json({
      ok: true,
      ...allStats,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Holographic stats error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// Context Compression Endpoints
// ============================================================================

/**
 * POST /api/advanced-ai/context/compress
 * Compress text to a fixed-dimension latent vector
 * Body: { text: string, source?: string }
 */
router.post("/context/compress", async (req: Request, res: Response) => {
  try {
    const { text, source } = req.body as {
      text?: string;
      source?: string;
    };

    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }

    const service = ContextCompressorService.getInstance();
    const compressed = service.compress(text, source || "api");

    return res.json({
      ok: true,
      id: compressed.id,
      originalLength: text.length,
      stats: compressed.stats,
      metadata: compressed.metadata,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Context compress error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/advanced-ai/context/similarity
 * Compare two contexts using compressed representations
 * Body: { contextId1: string, contextId2: string } OR { text1: string, text2: string }
 */
router.post("/context/similarity", async (req: Request, res: Response) => {
  try {
    const { contextId1, contextId2, text1, text2 } = req.body as {
      contextId1?: string;
      contextId2?: string;
      text1?: string;
      text2?: string;
    };

    const service = ContextCompressorService.getInstance();

    // If text provided, compress first
    let id1 = contextId1;
    let id2 = contextId2;

    if (text1 && text2) {
      const compressed1 = service.compress(text1, "similarity_check");
      const compressed2 = service.compress(text2, "similarity_check");
      id1 = compressed1.id;
      id2 = compressed2.id;
    }

    if (!id1 || !id2) {
      return res.status(400).json({
        error: "Either contextId1/contextId2 or text1/text2 are required",
      });
    }

    const ctx1 = service.get(id1);
    const ctx2 = service.get(id2);

    if (!ctx1 || !ctx2) {
      return res.status(404).json({ error: "One or both contexts not found" });
    }

    const similarity = ctx1.vector.similarity(ctx2.vector);

    return res.json({
      ok: true,
      similarity,
      context1: { id: id1, tokens: ctx1.stats.originalTokens },
      context2: { id: id2, tokens: ctx2.stats.originalTokens },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Context similarity error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/advanced-ai/context/query
 * Query cached context by similarity
 * Body: { query: string, topK?: number }
 */
router.post("/context/query", async (req: Request, res: Response) => {
  try {
    const { query, topK = 5 } = req.body as {
      query?: string;
      topK?: number;
    };

    if (!query) {
      return res.status(400).json({ error: "query is required" });
    }

    const service = ContextCompressorService.getInstance();
    const results = service.findSimilar(query, topK);

    return res.json({
      ok: true,
      query,
      results,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Context query error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/advanced-ai/context/list
 * List all cached contexts
 */
router.get("/context/list", async (req: Request, res: Response) => {
  try {
    const service = ContextCompressorService.getInstance();
    const contexts = service.listAll();

    return res.json({
      ok: true,
      count: contexts.length,
      contexts,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Context list error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// Swarm Orchestration Endpoints
// ============================================================================

/**
 * POST /api/advanced-ai/swarm/create
 * Create a new swarm
 * Body: { swarmId?: string, agentCount?: number }
 */
router.post("/swarm/create", async (req: Request, res: Response) => {
  try {
    const { swarmId, maxAgents = 12 } = req.body as {
      swarmId?: string;
      maxAgents?: number;
    };

    const service = SwarmOrchestratorService.getInstance();
    const swarm = service.getSwarm(swarmId || "default", { maxAgents });

    return res.json({
      ok: true,
      swarmId: swarmId || "default",
      stats: swarm.getStats(),
      topology: swarm.getTopologyVisualization(),
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Swarm create error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/advanced-ai/swarm/task
 * Submit a task to the swarm
 * Body: { swarmId?: string, query: string, context?: string }
 */
router.post("/swarm/task", async (req: Request, res: Response) => {
  try {
    const { swarmId, query, context } = req.body as {
      swarmId?: string;
      query?: string;
      context?: string;
    };

    if (!query) {
      return res.status(400).json({ error: "query is required" });
    }

    const service = SwarmOrchestratorService.getInstance();
    const swarm = service.getSwarm(swarmId || "default");

    const taskId = swarm.submitTask(query, context);

    // Start gossip for processing
    swarm.startGossip();

    // Return task ID - client can poll for results
    return res.json({
      ok: true,
      taskId,
      swarmId: swarmId || "default",
      status: "processing",
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Swarm task error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/advanced-ai/swarm/task/:taskId
 * Get task status and results
 */
router.get("/swarm/task/:taskId", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params as { taskId: string };
    const swarmId = (req.query.swarmId as string) || "default";

    const service = SwarmOrchestratorService.getInstance();
    const swarm = service.getSwarm(swarmId);
    const task = swarm.getTask(taskId);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    return res.json({
      ok: true,
      task: {
        id: task.id,
        query: task.query,
        status: task.status,
        synthesizedResult: task.synthesizedResult,
        resultCount: task.results.length,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
      },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Swarm task status error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/advanced-ai/swarm/status/:swarmId
 * Get swarm status and topology
 */
router.get(
  ["/swarm/status", "/swarm/status/:swarmId"],
  async (req: Request, res: Response) => {
    try {
      const { swarmId: swarmIdParam } = req.params as { swarmId?: string };
      const swarmId = swarmIdParam || "default";

      const service = SwarmOrchestratorService.getInstance();
      const swarm = service.getSwarm(swarmId);

      return res.json({
        ok: true,
        swarmId,
        stats: swarm.getStats(),
        topology: swarm.getTopologyVisualization(),
      });
    } catch (e) {
      logger.error({ error: (e as Error).message }, "Swarm status error");
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * POST /api/advanced-ai/swarm/inject
 * Inject a discovery into the swarm
 * Body: { swarmId?: string, content: string, confidence?: number, tags?: string[] }
 */
router.post("/swarm/inject", async (req: Request, res: Response) => {
  try {
    const {
      swarmId,
      content,
      confidence = 0.8,
      tags = [],
    } = req.body as {
      swarmId?: string;
      content?: string;
      confidence?: number;
      tags?: string[];
    };

    if (!content) {
      return res.status(400).json({ error: "content is required" });
    }

    const service = SwarmOrchestratorService.getInstance();
    const swarm = service.getSwarm(swarmId || "default");

    swarm.injectDiscovery(content, confidence, tags);

    return res.json({
      ok: true,
      swarmId: swarmId || "default",
      injected: true,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Swarm inject error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/advanced-ai/swarm/stop/:swarmId
 * Stop a swarm's gossip
 */
router.post(
  ["/swarm/stop", "/swarm/stop/:swarmId"],
  async (req: Request, res: Response) => {
    try {
      const { swarmId: swarmIdParam } = req.params as { swarmId?: string };
      const swarmId = swarmIdParam || "default";

      const service = SwarmOrchestratorService.getInstance();
      const swarm = service.getSwarm(swarmId);
      swarm.stopGossip();

      return res.json({
        ok: true,
        swarmId,
        status: "stopped",
      });
    } catch (e) {
      logger.error({ error: (e as Error).message }, "Swarm stop error");
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * GET /api/advanced-ai/swarm/list
 * List all swarms
 */
router.get("/swarm/list", async (req: Request, res: Response) => {
  try {
    const service = SwarmOrchestratorService.getInstance();
    const swarms = service.listSwarms();

    return res.json({
      ok: true,
      count: swarms.length,
      swarms,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Swarm list error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// Supervised Swarm Endpoints (Kimi-Controlled)
// ============================================================================

/**
 * POST /api/advanced-ai/supervised/create
 * Create a new supervised swarm (Kimi as supervisor)
 * Body: { swarmId?: string, agentsPerRole?: number, reviewStrictness?: 'lenient' | 'moderate' | 'strict' }
 */
router.post("/supervised/create", async (req: Request, res: Response) => {
  try {
    const {
      swarmId,
      agentsPerRole: _agentsPerRole = 1,
      reviewStrictness = "moderate",
    } = req.body as {
      swarmId?: string;
      agentsPerRole?: number;
      reviewStrictness?: "lenient" | "moderate" | "strict";
    };

    const service = SupervisedSwarmService.getInstance();
    const swarm = service.getSwarm(swarmId || "default", { reviewStrictness });

    return res.json({
      ok: true,
      swarmId: swarmId || "default",
      stats: swarm.getStats(),
      visualization: swarm.getVisualization(),
    });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Supervised swarm create error",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/advanced-ai/supervised/task
 * Submit a task to the supervised swarm
 * Body: { swarmId?: string, query: string, context?: string }
 */
router.post("/supervised/task", async (req: Request, res: Response) => {
  try {
    const { swarmId, query, context } = req.body as {
      swarmId?: string;
      query?: string;
      context?: string;
    };

    if (!query) {
      return res.status(400).json({ error: "query is required" });
    }

    const service = SupervisedSwarmService.getInstance();
    const swarm = service.getSwarm(swarmId || "default");

    // Submit task - this runs the full supervised workflow
    const task = await swarm.submitTask(query, context);

    return res.json({
      ok: true,
      task: {
        id: task.id,
        query: task.query,
        status: task.status,
        plan: task.plan,
        subtaskCount: task.subtasks.length,
        approvedCount: task.subtasks.filter((st) => st.status === "approved")
          .length,
        rejectedCount: task.subtasks.filter((st) => st.status === "rejected")
          .length,
        synthesizedResult: task.synthesizedResult,
        events: task.events.slice(-10), // Last 10 events
        createdAt: task.createdAt,
        completedAt: task.completedAt,
      },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Supervised task error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/advanced-ai/supervised/task/:taskId
 * Get supervised task status and full details
 */
router.get("/supervised/task/:taskId", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params as { taskId: string };
    const swarmId = (req.query.swarmId as string) || "default";

    const service = SupervisedSwarmService.getInstance();
    const swarm = service.getSwarm(swarmId);
    const task = swarm.getTask(taskId);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    return res.json({
      ok: true,
      task: {
        id: task.id,
        query: task.query,
        status: task.status,
        plan: task.plan,
        subtasks: task.subtasks.map((st) => ({
          id: st.id,
          role: st.role,
          instruction: st.instruction.slice(0, 100) + "...",
          status: st.status,
          attempts: st.attempts,
          result: st.result
            ? {
                content: st.result.content.slice(0, 200) + "...",
                confidence: st.result.confidence,
              }
            : null,
          review: st.review,
        })),
        synthesizedResult: task.synthesizedResult,
        eventCount: task.events.length,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
      },
    });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Supervised task status error",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/advanced-ai/supervised/status/:swarmId
 * Get supervised swarm status and visualization
 */
router.get(
  ["/supervised/status", "/supervised/status/:swarmId"],
  async (req: Request, res: Response) => {
    try {
      const { swarmId: swarmIdParam } = req.params as { swarmId?: string };
      const swarmId = swarmIdParam || "default";

      const service = SupervisedSwarmService.getInstance();
      const swarm = service.getSwarm(swarmId);

      return res.json({
        ok: true,
        swarmId,
        stats: swarm.getStats(),
        visualization: swarm.getVisualization(),
      });
    } catch (e) {
      logger.error({ error: (e as Error).message }, "Supervised status error");
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * GET /api/advanced-ai/supervised/list
 * List all supervised swarms
 */
router.get("/supervised/list", async (req: Request, res: Response) => {
  try {
    const service = SupervisedSwarmService.getInstance();
    const swarms = service.listSwarms();

    return res.json({
      ok: true,
      count: swarms.length,
      swarms,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Supervised list error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// Predictive Preloader Endpoints
// ============================================================================

/**
 * POST /api/advanced-ai/preloader/record
 * Record a query for learning
 * Body: { query: string, sessionId?: string, userId?: string }
 */
router.post("/preloader/record", async (req: Request, res: Response) => {
  try {
    const { query, sessionId, userId } = req.body as {
      query?: string;
      sessionId?: string;
      userId?: string;
    };

    if (!query) {
      return res.status(400).json({ error: "query is required" });
    }

    const service = PredictivePreloaderService.getInstance();
    const preloader = service.getPreloader(userId);

    if (sessionId) {
      preloader.startSession(sessionId);
    }

    preloader.recordQuery(query);

    return res.json({
      ok: true,
      session: preloader.getCurrentSession(),
      stats: preloader.getStats(),
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Preloader record error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/advanced-ai/preloader/predict
 * Get predicted next queries
 * Query: userId?, topK?
 */
router.get("/preloader/predict", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    const topK = parseInt(req.query.topK as string) || 10;

    const service = PredictivePreloaderService.getInstance();
    const preloader = service.getPreloader(userId);

    const predictions = preloader.generatePredictions(topK);

    return res.json({
      ok: true,
      predictions,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Preloader predict error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/advanced-ai/preloader/preload
 * Trigger preloading of predicted queries
 * Body: { userId?: string }
 */
router.post("/preloader/preload", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body as { userId?: string };

    const service = PredictivePreloaderService.getInstance();
    const preloader = service.getPreloader(userId);

    const count = await preloader.preload();

    return res.json({
      ok: true,
      preloadedCount: count,
      stats: preloader.getStats(),
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Preloader preload error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/advanced-ai/preloader/stats
 * Get preloader statistics
 */
router.get("/preloader/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;

    const service = PredictivePreloaderService.getInstance();
    const preloader = service.getPreloader(userId);

    return res.json({
      ok: true,
      stats: preloader.getStats(),
      topicTransitions: preloader.getTopicTransitions().slice(0, 20),
      temporalPatterns: preloader.getTemporalPatterns().slice(0, 10),
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Preloader stats error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// Recursive Distillation Endpoints
// ============================================================================

/**
 * POST /api/advanced-ai/distill/turn
 * Add a conversation turn
 * Body: { role: 'user' | 'assistant', content: string, sessionId?: string }
 */
router.post("/distill/turn", async (req: Request, res: Response) => {
  try {
    const { role, content, sessionId, metadata } = req.body as {
      role?: "user" | "assistant";
      content?: string;
      sessionId?: string;
      metadata?: Record<string, unknown>;
    };

    if (!role || !content) {
      return res.status(400).json({ error: "role and content are required" });
    }

    const turn: ConversationTurn = {
      role,
      content,
      timestamp: Date.now(),
      sessionId: sessionId || "default",
      metadata,
    };

    const service = RecursiveDistillationService.getInstance();
    service.addTurn(turn);

    return res.json({
      ok: true,
      stats: service.getDistiller().getStats(),
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Distill turn error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/advanced-ai/distill/run
 * Run distillation cycle
 * Body: { userId?: string }
 */
router.post("/distill/run", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body as { userId?: string };

    const service = RecursiveDistillationService.getInstance();
    const result = service.distill(userId || "default");

    return res.json({
      ok: true,
      result,
      stats: service.getDistiller().getStats(),
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Distill run error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/advanced-ai/distill/model/:userId
 * Get user model summary
 */
router.get(
  ["/distill/model", "/distill/model/:userId"],
  async (req: Request, res: Response) => {
    try {
      const { userId: userIdParam } = req.params as { userId?: string };
      const userId = userIdParam || "default";

      const service = RecursiveDistillationService.getInstance();
      const model = service.getModel(userId);

      if (!model) {
        return res.status(404).json({ error: "User model not found" });
      }

      return res.json({
        ok: true,
        userId: model.userId,
        version: model.version,
        summary: model.summary,
        styleProfile: model.styleProfile,
        preferences: model.preferences.slice(0, 20),
        constraints: model.constraints.slice(0, 10),
        patterns: model.patterns.slice(0, 20).map((p) => ({
          type: p.type,
          pattern: p.pattern,
          confidence: p.confidence,
          frequency: p.frequency,
        })),
        stats: {
          totalConversations: model.totalConversations,
          totalTurns: model.totalTurns,
          distillationCycles: model.distillationCycles,
          nodeCount: model.nodes.size,
          edgeCount: model.edges.length,
        },
      });
    } catch (e) {
      logger.error({ error: (e as Error).message }, "Distill model error");
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * GET /api/advanced-ai/distill/knowledge/:userId
 * Get user knowledge graph
 */
router.get(
  ["/distill/knowledge", "/distill/knowledge/:userId"],
  async (req: Request, res: Response) => {
    try {
      const { userId: userIdParam } = req.params as { userId?: string };
      const userId = userIdParam || "default";

      const service = RecursiveDistillationService.getInstance();
      const distiller = service.getDistiller();
      const graph = distiller.getKnowledgeGraph(userId);

      if (!graph) {
        return res.status(404).json({ error: "Knowledge graph not found" });
      }

      return res.json({
        ok: true,
        userId,
        nodes: graph.nodes.slice(0, 100),
        edges: graph.edges.slice(0, 200),
      });
    } catch (e) {
      logger.error({ error: (e as Error).message }, "Distill knowledge error");
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * GET /api/advanced-ai/distill/stats
 * Get distillation statistics
 */
router.get("/distill/stats", async (req: Request, res: Response) => {
  try {
    const service = RecursiveDistillationService.getInstance();
    const stats = service.getDistiller().getStats();

    return res.json({
      ok: true,
      ...stats,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Distill stats error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// Combined Overview Endpoint
// ============================================================================

/**
 * GET /api/advanced-ai/overview
 * Get overview of all advanced AI systems
 */
router.get("/overview", async (req: Request, res: Response) => {
  try {
    const holoService = HolographicMemoryService.getInstance();
    const preloaderService = PredictivePreloaderService.getInstance();
    const distillService = RecursiveDistillationService.getInstance();

    return res.json({
      ok: true,
      systems: {
        holographicMemory: {
          status: "active",
          stats: holoService.listAll(),
        },
        contextCompressor: {
          status: "active",
          description: "Compresses long contexts to fixed-dimension vectors",
        },
        swarmOrchestrator: {
          status: "active",
          description: "Distributed micro-agents with gossip protocol",
        },
        predictivePreloader: {
          status: "active",
          stats: preloaderService.getDefault().getStats(),
        },
        recursiveDistillation: {
          status: "active",
          stats: distillService.getDistiller().getStats(),
        },
      },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Overview error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
