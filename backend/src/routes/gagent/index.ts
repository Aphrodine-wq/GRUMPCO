/**
 * G-Agent Routes — Barrel Index
 *
 * Composes all G-Agent sub-routers into a single unified router.
 * Each sub-router handles a specific domain:
 *
 *  - Goals:    Goal CRUD, recurring goals, queue, follow-ups
 *  - Budget:   Budget status, config, cost estimation, sessions
 *  - Control:  Kill switch / emergency stop
 *  - Config:   Configuration, feature flags, presets, autonomy
 *  - Stream:   SSE streaming, comprehensive status, generation feedback
 *  - Compiler: Semantic compiler, prefetch, multi-modal, cache
 *  - Dedup:    Semantic deduplication
 *  - Learning: Real-time learning / feedback-based refinement
 *
 * @module routes/gagent
 */

import { Router } from 'express';
import goalsRouter from './gagentGoals.js';
import budgetRouter from './gagentBudget.js';
import controlRouter from './gagentControl.js';

import configRouter from './gagentConfig.js';
import streamRouter from './gagentStream.js';
import compilerRouter from './gagentCompiler.js';
import dedupRouter from './gagentDedup.js';
import learningRouter from './gagentLearning.js';

const router = Router();

// Mount all sub-routers (no prefix — paths are defined in each sub-router)
router.use(goalsRouter);
router.use(budgetRouter);
router.use(controlRouter);

router.use(configRouter);
router.use(streamRouter);
router.use(compilerRouter);
router.use(dedupRouter);
router.use(learningRouter);

export default router;
