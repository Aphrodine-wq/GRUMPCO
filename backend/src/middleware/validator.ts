import { body, validationResult, ValidationChain } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';
import { getRequestLogger } from './logger.js';

// Maximum message length (prevent abuse)
export const MAX_MESSAGE_LENGTH = 4000;

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
    .customSanitizer((value: string) => {
      // Remove control characters except newlines and tabs
      return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }),
];

// Check for suspicious patterns (logging only, not blocking)
function checkSuspiciousPatterns(message: string): string[] {
  const matches: string[] = [];
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(message)) {
      matches.push(pattern.toString());
    }
  }
  return matches;
}

interface RequestWithMessage extends Request {
  body: {
    message?: string;
  };
}

// Validation error handler middleware
export function handleValidationErrors(
  req: RequestWithMessage,
  res: Response,
  next: NextFunction
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

  // Log suspicious patterns but don't block
  const suspiciousMatches = checkSuspiciousPatterns(req.body.message || '');
  if (suspiciousMatches.length > 0) {
    const logger = getRequestLogger();
    logger.warn(
      {
        patterns: suspiciousMatches,
        messagePreview: req.body.message?.substring(0, 100),
      },
      'Suspicious prompt patterns detected'
    );
  }

  next();
}
