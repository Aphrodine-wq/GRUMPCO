/**
 * Scheduled agents API: create, list, cancel cron-based SHIP/codegen/chat runs.
 * Swarm API: POST /api/agents/swarm – Kimi-orchestrated multi-agent task decomposition and execution.
 */

import { Router, Request, Response } from 'express';
import { getRequestLogger } from '../middleware/logger.js';
import {
  listAllScheduledAgents,
  createScheduledAgent,
  cancelScheduledAgent,
  getScheduledAgent,
  type ScheduledAction,
} from '../services/scheduledAgentsService.js';
import { runSwarm } from '../services/swarmService.js';

const router = Router();
const log = getRequestLogger();

/**
 * POST /api/agents/swarm
 * Body: { prompt: string, workspaceRoot?: string }
 * Streams SSE: decompose_start, decompose_done, agent_start, agent_done, summary_start, summary_done, error.
 */
router.post('/swarm', async (req: Request, res: Response): Promise<void> => {
  const { prompt, workspaceRoot } = req.body as { prompt?: string; workspaceRoot?: string };
  if (typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'prompt is required and must be a non-empty string' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const swarm = runSwarm(prompt.trim(), { workspaceRoot: typeof workspaceRoot === 'string' ? workspaceRoot : undefined });
    for await (const event of swarm) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.write('data: {"type":"done"}\n\n');
    res.end();
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Swarm error');
    res.write(`data: ${JSON.stringify({ type: 'error', message: (error as Error).message })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/agents/schedule
 * Body: { name: string, cronExpression: string, action: 'ship' | 'codegen' | 'chat', params?: object }
 */
router.post('/schedule', async (req: Request, res: Response): Promise<void> => {
  try {
    const name = (req.body.name as string)?.trim();
    const cronExpression = (req.body.cronExpression as string)?.trim();
    const action = (req.body.action as ScheduledAction) || 'ship';
    const params = (req.body.params as Record<string, unknown>) ?? {};

    if (!name || !cronExpression) {
      res.status(400).json({ error: 'name and cronExpression are required' });
      return;
    }
    if (!['ship', 'codegen', 'chat'].includes(action)) {
      res.status(400).json({ error: 'action must be ship, codegen, or chat' });
      return;
    }
    if (action === 'ship' && typeof (params as { projectDescription?: string }).projectDescription !== 'string') {
      res.status(400).json({ error: 'params.projectDescription is required for action ship' });
      return;
    }

    const agent = await createScheduledAgent(name, cronExpression, action, params as { projectDescription?: string; preferences?: Record<string, unknown> });
    log.info({ id: agent.id, name, action }, 'Scheduled agent created');
    res.status(201).json(agent);
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Failed to create scheduled agent');
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/agents/scheduled
 */
router.get('/scheduled', async (_req: Request, res: Response): Promise<void> => {
  try {
    const agents = await listAllScheduledAgents();
    res.json(agents);
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Failed to list scheduled agents');
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/agents/scheduled/:id
 */
router.delete('/scheduled/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const ok = await cancelScheduledAgent(id);
    if (!ok) {
      res.status(404).json({ error: 'Scheduled agent not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Failed to cancel scheduled agent');
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/agents/scheduled/:id
 */
router.get('/scheduled/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const agent = await getScheduledAgent(id);
    if (!agent) {
      res.status(404).json({ error: 'Scheduled agent not found' });
      return;
    }
    res.json(agent);
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Failed to get scheduled agent');
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
