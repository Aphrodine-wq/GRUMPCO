import { body, validationResult, ValidationChain } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';
import { getRequestLogger } from './logger.js';

// Maximum message length (prevent abuse)
export const MAX_MESSAGE_LENGTH = 4000;

/** Max length per message content in chat (chars). */
export const MAX_CHAT_MESSAGE_LENGTH = 16000;
/** Max number of messages in a single chat request. */
export const MAX_CHAT_MESSAGES = 50;
/** Max length for ship projectDescription (chars). */
export const MAX_SHIP_PROJECT_DESCRIPTION_LENGTH = 16000;
/** Max length for projectName (chars). */
export const MAX_PROJECT_NAME_LENGTH = 2000;
/** Max length for architecture/PRD projectDescription (chars). */
export const MAX_ARCHITECTURE_DESCRIPTION_LENGTH = 16000;


// Basic prompt injection patterns to detect
const SUSPICIOUS_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /forget\s+(all\s+)?(previous|prior|above)/i,
  /new\s+instructions?:/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /<<SYS>>/i,
];

function sanitizeControlChars(value: string): string {
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/** Check for suspicious patterns. Returns list of matching pattern strings. */
export function checkSuspiciousPatterns(text: string): string[] {
  const matches: string[] = [];
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(text)) {
      matches.push(pattern.toString());
    }
  }
  return matches;
}

/** Run suspicious-pattern check on body keys. If BLOCK_SUSPICIOUS_PROMPTS, returns { block: true, patterns, key }. */
export function checkSuspiciousInBody(
  body: Record<string, unknown>,
  keys: string[]
): { block: false } | { block: true; patterns: string[]; key: string; preview: string } {
  for (const key of keys) {
    const val = body[key];
    const text = typeof val === 'string' ? val : '';
    const matches = checkSuspiciousPatterns(text);
    if (matches.length > 0 && process.env.BLOCK_SUSPICIOUS_PROMPTS === 'true') {
      return { block: true, patterns: matches, key, preview: text.substring(0, 100) };
    }
  }
  return { block: false };
}

// Validation rules for diagram generation
export const validateDiagramRequest: ValidationChain[] = [
  body('message')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Message is required')
    .isString()
    .withMessage('Message must be a string')
    .isLength({ min: 1, max: MAX_MESSAGE_LENGTH })
    .withMessage(`Message must be between 1 and ${MAX_MESSAGE_LENGTH} characters`)
    .trim()
    .customSanitizer((value: string) => sanitizeControlChars(value)),
];

// Validation rules for ship /start
export const validateShipRequest: ValidationChain[] = [
  body('projectDescription')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('projectDescription is required')
    .isString()
    .withMessage('projectDescription must be a string')
    .isLength({ min: 1, max: MAX_SHIP_PROJECT_DESCRIPTION_LENGTH })
    .withMessage(`projectDescription must be between 1 and ${MAX_SHIP_PROJECT_DESCRIPTION_LENGTH} characters`)
    .trim()
    .customSanitizer((value: string) => sanitizeControlChars(value)),
];

// Validation rules for codegen /start (legacy: prdId, architectureId, prd, architecture | multi: prds, architecture)
export const validateCodegenRequest: ValidationChain[] = [
  body('prdId').optional().isString().trim(),
  body('architectureId').optional().isString().trim(),
  body('prd').optional().isObject(),
  body('architecture').optional().isObject(),
  body('prds').optional().isArray(),
  body('preferences').optional().isObject(),
  body('componentMapping').optional().isObject(),
  body('projectId').optional().isString().trim(),
  body()
    .custom((_val, { req }) => {
      const b = (req as RequestWithBody).body as Record<string, unknown>;
      const multi = Array.isArray(b?.prds) && b?.prds.length > 0 && b?.architecture;
      const legacy = b?.prdId && b?.architectureId && b?.prd && b?.architecture;
      if (!multi && !legacy) throw new Error('Either (prds array + architecture) or (prdId, architectureId, prd, architecture) is required');
      return true;
    }),
];

// Validation rules for PRD generate / generate-stream
export const validatePrdGenerateRequest: ValidationChain[] = [
  body('projectName')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('projectName is required')
    .isString()
    .withMessage('projectName must be a string')
    .isLength({ min: 1, max: MAX_PROJECT_NAME_LENGTH })
    .withMessage(`projectName must be between 1 and ${MAX_PROJECT_NAME_LENGTH} characters`)
    .trim()
    .customSanitizer((value: string) => sanitizeControlChars(value)),
  body('projectDescription')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('projectDescription is required')
    .isString()
    .withMessage('projectDescription must be a string')
    .isLength({ min: 1, max: MAX_ARCHITECTURE_DESCRIPTION_LENGTH })
    .withMessage(`projectDescription must be between 1 and ${MAX_ARCHITECTURE_DESCRIPTION_LENGTH} characters`)
    .trim()
    .customSanitizer((value: string) => sanitizeControlChars(value)),
  body('architecture').exists({ checkNull: true }).withMessage('architecture is required').isObject().withMessage('architecture must be an object'),
];

// Validation rules for architecture generate / generate-stream
export const validateArchitectureRequest: ValidationChain[] = [
  body('projectDescription')
    .optional()
    .isString()
    .trim()
    .customSanitizer((value: string) => (typeof value === 'string' ? sanitizeControlChars(value) : '')),
  body('enrichedIntent')
    .optional()
    .isObject(),
  body('projectType').optional().isString().trim(),
  body('techStack').optional().isArray(),
  body('complexity').optional().isString().trim(),
  body('refinements').optional().isArray(),
  body('conversationHistory').optional().isArray(),
  body()
    .custom((_val, { req }) => {
      const b = (req as RequestWithBody).body as Record<string, unknown>;
      const pd = b?.projectDescription;
      const raw = (b?.enrichedIntent as { raw?: string } | undefined)?.raw;
      const spd = typeof pd === 'string' ? pd.trim() : '';
      const sraw = typeof raw === 'string' ? raw.trim() : '';
      if (!spd.length && !sraw.length) throw new Error('projectDescription or enrichedIntent.raw is required');
      if (spd.length > MAX_ARCHITECTURE_DESCRIPTION_LENGTH) throw new Error(`projectDescription exceeds ${MAX_ARCHITECTURE_DESCRIPTION_LENGTH} characters`);
      if (sraw.length > MAX_ARCHITECTURE_DESCRIPTION_LENGTH) throw new Error('enrichedIntent.raw exceeds maximum length');
      return true;
    }),
];

interface RequestWithBody extends Request {
  body: Record<string, unknown>;
}

/**
 * Validation error handler. Use with validate*Request chains.
 * @param suspiciousPatternKeys - Optional body keys to check for suspicious patterns. If BLOCK_SUSPICIOUS_PROMPTS, returns 400 on match.
 */
export function handleValidationErrors(
  req: RequestWithBody,
  res: Response,
  next: NextFunction,
  suspiciousPatternKeys: string[] = ['message']
): void {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const logger = getRequestLogger();
    logger.warn({ errors: errors.array() }, 'Validation failed');

    res.status(400).json({
      error: 'Validation failed',
      type: 'validation_error',
      details: errors.array().map(e => ({
        field: 'path' in e ? e.path : 'unknown',
        message: e.msg,
      })),
    });
    return;
  }

  const check = checkSuspiciousInBody(req.body, suspiciousPatternKeys);
  if (check.block) {
    const logger = getRequestLogger();
    logger.warn(
      { patterns: check.patterns, key: check.key, preview: check.preview },
      'Suspicious prompt patterns detected; blocking (BLOCK_SUSPICIOUS_PROMPTS=true)'
    );
    res.status(400).json({
      error: 'Request blocked: suspicious prompt patterns detected',
      type: 'validation_error',
      details: [{ field: check.key, message: 'Content matches blocked patterns.' }],
    });
    return;
  }

  // Log only (when not blocking)
  for (const key of suspiciousPatternKeys) {
    const val = req.body[key];
    const text = typeof val === 'string' ? val : '';
    const matches = checkSuspiciousPatterns(text);
    if (matches.length > 0) {
      const logger = getRequestLogger();
      logger.warn(
        { patterns: matches, key, messagePreview: text.substring(0, 100) },
        'Suspicious prompt patterns detected'
      );
    }
  }

  next();
}

/** Wrapper that binds handleValidationErrors with specific keys for diagram (message). */
export function handleDiagramValidationErrors(req: RequestWithBody, res: Response, next: NextFunction): void {
  handleValidationErrors(req, res, next, ['message']);
}

/** Wrapper for ship (projectDescription). */
export function handleShipValidationErrors(req: RequestWithBody, res: Response, next: NextFunction): void {
  handleValidationErrors(req, res, next, ['projectDescription']);
}

/** Wrapper for PRD generate (projectName, projectDescription). */
export function handlePrdValidationErrors(req: RequestWithBody, res: Response, next: NextFunction): void {
  handleValidationErrors(req, res, next, ['projectName', 'projectDescription']);
}

/** Wrapper for architecture (projectDescription; enrichedIntent.raw checked manually). */
export function handleArchitectureValidationErrors(req: RequestWithBody, res: Response, next: NextFunction): void {
  const keys = ['projectDescription'];
  const b = req.body as { enrichedIntent?: { raw?: string } };
  if (typeof b?.enrichedIntent?.raw === 'string') {
    const m = checkSuspiciousPatterns(b.enrichedIntent.raw);
    if (m.length > 0 && process.env.BLOCK_SUSPICIOUS_PROMPTS === 'true') {
      const logger = getRequestLogger();
      logger.warn({ patterns: m, key: 'enrichedIntent.raw' }, 'Suspicious prompt patterns detected; blocking');
      res.status(400).json({
        error: 'Request blocked: suspicious prompt patterns detected',
        type: 'validation_error',
        details: [{ field: 'enrichedIntent.raw', message: 'Content matches blocked patterns.' }],
      });
      return;
    }
    if (m.length > 0) {
      const logger = getRequestLogger();
      logger.warn({ patterns: m, key: 'enrichedIntent.raw', messagePreview: b.enrichedIntent.raw.substring(0, 100) }, 'Suspicious prompt patterns detected');
    }
  }
  handleValidationErrors(req, res, next, keys);
}

/** Wrapper for codegen (no user-facing text to check for suspicious patterns). */
export function handleCodegenValidationErrors(req: RequestWithBody, res: Response, next: NextFunction): void {
  handleValidationErrors(req, res, next, []);
}
