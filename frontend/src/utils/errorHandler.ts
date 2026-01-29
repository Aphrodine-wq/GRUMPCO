/**
 * Centralized Error Handling Utility
 * Provides error classification, user-friendly messages, and recovery suggestions
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- error shape from API (Phase 1.1) */

export type ErrorType = 'network' | 'validation' | 'api' | 'user' | 'timeout' | 'unknown';
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorContext {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  recovery?: RecoveryOption[];
  retryable: boolean;
  originalError?: Error;
  metadata?: Record<string, unknown>;
}

export interface RecoveryOption {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
}

/**
 * Classify error by type
 */
export function classifyError(error: unknown): ErrorType {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'network';
  }
  
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return 'timeout';
    }
    
    if (msg.includes('validation') || msg.includes('invalid')) {
      return 'validation';
    }
    
    if (msg.includes('network') || msg.includes('connection') || msg.includes('failed to fetch')) {
      return 'network';
    }
    
    if ((error as any).status || (error as any).statusCode) {
      return 'api';
    }
  }
  
  return 'unknown';
}

/**
 * Determine error severity
 */
export function getErrorSeverity(error: unknown, type: ErrorType): ErrorSeverity {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    // Critical: Authentication, data loss
    if (msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('data loss')) {
      return 'critical';
    }
    
    // High: API errors, service unavailable
    if (type === 'api' || msg.includes('service unavailable') || msg.includes('internal server')) {
      return 'high';
    }
    
    // Medium: Network issues, timeouts
    if (type === 'network' || type === 'timeout') {
      return 'medium';
    }
    
    // Low: Validation errors, user input issues
    if (type === 'validation' || type === 'user') {
      return 'low';
    }
  }
  
  return 'medium';
}

/**
 * Generate user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown, type: ErrorType): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    switch (type) {
      case 'network':
        return 'Connection error. Please check your internet connection and try again.';
      
      case 'timeout':
        return 'Request timed out. The server may be busy. Please try again.';
      
      case 'validation':
        if (msg.includes('mermaid') || msg.includes('diagram')) {
          return 'Invalid diagram syntax. Please check your Mermaid code.';
        }
        return 'Invalid input. Please check your request and try again.';
      
      case 'api':
        if (msg.includes('401') || msg.includes('unauthorized')) {
          return 'Authentication failed. Please check your API key.';
        }
        if (msg.includes('429') || msg.includes('rate limit')) {
          return 'Rate limit exceeded. Please wait a moment and try again.';
        }
        if (msg.includes('500') || msg.includes('internal server')) {
          return 'Server error. Our team has been notified. Please try again later.';
        }
        if (msg.includes('503') || msg.includes('service unavailable')) {
          return 'Service temporarily unavailable. Please try again in a moment.';
        }
        return 'API error occurred. Please try again.';
      
      case 'user':
        return error.message;
      
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
  
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Generate recovery options based on error type
 */
export function getRecoveryOptions(
  error: unknown,
  type: ErrorType,
  onRetry?: () => void | Promise<void>,
  onCancel?: () => void
): RecoveryOption[] {
  const options: RecoveryOption[] = [];
  
  if (type === 'network' || type === 'timeout' || type === 'api') {
    if (onRetry) {
      options.push({
        label: 'Retry',
        action: onRetry,
        primary: true,
      });
    }
  }
  
  if (type === 'validation') {
    options.push({
      label: 'Fix Input',
      action: () => {
        // Focus on input field
        const input = document.querySelector('input[type="text"]') as HTMLInputElement;
        input?.focus();
      },
      primary: true,
    });
  }
  
  if (onCancel) {
    options.push({
      label: 'Cancel',
      action: onCancel,
    });
  }
  
  return options;
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: unknown, type: ErrorType): boolean {
  if (type === 'network' || type === 'timeout') {
    return true;
  }
  
  if (error instanceof Error) {
    const _msg = error.message.toLowerCase();
    const errWithStatus = error as Error & { status?: number; statusCode?: number };
    const status = errWithStatus.status ?? errWithStatus.statusCode;
    
    // Retryable status codes
    if (status && [429, 500, 502, 503, 504].includes(status)) {
      return true;
    }
    
    // Don't retry client errors (except rate limits)
    if (status && status >= 400 && status < 500 && status !== 429) {
      return false;
    }
  }
  
  return type === 'api';
}

/**
 * Process error and return structured error context
 */
export function processError(
  error: unknown,
  onRetry?: () => void | Promise<void>,
  onCancel?: () => void
): ErrorContext {
  const type = classifyError(error);
  const severity = getErrorSeverity(error, type);
  const userMessage = getUserFriendlyMessage(error, type);
  const retryable = isRetryable(error, type);
  const recovery = getRecoveryOptions(error, type, onRetry, onCancel);
  
  return {
    type,
    severity,
    message: error instanceof Error ? error.message : String(error),
    userMessage,
    recovery: recovery.length > 0 ? recovery : undefined,
    retryable,
    originalError: error instanceof Error ? error : undefined,
    metadata: error instanceof Error ? {
      name: error.name,
      stack: error.stack,
      ...(error as any).status && { status: (error as any).status },
      ...(error as any).statusCode && { statusCode: (error as any).statusCode },
    } : undefined,
  };
}

/**
 * Log error for analytics/debugging
 */
export function logError(context: ErrorContext, additionalData?: Record<string, unknown>) {
  console.error('Error occurred:', {
    type: context.type,
    severity: context.severity,
    message: context.message,
    userMessage: context.userMessage,
    retryable: context.retryable,
    metadata: context.metadata,
    ...additionalData,
  });
  
  // In production, send to error tracking service
  if (typeof window !== 'undefined' && (window as any).trackError) {
    (window as any).trackError(context, additionalData);
  }
}
