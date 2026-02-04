/**
 * Memory API Routes
 *
 * Provides endpoints for user memory operations and G-Agent memory management.
 *
 * ## User Memory
 * - Recall memories by query
 * - Remember new information (interactions, corrections, preferences)
 * - Learn from user feedback/corrections
 *
 * ## G-Agent Memory
 * - Patterns: Reusable task patterns for goal achievement
 * - Skills: Learned capabilities and tool proficiencies
 * - Lexicon: Domain-specific terminology and definitions
 * - Project Context: Workspace-specific project information
 *
 * @module routes/memory
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  recall,
  remember,
  learnFromFeedback,
} from "../services/memoryService.js";
import {
  gAgentMemoryService,
  type MemoryCategory,
} from "../services/gAgentMemoryService.js";
import logger from "../middleware/logger.js";
import {
  sendErrorResponse,
  sendServerError,
  ErrorCode,
} from "../utils/errorResponse.js";

const router = Router();

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

/**
 * Schema for recall request.
 */
const recallSchema = z.object({
  userId: z
    .string({ required_error: "userId is required" })
    .min(1, "userId is required"),
  query: z
    .string({ required_error: "query is required" })
    .min(1, "query is required"),
});

/**
 * Schema for remember request.
 */
const rememberSchema = z.object({
  userId: z
    .string({ required_error: "userId is required" })
    .min(1, "userId is required"),
  type: z.enum(["interaction", "correction", "preference"]).optional(),
  content: z
    .string({ required_error: "content is required" })
    .min(1, "content is required"),
  summary: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Schema for feedback request.
 */
const feedbackSchema = z.object({
  userId: z
    .string({ required_error: "userId is required" })
    .min(1, "userId is required"),
  originalResponse: z.string({
    required_error: "originalResponse is required",
  }),
  correctedResponse: z.string({
    required_error: "correctedResponse is required",
  }),
  context: z.string().optional(),
});

/**
 * Schema for search query parameters.
 */
const searchQuerySchema = z.object({
  q: z.string().min(1, 'Query parameter "q" is required'),
  limit: z.string().regex(/^\d+$/).optional(),
});

/**
 * Schema for lexicon entry creation.
 */
const lexiconEntrySchema = z.object({
  term: z.string().min(1, "term is required"),
  definition: z.string().min(1, "definition is required"),
  category: z.string().min(1, "category is required"),
  aliases: z.array(z.string()).optional(),
  relatedTerms: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  source: z.string().optional(),
});

/**
 * Schema for project context creation.
 */
const projectContextSchema = z.object({
  workspaceRoot: z.string().min(1, "workspaceRoot is required"),
  name: z.string().min(1, "name is required"),
  type: z.string().min(1, "type is required"),
  techStack: z.array(z.string()).min(1, "techStack is required"),
  architecture: z.string().min(1, "architecture is required"),
  conventions: z
    .array(
      z.object({
        type: z.string(),
        pattern: z.string(),
        description: z.string(),
        examples: z.array(z.string()),
      }),
    )
    .optional(),
  files: z
    .array(
      z.object({
        path: z.string(),
        type: z.string(),
        description: z.string(),
        exports: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  dependencies: z.array(z.string()).optional(),
});

/**
 * Schema for unified G-Agent search.
 */
const gAgentSearchSchema = z.object({
  query: z.string().min(1, "query is required"),
  categories: z
    .array(z.enum(["patterns", "skills", "lexicon", "projectContext"]))
    .optional(),
  limit: z.number().int().positive().optional(),
});

// ============================================================================
// USER MEMORY ROUTES
// ============================================================================

/**
 * GET /api/memory
 *
 * List memories for integrations UI (stub: returns empty list).
 *
 * @route GET /api/memory
 * @group Memory - User memory operations
 * @returns {object} 200 - Empty memories list
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ memories: [] });
  } catch (e) {
    logger.warn({ error: (e as Error).message }, "Memory list error");
    sendServerError(res, e);
  }
});

/**
 * POST /api/memory/recall
 *
 * Recall memories matching a query for a specific user.
 *
 * @route POST /api/memory/recall
 * @group Memory - User memory operations
 * @param {object} req.body - Recall request
 * @param {string} req.body.userId - User identifier
 * @param {string} req.body.query - Search query for memories
 * @returns {object} 200 - Matching memories
 * @returns {ApiErrorResponse} 400 - Validation error
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.post("/recall", async (req: Request, res: Response): Promise<void> => {
  const parseResult = recallSchema.safeParse(req.body);
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    sendErrorResponse(
      res,
      ErrorCode.VALIDATION_ERROR,
      firstError?.message ?? "Invalid request",
      {
        field: firstError?.path?.join("."),
      },
    );
    return;
  }

  try {
    const { userId, query } = parseResult.data;
    const memories = await recall(userId.trim(), query.trim());
    res.json({ memories });
  } catch (e) {
    logger.warn({ error: (e as Error).message }, "Memory recall error");
    sendServerError(res, e);
  }
});

/**
 * POST /api/memory/remember
 *
 * Store a new memory for a user.
 *
 * @route POST /api/memory/remember
 * @group Memory - User memory operations
 * @param {object} req.body - Remember request
 * @param {string} req.body.userId - User identifier
 * @param {string} req.body.content - Memory content to store
 * @param {string} [req.body.type] - Memory type: 'interaction', 'correction', or 'preference'
 * @param {string} [req.body.summary] - Optional summary
 * @param {object} [req.body.metadata] - Optional metadata
 * @returns {object} 201 - Success confirmation
 * @returns {ApiErrorResponse} 400 - Validation error
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.post("/remember", async (req: Request, res: Response): Promise<void> => {
  const parseResult = rememberSchema.safeParse(req.body);
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    sendErrorResponse(
      res,
      ErrorCode.VALIDATION_ERROR,
      firstError?.message ?? "Invalid request",
      {
        field: firstError?.path?.join("."),
      },
    );
    return;
  }

  try {
    const { userId, type, content, summary, metadata } = parseResult.data;
    const validType =
      type === "correction" || type === "preference" ? type : "interaction";
    await remember({
      userId: userId.trim(),
      type: validType,
      content: content.trim(),
      summary,
      metadata,
    });
    res.status(201).json({ ok: true });
  } catch (e) {
    logger.warn({ error: (e as Error).message }, "Memory remember error");
    sendServerError(res, e);
  }
});

/**
 * POST /api/memory/feedback
 *
 * Learn from user correction/feedback.
 *
 * @route POST /api/memory/feedback
 * @group Memory - User memory operations
 * @param {object} req.body - Feedback request
 * @param {string} req.body.userId - User identifier
 * @param {string} req.body.originalResponse - The original response that was wrong
 * @param {string} req.body.correctedResponse - The corrected response
 * @param {string} [req.body.context] - Optional context about the correction
 * @returns {object} 201 - Success confirmation
 * @returns {ApiErrorResponse} 400 - Validation error
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.post("/feedback", async (req: Request, res: Response): Promise<void> => {
  const parseResult = feedbackSchema.safeParse(req.body);
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    sendErrorResponse(
      res,
      ErrorCode.VALIDATION_ERROR,
      firstError?.message ?? "Invalid request",
      {
        field: firstError?.path?.join("."),
      },
    );
    return;
  }

  try {
    const { userId, originalResponse, correctedResponse, context } =
      parseResult.data;
    await learnFromFeedback({
      userId: userId.trim(),
      originalResponse,
      correctedResponse,
      context,
    });
    res.status(201).json({ ok: true });
  } catch (e) {
    logger.warn({ error: (e as Error).message }, "Memory feedback error");
    sendServerError(res, e);
  }
});

// ============================================================================
// G-AGENT MEMORY ROUTES
// ============================================================================

/**
 * GET /api/memory/gagent/stats
 *
 * Get G-Agent memory statistics.
 *
 * @route GET /api/memory/gagent/stats
 * @group G-Agent Memory - G-Agent memory management
 * @returns {object} 200 - Memory statistics
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.get(
  "/gagent/stats",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const stats = gAgentMemoryService.getStats();
      res.json(stats);
    } catch (e) {
      logger.warn(
        { error: (e as Error).message },
        "G-Agent memory stats error",
      );
      sendServerError(res, e);
    }
  },
);

/**
 * GET /api/memory/gagent/patterns
 *
 * Get all G-Agent patterns.
 *
 * @route GET /api/memory/gagent/patterns
 * @group G-Agent Memory - G-Agent memory management
 * @returns {object} 200 - All patterns
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.get(
  "/gagent/patterns",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const patterns = gAgentMemoryService.getAllPatterns();
      res.json({ patterns });
    } catch (e) {
      logger.warn(
        { error: (e as Error).message },
        "G-Agent patterns list error",
      );
      sendServerError(res, e);
    }
  },
);

/**
 * GET /api/memory/gagent/patterns/search
 *
 * Search patterns by goal.
 *
 * @route GET /api/memory/gagent/patterns/search
 * @group G-Agent Memory - G-Agent memory management
 * @param {string} q.query.required - Search query
 * @param {string} [limit.query] - Maximum results (default: 5)
 * @returns {object} 200 - Matching patterns
 * @returns {ApiErrorResponse} 400 - Validation error
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.get(
  "/gagent/patterns/search",
  async (req: Request, res: Response): Promise<void> => {
    const parseResult = searchQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        firstError?.message ?? "Invalid request",
        {
          field: firstError?.path?.join("."),
        },
      );
      return;
    }

    try {
      const { q, limit } = parseResult.data;
      const patterns = await gAgentMemoryService.findPatterns(
        q.trim(),
        limit ? parseInt(limit, 10) : 5,
      );
      res.json({ patterns });
    } catch (e) {
      logger.warn(
        { error: (e as Error).message },
        "G-Agent patterns search error",
      );
      sendServerError(res, e);
    }
  },
);

/**
 * GET /api/memory/gagent/patterns/:id
 *
 * Get a specific pattern by ID.
 *
 * @route GET /api/memory/gagent/patterns/:id
 * @group G-Agent Memory - G-Agent memory management
 * @param {string} id.path.required - Pattern ID
 * @returns {object} 200 - Pattern details
 * @returns {ApiErrorResponse} 404 - Pattern not found
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.get(
  "/gagent/patterns/:id",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const pattern = gAgentMemoryService.getPattern(id);
      if (!pattern) {
        sendErrorResponse(res, ErrorCode.NOT_FOUND, "Pattern not found");
        return;
      }
      res.json({ pattern });
    } catch (e) {
      logger.warn({ error: (e as Error).message }, "G-Agent pattern get error");
      sendServerError(res, e);
    }
  },
);

/**
 * GET /api/memory/gagent/skills
 *
 * Get all G-Agent skills.
 *
 * @route GET /api/memory/gagent/skills
 * @group G-Agent Memory - G-Agent memory management
 * @returns {object} 200 - All skills
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.get(
  "/gagent/skills",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const skills = gAgentMemoryService.getAllSkills();
      res.json({ skills });
    } catch (e) {
      logger.warn({ error: (e as Error).message }, "G-Agent skills list error");
      sendServerError(res, e);
    }
  },
);

/**
 * GET /api/memory/gagent/skills/search
 *
 * Search skills by query.
 *
 * @route GET /api/memory/gagent/skills/search
 * @group G-Agent Memory - G-Agent memory management
 * @param {string} q.query.required - Search query
 * @param {string} [limit.query] - Maximum results (default: 5)
 * @returns {object} 200 - Matching skills
 * @returns {ApiErrorResponse} 400 - Validation error
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.get(
  "/gagent/skills/search",
  async (req: Request, res: Response): Promise<void> => {
    const parseResult = searchQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        firstError?.message ?? "Invalid request",
        {
          field: firstError?.path?.join("."),
        },
      );
      return;
    }

    try {
      const { q, limit } = parseResult.data;
      const skills = await gAgentMemoryService.findSkills(
        q.trim(),
        limit ? parseInt(limit, 10) : 5,
      );
      res.json({ skills });
    } catch (e) {
      logger.warn(
        { error: (e as Error).message },
        "G-Agent skills search error",
      );
      sendServerError(res, e);
    }
  },
);

/**
 * GET /api/memory/gagent/lexicon
 *
 * Get all G-Agent lexicon entries.
 *
 * @route GET /api/memory/gagent/lexicon
 * @group G-Agent Memory - G-Agent memory management
 * @returns {object} 200 - All lexicon entries
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.get(
  "/gagent/lexicon",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const entries = gAgentMemoryService.getAllLexiconEntries();
      res.json({ entries });
    } catch (e) {
      logger.warn(
        { error: (e as Error).message },
        "G-Agent lexicon list error",
      );
      sendServerError(res, e);
    }
  },
);

/**
 * GET /api/memory/gagent/lexicon/search
 *
 * Search lexicon by query.
 *
 * @route GET /api/memory/gagent/lexicon/search
 * @group G-Agent Memory - G-Agent memory management
 * @param {string} q.query.required - Search query
 * @param {string} [limit.query] - Maximum results (default: 10)
 * @returns {object} 200 - Matching lexicon entries
 * @returns {ApiErrorResponse} 400 - Validation error
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.get(
  "/gagent/lexicon/search",
  async (req: Request, res: Response): Promise<void> => {
    const parseResult = searchQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        firstError?.message ?? "Invalid request",
        {
          field: firstError?.path?.join("."),
        },
      );
      return;
    }

    try {
      const { q, limit } = parseResult.data;
      const entries = await gAgentMemoryService.searchLexicon(
        q.trim(),
        limit ? parseInt(limit, 10) : 10,
      );
      res.json({ entries });
    } catch (e) {
      logger.warn(
        { error: (e as Error).message },
        "G-Agent lexicon search error",
      );
      sendServerError(res, e);
    }
  },
);

/**
 * GET /api/memory/gagent/lexicon/:term
 *
 * Get a specific lexicon entry by term.
 *
 * @route GET /api/memory/gagent/lexicon/:term
 * @group G-Agent Memory - G-Agent memory management
 * @param {string} term.path.required - Lexicon term
 * @returns {object} 200 - Lexicon entry details
 * @returns {ApiErrorResponse} 404 - Term not found
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.get(
  "/gagent/lexicon/:term",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const term = req.params.term as string;
      const entry = gAgentMemoryService.getLexiconEntry(term);
      if (!entry) {
        sendErrorResponse(res, ErrorCode.NOT_FOUND, "Term not found");
        return;
      }
      res.json({ entry });
    } catch (e) {
      logger.warn({ error: (e as Error).message }, "G-Agent lexicon get error");
      sendServerError(res, e);
    }
  },
);

/**
 * POST /api/memory/gagent/lexicon
 *
 * Add a new lexicon entry.
 *
 * @route POST /api/memory/gagent/lexicon
 * @group G-Agent Memory - G-Agent memory management
 * @param {object} req.body - Lexicon entry data
 * @param {string} req.body.term - The term to define
 * @param {string} req.body.definition - Definition of the term
 * @param {string} req.body.category - Category for the term
 * @param {string[]} [req.body.aliases] - Alternative names for the term
 * @param {string[]} [req.body.relatedTerms] - Related terms
 * @param {string[]} [req.body.examples] - Usage examples
 * @param {string} [req.body.source] - Source of the definition
 * @returns {object} 201 - Created lexicon entry
 * @returns {ApiErrorResponse} 400 - Validation error
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.post(
  "/gagent/lexicon",
  async (req: Request, res: Response): Promise<void> => {
    const parseResult = lexiconEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        firstError?.message ?? "Invalid request",
        {
          field: firstError?.path?.join("."),
        },
      );
      return;
    }

    try {
      const {
        term,
        definition,
        category,
        aliases,
        relatedTerms,
        examples,
        source,
      } = parseResult.data;
      const entry = await gAgentMemoryService.addLexiconEntry({
        term,
        definition,
        category,
        aliases: aliases ?? [],
        relatedTerms: relatedTerms ?? [],
        examples: examples ?? [],
        source: source ?? "user",
      });
      res.status(201).json({ entry });
    } catch (e) {
      logger.warn({ error: (e as Error).message }, "G-Agent lexicon add error");
      sendServerError(res, e);
    }
  },
);

/**
 * GET /api/memory/gagent/context/:workspaceRoot
 *
 * Get project context by workspace root (URL-encoded).
 *
 * @route GET /api/memory/gagent/context/:workspaceRoot
 * @group G-Agent Memory - G-Agent memory management
 * @param {string} workspaceRoot.path.required - URL-encoded workspace root path
 * @returns {object} 200 - Project context
 * @returns {ApiErrorResponse} 404 - Project context not found
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.get(
  "/gagent/context/:workspaceRoot",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const workspaceRoot = decodeURIComponent(
        req.params.workspaceRoot as string,
      );
      const context =
        await gAgentMemoryService.getProjectContext(workspaceRoot);
      if (!context) {
        sendErrorResponse(
          res,
          ErrorCode.NOT_FOUND,
          "Project context not found",
        );
        return;
      }
      res.json({ context });
    } catch (e) {
      logger.warn({ error: (e as Error).message }, "G-Agent context get error");
      sendServerError(res, e);
    }
  },
);

/**
 * POST /api/memory/gagent/context
 *
 * Set or update project context.
 *
 * @route POST /api/memory/gagent/context
 * @group G-Agent Memory - G-Agent memory management
 * @param {object} req.body - Project context data
 * @param {string} req.body.workspaceRoot - Workspace root path
 * @param {string} req.body.name - Project name
 * @param {string} req.body.type - Project type
 * @param {string[]} req.body.techStack - Technology stack
 * @param {string} req.body.architecture - Architecture description
 * @param {Array} [req.body.conventions] - Coding conventions
 * @param {Array} [req.body.files] - Important files
 * @param {string[]} [req.body.dependencies] - Project dependencies
 * @returns {object} 201 - Created/updated project context
 * @returns {ApiErrorResponse} 400 - Validation error
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.post(
  "/gagent/context",
  async (req: Request, res: Response): Promise<void> => {
    const parseResult = projectContextSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        firstError?.message ?? "Invalid request",
        {
          field: firstError?.path?.join("."),
        },
      );
      return;
    }

    try {
      const {
        workspaceRoot,
        name,
        type,
        techStack,
        architecture,
        conventions,
        files,
        dependencies,
      } = parseResult.data;

      const context = await gAgentMemoryService.setProjectContext({
        workspaceRoot,
        name,
        type,
        techStack,
        architecture,
        conventions: conventions ?? [],
        files: files ?? [],
        dependencies: dependencies ?? [],
        lastAnalyzedAt: new Date().toISOString(),
      });

      res.status(201).json({ context });
    } catch (e) {
      logger.warn({ error: (e as Error).message }, "G-Agent context set error");
      sendServerError(res, e);
    }
  },
);

/**
 * POST /api/memory/gagent/search
 *
 * Unified search across all G-Agent memory categories.
 *
 * @route POST /api/memory/gagent/search
 * @group G-Agent Memory - G-Agent memory management
 * @param {object} req.body - Search request
 * @param {string} req.body.query - Search query
 * @param {string[]} [req.body.categories] - Categories to search (patterns, skills, lexicon, projectContext)
 * @param {number} [req.body.limit] - Maximum results per category
 * @returns {object} 200 - Search results from all categories
 * @returns {ApiErrorResponse} 400 - Validation error
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.post(
  "/gagent/search",
  async (req: Request, res: Response): Promise<void> => {
    const parseResult = gAgentSearchSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        firstError?.message ?? "Invalid request",
        {
          field: firstError?.path?.join("."),
        },
      );
      return;
    }

    try {
      const { query, categories, limit } = parseResult.data;
      const results = await gAgentMemoryService.search(query.trim(), {
        categories: categories as MemoryCategory[],
        limit,
      });
      res.json(results);
    } catch (e) {
      logger.warn({ error: (e as Error).message }, "G-Agent search error");
      sendServerError(res, e);
    }
  },
);

export default router;
