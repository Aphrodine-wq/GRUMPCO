/**
 * @grump/kimi - Kimi K2.5 Optimization and Integration Package
 * 
 * Kimi K2.5 is NVIDIA's implementation of Moonshot AI's Kimi model with:
 * - 256K context window (vs Claude's 200K)
 * - 5x cheaper pricing ($0.6/M vs $3/M)
 * - Superior multilingual support (especially Chinese)
 * - Strong coding capabilities
 * - Vision/multimodal capabilities
 * - OpenAI-compatible API via NIM
 * 
 * This package provides:
 * - Type definitions for Kimi-specific operations
 * - Client-side optimization utilities
 * - Routing decision helpers
 * - Cost estimation utilities
 */

// ============================================
// Configuration Constants
// ============================================

/**
 * Kimi K2.5 model configuration
 */
export const KIMI_K25_CONFIG = {
  /** Model ID for NIM/OpenRouter */
  modelId: 'moonshotai/kimi-k2.5',
  /** Total context window size in tokens */
  contextWindow: 256_000,
  /** Maximum input tokens (reserving for output) */
  maxInputTokens: 240_000,
  /** Context advantage over Claude (56K extra tokens) */
  contextAdvantage: 56_000,
  /** Temperature settings by task type */
  temperature: {
    coding: 0.1,
    creative: 0.7,
    analysis: 0.3,
    chat: 0.7,
    default: 0.3,
  },
  /** Pricing per million tokens (USD) */
  pricing: {
    inputPerMillion: 0.6,
    outputPerMillion: 0.6,
  },
  /** Token efficiency compared to alternatives */
  tokenEfficiency: 0.95,
} as const;

/**
 * Agent IDs used in swarm orchestration
 */
export const SWARM_AGENT_IDS = [
  'arch',      // Architecture agent
  'frontend',  // Frontend generation
  'backend',   // Backend generation
  'devops',    // DevOps/infrastructure
  'test',      // Test generation
  'docs',      // Documentation
  'ux',        // UX specialist
  'security',  // Security analysis
  'perf',      // Performance optimization
  'a11y',      // Accessibility
  'data',      // Data/database
  'review',    // Code review
] as const;

export type SwarmAgentId = typeof SWARM_AGENT_IDS[number];

// ============================================
// Design-to-Code Types
// ============================================

/**
 * Supported frameworks for design-to-code generation
 */
export type DesignToCodeFramework = 'svelte' | 'react' | 'vue' | 'flutter';

/**
 * Input for design-to-code generation
 */
export interface DesignToCodeInput {
  /** Image as base64 string (no data URL prefix) or Buffer */
  image?: string | Buffer;
  /** Optional Figma or image URL (if no image buffer) */
  figmaUrl?: string;
  /** Description of what to build or requirements */
  description: string;
  /** Target framework for code generation */
  targetFramework: DesignToCodeFramework;
}

/**
 * Result from design-to-code generation
 */
export interface DesignToCodeResult {
  /** Generated code */
  code: string;
  /** Optional explanation of the generated code */
  explanation?: string;
}

// ============================================
// Task Configuration Types
// ============================================

export type TaskType = 'coding' | 'chat' | 'analysis' | 'creative';

/**
 * Task-specific configuration for optimal Kimi performance
 */
export interface TaskConfig {
  temperature: number;
  maxTokens: number;
  topP: number;
  presencePenalty: number;
  frequencyPenalty: number;
}

/**
 * Get optimal Kimi configuration for a task type
 */
export function getTaskConfig(taskType: TaskType): TaskConfig {
  const configs: Record<TaskType, TaskConfig> = {
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

// ============================================
// Language Detection
// ============================================

/**
 * Detect if input contains non-English content
 * Kimi excels at multilingual tasks, especially CJK languages
 */
export function containsNonEnglish(text: string): boolean {
  // Check for CJK characters (Chinese, Japanese, Korean)
  const cjkRegex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;
  // Check for other non-Latin scripts (Arabic, Hindi, Cyrillic, etc.)
  const nonLatinRegex = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0900-\u097f\u0400-\u04ff]/;
  
  return cjkRegex.test(text) || nonLatinRegex.test(text);
}

/**
 * Detect specific language types in content
 */
export function detectLanguage(text: string): {
  hasChinese: boolean;
  hasJapanese: boolean;
  hasKorean: boolean;
  hasArabic: boolean;
  hasCyrillic: boolean;
  hasHindi: boolean;
  isMultilingual: boolean;
} {
  return {
    hasChinese: /[\u4e00-\u9fff]/.test(text),
    hasJapanese: /[\u3040-\u309f\u30a0-\u30ff]/.test(text),
    hasKorean: /[\uac00-\ud7af]/.test(text),
    hasArabic: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(text),
    hasCyrillic: /[\u0400-\u04ff]/.test(text),
    hasHindi: /[\u0900-\u097f]/.test(text),
    isMultilingual: containsNonEnglish(text),
  };
}

// ============================================
// Context Management
// ============================================

/**
 * Result of context retention calculation
 */
export interface ContextRetentionResult {
  /** Number of tokens to retain */
  retainTokens: number;
  /** How much of Kimi's advantage is being used */
  advantageUsed: number;
  /** Recommendation for context management */
  recommendation: string;
  /** Whether Kimi's extended context is beneficial */
  usingExtendedContext: boolean;
}

/**
 * Calculate optimal context retention for Kimi
 * Uses the extra 56K tokens over Claude for better context
 */
export function calculateContextRetention(
  currentTokens: number,
  claudeLimit: number = 200_000
): ContextRetentionResult {
  const advantage = KIMI_K25_CONFIG.contextAdvantage;
  
  if (currentTokens <= claudeLimit) {
    return {
      retainTokens: currentTokens,
      advantageUsed: 0,
      recommendation: `Can add up to ${advantage.toLocaleString()} more tokens of context`,
      usingExtendedContext: false,
    };
  }
  
  if (currentTokens <= KIMI_K25_CONFIG.maxInputTokens) {
    return {
      retainTokens: currentTokens,
      advantageUsed: currentTokens - claudeLimit,
      recommendation: `Using ${(currentTokens - claudeLimit).toLocaleString()} of ${advantage.toLocaleString()} extra tokens`,
      usingExtendedContext: true,
    };
  }
  
  return {
    retainTokens: KIMI_K25_CONFIG.maxInputTokens,
    advantageUsed: advantage,
    recommendation: `Truncating to ${KIMI_K25_CONFIG.maxInputTokens.toLocaleString()} tokens (exceeds Kimi limit)`,
    usingExtendedContext: true,
  };
}

// ============================================
// Cost Estimation
// ============================================

/**
 * Cost comparison result
 */
export interface CostComparison {
  /** Cost if using Kimi */
  kimiCost: number;
  /** Cost if using Claude */
  claudeCost: number;
  /** Absolute savings amount */
  savings: number;
  /** Savings as percentage */
  savingsPercent: number;
  /** Human-readable summary */
  summary: string;
}

/**
 * Estimate cost savings from using Kimi vs Claude
 */
export function estimateSavings(
  inputTokens: number,
  outputTokens: number,
  requestCount: number = 1
): CostComparison {
  // Claude Sonnet pricing: $3/M input, $15/M output
  const claudeCost = ((inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0) * requestCount;
  
  // Kimi K2.5 pricing: $0.6/M input, $0.6/M output
  const kimiCost = ((inputTokens / 1_000_000) * KIMI_K25_CONFIG.pricing.inputPerMillion + 
                   (outputTokens / 1_000_000) * KIMI_K25_CONFIG.pricing.outputPerMillion) * requestCount;
  
  const savings = claudeCost - kimiCost;
  const savingsPercent = claudeCost > 0 ? (savings / claudeCost) * 100 : 0;
  
  return {
    kimiCost,
    claudeCost,
    savings,
    savingsPercent,
    summary: `Kimi: $${kimiCost.toFixed(4)} vs Claude: $${claudeCost.toFixed(4)} (${savingsPercent.toFixed(1)}% savings)`,
  };
}

/**
 * Estimate tokens from character count
 * Approximate: 1 token ≈ 4 characters for English
 */
export function estimateTokens(characterCount: number): number {
  return Math.ceil(characterCount / 4);
}

// ============================================
// Routing Decisions
// ============================================

/**
 * Input for routing decision
 */
export interface RoutingInput {
  /** Content to analyze */
  content: string;
  /** Whether tools/function calling is required */
  requiresTools: boolean;
  /** Whether this is a complex reasoning task */
  isComplex: boolean;
  /** Whether images are included */
  hasImage: boolean;
  /** Whether this is primarily code generation */
  isCodeGeneration: boolean;
}

/**
 * Routing decision result
 */
export interface RoutingDecision {
  /** Whether to use Kimi */
  useKimi: boolean;
  /** Confidence level (0-1) */
  confidence: number;
  /** Reasons for the decision */
  reasons: string[];
  /** Estimated cost savings if using Kimi */
  estimatedSavings?: CostComparison;
}

/**
 * Determine whether to route to Kimi K2.5
 */
export function shouldRouteToKimi(input: RoutingInput): RoutingDecision {
  const reasons: string[] = [];
  let confidence = 0;
  
  // Multilingual content - Kimi excels here
  if (containsNonEnglish(input.content)) {
    confidence += 0.3;
    reasons.push('Multilingual content detected - Kimi excels here');
  }
  
  // Code generation - Kimi is strong and cheaper
  if (input.isCodeGeneration && !input.requiresTools) {
    confidence += 0.25;
    reasons.push('Code generation without tools - Kimi is 5x cheaper');
  }
  
  // Long context - use Kimi's extra 56K
  if (input.content.length > 150000) {
    confidence += 0.2;
    reasons.push("Long context - using Kimi's 256K window");
  }
  
  // Simple tasks - Kimi is cost-effective
  if (!input.isComplex && !input.requiresTools) {
    confidence += 0.25;
    reasons.push('Simple task - cost optimization with Kimi');
  }
  
  // Vision tasks - Kimi supports vision
  if (input.hasImage) {
    confidence += 0.15;
    reasons.push('Vision task - Kimi has multimodal capabilities');
  }
  
  // Tool requirements reduce confidence (Claude's tool use is more mature)
  if (input.requiresTools) {
    confidence -= 0.2;
    reasons.push('Note: Tool use may be more reliable with Claude');
  }
  
  const useKimi = confidence > 0.4;
  
  // Estimate savings
  const inputTokens = estimateTokens(input.content.length);
  const outputTokens = Math.ceil(inputTokens * 0.5);
  const estimatedSavings = estimateSavings(inputTokens, outputTokens);
  
  return {
    useKimi,
    confidence: Math.min(Math.max(confidence, 0), 1.0),
    reasons,
    estimatedSavings,
  };
}

// ============================================
// Enhanced Routing (Detailed Analysis)
// ============================================

/**
 * Detailed routing input for comprehensive analysis
 */
export interface EnhancedRoutingInput {
  /** Total characters in messages */
  messageChars: number;
  /** Number of messages in conversation */
  messageCount: number;
  /** Current mode (chat, ship, codegen, etc.) */
  mode?: string;
  /** Whether tools/functions are requested */
  toolsRequested: boolean;
  /** Whether multimodal (images) are included */
  multimodal: boolean;
  /** Whether this is a complex reasoning task */
  isComplex: boolean;
  /** Detected language if known */
  detectedLanguage?: string;
  /** Whether content includes code */
  hasCode: boolean;
  /** Estimated context size in tokens */
  contextSize: number;
}

/**
 * Enhanced routing decision with detailed analysis
 */
export interface EnhancedRoutingDecision {
  /** Recommended model */
  recommendedModel: 'kimi' | 'claude' | 'either';
  /** Confidence level (0-1) */
  confidence: number;
  /** Estimated dollar savings */
  estimatedSavings?: number;
  /** Detailed rationale */
  rationale: string[];
}

/**
 * Get comprehensive routing decision with detailed analysis
 */
export function getEnhancedRoutingDecision(input: EnhancedRoutingInput): EnhancedRoutingDecision {
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
  
  // Tool requirements favor Claude
  if (input.toolsRequested) {
    kimiScore -= 20;
    rationale.push('Tool use required - Claude may be more reliable');
  }
  
  // Very complex tasks favor Claude
  if (input.isComplex && input.messageChars > 10000) {
    kimiScore -= 15;
    rationale.push("Complex task - Claude's reasoning may be superior");
  }
  
  // Calculate recommendation
  let recommendedModel: 'kimi' | 'claude' | 'either';
  let confidence: number;
  
  if (kimiScore >= 40) {
    recommendedModel = 'kimi';
    confidence = Math.min(kimiScore / 100, 0.95);
  } else if (kimiScore <= -20) {
    recommendedModel = 'claude';
    confidence = Math.min(Math.abs(kimiScore) / 100, 0.95);
  } else {
    recommendedModel = 'either';
    confidence = 0.5;
  }
  
  // Estimate savings
  const estimatedInputTokens = Math.ceil(input.messageChars * 0.25);
  const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 0.5);
  const savings = estimateSavings(estimatedInputTokens, estimatedOutputTokens);
  
  return {
    recommendedModel,
    confidence,
    estimatedSavings: savings.savings,
    rationale,
  };
}

// ============================================
// Prompt Optimization
// ============================================

/**
 * Result of prompt optimization
 */
export interface PromptOptimizationResult {
  /** Optimized system prompt */
  optimizedSystem: string;
  /** Optimized user content */
  optimizedUser: string;
  /** List of optimizations applied */
  optimizations: string[];
}

/**
 * Optimize prompts specifically for Kimi K2.5
 * Kimi works well with structured, clear prompts
 */
export function optimizePromptForKimi(
  systemPrompt: string,
  userContent: string
): PromptOptimizationResult {
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
  let optimizedUser = userContent;
  if (userContent.length > 10000 && !hasNonEnglish) {
    // For long English content, ensure clear structure
    if (!userContent.includes('#') && !userContent.includes('##')) {
      optimizations.push('Content is long but lacks structure - consider adding headers');
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

// ============================================
// Swarm Types
// ============================================

/**
 * Status of a swarm agent
 */
export type SwarmAgentStatus = 'idle' | 'working' | 'completed' | 'failed' | 'waiting';

/**
 * Swarm agent definition
 */
export interface SwarmAgent {
  id: SwarmAgentId;
  name: string;
  description: string;
  status: SwarmAgentStatus;
  capabilities: string[];
}

/**
 * Get default swarm agent definitions
 */
export function getSwarmAgents(): SwarmAgent[] {
  return [
    { id: 'arch', name: 'Architect', description: 'System architecture and design', status: 'idle', capabilities: ['architecture', 'design', 'planning'] },
    { id: 'frontend', name: 'Frontend', description: 'UI/UX implementation', status: 'idle', capabilities: ['svelte', 'react', 'vue', 'css', 'html'] },
    { id: 'backend', name: 'Backend', description: 'Server-side logic', status: 'idle', capabilities: ['node', 'express', 'api', 'database'] },
    { id: 'devops', name: 'DevOps', description: 'Infrastructure and deployment', status: 'idle', capabilities: ['docker', 'k8s', 'ci-cd', 'terraform'] },
    { id: 'test', name: 'Testing', description: 'Test generation and QA', status: 'idle', capabilities: ['unit', 'integration', 'e2e', 'vitest'] },
    { id: 'docs', name: 'Documentation', description: 'Documentation generation', status: 'idle', capabilities: ['readme', 'api-docs', 'jsdoc'] },
    { id: 'ux', name: 'UX Specialist', description: 'User experience optimization', status: 'idle', capabilities: ['ux', 'usability', 'design'] },
    { id: 'security', name: 'Security', description: 'Security analysis', status: 'idle', capabilities: ['security', 'auth', 'encryption'] },
    { id: 'perf', name: 'Performance', description: 'Performance optimization', status: 'idle', capabilities: ['profiling', 'optimization', 'caching'] },
    { id: 'a11y', name: 'Accessibility', description: 'Accessibility compliance', status: 'idle', capabilities: ['wcag', 'aria', 'screen-reader'] },
    { id: 'data', name: 'Data', description: 'Database and data modeling', status: 'idle', capabilities: ['sql', 'nosql', 'schema', 'migrations'] },
    { id: 'review', name: 'Code Review', description: 'Code review and quality', status: 'idle', capabilities: ['review', 'best-practices', 'refactoring'] },
  ];
}

// ============================================
// Utility Exports
// ============================================

/**
 * Format token count for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}
