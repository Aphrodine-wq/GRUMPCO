import express, { Request, Response, Router } from 'express';
import { generateDiagram, generateDiagramStream } from '../services/claudeService.js';
import { generateProjectZip } from '../services/codeGeneratorService.js';
import { getRequestLogger } from '../middleware/logger.js';
import { validateDiagramRequest, handleValidationErrors } from '../middleware/validator.js';
import { activeSseConnections } from '../middleware/metrics.js';
import type { ConversationMessage, RefinementContext, DiagramType, TechStack, ClarificationResponse } from '../types/index.js';
import type { UserPreferences } from '../prompts/index.js';

const router: Router = express.Router();

// Request timeout (30 seconds)
const REQUEST_TIMEOUT = 30000;

interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
  retryAfter?: number;
}

interface ClassifiedError {
  status: number;
  type: string;
  message: string;
  suggestedAction: string;
  retryable: boolean;
  retryAfter?: number;
}

// Helper to classify Anthropic API errors with user-friendly messages
function classifyError(error: ErrorWithStatus): ClassifiedError {
  const message = error.message?.toLowerCase() || '';
  const status = error.status || error.statusCode;
  const code = error.code || '';

  // Circuit breaker open
  if (code === 'CIRCUIT_OPEN') {
    return {
      status: 503,
      type: 'service_unavailable',
      message: 'Service is recovering. Please wait a moment.',
      suggestedAction: 'The service is temporarily paused to recover. Try again in a minute.',
      retryable: true,
      retryAfter: error.retryAfter || 60,
    };
  }

  // Network connectivity errors
  if (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EHOSTUNREACH' ||
    code === 'ECONNRESET'
  ) {
    return {
      status: 503,
      type: 'network_error',
      message: 'Cannot connect to AI service.',
      suggestedAction: 'Check your internet connection and try again.',
      retryable: true,
    };
  }

  // Authentication errors
  if (
    status === 401 ||
    message.includes('api key') ||
    message.includes('authentication') ||
    message.includes('unauthorized')
  ) {
    return {
      status: 401,
      type: 'auth_error',
      message: 'Invalid API key.',
      suggestedAction:
        'Please check your ANTHROPIC_API_KEY in the backend .env file. See API_SETUP_INSTRUCTIONS.txt for help.',
      retryable: false,
    };
  }

  // Rate limiting
  if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
    return {
      status: 429,
      type: 'rate_limit',
      message: 'Too many requests.',
      suggestedAction: 'Please wait a moment before trying again.',
      retryable: true,
      retryAfter: 60,
    };
  }

  // Extraction failures
  if (code === 'EXTRACTION_FAILED') {
    return {
      status: 422,
      type: 'extraction_failed',
      message: 'Could not generate a valid diagram.',
      suggestedAction: 'Try rephrasing your request or be more specific about what you want.',
      retryable: true,
    };
  }

  // Timeout errors
  if (message.includes('timeout') || message.includes('timed out')) {
    return {
      status: 504,
      type: 'timeout',
      message: 'Request took too long.',
      suggestedAction: 'Try a simpler request or try again in a moment.',
      retryable: true,
    };
  }

  // Service unavailable (network, overloaded)
  if (
    status === 503 ||
    status === 502 ||
    message.includes('unavailable') ||
    message.includes('overloaded')
  ) {
    return {
      status: 503,
      type: 'service_unavailable',
      message: 'AI service temporarily unavailable.',
      suggestedAction: 'The service is experiencing high demand. Please try again shortly.',
      retryable: true,
    };
  }

  // Default: internal error
  return {
    status: 500,
    type: 'internal_error',
    message: 'Something went wrong.',
    suggestedAction: 'Please try again. If the problem persists, check the console for details.',
    retryable: true,
  };
}

interface DiagramRequestBody extends Request {
  body: {
    message: string;
    preferences?: UserPreferences;
    conversationHistory?: ConversationMessage[];
    refinementContext?: RefinementContext;
    clarificationAnswers?: ClarificationResponse;
  };
}

interface CodeGenRequestBody extends Request {
  body: {
    diagramType: string;
    mermaidCode: string;
    techStack: string;
    projectName?: string;
  };
}

// Non-streaming endpoint with validation
router.post(
  '/generate-diagram',
  validateDiagramRequest,
  handleValidationErrors,
  async (req: DiagramRequestBody, res: Response) => {
    const log = getRequestLogger();
    const { message, preferences } = req.body;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        log.warn('Request timeout');
        res.status(504).json({
          error: 'Request timeout',
          type: 'timeout',
        });
      }
    }, REQUEST_TIMEOUT);

    try {
      const mermaidCode = await generateDiagram(message, preferences);
      clearTimeout(timeoutId);
      if (res.headersSent) return;

      res.json({
        success: true,
        mermaidCode,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (res.headersSent) return;

      const err = error as ErrorWithStatus;
      log.error({ error: err.message, code: err.code }, 'Error generating diagram');
      const classified = classifyError(err);
      const response: Record<string, unknown> = {
        error: classified.message,
        type: classified.type,
        suggestedAction: classified.suggestedAction,
        retryable: classified.retryable,
      };

      // Add retry-after header for circuit breaker and rate limits
      if (classified.retryAfter) {
        res.setHeader('Retry-After', classified.retryAfter.toString());
        response.retryAfter = classified.retryAfter;
      }

      if (process.env.NODE_ENV === 'development') {
        response.details = err.message;
      }

      res.status(classified.status).json(response);
    }
  }
);

// Streaming endpoint with abort controller and validation
router.post(
  '/generate-diagram-stream',
  validateDiagramRequest,
  handleValidationErrors,
  async (req: DiagramRequestBody, res: Response) => {
    const log = getRequestLogger();
    const { message, preferences, conversationHistory, refinementContext, clarificationAnswers } = req.body;

    // Format message with clarification answers if present
    let finalMessage = message;
    if (clarificationAnswers?.answers?.length) {
      const formattedAnswers = clarificationAnswers.answers
        .map(a => `- ${a.questionId}: ${a.selectedOptionIds.join(', ')}`)
        .join('\n');
      finalMessage = `Based on my clarifying questions, here are the user's answers:\n${formattedAnswers}\n\nOriginal request: ${message}\n\nNow generate the diagram based on these preferences. Do not ask any more questions.`;
      log.info({ answers: clarificationAnswers.answers }, 'Processing clarification answers');
    }

    // Create abort controller for request cancellation
    const abortController = new AbortController();

    // Track active connection
    activeSseConnections.inc();

    // Handle client disconnect
    req.on('close', () => {
      log.info('Client disconnected from stream');
      abortController.abort();
      activeSseConnections.dec();
    });

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!res.writableEnded) {
        log.warn('Stream timeout');
        abortController.abort();
        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ error: 'Request timeout', type: 'timeout' })}\n\n`);
          res.end();
        } else {
          res.status(504).json({ error: 'Request timeout', type: 'timeout' });
        }
      }
    }, REQUEST_TIMEOUT);

    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      res.flushHeaders();

      for await (const chunk of generateDiagramStream(
        finalMessage,
        preferences,
        abortController.signal,
        conversationHistory,
        refinementContext
      )) {
        if (abortController.signal.aborted) break;
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }

      clearTimeout(timeoutId);
      if (!abortController.signal.aborted && !res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (error) {
      clearTimeout(timeoutId);

      // Ignore abort errors
      const err = error as ErrorWithStatus;
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        if (!res.writableEnded) res.end();
        return;
      }

      log.error({ error: err.message, code: err.code }, 'Error streaming diagram');
      const classified = classifyError(err);
      const errorPayload: Record<string, unknown> = {
        error: classified.message,
        type: classified.type,
        suggestedAction: classified.suggestedAction,
        retryable: classified.retryable,
      };

      if (classified.retryAfter) {
        errorPayload.retryAfter = classified.retryAfter;
      }

      // If headers already sent, send error via SSE
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify(errorPayload)}\n\n`);
        res.end();
      } else {
        res.status(classified.status).json(errorPayload);
      }
    }
  }
);

// Code generation endpoint - generates downloadable ZIP
router.post('/generate-code', async (req: CodeGenRequestBody, res: Response) => {
  const log = getRequestLogger();
  const { diagramType, mermaidCode, techStack, projectName } = req.body;

  // Validate required fields
  if (!diagramType || !mermaidCode || !techStack) {
    res.status(400).json({
      error: 'Missing required fields: diagramType, mermaidCode, techStack',
      type: 'validation_error',
    });
    return;
  }

  // Validate tech stack
  const validStacks = ['react-express-prisma', 'fastapi-sqlalchemy', 'nextjs-prisma'];
  if (!validStacks.includes(techStack)) {
    res.status(400).json({
      error: `Invalid techStack. Must be one of: ${validStacks.join(', ')}`,
      type: 'validation_error',
    });
    return;
  }

  // Validate diagram type
  const validTypes = ['er', 'sequence', 'flowchart', 'class'];
  if (!validTypes.includes(diagramType)) {
    res.status(400).json({
      error: `Invalid diagramType. Must be one of: ${validTypes.join(', ')}`,
      type: 'validation_error',
    });
    return;
  }

  // Set up timeout (60 seconds for code generation)
  const CODE_GEN_TIMEOUT = 60000;
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      log.warn('Code generation timeout');
      res.status(504).json({
        error: 'Code generation timeout',
        type: 'timeout',
      });
    }
  }, CODE_GEN_TIMEOUT);

  try {
    log.info({ diagramType, techStack }, 'Starting code generation');
    const sanitizedName = (projectName || 'generated-project')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);

    const zipStream = await generateProjectZip({
      diagramType: diagramType as DiagramType,
      mermaidCode,
      techStack: techStack as TechStack,
      projectName: sanitizedName,
    });

    clearTimeout(timeoutId);
    if (res.headersSent) return;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedName}.zip"`);
    zipStream.pipe(res);

    zipStream.on('error', (err: Error) => {
      log.error({ error: err.message }, 'ZIP stream error');
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate ZIP', type: 'internal_error' });
      }
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (res.headersSent) return;

    const err = error as ErrorWithStatus;
    log.error({ error: err.message }, 'Error generating code');
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || 'Failed to generate code',
      type: 'internal_error',
    });
  }
});

export default router;
