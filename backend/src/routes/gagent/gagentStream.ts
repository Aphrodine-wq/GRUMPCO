/**
 * G-Agent Stream / Status / Feedback Sub-Router
 *
 * SSE event streaming, comprehensive status endpoint, and generation feedback.
 *
 * @module routes/gagent/gagentStream
 */

import { Router, type Request, type Response } from 'express';
import { gAgentGoalQueue } from '../../services/agents/gAgentGoalQueue.js';
import {
  budgetManager,
  killSwitch,
  configManager,
  FEATURES,
  messageBus,
  CHANNELS,
  getSemanticCompiler,
} from '../../gAgent/index.js';
import logger from '../../middleware/logger.js';

const router = Router();

// ============================================================================
// SSE (SERVER-SENT EVENTS) STREAMING
// ============================================================================

/** GET /stream — Real-time event streaming via SSE */
router.get('/stream', (req: Request, res: Response) => {
  const sessionId = (req.query.sessionId as string) || 'default';
  const userId = (req as Request & { userId?: string }).userId || 'default';

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no',
  });

  // Send initial connection event
  res.write(
    `event: connected\ndata: ${JSON.stringify({
      sessionId,
      userId,
      timestamp: new Date().toISOString(),
    })}\n\n`
  );

  // Keep-alive ping every 30 seconds
  const pingInterval = setInterval(() => {
    res.write(`:ping ${Date.now()}\n\n`);
  }, 30000);

  // Track subscription IDs for cleanup
  const subscriptionIds: string[] = [];

  // Event handlers that write to SSE
  const writeEvent = (eventName: string) => (data: unknown) => {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Subscribe to message bus channels
  subscriptionIds.push(messageBus.subscribe(CHANNELS.AGENT_SPAWN, writeEvent('agent_spawned')));
  subscriptionIds.push(messageBus.subscribe(CHANNELS.AGENT_STATUS, writeEvent('agent_status')));
  subscriptionIds.push(messageBus.subscribe(CHANNELS.AGENT_RESULT, writeEvent('agent_result')));
  subscriptionIds.push(messageBus.subscribe(CHANNELS.TASK_PROGRESS, writeEvent('task_progress')));
  subscriptionIds.push(messageBus.subscribe(CHANNELS.TASK_COMPLETE, writeEvent('task_complete')));
  subscriptionIds.push(messageBus.subscribe(CHANNELS.TASK_FAILED, writeEvent('task_failed')));
  subscriptionIds.push(messageBus.subscribe(CHANNELS.GOAL_CREATED, writeEvent('goal_created')));
  subscriptionIds.push(messageBus.subscribe(CHANNELS.GOAL_UPDATED, writeEvent('goal_updated')));
  subscriptionIds.push(messageBus.subscribe(CHANNELS.GOAL_COMPLETED, writeEvent('goal_completed')));
  subscriptionIds.push(messageBus.subscribe(CHANNELS.BROADCAST, writeEvent('broadcast')));
  subscriptionIds.push(messageBus.subscribe(CHANNELS.SYSTEM_ERROR, writeEvent('system_error')));

  // Subscribe to budget events (EventEmitter style)
  const budgetWarningHandler = writeEvent('budget_warning');
  const budgetCriticalHandler = writeEvent('budget_critical');
  const approvalRequiredHandler = writeEvent('approval_required');
  budgetManager.on('budget_warning', budgetWarningHandler);
  budgetManager.on('budget_critical', budgetCriticalHandler);
  budgetManager.on('approval_required', approvalRequiredHandler);

  // Subscribe to kill switch events
  const emergencyStopHandler = writeEvent('emergency_stop');
  const operationsResumedHandler = writeEvent('operations_resumed');
  killSwitch.on('stop', emergencyStopHandler);
  killSwitch.on('resume', operationsResumedHandler);

  // Cleanup on connection close
  req.on('close', () => {
    clearInterval(pingInterval);

    for (const subId of subscriptionIds) {
      messageBus.unsubscribe(subId);
    }

    budgetManager.off('budget_warning', budgetWarningHandler);
    budgetManager.off('budget_critical', budgetCriticalHandler);
    budgetManager.off('approval_required', approvalRequiredHandler);

    killSwitch.off('stop', emergencyStopHandler);
    killSwitch.off('resume', operationsResumedHandler);

    logger.debug({ sessionId, userId }, 'SSE connection closed');
  });

  logger.debug({ sessionId, userId }, 'SSE connection established');
});

// ============================================================================
// COMPREHENSIVE STATUS ENDPOINT
// ============================================================================

/** GET /status — Comprehensive G-Agent system status */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId || 'default';
    const sessionId = (req.query.sessionId as string) || 'default';

    const queueStats = gAgentGoalQueue.getQueueStats(userId);
    const budgetStatus = budgetManager.getBudgetStatus(sessionId);
    const killSwitchStatus = killSwitch.getGlobalStopInfo();
    const config = configManager.getConfig();

    let compilerStats = null;
    try {
      const compiler = getSemanticCompiler(sessionId);
      compilerStats = compiler.getStats();
    } catch {
      // Compiler not initialized for this session
    }

    return res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      queue: queueStats,
      budget: budgetStatus,
      control: {
        globalStopActive: killSwitchStatus.active,
        ...killSwitchStatus,
      },
      config: {
        autonomyLevel: config.autonomyLevel,
        environment: config.environment,
      },
      capabilities: {
        goalQueue: configManager.isFeatureEnabled(FEATURES.GOAL_QUEUE),
        agentLightning: configManager.isFeatureEnabled(FEATURES.AGENT_LIGHTNING),
        selfHealing: configManager.isFeatureEnabled(FEATURES.SELF_HEALING),
        patternLearning: configManager.isFeatureEnabled(FEATURES.PATTERN_LEARNING),
        confidenceRouting: configManager.isFeatureEnabled(FEATURES.CONFIDENCE_ROUTING),
        multiAgentSwarm: configManager.isFeatureEnabled(FEATURES.MULTI_AGENT_SWARM),
      },
      compiler: compilerStats,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to get G-Agent status');
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// GENERATION FEEDBACK
// ============================================================================

/** POST /feedback — Store thumbs up/down on a generation result */
router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const { goalId, requestId, messageId, rating, comment } = req.body as {
      goalId?: string;
      requestId?: string;
      messageId?: string;
      rating?: 'up' | 'down';
      comment?: string;
    };
    if (!rating || (rating !== 'up' && rating !== 'down')) {
      return res.status(400).json({ error: 'rating is required and must be "up" or "down"' });
    }
    const fs = await import('fs');
    const path = await import('path');
    const dataDir = path.join(process.cwd(), 'data');
    const feedbackPath = path.join(dataDir, 'generation-feedback.json');
    const entry = {
      timestamp: new Date().toISOString(),
      goalId: goalId ?? null,
      requestId: requestId ?? null,
      messageId: messageId ?? null,
      rating,
      comment: comment ?? null,
    };
    try {
      await fs.promises.mkdir(dataDir, { recursive: true });
      let list: unknown[] = [];
      if (fs.existsSync(feedbackPath)) {
        const raw = await fs.promises.readFile(feedbackPath, 'utf-8');
        try {
          list = JSON.parse(raw) as unknown[];
        } catch {
          list = [];
        }
      }
      list.push(entry);
      await fs.promises.writeFile(feedbackPath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (fileErr) {
      logger.warn({ err: (fileErr as Error).message }, 'Could not persist generation feedback');
    }
    logger.info(
      { messageId: messageId ?? goalId ?? requestId, rating },
      'Generation feedback recorded'
    );
    return res.json({ success: true, message: 'Feedback recorded' });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Generation feedback failed');
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
