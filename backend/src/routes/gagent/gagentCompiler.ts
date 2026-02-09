/**
 * G-Agent Compiler Sub-Router
 *
 * Semantic compiler core, prefetch, multi-modal compilation, and hierarchical cache.
 *
 * @module routes/gagent/gagentCompiler
 */

import { Router, type Request, type Response } from "express";
import {
    getSemanticCompiler,
    destroySemanticCompiler,
    type CompilationRequest,
} from "../../gAgent/index.js";
import logger from "../../middleware/logger.js";

const router = Router();

// ============================================================================
// SEMANTIC COMPILER API (Core)
// ============================================================================

/** POST /compiler/compile — Compile context for a query */
router.post("/compiler/compile", async (req: Request, res: Response) => {
    try {
        const sessionId = (req.query.sessionId as string) || "default";
        const { query, context, constraints, options } = req.body;

        if (!query || typeof query !== "string") {
            return res.status(400).json({ error: "query is required" });
        }

        const compiler = getSemanticCompiler(sessionId);

        const request: CompilationRequest = {
            query,
            context: context || {},
            constraints: {
                maxTokens: constraints?.maxTokens || 8000,
                maxCost: constraints?.maxCost || 100,
                maxLatency: constraints?.maxLatency || 5000,
                qualityThreshold: constraints?.qualityThreshold || 0.3,
            },
            options: {
                speculative: options?.speculative !== false,
                streaming: options?.streaming || false,
                cacheResults: options?.cacheResults !== false,
            },
        };

        const result = await compiler.compile(request);

        logger.info(
            {
                sessionId,
                queryLength: query.length,
                originalTokens: result.stats.originalTokens,
                compiledTokens: result.stats.compiledTokens,
                compressionRatio: result.stats.compressionRatio.toFixed(2),
                unitsIncluded: result.stats.unitsIncluded,
            },
            "Context compiled via 100x compiler",
        );

        return res.json({
            success: true,
            result: {
                id: result.id,
                compiledContext: result.compiledContext,
                stats: result.stats,
                includedUnits: result.includedUnits,
                excludedUnits: result.excludedUnits,
                delta: result.delta,
            },
        });
    } catch (e) {
        logger.error({ error: (e as Error).message }, "Compilation failed");
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** POST /compiler/compile/stream — Progressive streaming compilation */
router.post(
    "/compiler/compile/stream",
    async (req: Request, res: Response): Promise<void> => {
        const sessionId = (req.query.sessionId as string) || "default";
        const { query, context, constraints } = req.body;

        if (!query || typeof query !== "string") {
            res.status(400).json({ error: "query is required" });
            return;
        }

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        });

        try {
            const compiler = getSemanticCompiler(sessionId);

            const request: CompilationRequest = {
                query,
                context: context || {},
                constraints: {
                    maxTokens: constraints?.maxTokens || 8000,
                    maxCost: constraints?.maxCost || 100,
                    maxLatency: constraints?.maxLatency || 10000,
                    qualityThreshold: constraints?.qualityThreshold || 0.3,
                },
                options: {
                    speculative: false,
                    streaming: true,
                    cacheResults: true,
                },
            };

            for await (const state of compiler.compileStream(request)) {
                res.write(`event: level_${state.currentLevel}\n`);
                res.write(
                    `data: ${JSON.stringify({
                        level: state.currentLevel,
                        loadedUnits: state.loadedUnits.size,
                        tokenBudgetUsed: state.tokenBudgetUsed,
                        tokenBudgetRemaining: state.tokenBudgetRemaining,
                        units: Array.from(state.loadedUnits.entries()).map(
                            ([id, unit]) => ({
                                id,
                                type: unit.type,
                                preview:
                                    unit.levels.abstract || unit.levels.summary?.slice(0, 100),
                            }),
                        ),
                    })}\n\n`,
                );
            }

            res.write("event: done\n");
            res.write(`data: ${JSON.stringify({ success: true })}\n\n`);
            res.end();
        } catch (e) {
            res.write("event: error\n");
            res.write(`data: ${JSON.stringify({ error: (e as Error).message })}\n\n`);
            res.end();
        }
    },
);

/** POST /compiler/index/file — Index a file */
router.post("/compiler/index/file", async (req: Request, res: Response) => {
    try {
        const sessionId = (req.query.sessionId as string) || "default";
        const { filePath, content, type, forceReindex } = req.body;

        if (!filePath || typeof filePath !== "string") {
            return res.status(400).json({ error: "filePath is required" });
        }
        if (!content || typeof content !== "string") {
            return res.status(400).json({ error: "content is required" });
        }

        const compiler = getSemanticCompiler(sessionId);
        const units = await compiler.indexFile(filePath, content, {
            type,
            forceReindex: forceReindex || false,
        });

        logger.info(
            { sessionId, filePath, unitCount: units.length },
            "File indexed into semantic compiler",
        );

        return res.json({
            success: true,
            filePath,
            unitsCreated: units.length,
            units: units.map((u) => ({
                id: u.id,
                type: u.type,
                abstract: u.levels.abstract,
                importance: u.meta.importance,
            })),
        });
    } catch (e) {
        logger.error({ error: (e as Error).message }, "File indexing failed");
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** POST /compiler/index/conversation — Index a conversation history */
router.post(
    "/compiler/index/conversation",
    async (req: Request, res: Response) => {
        try {
            const sessionId = (req.query.sessionId as string) || "default";
            const { conversationId, messages } = req.body;

            if (!conversationId || typeof conversationId !== "string") {
                return res.status(400).json({ error: "conversationId is required" });
            }
            if (!Array.isArray(messages)) {
                return res.status(400).json({ error: "messages must be an array" });
            }

            const compiler = getSemanticCompiler(sessionId);
            const units = await compiler.indexConversation(conversationId, messages);

            logger.info(
                {
                    sessionId,
                    conversationId,
                    messageCount: messages.length,
                    unitCount: units.length,
                },
                "Conversation indexed into semantic compiler",
            );

            return res.json({
                success: true,
                conversationId,
                messagesProcessed: messages.length,
                unitsCreated: units.length,
            });
        } catch (e) {
            logger.error(
                { error: (e as Error).message },
                "Conversation indexing failed",
            );
            return res.status(500).json({ error: (e as Error).message });
        }
    },
);

/** GET /compiler/stats — Get compiler statistics */
router.get("/compiler/stats", async (req: Request, res: Response) => {
    try {
        const sessionId = (req.query.sessionId as string) || "default";

        const compiler = getSemanticCompiler(sessionId);
        const stats = compiler.getStats();

        return res.json({
            success: true,
            sessionId,
            stats: {
                ...stats,
                compressionEfficiencyPercent:
                    (stats.compressionEfficiency * 100).toFixed(1) + "%",
                tokensSavedFormatted: stats.tokensSaved.toLocaleString(),
                costSavedFormatted:
                    stats.totalCostSaved < 100
                        ? `${stats.totalCostSaved}¢`
                        : `$${(stats.totalCostSaved / 100).toFixed(2)}`,
            },
        });
    } catch (e) {
        logger.error(
            { error: (e as Error).message },
            "Failed to get compiler stats",
        );
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** POST /compiler/clear — Clear compiler caches */
router.post("/compiler/clear", async (req: Request, res: Response) => {
    try {
        const sessionId = (req.query.sessionId as string) || "default";
        const { caches, index, destroy } = req.body;

        if (destroy) {
            destroySemanticCompiler(sessionId);
            logger.info({ sessionId }, "Semantic compiler destroyed");
            return res.json({ success: true, action: "destroyed" });
        }

        const compiler = getSemanticCompiler(sessionId);

        if (caches !== false) {
            compiler.clearCaches();
        }

        if (index) {
            compiler.clearIndex();
        }

        logger.info({ sessionId, caches, index }, "Compiler cleared");

        return res.json({
            success: true,
            cleared: {
                caches: caches !== false,
                index: !!index,
            },
        });
    } catch (e) {
        logger.error({ error: (e as Error).message }, "Failed to clear compiler");
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** POST /compiler/delta — Compute delta between compilation results */
router.post("/compiler/delta", async (req: Request, res: Response) => {
    try {
        const sessionId = (req.query.sessionId as string) || "default";
        const { previousResult, currentQuery, context, constraints } = req.body;

        if (!currentQuery) {
            return res.status(400).json({ error: "currentQuery is required" });
        }

        const compiler = getSemanticCompiler(sessionId);

        const currentResult = await compiler.compile({
            query: currentQuery,
            context: context || {},
            constraints: constraints || {
                maxTokens: 8000,
                maxCost: 100,
                maxLatency: 5000,
                qualityThreshold: 0.3,
            },
            options: {
                speculative: false,
                streaming: false,
                cacheResults: true,
            },
        });

        const delta = compiler.computeDelta(previousResult || null, currentResult);
        const deltaUpdate = compiler.generateDeltaUpdate(delta);

        return res.json({
            success: true,
            currentResult: {
                id: currentResult.id,
                stats: currentResult.stats,
            },
            delta,
            deltaUpdate,
            fullContext: previousResult ? undefined : currentResult.compiledContext,
        });
    } catch (e) {
        logger.error({ error: (e as Error).message }, "Delta computation failed");
        return res.status(500).json({ error: (e as Error).message });
    }
});

// ============================================================================
// PREDICTIVE PREFETCH API
// ============================================================================

/** GET /compiler/prefetch/metrics — Get prefetch metrics */
router.get(
    "/compiler/prefetch/metrics",
    async (req: Request, res: Response) => {
        try {
            const sessionId = (req.query.sessionId as string) || "default";
            const compiler = getSemanticCompiler(sessionId);
            const metrics = compiler.getPrefetchMetrics();

            return res.json({ success: true, sessionId, metrics });
        } catch (e) {
            logger.error(
                { error: (e as Error).message },
                "Failed to get prefetch metrics",
            );
            return res.status(500).json({ error: (e as Error).message });
        }
    },
);

/** POST /compiler/prefetch/predict — Predict follow-up queries */
router.post(
    "/compiler/prefetch/predict",
    async (req: Request, res: Response) => {
        try {
            const sessionId = (req.query.sessionId as string) || "default";
            const { query } = req.body;

            if (!query || typeof query !== "string") {
                return res.status(400).json({ error: "query is required" });
            }

            const compiler = getSemanticCompiler(sessionId);
            const predictions = await compiler.predictNextQueries(query);

            return res.json({ success: true, query, predictions });
        } catch (e) {
            logger.error(
                { error: (e as Error).message },
                "Failed to predict follow-ups",
            );
            return res.status(500).json({ error: (e as Error).message });
        }
    },
);

/** POST /compiler/prefetch/files — Predict files likely to be accessed next */
router.post("/compiler/prefetch/files", async (req: Request, res: Response) => {
    try {
        const sessionId = (req.query.sessionId as string) || "default";
        const { currentFile } = req.body;

        const compiler = getSemanticCompiler(sessionId);
        const predictions = compiler.predictFilesToAccess(currentFile);

        return res.json({
            success: true,
            currentFile: currentFile || null,
            predictions,
        });
    } catch (e) {
        logger.error({ error: (e as Error).message }, "Failed to predict files");
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** POST /compiler/prefetch/queue — Queue a file for background indexing */
router.post("/compiler/prefetch/queue", async (req: Request, res: Response) => {
    try {
        const sessionId = (req.query.sessionId as string) || "default";
        const { filePath } = req.body;

        if (!filePath || typeof filePath !== "string") {
            return res.status(400).json({ error: "filePath is required" });
        }

        const compiler = getSemanticCompiler(sessionId);
        compiler.queueBackgroundIndex(filePath);

        return res.json({
            success: true,
            message: `Queued ${filePath} for background indexing`,
        });
    } catch (e) {
        logger.error({ error: (e as Error).message }, "Failed to queue file");
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** GET /compiler/prefetch/patterns — Get learned query patterns */
router.get(
    "/compiler/prefetch/patterns",
    async (req: Request, res: Response) => {
        try {
            const sessionId = (req.query.sessionId as string) || "default";
            const compiler = getSemanticCompiler(sessionId);
            const patterns = compiler.getQueryPatterns();

            return res.json({
                success: true,
                sessionId,
                patternCount: patterns.length,
                patterns: patterns.slice(0, 50),
            });
        } catch (e) {
            logger.error({ error: (e as Error).message }, "Failed to get patterns");
            return res.status(500).json({ error: (e as Error).message });
        }
    },
);

/** POST /compiler/prefetch/export — Export prefetch patterns */
router.post(
    "/compiler/prefetch/export",
    async (req: Request, res: Response) => {
        try {
            const sessionId = (req.query.sessionId as string) || "default";
            const compiler = getSemanticCompiler(sessionId);
            const exported = compiler.exportPrefetchPatterns();

            return res.json({
                success: true,
                sessionId,
                data: exported,
                summary: {
                    queryPatterns: exported.queryPatterns.length,
                    filePatterns: exported.filePatterns.length,
                    topicClusters: exported.topicClusters.length,
                },
            });
        } catch (e) {
            logger.error(
                { error: (e as Error).message },
                "Failed to export patterns",
            );
            return res.status(500).json({ error: (e as Error).message });
        }
    },
);

/** POST /compiler/prefetch/import — Import prefetch patterns */
router.post(
    "/compiler/prefetch/import",
    async (req: Request, res: Response) => {
        try {
            const sessionId = (req.query.sessionId as string) || "default";
            const { data } = req.body;

            if (!data) {
                return res.status(400).json({ error: "data is required" });
            }

            const compiler = getSemanticCompiler(sessionId);
            compiler.importPrefetchPatterns(data);

            const metrics = compiler.getPrefetchMetrics();

            return res.json({
                success: true,
                sessionId,
                imported: {
                    queryPatterns: data.queryPatterns?.length || 0,
                    filePatterns: data.filePatterns?.length || 0,
                    topicClusters: data.topicClusters?.length || 0,
                },
                totalPatterns: metrics.totalPatterns,
            });
        } catch (e) {
            logger.error(
                { error: (e as Error).message },
                "Failed to import patterns",
            );
            return res.status(500).json({ error: (e as Error).message });
        }
    },
);

// ============================================================================
// MULTI-MODAL COMPILATION API
// ============================================================================

/** POST /compiler/multimodal/index — Index a file with multi-modal awareness */
router.post(
    "/compiler/multimodal/index",
    async (req: Request, res: Response) => {
        try {
            const sessionId = (req.query.sessionId as string) || "default";
            const { filePath, content, modality, importance } = req.body;

            if (!filePath || typeof filePath !== "string") {
                return res.status(400).json({ error: "filePath is required" });
            }
            if (!content || typeof content !== "string") {
                return res.status(400).json({ error: "content is required" });
            }

            const compiler = getSemanticCompiler(sessionId);
            const result = compiler.indexMultiModal(filePath, content, {
                modality,
                importance,
            });

            logger.info(
                {
                    sessionId,
                    filePath,
                    modality: result.modality,
                    crossRefs: result.crossRefs,
                },
                "File indexed with multi-modal awareness",
            );

            return res.json({ success: true, ...result });
        } catch (e) {
            logger.error(
                { error: (e as Error).message },
                "Multi-modal indexing failed",
            );
            return res.status(500).json({ error: (e as Error).message });
        }
    },
);

/** POST /compiler/multimodal/compile — Compile multi-modal context */
router.post(
    "/compiler/multimodal/compile",
    async (req: Request, res: Response) => {
        try {
            const sessionId = (req.query.sessionId as string) || "default";
            const {
                query,
                intent,
                modalities,
                maxTokens,
                includeCrossRefs,
                balanceModalities,
            } = req.body;

            if (!query || typeof query !== "string") {
                return res.status(400).json({ error: "query is required" });
            }

            const compiler = getSemanticCompiler(sessionId);
            const result = compiler.compileMultiModal({
                query,
                intent,
                modalities,
                maxTokens: maxTokens || 8000,
                includeCrossRefs: includeCrossRefs !== false,
                balanceModalities: balanceModalities !== false,
            });

            logger.info(
                {
                    sessionId,
                    queryLength: query.length,
                    intent: intent || "inferred",
                    totalUnits: result.stats.totalUnits,
                    totalTokens: result.stats.totalTokens,
                    modalitiesIncluded: result.stats.modalitiesIncluded,
                    crossRefsFound: result.stats.crossRefsFound,
                },
                "Multi-modal context compiled",
            );

            return res.json({ success: true, result });
        } catch (e) {
            logger.error(
                { error: (e as Error).message },
                "Multi-modal compilation failed",
            );
            return res.status(500).json({ error: (e as Error).message });
        }
    },
);

/** GET /compiler/multimodal/units — Get indexed units by modality */
router.get(
    "/compiler/multimodal/units",
    async (req: Request, res: Response) => {
        try {
            const sessionId = (req.query.sessionId as string) || "default";
            const modality = req.query.modality as string | undefined;

            const compiler = getSemanticCompiler(sessionId);

            let units;
            if (modality) {
                units = compiler.getUnitsByModality(
                    modality as Parameters<typeof compiler.getUnitsByModality>[0],
                );
            } else {
                const allModalities = [
                    "code",
                    "test",
                    "docs",
                    "config",
                    "types",
                    "api",
                    "data",
                    "style",
                    "unknown",
                ];
                units = allModalities.flatMap((m) =>
                    compiler.getUnitsByModality(
                        m as Parameters<typeof compiler.getUnitsByModality>[0],
                    ),
                );
            }

            return res.json({
                success: true,
                sessionId,
                modality: modality || "all",
                unitCount: units.length,
                units: units.map((u) => ({
                    id: u.id,
                    filePath: u.filePath,
                    modality: u.modality,
                    abstract: u.content.abstract,
                    tokenCount: u.meta.tokenCount,
                    importance: u.meta.importance,
                    crossRefCount: u.crossRefs.length,
                })),
            });
        } catch (e) {
            logger.error({ error: (e as Error).message }, "Failed to get units");
            return res.status(500).json({ error: (e as Error).message });
        }
    },
);

/** GET /compiler/multimodal/crossrefs/:unitId — Get cross-references */
router.get(
    "/compiler/multimodal/crossrefs/:unitId",
    async (req: Request, res: Response) => {
        try {
            const sessionId = (req.query.sessionId as string) || "default";
            const unitId = req.params.unitId as string;

            const compiler = getSemanticCompiler(sessionId);
            const crossRefs = compiler.getCrossReferences(unitId);

            return res.json({ success: true, unitId, crossRefs });
        } catch (e) {
            logger.error(
                { error: (e as Error).message },
                "Failed to get cross-references",
            );
            return res.status(500).json({ error: (e as Error).message });
        }
    },
);

/** POST /compiler/multimodal/detect — Detect content modality */
router.post(
    "/compiler/multimodal/detect",
    async (req: Request, res: Response) => {
        try {
            const sessionId = (req.query.sessionId as string) || "default";
            const { filePath, content } = req.body;

            if (!filePath || typeof filePath !== "string") {
                return res.status(400).json({ error: "filePath is required" });
            }

            const compiler = getSemanticCompiler(sessionId);
            const modality = compiler.detectModality(filePath, content);

            return res.json({ success: true, filePath, modality });
        } catch (e) {
            logger.error(
                { error: (e as Error).message },
                "Failed to detect modality",
            );
            return res.status(500).json({ error: (e as Error).message });
        }
    },
);

/** GET /compiler/multimodal/metrics — Get multi-modal metrics */
router.get(
    "/compiler/multimodal/metrics",
    async (req: Request, res: Response) => {
        try {
            const sessionId = (req.query.sessionId as string) || "default";
            const compiler = getSemanticCompiler(sessionId);
            const metrics = compiler.getMultiModalMetrics();

            return res.json({ success: true, sessionId, metrics });
        } catch (e) {
            logger.error(
                { error: (e as Error).message },
                "Failed to get multi-modal metrics",
            );
            return res.status(500).json({ error: (e as Error).message });
        }
    },
);

// ============================================================================
// HIERARCHICAL CACHE API
// ============================================================================

/** GET /compiler/cache/metrics — Get cache metrics for all tiers */
router.get("/compiler/cache/metrics", async (req: Request, res: Response) => {
    try {
        const sessionId = (req.query.sessionId as string) || "default";
        const compiler = getSemanticCompiler(sessionId);
        const metrics = compiler.getHierarchicalCacheMetrics();

        return res.json({ success: true, sessionId, metrics });
    } catch (e) {
        logger.error(
            { error: (e as Error).message },
            "Failed to get cache metrics",
        );
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** POST /compiler/cache/get — Get cached value by key */
router.post("/compiler/cache/get", async (req: Request, res: Response) => {
    try {
        const sessionId = (req.query.sessionId as string) || "default";
        const { key, namespace } = req.body;

        if (!key || typeof key !== "string") {
            return res.status(400).json({ error: "key is required" });
        }

        const compiler = getSemanticCompiler(sessionId);
        const value = await compiler.getCached(key, namespace || "compilation");

        return res.json({
            success: true,
            key,
            namespace: namespace || "compilation",
            found: value !== undefined,
            value,
        });
    } catch (e) {
        logger.error({ error: (e as Error).message }, "Cache get failed");
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** POST /compiler/cache/set — Set cached value with tier preference */
router.post("/compiler/cache/set", async (req: Request, res: Response) => {
    try {
        const sessionId = (req.query.sessionId as string) || "default";
        const { key, value, namespace, ttl, importance, tier } = req.body;

        if (!key || typeof key !== "string") {
            return res.status(400).json({ error: "key is required" });
        }

        if (value === undefined) {
            return res.status(400).json({ error: "value is required" });
        }

        const compiler = getSemanticCompiler(sessionId);
        await compiler.setCached(key, value, {
            namespace: namespace || "compilation",
            ttl,
            importance,
            tier: tier || "l2",
        });

        logger.debug(
            {
                sessionId,
                key,
                namespace: namespace || "compilation",
                tier: tier || "l2",
            },
            "Cache value set",
        );

        return res.json({
            success: true,
            key,
            namespace: namespace || "compilation",
            tier: tier || "l2",
        });
    } catch (e) {
        logger.error({ error: (e as Error).message }, "Cache set failed");
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** DELETE /compiler/cache/delete — Delete cached value from all tiers */
router.delete("/compiler/cache/delete", async (req: Request, res: Response) => {
    try {
        const sessionId = (req.query.sessionId as string) || "default";
        const key = req.query.key as string;
        const namespace = (req.query.namespace as string) || "compilation";

        if (!key) {
            return res.status(400).json({ error: "key query parameter is required" });
        }

        const compiler = getSemanticCompiler(sessionId);
        const deleted = await compiler.deleteCached(key, namespace);

        return res.json({ success: true, key, namespace, deleted });
    } catch (e) {
        logger.error({ error: (e as Error).message }, "Cache delete failed");
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** POST /compiler/cache/clear — Clear cache by tier or namespace */
router.post("/compiler/cache/clear", async (req: Request, res: Response) => {
    try {
        const sessionId = (req.query.sessionId as string) || "default";
        const { l1, l2, l3, namespace } = req.body;

        const compiler = getSemanticCompiler(sessionId);

        if (namespace) {
            const cleared = await compiler.clearCacheNamespace(namespace);
            logger.info({ sessionId, namespace, cleared }, "Cache namespace cleared");
            return res.json({ success: true, namespace, cleared });
        }

        await compiler.clearHierarchicalCache({ l1, l2, l3 });

        logger.info({ sessionId, l1, l2, l3 }, "Cache tiers cleared");

        return res.json({
            success: true,
            cleared: { l1: !!l1, l2: !!l2, l3: !!l3 },
        });
    } catch (e) {
        logger.error({ error: (e as Error).message }, "Cache clear failed");
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** POST /compiler/cache/warm — Warm L2 cache from persistent L3 */
router.post("/compiler/cache/warm", async (req: Request, res: Response) => {
    try {
        const sessionId = (req.query.sessionId as string) || "default";
        const { limit } = req.body;

        const compiler = getSemanticCompiler(sessionId);
        const warmed = await compiler.warmCacheFromPersistent(limit || 100);

        logger.info({ sessionId, warmed }, "Cache warmed from persistent");

        return res.json({
            success: true,
            warmed,
            message: `Warmed ${warmed} entries from L3 to L2`,
        });
    } catch (e) {
        logger.error({ error: (e as Error).message }, "Cache warm failed");
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** POST /compiler/cache/preload — Preload entries into cache */
router.post("/compiler/cache/preload", async (req: Request, res: Response) => {
    try {
        const sessionId = (req.query.sessionId as string) || "default";
        const { entries } = req.body;

        if (!entries || !Array.isArray(entries)) {
            return res.status(400).json({ error: "entries array is required" });
        }

        const compiler = getSemanticCompiler(sessionId);
        await compiler.preloadCache(entries);

        logger.info({ sessionId, count: entries.length }, "Cache preloaded");

        return res.json({ success: true, preloaded: entries.length });
    } catch (e) {
        logger.error({ error: (e as Error).message }, "Cache preload failed");
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** GET /compiler/cache/namespace/:namespace — Get entries by namespace */
router.get(
    "/compiler/cache/namespace/:namespace",
    async (req: Request, res: Response) => {
        try {
            const sessionId = (req.query.sessionId as string) || "default";
            const namespace = req.params.namespace as string;

            const compiler = getSemanticCompiler(sessionId);
            const entries = await compiler.getCacheEntriesByNamespace(namespace);

            return res.json({
                success: true,
                namespace,
                entries: entries.map((e) => ({
                    key: e.key,
                    size: e.size,
                    accessCount: e.accessCount,
                    lastAccessedAt: new Date(e.lastAccessedAt).toISOString(),
                    importance: e.importance,
                })),
                count: entries.length,
            });
        } catch (e) {
            logger.error(
                { error: (e as Error).message },
                "Failed to get cache namespace",
            );
            return res.status(500).json({ error: (e as Error).message });
        }
    },
);

/** POST /compiler/cache/shutdown — Shutdown cache (persist all data) */
router.post("/compiler/cache/shutdown", async (req: Request, res: Response) => {
    try {
        const sessionId = (req.query.sessionId as string) || "default";

        const compiler = getSemanticCompiler(sessionId);
        await compiler.shutdownHierarchicalCache();

        logger.info({ sessionId }, "Hierarchical cache shutdown complete");

        return res.json({
            success: true,
            message: "Cache shutdown complete, all data persisted",
        });
    } catch (e) {
        logger.error({ error: (e as Error).message }, "Cache shutdown failed");
        return res.status(500).json({ error: (e as Error).message });
    }
});

export default router;
