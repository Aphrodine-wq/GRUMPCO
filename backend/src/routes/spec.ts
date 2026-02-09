/**
 * Spec API Routes
 * Handles spec session management, Q&A, and specification generation
 */

import { Router, type Request, type Response } from "express";
import {
  startSpecSession,
  submitAnswer,
  getSpecSession,
  generateSpecification,
  isSessionComplete,
  getNextQuestion,
} from "../services/ship/specService.js";
import type {
  SpecStartRequest,
  SpecAnswerRequest,
  SpecGenerateRequest,
} from "../types/spec.js";
import logger from "../middleware/logger.js";
import { sendServerError } from "../utils/errorResponse.js";
import { MAX_USER_REQUEST_LENGTH } from "../config/limits.js";

const router = Router();

/**
 * POST /api/spec/start
 * Start a new spec session and generate initial questions
 */
router.post("/start", async (req: Request, res: Response): Promise<void> => {
  try {
    const request: SpecStartRequest = req.body;

    if (!request.userRequest || typeof request.userRequest !== "string") {
      res.status(400).json({
        error: "Invalid request",
        message: "userRequest is required and must be a string",
      });
      return;
    }
    if (request.userRequest.length > MAX_USER_REQUEST_LENGTH) {
      res.status(413).json({
        error: "Invalid request",
        message: `userRequest exceeds maximum length of ${MAX_USER_REQUEST_LENGTH} characters`,
      });
      return;
    }

    logger.debug({ requestId: req.id }, "Spec session start request");

    const session = await startSpecSession(request);

    res.json({ session });
  } catch (error: unknown) {
    logger.error({ error, requestId: req.id }, "Spec session start failed");
    sendServerError(res, error);
  }
});

/**
 * GET /api/spec/:id
 * Get spec session status
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const session = await getSpecSession(id);

    if (!session) {
      res.status(404).json({
        error: "Spec session not found",
        message: `Spec session ${id} does not exist`,
      });
      return;
    }

    const complete = await isSessionComplete(id);
    const nextQuestion = await getNextQuestion(id);

    res.json({
      session,
      isComplete: complete,
      nextQuestion,
    });
  } catch (error: unknown) {
    logger.error({ error, requestId: req.id }, "Get spec session failed");
    sendServerError(res, error);
  }
});

/**
 * POST /api/spec/:id/answer
 * Submit answer to a question
 */
router.post(
  "/:id/answer",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const answerRequest: SpecAnswerRequest = req.body;

      if (!answerRequest.questionId || answerRequest.value === undefined) {
        res.status(400).json({
          error: "Invalid request",
          message: "questionId and value are required",
        });
        return;
      }

      const session = await submitAnswer(id, answerRequest);

      const complete = await isSessionComplete(id);
      const nextQuestion = await getNextQuestion(id);

      res.json({
        session,
        isComplete: complete,
        nextQuestion,
      });
    } catch (error: unknown) {
      logger.error({ error, requestId: req.id }, "Answer submission failed");
      sendServerError(res, error);
    }
  },
);

/**
 * POST /api/spec/:id/generate
 * Generate specification from answered questions
 */
router.post(
  "/:id/generate",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const request: SpecGenerateRequest = { sessionId: id };

      const complete = await isSessionComplete(id);
      if (!complete) {
        const nextQuestion = await getNextQuestion(id);
        res.status(400).json({
          error: "Session incomplete",
          message: "Not all required questions are answered",
          nextQuestion,
        });
        return;
      }

      logger.debug(
        { requestId: req.id, sessionId: id },
        "Spec generation request",
      );

      const { specification, session } = await generateSpecification(request);

      res.json({ specification, session });
    } catch (error: unknown) {
      logger.error({ error, requestId: req.id }, "Spec generation failed");
      sendServerError(res, error);
    }
  },
);

export default router;
