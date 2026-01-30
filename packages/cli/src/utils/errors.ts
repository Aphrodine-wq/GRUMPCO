import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * Error handling utilities with purple/white branding
 * STRICT purple theme: #6B46C1, #8B5CF6, #A855F7, #FFFFFF
 */

interface ErrorWithCode extends Error {
  code?: string;
  statusCode?: number;
  response?: {
    status?: number;
    data?: unknown;
  };
}

/**
 * Display an error with the purple frowny face (STRICT: purple bg, white text)
 */
export function displayError(error: Error | string, context?: string): void {
  console.error('\n' + branding.getErrorFace());
  console.error(chalk.bgHex(branding.colors.darkPurple).whiteBright.bold('\n  Oh no! Something went wrong.\n'));
  
  if (context) {
    console.error(chalk.bgHex(branding.colors.darkPurple).white(`  Context: ${context}\n`));
  }
  
  const message = typeof error === 'string' ? error : error.message;
  console.error(chalk.white(`  Error: ${message}\n`));
  
  // Provide helpful suggestions based on error type
  const suggestions = getErrorSuggestions(error);
  if (suggestions.length > 0) {
    console.error(chalk.hex(branding.colors.mediumPurple)('  Suggestions:'));
    suggestions.forEach(suggestion => {
      console.error(chalk.hex(branding.colors.lightPurple)(`    • ${suggestion}`));
    });
    console.error();
  }
  
  console.error(chalk.hex(branding.colors.lightPurple)('  Run with --verbose for more details.\n'));
  console.error(branding.getDivider());
}

/**
 * Display a warning message (purple theme)
 */
export function displayWarning(message: string): void {
  console.warn(chalk.hex(branding.colors.mediumPurple)(`\n  ⚠ ${message}\n`));
}

/**
 * Get error suggestions based on error patterns
 */
function getErrorSuggestions(error: Error | string): string[] {
  const suggestions: string[] = [];
  const message = (typeof error === 'string' ? error : error.message).toLowerCase();
  const errorCode = (error as ErrorWithCode).code;
  
  // Connection errors
  if (message.includes('connect') || message.includes('network') || errorCode === 'ECONNREFUSED') {
    suggestions.push('Check that your server is running on the configured URL');
    suggestions.push('Verify your network connection');
    suggestions.push('Try using --url to specify a different endpoint');
  }
  
  // Authentication errors
  if (message.includes('auth') || message.includes('unauthorized') || message.includes('401')) {
    suggestions.push('Run `grump auth login` to authenticate');
    suggestions.push('Check that your API key is valid with `grump auth status`');
    suggestions.push('Verify the GRUMP_API_KEY environment variable is set');
  }
  
  // Not found errors
  if (message.includes('not found') || message.includes('404')) {
    suggestions.push('Check that the session ID is correct');
    suggestions.push('Use `grump list` to see available sessions');
  }
  
  // Timeout errors
  if (message.includes('timeout') || errorCode === 'ETIMEDOUT') {
    suggestions.push('The operation took too long - try again later');
    suggestions.push('Check server load and try with a smaller request');
  }
  
  // Config errors
  if (message.includes('config') || message.includes('configuration')) {
    suggestions.push('Run `grump init` to set up your configuration');
    suggestions.push('Check your .grumprc file for errors');
  }
  
  // Generic fallback
  if (suggestions.length === 0) {
    suggestions.push('Check the documentation for this command');
    suggestions.push('Try running with --verbose for more details');
    suggestions.push('Report this issue if it persists');
  }
  
  return suggestions;
}

/**
 * Create a custom error class with additional context
 */
export class GrumpError extends Error {
  public code: string;
  public statusCode?: number;
  public suggestions: string[];
  
  constructor(message: string, code: string, statusCode?: number, suggestions?: string[]) {
    super(message);
    this.name = 'GrumpError';
    this.code = code;
    this.statusCode = statusCode;
    this.suggestions = suggestions || [];
  }
}

/**
 * Handle API errors and convert to GrumpErrors
 */
export function handleApiError(response: Response, data?: unknown): never {
  let message = `API request failed with status ${response.status}`;
  let suggestions: string[] = [];
  
  switch (response.status) {
    case 401:
      message = 'Authentication failed. Please check your API key.';
      suggestions = ['Run `grump auth login` to authenticate', 'Check your GRUMP_API_KEY environment variable'];
      break;
    case 403:
      message = 'Access denied. You do not have permission to perform this action.';
      break;
    case 404:
      message = 'Resource not found.';
      suggestions = ['Verify the session ID or resource identifier', 'Use `grump list` to see available resources'];
      break;
    case 429:
      message = 'Rate limit exceeded. Please slow down your requests.';
      suggestions = ['Wait a few moments before retrying', 'Consider batching your requests'];
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      message = 'Server error. The API encountered an internal problem.';
      suggestions = ['The server may be overloaded - try again in a moment', 'Check the API status page'];
      break;
  }
  
  throw new GrumpError(message, `HTTP_${response.status}`, response.status, suggestions);
}

/**
 * Validate that required parameters are present
 */
export function validateRequired<T>(value: T | undefined | null, name: string): T {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    throw new GrumpError(
      `Missing required parameter: ${name}`,
      'MISSING_PARAM',
      undefined,
      [`Provide the ${name} parameter`, `Run with --help for usage information`]
    );
  }
  return value;
}
