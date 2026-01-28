/**
 * Spec API Routes
 * Handles spec session management, Q&A, and specification generation
 */

import { Router, Request, Response } from 'express';
import {
  startSpecSession,
  submitAnswer,
  getSpecSession,
  generateSpecification,
  isSessionComplete,
  getNextQuestion,
} from '../services/specService.js';
import type {
  SpecStartRequest,
  SpecAnswerRequest,
  SpecGenerateRequest,
} from '../types/spec.js';
import { logger } from '../utils/logger.js';
import { sendServerError } from '../utils/errorResponse.js';

const router = Router();

/**
 * POST /api/spec/start
 * Start a new spec session and generate initial questions
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const request: SpecStartRequest = req.body;

    if (!request.userRequest) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'userRequest is required',
      });
    }

    logger.debug({ requestId: req.id }, 'Spec session start request');

    const session = await startSpecSession(request);

    res.json({ session });
  } catch (error: any) {
    logger.error({ error, requestId: req.id }, 'Spec session start failed');
    sendServerError(res, error);
  }
});

/**
 * GET /api/spec/:id
 * Get spec session status
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await getSpecSession(id);

    if (!session) {
      return res.status(404).json({
        error: 'Spec session not found',
        message: `Spec session ${id} does not exist`,
      });
    }

    const complete = await isSessionComplete(id);
    const nextQuestion = await getNextQuestion(id);

    res.json({
      session,
      isComplete: complete,
      nextQuestion,
    });
  } catch (error: any) {
    logger.error({ error, requestId: req.id }, 'Get spec session failed');
    sendServerError(res, error);
  }
});

/**
 * POST /api/spec/:id/answer
 * Submit answer to a question
 */
router.post('/:id/answer', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const answerRequest: SpecAnswerRequest = req.body;

    if (!answerRequest.questionId || answerRequest.value === undefined) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'questionId and value are required',
      });
    }

    const session = await submitAnswer(id, answerRequest);

    const complete = await isSessionComplete(id);
    const nextQuestion = await getNextQuestion(id);

    res.json({
      session,
      isComplete: complete,
      nextQuestion,
    });
  } catch (error: any) {
    logger.error({ error, requestId: req.id }, 'Answer submission failed');
    sendServerError(res, error);
  }
});

/**
 * POST /api/spec/:id/generate
 * Generate specification from answered questions
 */
router.post('/:id/generate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request: SpecGenerateRequest = { sessionId: id };

    if (!isSessionComplete(id)) {
      return res.status(400).json({
        error: 'Session incomplete',
        message: 'Not all required questions are answered',
        nextQuestion: getNextQuestion(id),
      });
    }

    logger.debug({ requestId: req.id, sessionId: id }, 'Spec generation request');

    const { specification, session } = await generateSpecification(request);

    res.json({ specification, session });
  } catch (error: any) {
    logger.error({ error, requestId: req.id }, 'Spec generation failed');
    sendServerError(res, error);
  }
});

export default router;
