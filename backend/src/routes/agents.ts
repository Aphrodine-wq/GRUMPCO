/**
 * Agents API Routes
 *
 * Provides endpoints for scheduled agents and swarm orchestration.
 *
 * ## Scheduled Agents
 * - Create, list, get, and cancel cron-based SHIP/codegen/chat runs
 * - Agents execute on a cron schedule with specified parameters
 *
 * ## Swarm API
 * - Kimi-orchestrated multi-agent task decomposition and execution
 * - Streams SSE events for real-time progress updates
 *
 * @module routes/agents
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getRequestLogger } from '../middleware/logger.js';
import {
  listAllScheduledAgents,
  createScheduledAgent,
  cancelScheduledAgent,
  getScheduledAgent,
} from '../services/agents/scheduledAgentsService.js';
import { runSwarm } from '../services/agents/swarmService.js';
import {
  sendErrorResponse,
  sendServerError,
  ErrorCode,
  getClientSSEErrorMessage,
} from '../utils/errorResponse.js';

const router = Router();
const log = getRequestLogger();

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

/**
 * Schema for swarm request.
 */
const swarmRequestSchema = z.object({
  prompt: z.string().min(1, 'prompt is required and must be a non-empty string'),
  workspaceRoot: z.string().optional(),
  modelPreference: z
    .object({
      provider: z.literal('nim'),
      modelId: z.string(),
    })
    .optional(),
});

/**
 * Schema for schedule agent request.
 */
const scheduleAgentSchema = z.object({
  name: z.string().min(1, 'name is required'),
  cronExpression: z.string().min(1, 'cronExpression is required'),
  action: z.enum(['ship', 'codegen', 'chat']),
  params: z
    .object({
      projectDescription: z.string().optional(),
      preferences: z.record(z.unknown()).optional(),
    })
    .optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/agents/swarm
 *
 * Initiate a swarm task with multi-agent decomposition and execution.
 * Streams SSE events: decompose_start, decompose_done, agent_start, agent_done, summary_start, summary_done, error.
 *
 * @route POST /api/agents/swarm
 * @group Agents - Agent orchestration operations
 * @param {object} req.body - Swarm request
 * @param {string} req.body.prompt - Task description for the swarm
 * @param {string} [req.body.workspaceRoot] - Workspace directory for agents
 * @returns {SSE} 200 - Server-Sent Events stream with swarm progress
 * @returns {ApiErrorResponse} 400 - Validation error
 */
router.post('/swarm', async (req: Request, res: Response): Promise<void> => {
  const parseResult = swarmRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, firstError?.message ?? 'Invalid request', {
      field: firstError?.path?.join('.'),
    });
    return;
  }

  const { prompt, workspaceRoot, modelPreference } = parseResult.data;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const swarm = runSwarm(prompt.trim(), {
      workspaceRoot: workspaceRoot ?? undefined,
      modelPreference,
    });
    for await (const event of swarm) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.write('data: {"type":"done"}\n\n');
    res.end();
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Swarm error');
    res.write(
      `data: ${JSON.stringify({ type: 'error', message: getClientSSEErrorMessage(error) })}\n\n`
    );
    res.end();
  }
});

/**
 * POST /api/agents/schedule
 *
 * Create a new scheduled agent that runs on a cron schedule.
 *
 * @route POST /api/agents/schedule
 * @group Agents - Agent orchestration operations
 * @param {object} req.body - Schedule request
 * @param {string} req.body.name - Name for the scheduled agent
 * @param {string} req.body.cronExpression - Cron expression for scheduling
 * @param {string} req.body.action - Action type: 'ship', 'codegen', or 'chat'
 * @param {object} [req.body.params] - Additional parameters for the action
 * @returns {object} 201 - Created scheduled agent
 * @returns {ApiErrorResponse} 400 - Validation error
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.post('/schedule', async (req: Request, res: Response): Promise<void> => {
  const parseResult = scheduleAgentSchema.safeParse(req.body);
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, firstError?.message ?? 'Invalid request', {
      field: firstError?.path?.join('.'),
    });
    return;
  }

  const { name, cronExpression, action, params } = parseResult.data;

  // Additional validation: ship action requires projectDescription
  if (action === 'ship' && !params?.projectDescription) {
    sendErrorResponse(
      res,
      ErrorCode.VALIDATION_ERROR,
      'params.projectDescription is required for action ship',
      {
        field: 'params.projectDescription',
      }
    );
    return;
  }

  try {
    const agent = await createScheduledAgent(
      name.trim(),
      cronExpression.trim(),
      action,
      params ?? {}
    );
    log.info({ id: agent.id, name, action }, 'Scheduled agent created');
    res.status(201).json(agent);
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Failed to create scheduled agent');
    sendServerError(res, error);
  }
});

/**
 * GET /api/agents/scheduled
 *
 * List all scheduled agents.
 *
 * @route GET /api/agents/scheduled
 * @group Agents - Agent orchestration operations
 * @returns {Array} 200 - Array of scheduled agents
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.get('/scheduled', async (_req: Request, res: Response): Promise<void> => {
  try {
    const agents = await listAllScheduledAgents();
    res.json(agents);
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Failed to list scheduled agents');
    sendServerError(res, error);
  }
});

/**
 * DELETE /api/agents/scheduled/:id
 *
 * Cancel and delete a scheduled agent.
 *
 * @route DELETE /api/agents/scheduled/:id
 * @group Agents - Agent orchestration operations
 * @param {string} id.path.required - Scheduled agent ID
 * @returns {void} 204 - Successfully deleted
 * @returns {ApiErrorResponse} 404 - Agent not found
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.delete('/scheduled/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const ok = await cancelScheduledAgent(id);
    if (!ok) {
      sendErrorResponse(res, ErrorCode.NOT_FOUND, 'Scheduled agent not found');
      return;
    }
    res.status(204).send();
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Failed to cancel scheduled agent');
    sendServerError(res, error);
  }
});

/**
 * GET /api/agents/scheduled/:id
 *
 * Get details of a specific scheduled agent.
 *
 * @route GET /api/agents/scheduled/:id
 * @group Agents - Agent orchestration operations
 * @param {string} id.path.required - Scheduled agent ID
 * @returns {object} 200 - Scheduled agent details
 * @returns {ApiErrorResponse} 404 - Agent not found
 * @returns {ApiErrorResponse} 500 - Server error
 */
router.get('/scheduled/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const agent = await getScheduledAgent(id);
    if (!agent) {
      sendErrorResponse(res, ErrorCode.NOT_FOUND, 'Scheduled agent not found');
      return;
    }
    res.json(agent);
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Failed to get scheduled agent');
    sendServerError(res, error);
  }
});

export default router;
