/**
 * Custom Error Classes
 * 
 * Provides a hierarchy of error classes for consistent error handling
 * across all G-Rump packages.
 */

/**
 * Base error class for all G-Rump errors.
 * Extends Error with additional context and metadata.
 */
export class GrumpError extends Error {
  /** Error code for programmatic handling */
  public readonly code: string;
  /** HTTP status code (if applicable) */
  public readonly statusCode?: number;
  /** Additional error context */
  public readonly context?: Record<string, unknown>;
  /** Whether this error is retryable */
  public readonly retryable: boolean;

  constructor(
    message: string,
    options: {
      code?: string;
      statusCode?: number;
      context?: Record<string, unknown>;
      retryable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = 'GrumpError';
    this.code = options.code ?? 'GRUMP_ERROR';
    this.statusCode = options.statusCode;
    this.context = options.context;
    this.retryable = options.retryable ?? false;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GrumpError);
    }
  }

  /**
   * Creates a JSON representation of the error.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      retryable: this.retryable,
    };
  }
}

/**
 * Error thrown when a requested resource is not found.
 */
export class NotFoundError extends GrumpError {
  constructor(
    resource: string,
    id?: string,
    options: { context?: Record<string, unknown> } = {}
  ) {
    const message = id
      ? `${resource} with ID '${id}' not found`
      : `${resource} not found`;
    
    super(message, {
      code: 'NOT_FOUND',
      statusCode: 404,
      context: { resource, id, ...options.context },
      retryable: false,
    });
    this.name = 'NotFoundError';
  }
}

/**
 * Error thrown when validation fails.
 */
export class ValidationError extends GrumpError {
  /** Field that failed validation */
  public readonly field?: string;
  /** Validation errors by field */
  public readonly errors?: Record<string, string[]>;

  constructor(
    message: string,
    options: {
      field?: string;
      errors?: Record<string, string[]>;
      context?: Record<string, unknown>;
    } = {}
  ) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      context: options.context,
      retryable: false,
    });
    this.name = 'ValidationError';
    this.field = options.field;
    this.errors = options.errors;
  }
}

/**
 * Error thrown when a model or provider is not found.
 */
export class ModelNotFoundError extends GrumpError {
  /** Model ID that was not found */
  public readonly modelId: string;
  /** Provider ID (if applicable) */
  public readonly providerId?: string;

  constructor(
    modelId: string,
    providerId?: string,
    options: { context?: Record<string, unknown> } = {}
  ) {
    const message = providerId
      ? `Model '${modelId}' not found for provider '${providerId}'`
      : `Model '${modelId}' not found`;
    
    super(message, {
      code: 'MODEL_NOT_FOUND',
      statusCode: 404,
      context: { modelId, providerId, ...options.context },
      retryable: false,
    });
    this.name = 'ModelNotFoundError';
    this.modelId = modelId;
    this.providerId = providerId;
  }
}

/**
 * Error thrown when rate limit is exceeded.
 */
export class RateLimitError extends GrumpError {
  /** Seconds until the rate limit resets */
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Rate limit exceeded',
    options: {
      retryAfter?: number;
      context?: Record<string, unknown>;
    } = {}
  ) {
    super(message, {
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      context: options.context,
      retryable: true,
    });
    this.name = 'RateLimitError';
    this.retryAfter = options.retryAfter;
  }
}

/**
 * Error thrown when authentication fails.
 */
export class AuthenticationError extends GrumpError {
  constructor(
    message: string = 'Authentication required',
    options: { context?: Record<string, unknown> } = {}
  ) {
    super(message, {
      code: 'AUTHENTICATION_ERROR',
      statusCode: 401,
      context: options.context,
      retryable: false,
    });
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when authorization fails.
 */
export class AuthorizationError extends GrumpError {
  constructor(
    message: string = 'Permission denied',
    options: { context?: Record<string, unknown> } = {}
  ) {
    super(message, {
      code: 'AUTHORIZATION_ERROR',
      statusCode: 403,
      context: options.context,
      retryable: false,
    });
    this.name = 'AuthorizationError';
  }
}

/**
 * Error thrown when a timeout occurs.
 */
export class TimeoutError extends GrumpError {
  /** Timeout duration in milliseconds */
  public readonly timeoutMs: number;

  constructor(
    operation: string,
    timeoutMs: number,
    options: { context?: Record<string, unknown> } = {}
  ) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`, {
      code: 'TIMEOUT',
      statusCode: 408,
      context: { operation, timeoutMs, ...options.context },
      retryable: true,
    });
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when configuration is invalid.
 */
export class ConfigurationError extends GrumpError {
  constructor(
    message: string,
    options: { context?: Record<string, unknown> } = {}
  ) {
    super(message, {
      code: 'CONFIGURATION_ERROR',
      statusCode: 500,
      context: options.context,
      retryable: false,
    });
    this.name = 'ConfigurationError';
  }
}

/**
 * Safely extracts error message from unknown error.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * Type guard for GrumpError.
 */
export function isGrumpError(error: unknown): error is GrumpError {
  return error instanceof GrumpError;
}

/**
 * Wraps an unknown error in a GrumpError.
 */
export function wrapError(
  error: unknown,
  fallbackMessage: string = 'An error occurred'
): GrumpError {
  if (error instanceof GrumpError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new GrumpError(error.message || fallbackMessage, { cause: error });
  }
  
  return new GrumpError(
    typeof error === 'string' ? error : fallbackMessage
  );
}
