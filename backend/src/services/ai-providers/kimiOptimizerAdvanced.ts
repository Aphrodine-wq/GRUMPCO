/**
 * Kimi K2.5 Advanced Optimizations
 *
 * Comprehensive optimizations for Kimi K2.5 including:
 * - Advanced multilingual support (20+ languages)
 * - Token optimization and compression
 * - Context window management for 256K
 * - Smart routing with ML-like scoring
 * - Performance analytics
 * - Advanced prompt engineering
 *
 * Powered by NVIDIA NIM - https://build.nvidia.com/
 */

import type { StreamParams } from "./llmGateway.js";
import _logger from "../../middleware/logger.js";

// Message type from StreamParams
type Message = StreamParams["messages"][number];

/**
 * Kimi K2.5 Configuration
 */
export const KIMI_K25_CONFIG = {
  modelId: "moonshotai/kimi-k2.5",
  provider: "nim" as const,
  contextWindow: 256_000,
  maxInputTokens: 240_000,
  contextAdvantage: 56_000, // Extended context window capacity

  // Pricing: $0.6/M tokens (both input/output)
  pricing: {
    inputPerMillion: 0.6,
    outputPerMillion: 0.6,
  },

  // Optimal parameters
  temperature: {
    coding: 0.1,
    creative: 0.7,
    analysis: 0.3,
    chat: 0.7,
    default: 0.3,
  },

  // Token efficiency
  tokenEfficiency: 0.95,

  // Performance characteristics
  performance: {
    avgLatencyMs: 1800,
    tokensPerSecond: 45,
    reliability: 0.995,
  },
} as const;

/**
 * Supported Languages with Kimi optimization weights
 * Kimi excels at these languages due to training
 */
export const SUPPORTED_LANGUAGES = {
  // CJK - Kimi's strongest languages
  zh: { name: "Chinese", weight: 1.0, script: "CJK" },
  ja: { name: "Japanese", weight: 1.0, script: "CJK" },
  ko: { name: "Korean", weight: 0.95, script: "CJK" },

  // Other Asian languages
  th: { name: "Thai", weight: 0.85, script: "Thai" },
  vi: { name: "Vietnamese", weight: 0.85, script: "Latin" },
  id: { name: "Indonesian", weight: 0.8, script: "Latin" },
  ms: { name: "Malay", weight: 0.8, script: "Latin" },

  // European
  en: { name: "English", weight: 0.95, script: "Latin" },
  es: { name: "Spanish", weight: 0.85, script: "Latin" },
  fr: { name: "French", weight: 0.85, script: "Latin" },
  de: { name: "German", weight: 0.85, script: "Latin" },
  it: { name: "Italian", weight: 0.85, script: "Latin" },
  pt: { name: "Portuguese", weight: 0.85, script: "Latin" },
  ru: { name: "Russian", weight: 0.85, script: "Cyrillic" },

  // Middle Eastern
  ar: { name: "Arabic", weight: 0.8, script: "Arabic" },
  he: { name: "Hebrew", weight: 0.75, script: "Hebrew" },
  fa: { name: "Persian", weight: 0.75, script: "Arabic" },

  // South Asian
  hi: { name: "Hindi", weight: 0.8, script: "Devanagari" },
  bn: { name: "Bengali", weight: 0.75, script: "Bengali" },
  ta: { name: "Tamil", weight: 0.75, script: "Tamil" },
  ur: { name: "Urdu", weight: 0.75, script: "Arabic" },
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

/**
 * Detect language from text with confidence score
 */
export function detectLanguageAdvanced(text: string): {
  language: LanguageCode;
  confidence: number;
  script: string;
  isMultilingual: boolean;
} {
  const langScores: Record<string, number> = {};

  // Chinese detection (simplified and traditional)
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  if (chineseChars > 0) {
    langScores["zh"] = chineseChars * 2; // Higher weight for Chinese
  }

  // Japanese detection
  const japaneseChars = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || [])
    .length;
  if (japaneseChars > 0) {
    langScores["ja"] = japaneseChars * 2;
  }

  // Korean detection
  const koreanChars = (text.match(/[\uac00-\ud7af]/g) || []).length;
  if (koreanChars > 0) {
    langScores["ko"] = koreanChars * 2;
  }

  // Arabic detection
  const arabicChars = (text.match(/[\u0600-\u06ff]/g) || []).length;
  if (arabicChars > 0) {
    langScores["ar"] = arabicChars * 1.5;
  }

  // Cyrillic detection
  const cyrillicChars = (text.match(/[\u0400-\u04ff]/g) || []).length;
  if (cyrillicChars > 0) {
    langScores["ru"] = cyrillicChars * 1.5;
  }

  // Devanagari (Hindi)
  const devanagariChars = (text.match(/[\u0900-\u097f]/g) || []).length;
  if (devanagariChars > 0) {
    langScores["hi"] = devanagariChars * 1.5;
  }

  // Thai detection
  const thaiChars = (text.match(/[\u0e00-\u0e7f]/g) || []).length;
  if (thaiChars > 0) {
    langScores["th"] = thaiChars * 1.5;
  }

  // Hebrew detection
  const hebrewChars = (text.match(/[\u0590-\u05ff]/g) || []).length;
  if (hebrewChars > 0) {
    langScores["he"] = hebrewChars * 1.5;
  }

  // Default to English if no specific script detected
  if (Object.keys(langScores).length === 0) {
    return {
      language: "en",
      confidence: 0.6,
      script: "Latin",
      isMultilingual: false,
    };
  }

  // Find highest scoring language
  const detectedLang = Object.entries(langScores).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const totalChars = text.length;
  const confidence = Math.min(detectedLang[1] / (totalChars * 0.3), 1.0);

  // Check for multilingual content
  const significantLangs = Object.entries(langScores).filter(
    ([_, score]) => score > 10,
  );
  const isMultilingual = significantLangs.length > 1;

  const langCode = detectedLang[0] as LanguageCode;
  const langInfo = SUPPORTED_LANGUAGES[langCode];

  return {
    language: langCode,
    confidence,
    script: langInfo?.script || "Unknown",
    isMultilingual,
  };
}

/**
 * Calculate optimal context retention for Kimi
 */
export function calculateKimiContextRetention(
  currentTokens: number,
  maxTokens: number = 200_000, // Claude's limit for comparison
): {
  retainTokens: number;
  advantageUsed: number;
  advantagePercent: number;
  recommendation: string;
  strategy: "full" | "partial" | "truncate";
} {
  const advantage = KIMI_K25_CONFIG.contextAdvantage;

  if (currentTokens <= maxTokens) {
    return {
      retainTokens: currentTokens,
      advantageUsed: 0,
      advantagePercent: 0,
      recommendation: `Can add up to ${advantage.toLocaleString()} more tokens of context`,
      strategy: "full",
    };
  }

  if (currentTokens <= KIMI_K25_CONFIG.maxInputTokens) {
    const used = currentTokens - maxTokens;
    return {
      retainTokens: currentTokens,
      advantageUsed: used,
      advantagePercent: (used / advantage) * 100,
      recommendation: `Using ${used.toLocaleString()} of ${advantage.toLocaleString()} extra tokens (${((used / advantage) * 100).toFixed(1)}%)`,
      strategy: "partial",
    };
  }

  return {
    retainTokens: KIMI_K25_CONFIG.maxInputTokens,
    advantageUsed: advantage,
    advantagePercent: 100,
    recommendation: `Truncating to ${KIMI_K25_CONFIG.maxInputTokens.toLocaleString()} tokens (100% advantage used)`,
    strategy: "truncate",
  };
}

/**
 * Smart token estimation with Kimi efficiency factor
 */
export function estimateTokensKimi(text: string): {
  estimatedTokens: number;
  confidence: number;
  method: "chars" | "words" | "hybrid";
} {
  const charCount = text.length;
  const wordCount = text.split(/\s+/).length;

  // Kimi uses roughly 1.5-2.0 chars per token (more efficient than Claude)
  const charBased = charCount / 2.0;
  const wordBased = wordCount * 1.3;

  // Hybrid approach: use character-based for code, word-based for prose
  const hasCode =
    /[{};<>/()]/.test(text) ||
    text.includes("function") ||
    text.includes("def ");

  if (hasCode) {
    return {
      estimatedTokens: Math.ceil(charBased * KIMI_K25_CONFIG.tokenEfficiency),
      confidence: 0.85,
      method: "chars",
    };
  }

  // Average of both methods
  const hybrid = (charBased + wordBased) / 2;

  return {
    estimatedTokens: Math.ceil(hybrid * KIMI_K25_CONFIG.tokenEfficiency),
    confidence: 0.75,
    method: "hybrid",
  };
}

/**
 * Advanced prompt optimization for Kimi K2.5
 */
export function optimizePromptForKimi(
  systemPrompt: string,
  userContent: string,
  options: {
    taskType?: "coding" | "analysis" | "creative" | "chat";
    enableMultilingual?: boolean;
    optimizeStructure?: boolean;
  } = {},
): {
  optimizedSystem: string;
  optimizedUser: string;
  optimizations: string[];
  estimatedTokens: number;
} {
  const {
    taskType = "default",
    enableMultilingual = true,
    optimizeStructure = true,
  } = options;
  const optimizations: string[] = [];

  // Detect language
  const langInfo = detectLanguageAdvanced(userContent);

  let optimizedSystem = systemPrompt;
  const optimizedUser = userContent;

  // Add multilingual support if needed
  if (enableMultilingual && langInfo.language !== "en") {
    const langName =
      SUPPORTED_LANGUAGES[langInfo.language]?.name || langInfo.language;
    optimizedSystem += `\n\n## Multilingual Support (${langName})\nRespond in ${langName} with the same level of technical precision as English. Maintain all technical terminology accurately.`;
    optimizations.push(
      `Added ${langName} support (${(langInfo.confidence * 100).toFixed(0)}% confidence)`,
    );
  }

  // Add task-specific instructions
  const taskInstructions: Record<string, string> = {
    coding:
      "\n\n## Code Generation Guidelines\n- Provide complete, runnable code\n- Include error handling\n- Add comments for complex logic\n- Follow language best practices",
    analysis:
      "\n\n## Analysis Guidelines\n- Break down complex topics step by step\n- Provide specific examples\n- Consider edge cases\n- Summarize key findings",
    creative:
      "\n\n## Creative Guidelines\n- Think divergently and explore multiple angles\n- Provide novel insights\n- Balance creativity with practicality",
    chat: "\n\n## Conversation Guidelines\n- Be conversational but informative\n- Ask clarifying questions when needed\n- Maintain context across messages",
  };

  if (taskInstructions[taskType] && !optimizedSystem.includes("## ")) {
    optimizedSystem += taskInstructions[taskType];
    optimizations.push(`Added ${taskType}-specific guidelines`);
  }

  // Structure optimization
  if (optimizeStructure && userContent.length > 5000) {
    if (!userContent.includes("#") && !userContent.includes("##")) {
      optimizations.push("Consider adding headers for better structure");
    }
  }

  // Token estimation
  const systemTokens = estimateTokensKimi(optimizedSystem);
  const userTokens = estimateTokensKimi(optimizedUser);
  const estimatedTokens =
    systemTokens.estimatedTokens + userTokens.estimatedTokens;

  return {
    optimizedSystem,
    optimizedUser,
    optimizations,
    estimatedTokens,
  };
}

/**
 * Smart routing decision for Kimi K2.5
 */
export function shouldRouteToKimi(request: {
  content: string;
  requiresTools: boolean;
  isComplex: boolean;
  hasImage: boolean;
  isCodeGeneration: boolean;
  estimatedTokens?: number;
}): {
  useKimi: boolean;
  confidence: number;
  score: number;
  reasons: string[];
  recommendations: string[];
} {
  const reasons: string[] = [];
  const recommendations: string[] = [];
  let score = 50; // Base score

  // Language detection (up to +30 points)
  const langInfo = detectLanguageAdvanced(request.content);
  if (langInfo.language !== "en") {
    const langWeight = SUPPORTED_LANGUAGES[langInfo.language]?.weight || 0.5;
    score += Math.floor(30 * langWeight);
    reasons.push(
      `${SUPPORTED_LANGUAGES[langInfo.language]?.name || langInfo.language} content detected`,
    );
  }

  // Code generation (up to +25 points)
  if (request.isCodeGeneration) {
    score += request.requiresTools ? 10 : 25;
    reasons.push(
      request.requiresTools
        ? "Code with tools"
        : "Code generation - Kimi excels here",
    );
    recommendations.push("Kimi is 5x cheaper for code generation");
  }

  // Context size (up to +20 points)
  const tokens =
    request.estimatedTokens ||
    estimateTokensKimi(request.content).estimatedTokens;
  if (tokens > 180000) {
    score += 20;
    reasons.push("Large context - using 256K window advantage");
  } else if (tokens > 100000) {
    score += 10;
    reasons.push("Medium context - some advantage available");
  }

  // Simple tasks (up to +15 points)
  if (!request.isComplex && !request.requiresTools && tokens < 10000) {
    score += 15;
    reasons.push("Simple task - cost optimization opportunity");
  }

  // Vision (up to +10 points)
  if (request.hasImage) {
    score += 10;
    reasons.push("Vision task supported");
  }

  // Tool requirements (down to -20 points)
  if (request.requiresTools && !request.isCodeGeneration) {
    score -= 20;
    reasons.push("Tool use may have limited support");
    recommendations.push("Consider testing tool compatibility");
  }

  // Complex reasoning (down to -15 points)
  if (request.isComplex && tokens > 15000) {
    score -= 15;
    reasons.push("Complex reasoning task");
    recommendations.push("Consider using alternative for complex reasoning");
  }

  const confidence = Math.min(score / 100, 0.95);
  const useKimi = score >= 60;

  return {
    useKimi,
    confidence,
    score,
    reasons,
    recommendations,
  };
}

/**
 * Cost analysis for Kimi vs alternatives
 */
export function analyzeKimiCost(
  inputTokens: number,
  outputTokens: number,
  alternatives: Array<{
    name: string;
    inputPrice: number;
    outputPrice: number;
  }> = [
    { name: "GPT-4", inputPrice: 30.0, outputPrice: 60.0 },
    { name: "Gemini Pro", inputPrice: 3.5, outputPrice: 10.5 },
  ],
): {
  kimiCost: number;
  comparisons: Array<{
    name: string;
    cost: number;
    savings: number;
    savingsPercent: number;
  }>;
  cheapest: string;
  recommendation: string;
} {
  const kimiInputCost =
    (inputTokens / 1_000_000) * KIMI_K25_CONFIG.pricing.inputPerMillion;
  const kimiOutputCost =
    (outputTokens / 1_000_000) * KIMI_K25_CONFIG.pricing.outputPerMillion;
  const kimiTotal = kimiInputCost + kimiOutputCost;

  const comparisons = alternatives.map((alt) => {
    const altInput = (inputTokens / 1_000_000) * alt.inputPrice;
    const altOutput = (outputTokens / 1_000_000) * alt.outputPrice;
    const altTotal = altInput + altOutput;

    return {
      name: alt.name,
      cost: altTotal,
      savings: altTotal - kimiTotal,
      savingsPercent: ((altTotal - kimiTotal) / altTotal) * 100,
    };
  });

  const allOptions = [
    { name: "Kimi K2.5", cost: kimiTotal, savings: 0, savingsPercent: 0 },
    ...comparisons,
  ];
  const cheapest = allOptions.sort((a, b) => a.cost - b.cost)[0];

  return {
    kimiCost: kimiTotal,
    comparisons,
    cheapest: cheapest.name,
    recommendation:
      cheapest.name === "Kimi K2.5"
        ? `Kimi K2.5 is cheapest at $${kimiTotal.toFixed(4)}`
        : `${cheapest.name} is cheaper by $${(kimiTotal - cheapest.cost).toFixed(4)}`,
  };
}

/**
 * Conversation optimization for 256K context
 */
export function optimizeConversationForKimi(
  messages: Message[],
  currentTokenCount: number,
  options: {
    preserveSystem?: boolean;
    recentMessageCount?: number;
    summaryThreshold?: number;
  } = {},
): {
  optimizedMessages: Message[];
  tokensRetained: number;
  tokensSaved: number;
  strategy: "full" | "recent" | "summarized";
  summary?: string;
} {
  const {
    preserveSystem: _preserveSystem = true,
    recentMessageCount = 50,
    summaryThreshold: _summaryThreshold = 200000,
  } = options;

  const maxTokens = KIMI_K25_CONFIG.maxInputTokens;

  // If within limits, keep everything
  if (currentTokenCount <= maxTokens) {
    return {
      optimizedMessages: messages,
      tokensRetained: currentTokenCount,
      tokensSaved: 0,
      strategy: "full",
    };
  }

  // Keep recent messages
  const recent = messages.slice(-recentMessageCount);
  const recentTokens = estimateTokensKimi(
    recent.map((m) => m.content).join(" "),
  ).estimatedTokens;

  if (recentTokens <= maxTokens) {
    return {
      optimizedMessages: recent,
      tokensRetained: recentTokens,
      tokensSaved: currentTokenCount - recentTokens,
      strategy: "recent",
      summary: `Retained last ${recent.length} messages`,
    };
  }

  // Need to summarize or truncate further
  const truncated = recent.slice(-20);
  const truncatedTokens = estimateTokensKimi(
    truncated.map((m) => m.content).join(" "),
  ).estimatedTokens;

  return {
    optimizedMessages: truncated,
    tokensRetained: truncatedTokens,
    tokensSaved: currentTokenCount - truncatedTokens,
    strategy: "summarized",
    summary: `Retained last ${truncated.length} most recent messages`,
  };
}

/**
 * Task configuration presets
 */
export function getKimiTaskConfig(
  taskType: "coding" | "chat" | "analysis" | "creative" | "vision",
) {
  const configs = {
    coding: {
      model: KIMI_K25_CONFIG.modelId,
      temperature: 0.1,
      maxTokens: 8192,
      topP: 0.95,
      frequencyPenalty: 0,
      presencePenalty: 0,
    },
    chat: {
      model: KIMI_K25_CONFIG.modelId,
      temperature: 0.7,
      maxTokens: 4096,
      topP: 0.9,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1,
    },
    analysis: {
      model: KIMI_K25_CONFIG.modelId,
      temperature: 0.3,
      maxTokens: 4096,
      topP: 0.95,
      frequencyPenalty: 0,
      presencePenalty: 0,
    },
    creative: {
      model: KIMI_K25_CONFIG.modelId,
      temperature: 0.8,
      maxTokens: 4096,
      topP: 0.95,
      frequencyPenalty: 0.2,
      presencePenalty: 0.2,
    },
    vision: {
      model: KIMI_K25_CONFIG.modelId,
      temperature: 0.3,
      maxTokens: 4096,
      topP: 0.95,
      frequencyPenalty: 0,
      presencePenalty: 0,
    },
  };

  return configs[taskType];
}

/**
 * Performance metrics tracking
 */
export interface KimiPerformanceMetrics {
  requestCount: number;
  totalTokens: number;
  avgLatencyMs: number;
  errorRate: number;
  costSavings: number;
  multilingualRequests: number;
  contextAdvantageUsed: number;
}

export function createKimiMetrics(): KimiPerformanceMetrics {
  return {
    requestCount: 0,
    totalTokens: 0,
    avgLatencyMs: 0,
    errorRate: 0,
    costSavings: 0,
    multilingualRequests: 0,
    contextAdvantageUsed: 0,
  };
}

/**
 * Routing input interface
 */
export interface KimiRoutingInput {
  messageChars: number;
  messageCount: number;
  mode?: string;
  toolsRequested: boolean;
  multimodal: boolean;
  isComplex: boolean;
  detectedLanguage?: LanguageCode;
  hasCode: boolean;
  contextSize: number;
  estimatedTokens: number;
}

/**
 * Enhanced routing decision
 */
export function getKimiRoutingDecision(input: KimiRoutingInput): {
  recommendedProvider: "nim" | "zhipu" | "openrouter" | "local";
  recommendedModel: string;
  confidence: number;
  score: number;
  estimatedSavings: number;
  rationale: string[];
  alternatives: Array<{ provider: string; model: string; confidence: number }>;
} {
  const rationale: string[] = [];
  let score = 50;

  // Language scoring
  if (input.detectedLanguage && input.detectedLanguage !== "en") {
    const weight = SUPPORTED_LANGUAGES[input.detectedLanguage]?.weight || 0.5;
    score += Math.floor(30 * weight);
    rationale.push(
      `${SUPPORTED_LANGUAGES[input.detectedLanguage]?.name} content (${(weight * 100).toFixed(0)}% weight)`,
    );
  }

  // Context scoring
  if (input.contextSize > 180000) {
    score += 20;
    rationale.push("Large context (256K window advantage)");
  }

  // Code scoring
  if (input.hasCode && !input.toolsRequested) {
    score += 20;
    rationale.push("Code generation (5x cost savings)");
  }

  // Simple task bonus
  if (!input.isComplex && input.messageChars < 10000) {
    score += 15;
    rationale.push("Simple task optimization");
  }

  // Tool penalty
  if (input.toolsRequested) {
    score -= 15;
    rationale.push("Tool use consideration");
  }

  const confidence = Math.min(score / 100, 0.95);

  // Calculate savings
  const inputTokens = Math.ceil(input.messageChars * 0.25);
  const outputTokens = Math.ceil(inputTokens * 0.5);
  const kimiCost = ((inputTokens + outputTokens) / 1_000_000) * 1.2; // $0.6 each way
  const typicalCost = ((inputTokens + outputTokens) / 1_000_000) * 18.0; // Claude-like pricing
  const estimatedSavings = typicalCost - kimiCost;

  return {
    recommendedProvider: "nim",
    recommendedModel: KIMI_K25_CONFIG.modelId,
    confidence,
    score,
    estimatedSavings,
    rationale,
    alternatives: [
      { provider: "zhipu", model: "glm-4", confidence: 0.6 },
      {
        provider: "openrouter",
        model: "openrouter/moonshotai/kimi-k2.5",
        confidence: 0.8,
      },
    ],
  };
}

// Re-export basic functions for compatibility
export { containsNonEnglish } from "./kimiOptimizer.js";
export { estimateKimiSavings } from "./kimiOptimizer.js";
