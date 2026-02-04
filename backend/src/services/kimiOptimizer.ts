/**
 * Kimi K2.5 Optimizations
 *
 * Kimi K2.5 is NVIDIA's implementation of Moonshot AI's Kimi model with:
 * - 256K context window
 * - Cost-effective pricing ($0.6/M tokens)
 * - Superior multilingual support (especially Chinese)
 * - Strong coding capabilities
 * - OpenAI-compatible API via NIM
 *
 * Powered by NVIDIA NIM - https://build.nvidia.com/
 *
 * This module provides optimizations to leverage Kimi K2.5's unique strengths.
 */

import type { StreamParams } from '../services/llmGateway.js';

// Message type from StreamParams
type Message = StreamParams['messages'][number];
import logger from '../middleware/logger.js';

/**
 * Kimi K2.5 Configuration
 */
export const KIMI_K25_CONFIG = {
  modelId: 'moonshotai/kimi-k2.5',
  contextWindow: 256_000,
  // Reserve tokens for response
  maxInputTokens: 240_000,
  // Kimi has large context advantage - use this for:
  // - Extended conversation history
  // - Larger codebases
  // - More comprehensive documentation
  contextAdvantage: 56_000,
  // Optimal temperature settings for Kimi
  temperature: {
    coding: 0.1, // Low temp for deterministic code
    creative: 0.7, // Higher for creative tasks
    default: 0.3, // Balanced
  },
  // Token efficiency - Kimi is efficient with structured prompts
  tokenEfficiency: 0.95,
} as const;

/**
 * Detect if input contains non-English content
 * Kimi excels at multilingual tasks
 */
export function containsNonEnglish(text: string): boolean {
  // Check for CJK characters (Chinese, Japanese, Korean)
  const cjkRegex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;
  // Check for other non-Latin scripts
  const nonLatinRegex = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0900-\u097f\u0400-\u04ff]/;

  return cjkRegex.test(text) || nonLatinRegex.test(text);
}

/**
 * Calculate optimal context retention for Kimi
 * Maximizes use of Kimi's large context window
 */
export function calculateKimiContextRetention(
  currentTokens: number,
  maxTokens: number = 200_000
): {
  retainTokens: number;
  advantageUsed: number;
  recommendation: string;
} {
  const advantage = KIMI_K25_CONFIG.contextAdvantage;

  if (currentTokens <= maxTokens) {
    // Well within limits, can add more context
    return {
      retainTokens: currentTokens,
      advantageUsed: 0,
      recommendation: 'Can add up to 56K more tokens of context',
    };
  }

  if (currentTokens <= KIMI_K25_CONFIG.maxInputTokens) {
    // Using Kimi's extended context
    return {
      retainTokens: currentTokens,
      advantageUsed: currentTokens - maxTokens,
      recommendation: `Using ${currentTokens - maxTokens} of ${advantage} extra tokens`,
    };
  }

  // Exceeding even Kimi's limit - need truncation
  return {
    retainTokens: KIMI_K25_CONFIG.maxInputTokens,
    advantageUsed: advantage,
    recommendation: `Truncating to ${KIMI_K25_CONFIG.maxInputTokens} tokens`,
  };
}

/**
 * Optimize prompts specifically for Kimi K2.5
 * Kimi works well with structured, clear prompts
 */
export function optimizePromptForKimi(
  systemPrompt: string,
  userContent: string
): {
  optimizedSystem: string;
  optimizedUser: string;
  optimizations: string[];
} {
  const optimizations: string[] = [];

  // Detect language
  const hasNonEnglish = containsNonEnglish(userContent);

  // Optimize system prompt
  let optimizedSystem = systemPrompt;

  // Add multilingual instruction if needed
  if (hasNonEnglish) {
    optimizedSystem += `\n\n## Multilingual Support\nYou can understand and respond in multiple languages. Match the user's language and maintain technical accuracy across languages.`;
    optimizations.push('Added multilingual support instruction');
  }

  // Kimi prefers explicit formatting instructions
  if (!optimizedSystem.includes('## Output Format')) {
    optimizedSystem += `\n\n## Output Format\nProvide clear, well-structured responses. Use markdown formatting appropriately. For code, always include language tags and ensure syntax correctness.`;
    optimizations.push('Added output format guidance');
  }

  // Optimize user content if very long
  const optimizedUser = userContent;
  if (userContent.length > 10000 && !hasNonEnglish) {
    // For long English content, ensure clear structure
    if (!userContent.includes('#') && !userContent.includes('##')) {
      // No headers - might benefit from structure
      optimizations.push('Content is long but lacks structure');
    }
  }

  // If Chinese detected, ensure proper handling
  if (hasNonEnglish && /[\u4e00-\u9fff]/.test(userContent)) {
    optimizations.push('Chinese content detected - using optimized processing');
  }

  return {
    optimizedSystem,
    optimizedUser,
    optimizations,
  };
}

/**
 * Route to Kimi K2.5 when beneficial
 */
export function shouldRouteToKimi(request: {
  content: string;
  requiresTools: boolean;
  isComplex: boolean;
  hasImage: boolean;
  isCodeGeneration: boolean;
}): {
  useKimi: boolean;
  confidence: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let confidence = 0;

  // Multilingual content - Kimi excels here
  if (containsNonEnglish(request.content)) {
    confidence += 0.3;
    reasons.push('Multilingual content detected');
  }

  // Code generation - Kimi is strong and cheaper
  if (request.isCodeGeneration && !request.requiresTools) {
    confidence += 0.25;
    reasons.push('Code generation without tools - Kimi is 5x cheaper');
  }

  // Long context - use Kimi's extra 56K
  if (request.content.length > 150000) {
    confidence += 0.2;
    reasons.push("Long context - using Kimi's 256K window");
  }

  // Simple tasks - Kimi is cost-effective
  if (!request.isComplex && !request.requiresTools) {
    confidence += 0.25;
    reasons.push('Simple task - cost optimization with Kimi');
  }

  // Vision tasks - Kimi supports vision
  if (request.hasImage) {
    confidence += 0.15;
    reasons.push('Vision task - Kimi has vision capabilities');
  }

  // Tool requirements reduce confidence (Llama 405B may be better for complex tool use)
  if (request.requiresTools) {
    confidence -= 0.2;
    reasons.push('Note: Tool use may benefit from Llama 405B for complex scenarios');
  }

  const useKimi = confidence > 0.4;

  return {
    useKimi,
    confidence: Math.min(confidence, 1.0),
    reasons,
  };
}

/**
 * Estimate cost savings from using Kimi vs Llama 405B
 */
export function estimateKimiSavings(
  inputTokens: number,
  outputTokens: number,
  requestCount: number = 1
): {
  llama405bCost: number;
  kimiCost: number;
  savings: number;
  savingsPercent: number;
} {
  // Llama 405B pricing estimate: $5/M input, $15/M output
  const llama405bCost =
    ((inputTokens / 1_000_000) * 5.0 + (outputTokens / 1_000_000) * 15.0) * requestCount;

  // Kimi K2.5 pricing: $0.6/M input, $0.6/M output
  const kimiCost =
    ((inputTokens / 1_000_000) * 0.6 + (outputTokens / 1_000_000) * 0.6) * requestCount;

  const savings = llama405bCost - kimiCost;
  const savingsPercent = llama405bCost > 0 ? (savings / llama405bCost) * 100 : 0;

  return {
    llama405bCost,
    kimiCost,
    savings,
    savingsPercent,
  };
}

/**
 * Kimi-optimized conversation history management
 * Leverages the extra context window capacity
 */
export function optimizeConversationForKimi(
  messages: Message[],
  currentTokenCount: number
): {
  optimizedMessages: Message[];
  tokensRetained: number;
  advantageUtilized: boolean;
  summary?: string;
} {
  const standardLimit = 200_000;
  const maxKimiTokens = KIMI_K25_CONFIG.maxInputTokens;

  if (currentTokenCount <= standardLimit) {
    // Well within limits, return all messages
    return {
      optimizedMessages: messages,
      tokensRetained: currentTokenCount,
      advantageUtilized: false,
    };
  }

  if (currentTokenCount <= maxKimiTokens) {
    // Using Kimi's extended context
    logger.info(
      {
        tokens: currentTokenCount,
        advantage: currentTokenCount - standardLimit,
      },
      'Using Kimi K2.5 extended context'
    );

    return {
      optimizedMessages: messages,
      tokensRetained: currentTokenCount,
      advantageUtilized: true,
    };
  }

  // Exceeds even Kimi's limit - need to truncate
  // Keep last 20 messages (system is handled separately in StreamParams)
  const recentMessages = messages.slice(-20);

  return {
    optimizedMessages: recentMessages,
    tokensRetained: maxKimiTokens, // Approximate
    advantageUtilized: true,
    summary: `Retained ${recentMessages.length} most recent messages`,
  };
}

/**
 * Get Kimi K2.5 specific configuration for different task types
 */
export function getKimiTaskConfig(taskType: 'coding' | 'chat' | 'analysis' | 'creative') {
  const configs = {
    coding: {
      temperature: 0.1,
      maxTokens: 8192,
      topP: 0.95,
      presencePenalty: 0,
      frequencyPenalty: 0,
    },
    chat: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 0.9,
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    },
    analysis: {
      temperature: 0.3,
      maxTokens: 4096,
      topP: 0.95,
      presencePenalty: 0,
      frequencyPenalty: 0,
    },
    creative: {
      temperature: 0.8,
      maxTokens: 4096,
      topP: 0.95,
      presencePenalty: 0.2,
      frequencyPenalty: 0.2,
    },
  };

  return configs[taskType];
}

/**
 * Enhanced routing decision with Kimi K2.5 optimization
 * Integrates with existing model router
 */
export interface KimiRoutingInput {
  messageChars: number;
  messageCount: number;
  mode?: string;
  toolsRequested: boolean;
  multimodal: boolean;
  isComplex: boolean;
  detectedLanguage?: string;
  hasCode: boolean;
  contextSize: number;
}

export function getKimiRoutingDecision(input: KimiRoutingInput): {
  recommendedModel: 'kimi' | 'llama405b' | 'either';
  confidence: number;
  estimatedSavings?: number;
  rationale: string[];
} {
  const rationale: string[] = [];
  let kimiScore = 0;

  // Language preference
  if (input.detectedLanguage && !['en', 'english'].includes(input.detectedLanguage.toLowerCase())) {
    kimiScore += 30;
    rationale.push(`Multilingual content (${input.detectedLanguage}) - Kimi excels here`);
  }

  // Context size advantage
  if (input.contextSize > 150000) {
    kimiScore += 25;
    rationale.push("Large context - using Kimi's 256K window");
  }

  // Code generation (Kimi is strong and cheaper)
  if (input.hasCode && !input.toolsRequested) {
    kimiScore += 20;
    rationale.push('Code generation - Kimi is capable and 5x cheaper');
  }

  // Simple tasks
  if (!input.isComplex && !input.toolsRequested && input.messageChars < 5000) {
    kimiScore += 15;
    rationale.push('Simple task - cost-effective with Kimi');
  }

  // Tool requirements favor Llama 405B for complex scenarios
  if (input.toolsRequested) {
    kimiScore -= 20;
    rationale.push('Tool use required - Llama 405B may be more reliable for complex tool chains');
  }

  // Very complex tasks may favor larger models
  if (input.isComplex && input.messageChars > 10000) {
    kimiScore -= 15;
    rationale.push('Complex task - Llama 405B reasoning may be superior');
  }

  // Calculate confidence and recommendation
  let recommendedModel: 'kimi' | 'llama405b' | 'either';
  let confidence: number;

  if (kimiScore >= 40) {
    recommendedModel = 'kimi';
    confidence = Math.min(kimiScore / 100, 0.95);
  } else if (kimiScore <= -20) {
    recommendedModel = 'llama405b';
    confidence = Math.min(Math.abs(kimiScore) / 100, 0.95);
  } else {
    recommendedModel = 'either';
    confidence = 0.5;
  }

  // Estimate savings
  const estimatedInputTokens = Math.ceil(input.messageChars * 0.25);
  const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 0.5);
  const savings = estimateKimiSavings(estimatedInputTokens, estimatedOutputTokens);

  return {
    recommendedModel,
    confidence,
    estimatedSavings: savings.savings,
    rationale,
  };
}
