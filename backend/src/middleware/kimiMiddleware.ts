/**
 * Kimi K2.5 Optimization Middleware
 * 
 * Automatically detects and applies Kimi K2.5 optimizations to requests.
 * This includes:
 * - Language detection and multilingual optimization
 * - Context window utilization
 * - Cost-aware routing
 * - Prompt optimization
 */

import { Request, Response, NextFunction } from 'express';
import {
  containsNonEnglish,
  optimizePromptForKimi,
  shouldRouteToKimi,
  estimateKimiSavings,
  KIMI_K25_CONFIG,
  getKimiRoutingDecision,
  type KimiRoutingInput,
} from '../services/kimiOptimizer.js';
import { selectModelEnhanced, type EnhancedRouterContext } from '../services/modelRouterEnhanced.js';
import logger from '../middleware/logger.js';

// Extend Express Request type to include Kimi optimization context
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      kimiOptimization?: {
        detectedLanguage: string;
        hasNonEnglish: boolean;
        recommendedModel: string;
        confidence: number;
        estimatedSavings?: number;
        optimizations: string[];
        contextRetention?: {
          retainTokens: number;
          advantageUsed: number;
          recommendation: string;
        };
      };
    }
  }
}

/**
 * Detect language from text content
 */
function detectLanguage(text: string): string {
  // Chinese detection
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  
  // Japanese detection
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
  
  // Korean detection
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  
  // Arabic detection
  if (/[\u0600-\u06ff]/.test(text)) return 'ar';
  
  // Russian/Cyrillic detection
  if (/[\u0400-\u04ff]/.test(text)) return 'ru';
  
  // Hindi detection
  if (/[\u0900-\u097f]/.test(text)) return 'hi';
  
  return 'en';
}

/**
 * Extract text content from various request formats
 */
function extractContent(req: Request): string {
  // Handle different request structures
  if (req.body.message) {
    return req.body.message;
  }
  
  if (req.body.messages && Array.isArray(req.body.messages)) {
    // Concatenate all message contents
    return req.body.messages
      .map((m: { content?: string }) => m.content || '')
      .join(' ');
  }
  
  if (req.body.prompt) {
    return req.body.prompt;
  }
  
  if (req.body.content) {
    return req.body.content;
  }
  
  if (req.body.text) {
    return req.body.text;
  }
  
  return '';
}

/**
 * Kimi optimization middleware
 * Analyzes requests and adds optimization metadata
 */
export function kimiOptimizationMiddleware(
  options: {
    autoRoute?: boolean;
    trackSavings?: boolean;
    logDecisions?: boolean;
  } = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const { autoRoute = true, trackSavings = true, logDecisions = true } = options;
  
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const content = extractContent(req);
      
      if (!content) {
        // No content to analyze, skip optimization
        return next();
      }
      
      // Language detection
      const detectedLanguage = detectLanguage(content);
      const hasNonEnglish = detectedLanguage !== 'en';
      
      // Prepare routing input
      const routingInput: KimiRoutingInput = {
        messageChars: content.length,
        messageCount: req.body.messages?.length || 1,
        mode: req.body.mode,
        toolsRequested: req.body.tools !== undefined && req.body.tools.length > 0,
        multimodal: req.body.multimodal === true || content.includes('image_url'),
        isComplex: req.body.complex === true || content.length > 5000,
        detectedLanguage,
        hasCode: content.includes('```') || /\b(function|class|const|let|var|import|export)\b/.test(content),
        contextSize: req.body.contextTokens || content.length,
      };
      
      // Get routing decision
      const routingDecision = getKimiRoutingDecision(routingInput);
      
      // Calculate savings if routing to Kimi
      let estimatedSavings: number | undefined;
      if (routingDecision.recommendedModel === 'kimi' && trackSavings) {
        const inputTokens = Math.ceil(content.length * 0.25);
        const outputTokens = Math.ceil(inputTokens * 0.5);
        const savings = estimateKimiSavings(inputTokens, outputTokens);
        estimatedSavings = savings.savings;
      }
      
      // Build optimization context
      const optimizations: string[] = [];
      
      if (hasNonEnglish) {
        optimizations.push('Multilingual content detected - using Kimi optimization');
      }
      
      if (routingDecision.recommendedModel === 'kimi') {
        optimizations.push(`Kimi K2.5 recommended (confidence: ${(routingDecision.confidence * 100).toFixed(0)}%)`);
        if (estimatedSavings) {
          optimizations.push(`Estimated savings: $${estimatedSavings.toFixed(4)} vs Claude`);
        }
      }
      
      // Attach optimization metadata to request
      req.kimiOptimization = {
        detectedLanguage,
        hasNonEnglish,
        recommendedModel: routingDecision.recommendedModel,
        confidence: routingDecision.confidence,
        estimatedSavings,
        optimizations,
        contextRetention: routingDecision.recommendedModel === 'kimi' ? {
          retainTokens: KIMI_K25_CONFIG.maxInputTokens,
          advantageUsed: KIMI_K25_CONFIG.contextAdvantage,
          recommendation: 'Using Kimi\'s 256K context window',
        } : undefined,
      };
      
      // Auto-route if enabled
      if (autoRoute && routingDecision.recommendedModel === 'kimi') {
        // Override model selection in request
        if (!req.body.model || req.body.model === 'claude-sonnet-4-20250514') {
          req.body.model = KIMI_K25_CONFIG.modelId;
          req.body.provider = 'nim';
          optimizations.push(`Auto-routed to ${KIMI_K25_CONFIG.modelId}`);
        }
      }
      
      // Log decision if enabled
      if (logDecisions) {
        logger.info(
          {
            path: req.path,
            method: req.method,
            detectedLanguage,
            recommendedModel: routingDecision.recommendedModel,
            confidence: routingDecision.confidence,
            estimatedSavings,
            rationale: routingDecision.rationale,
          },
          'Kimi optimization decision'
        );
      }
      
      next();
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error), path: req.path },
        'Error in Kimi optimization middleware'
      );
      // Continue without optimization on error
      next();
    }
  };
}

/**
 * Middleware to optimize prompts for Kimi when detected
 */
export function kimiPromptOptimizationMiddleware(
  options: {
    optimizeSystemPrompt?: boolean;
    optimizeUserContent?: boolean;
  } = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const { optimizeSystemPrompt = true, optimizeUserContent = false } = options;
  
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const isKimiRequest = req.body.model?.includes('kimi') || 
                           req.body.provider === 'nim' ||
                           req.kimiOptimization?.recommendedModel === 'kimi';
      
      if (!isKimiRequest) {
        return next();
      }
      
      const systemPrompt = req.body.system || req.body.systemPrompt;
      const userContent = extractContent(req);
      
      if (systemPrompt || userContent) {
        const optimized = optimizePromptForKimi(
          systemPrompt || '',
          userContent || ''
        );
        
        if (optimizeSystemPrompt && optimized.optimizations.length > 0) {
          req.body.system = optimized.optimizedSystem;
          req.body.systemPrompt = optimized.optimizedSystem;
          
          logger.debug(
            { optimizations: optimized.optimizations },
            'System prompt optimized for Kimi'
          );
        }
        
        if (optimizeUserContent) {
          // Note: Modifying user content is more invasive, disabled by default
          // Could be enabled for specific use cases
        }
      }
      
      next();
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error in Kimi prompt optimization middleware'
      );
      next();
    }
  };
}

/**
 * Analytics middleware to track Kimi usage and savings
 */
export function kimiAnalyticsMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    // Store original end function
    const originalEnd = res.end.bind(res);
    
    // Override end to capture completion
    res.end = function(chunk?: any, encoding?: any, cb?: any): Response {
      const duration = Date.now() - startTime;
      
      // Log analytics data
      if (req.kimiOptimization) {
        logger.info(
          {
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
            duration,
            detectedLanguage: req.kimiOptimization.detectedLanguage,
            hasNonEnglish: req.kimiOptimization.hasNonEnglish,
            recommendedModel: req.kimiOptimization.recommendedModel,
            estimatedSavings: req.kimiOptimization.estimatedSavings,
            modelUsed: req.body.model,
            providerUsed: req.body.provider,
          },
          'Kimi analytics'
        );
      }
      
      // Call original end
      return originalEnd(chunk, encoding, cb);
    } as any;
    
    next();
  };
}

/**
 * Combined Kimi optimization middleware stack
 */
export function createKimiOptimizationStack(
  options: {
    autoRoute?: boolean;
    trackSavings?: boolean;
    logDecisions?: boolean;
    optimizePrompts?: boolean;
    trackAnalytics?: boolean;
  } = {}
): ((req: Request, res: Response, next: NextFunction) => void)[] {
  const {
    autoRoute = true,
    trackSavings = true,
    logDecisions = true,
    optimizePrompts = true,
    trackAnalytics = true,
  } = options;
  
  const stack: ((req: Request, res: Response, next: NextFunction) => void)[] = [];
  
  // Main optimization middleware
  stack.push(kimiOptimizationMiddleware({ autoRoute, trackSavings, logDecisions }));
  
  // Prompt optimization (if enabled)
  if (optimizePrompts) {
    stack.push(kimiPromptOptimizationMiddleware());
  }
  
  // Analytics tracking (if enabled)
  if (trackAnalytics) {
    stack.push(kimiAnalyticsMiddleware());
  }
  
  return stack;
}

// Default export - combined middleware
export default function kimiMiddleware(
  options?: Parameters<typeof createKimiOptimizationStack>[0]
): ((req: Request, res: Response, next: NextFunction) => void)[] {
  return createKimiOptimizationStack(options);
}
