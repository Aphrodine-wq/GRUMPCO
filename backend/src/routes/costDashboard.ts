/**
 * Cost Dashboard Routes
 * API endpoints for cost analytics and optimization
 */

import { Router, type Request, type Response } from 'express';
import { getCostAnalytics } from '../services/ai-providers/costAnalytics.js';
import { getCostOptimizer } from '../services/ai-providers/costOptimizer.js';
import { getTieredCache } from '../services/caching/tieredCache.js';
import { getWorkerPool } from '../services/infra/workerPool.js';
import { getNIMAccelerator } from '../services/ai-providers/nimAccelerator.js';
import logger from '../middleware/logger.js';

const router = Router();

/**
 * GET /api/cost/snippet
 * Lightweight cost for UI snippet: today's total and request count.
 */
router.get('/snippet', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'default';
    const analytics = getCostAnalytics();
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const summary = await analytics.getCostSummary(userId, start, now);
    res.json({
      success: true,
      todayUsd: summary.totalCost,
      requestCount: summary.totalRequests,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to get cost snippet'
    );
    // Return 200 with zeros so UI does not break when DB/analytics not ready
    res.json({
      success: true,
      todayUsd: 0,
      requestCount: 0,
    });
  }
});

/**
 * GET /api/cost/summary
 * Get cost summary for a user
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'default';
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const analytics = getCostAnalytics();
    const summary = await analytics.getCostSummary(userId, startDate, endDate);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to get cost summary'
    );
    res.status(500).json({
      success: false,
      error: 'Failed to get cost summary',
    });
  }
});

/**
 * GET /api/cost/budget
 * Get budget status for a user
 */
router.get('/budget', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'default';

    const analytics = getCostAnalytics();
    const budget = await analytics.checkBudget(userId);

    res.json({
      success: true,
      data: budget,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to get budget status'
    );
    res.status(500).json({
      success: false,
      error: 'Failed to get budget status',
    });
  }
});

/**
 * POST /api/cost/budget
 * Set budget for a user
 */
router.post('/budget', async (req: Request, res: Response) => {
  try {
    const { userId, dailyLimitUsd, monthlyLimitUsd, alertThresholdPercent } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'userId is required',
      });
      return;
    }

    const analytics = getCostAnalytics();
    analytics.setBudget({
      userId,
      dailyLimitUsd,
      monthlyLimitUsd,
      alertThresholdPercent: alertThresholdPercent || 80,
    });

    res.json({
      success: true,
      message: 'Budget set successfully',
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to set budget'
    );
    res.status(500).json({
      success: false,
      error: 'Failed to set budget',
    });
  }
});

/**
 * GET /api/cost/recommendations
 * Get cost optimization recommendations
 */
router.get('/recommendations', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'default';

    const analytics = getCostAnalytics();
    const recommendations = await analytics.getRecommendations(userId);

    res.json({
      success: true,
      data: {
        recommendations,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to get recommendations'
    );
    res.status(500).json({
      success: false,
      error: 'Failed to get recommendations',
    });
  }
});

/**
 * GET /api/cost/realtime
 * Get real-time cost metrics
 */
router.get('/realtime', async (req: Request, res: Response) => {
  try {
    const analytics = getCostAnalytics();
    const metrics = analytics.getRealTimeMetrics();

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to get real-time metrics'
    );
    res.status(500).json({
      success: false,
      error: 'Failed to get real-time metrics',
    });
  }
});

/**
 * GET /api/cost/savings
 * Get cost savings from optimizations
 */
router.get('/savings', async (req: Request, res: Response) => {
  try {
    const optimizer = getCostOptimizer();
    const savings = optimizer.getSavings();

    res.json({
      success: true,
      data: savings,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to get savings'
    );
    res.status(500).json({
      success: false,
      error: 'Failed to get savings',
    });
  }
});

/**
 * GET /api/cost/stats
 * Get comprehensive system statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const cache = getTieredCache();
    const cacheStats = cache.getStats();

    const workerPool = getWorkerPool();
    const workerStats = workerPool.getStats();

    const nim = getNIMAccelerator();
    const nimStats = nim ? nim.getStats() : null;
    const gpu = nim ? await nim.getGpuMetrics() : null;

    res.json({
      success: true,
      data: {
        cache: cacheStats,
        workerPool: workerStats,
        nim: nimStats,
        gpu: gpu ?? null,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to get stats'
    );
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
    });
  }
});

export default router;
