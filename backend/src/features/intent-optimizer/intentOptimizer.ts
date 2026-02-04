/**
 * Intent Optimizer Service
 *
 * Takes raw or parsed intent and returns a cleaned-up, design-ready version.
 * Uses LLM Gateway (Kimi K2.5 via NIM) for intelligent intent optimization.
 */

import logger from '../../middleware/logger.js';
import { withResilience } from '../../services/resilience.js';
import { withCache } from '../../services/cacheService.js';
import { getStream, type StreamParams } from '../../services/llmGateway.js';
import {
  type OptimizationMode,
  type OptimizationOptions,
  type OptimizedIntent,
  type OptimizationRequest,
  type OptimizationResponse,
  type Constraint,
  type NonFunctionalRequirement,
  type TechStackHint,
  type ActorDefinition,
  type DataFlowSummary,
  type AmbiguityAnalysis,
  type ClarificationQuestion,
} from './types.js';

const DEFAULT_INTENT_MODEL = 'moonshotai/kimi-k2.5';
const CACHE_VERSION = 'v1';

/**
 * Collect streaming LLM response into a complete text response
 */
async function getCompletion(
  params: StreamParams,
  options?: { model?: string; timeout?: number }
): Promise<string> {
  const modelId = options?.model ?? DEFAULT_INTENT_MODEL;
  const stream = getStream(params, { provider: 'nim', modelId });

  let fullText = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
    } else if (event.type === 'error') {
      throw new Error(`LLM Gateway error: ${JSON.stringify(event.error)}`);
    }
  }

  return fullText;
}

/**
 * Get system prompt for intent optimization based on mode
 */
function getOptimizationPrompt(mode: OptimizationMode, options?: OptimizationOptions): string {
  const basePrompt = `You are an expert software architect and product manager specializing in intent optimization. Your task is to analyze raw or unstructured user intent and transform it into a structured, design-ready format.

RULES:
1. Always return valid JSON matching the schema exactly
2. Extract explicit and implicit requirements
3. Identify constraints, stakeholders, and data flows
4. Suggest appropriate tech stack based on requirements
5. Flag ambiguities and generate clarification questions
6. Be thorough but concise

OUTPUT SCHEMA:
{
  "features": ["list of clear, specific features"],
  "constraints": [
    {
      "type": "technical|business|regulatory|resource",
      "description": "constraint description",
      "priority": "must|should|nice_to_have",
      "impact": "how this affects implementation"
    }
  ],
  "nonFunctionalRequirements": [
    {
      "category": "performance|security|scalability|reliability|usability|maintainability",
      "requirement": "specific requirement",
      "metric": "target metric if applicable",
      "priority": "critical|high|medium|low"
    }
  ],
  "techStack": [
    {
      "technology": "technology name",
      "category": "frontend|backend|database|infrastructure|etc",
      "rationale": "why this is recommended",
      "confidence": 0.0-1.0
    }
  ],
  "actors": [
    {
      "id": "unique-id",
      "name": "actor name",
      "type": "human|system|external_service",
      "responsibilities": ["list of responsibilities"],
      "priority": "primary|secondary|tertiary"
    }
  ],
  "dataFlows": [
    {
      "name": "flow name",
      "source": "source actor/component",
      "target": "target actor/component",
      "data": "data description",
      "direction": "inbound|outbound|bidirectional"
    }
  ],
  "ambiguity": {
    "score": 0.0-1.0,
    "reason": "explanation of ambiguity score",
    "ambiguousAreas": ["list of ambiguous areas"]
  },
  "reasoning": "explanation of optimization decisions",
  "clarifications": [
    {
      "id": "q1",
      "question": "clarification question",
      "importance": "why this matters",
      "suggestedOptions": ["optional", "suggested", "answers"]
    }
  ],
  "confidence": 0.0-1.0
}`;

  if (mode === 'codegen') {
    return `${basePrompt}

CODEGEN MODE FOCUS:
- Emphasize implementation details and code patterns
- Include specific libraries and frameworks
- Focus on data models and API contracts
- Consider testing requirements
- Address code quality and maintainability
${options?.includeImplementationDetails !== false ? '- Provide implementation guidance' : ''}`;
  } else {
    return `${basePrompt}

ARCHITECTURE MODE FOCUS:
- Emphasize high-level design and system structure
- Include architectural patterns and styles
- Focus on component boundaries and interfaces
- Consider scalability and deployment
- Address cross-cutting concerns
${options?.includeDesignPatterns !== false ? '- Include design pattern recommendations' : ''}`;
  }
}

/**
 * Build user message for optimization
 */
function buildUserMessage(
  rawIntent: string,
  mode: OptimizationMode,
  options?: OptimizationOptions
): string {
  let message = `Please optimize the following intent for ${mode} mode:\n\n`;
  message += `RAW INTENT:\n${rawIntent}\n\n`;

  if (options?.projectContext) {
    const ctx = options.projectContext;
    message += `PROJECT CONTEXT:\n`;
    if (ctx.name) message += `- Project Name: ${ctx.name}\n`;
    if (ctx.existingTechStack?.length)
      message += `- Existing Tech Stack: ${ctx.existingTechStack.join(', ')}\n`;
    if (ctx.phase) message += `- Project Phase: ${ctx.phase}\n`;
    if (ctx.teamSize) message += `- Team Size: ${ctx.teamSize}\n`;
    if (ctx.timeline) message += `- Timeline: ${ctx.timeline}\n`;
    if (ctx.budget) message += `- Budget: ${ctx.budget}\n`;
    message += `\n`;
  }

  if (options?.maxFeatures) {
    message += `CONSTRAINT: Limit to top ${options.maxFeatures} most important features.\n\n`;
  }

  if (options?.includeNFRs === false) {
    message += `CONSTRAINT: Do not include non-functional requirements.\n\n`;
  }

  const numQuestions = Math.min(Math.max(options?.clarificationQuestionsCount ?? 3, 1), 5);
  message += `CONSTRAINT: Generate ${numQuestions} high-impact clarification questions.\n\n`;

  message += `Return the optimized intent as JSON matching the schema exactly.`;

  return message;
}

/**
 * Parse LLM response into OptimizedIntent
 */
function parseOptimizationResponse(raw: string): OptimizedIntent {
  let text = raw.trim();

  // Extract JSON from markdown code blocks
  if (text.includes('```json')) {
    const match = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (match) text = match[1];
  } else if (text.includes('```')) {
    const match = text.match(/```\n?([\s\S]*?)\n?```/);
    if (match) text = match[1];
  } else {
    // Try to find JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(text) as Partial<OptimizedIntent>;

    // Validate and set defaults
    return {
      features: Array.isArray(parsed.features) ? parsed.features : [],
      constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
      nonFunctionalRequirements: Array.isArray(parsed.nonFunctionalRequirements)
        ? parsed.nonFunctionalRequirements
        : [],
      techStack: Array.isArray(parsed.techStack) ? parsed.techStack : [],
      actors: Array.isArray(parsed.actors) ? parsed.actors : [],
      dataFlows: Array.isArray(parsed.dataFlows) ? parsed.dataFlows : [],
      ambiguity: parsed.ambiguity || {
        score: 0.5,
        reason: 'Default ambiguity assessment',
        ambiguousAreas: [],
      },
      reasoning: parsed.reasoning || 'No reasoning provided',
      clarifications: Array.isArray(parsed.clarifications) ? parsed.clarifications : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    };
  } catch (e) {
    logger.error(
      { error: (e as Error).message, raw: text.substring(0, 200) },
      'Failed to parse optimization response'
    );
    throw new Error(`Failed to parse optimization response: ${(e as Error).message}`);
  }
}

/**
 * Optimize raw intent using LLM
 */
async function optimizeIntentWithLLM(
  rawIntent: string,
  mode: OptimizationMode,
  options?: OptimizationOptions
): Promise<OptimizedIntent> {
  // Check if NIM is available
  if (!process.env.NVIDIA_NIM_API_KEY) {
    logger.warn({}, 'NIM not configured for intent optimization');
    throw new Error('Intent optimization requires NVIDIA NIM API key to be configured');
  }

  const systemPrompt = getOptimizationPrompt(mode, options);
  const userMessage = buildUserMessage(rawIntent, mode, options);

  // Create resilient wrapper
  const resilientCall = withResilience(async (params: StreamParams): Promise<string> => {
    return await getCompletion(params, { model: DEFAULT_INTENT_MODEL });
  }, 'intent-optimization');

  const response = await resilientCall({
    model: DEFAULT_INTENT_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  return parseOptimizationResponse(response);
}

/**
 * Calculate confidence score based on optimization quality
 */
function calculateConfidence(optimized: OptimizedIntent, mode: OptimizationMode): number {
  let score = optimized.confidence || 0.5;

  // Adjust based on completeness
  if (optimized.features.length > 0) score += 0.1;
  if (optimized.constraints.length > 0) score += 0.1;
  if (optimized.actors.length > 0) score += 0.05;
  if (optimized.techStack.length > 0) score += 0.05;

  // Adjust based on ambiguity
  score -= optimized.ambiguity.score * 0.2;

  // Mode-specific adjustments
  if (mode === 'codegen') {
    if (optimized.nonFunctionalRequirements.some((nfr) => nfr.category === 'maintainability'))
      score += 0.05;
  } else {
    if (optimized.dataFlows.length > 0) score += 0.05;
    if (optimized.nonFunctionalRequirements.some((nfr) => nfr.category === 'scalability'))
      score += 0.05;
  }

  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, score));
}

/**
 * Main optimization function
 * Takes raw intent and returns cleaned, design-ready version
 */
export async function optimizeIntent(
  rawIntent: string,
  mode: OptimizationMode,
  options?: OptimizationOptions
): Promise<OptimizedIntent> {
  const startTime = Date.now();

  logger.info(
    {
      rawLength: rawIntent.length,
      mode,
      hasContext: !!options?.projectContext,
    },
    'Intent optimization requested'
  );

  // Create cache key
  const cacheKey = JSON.stringify({
    v: CACHE_VERSION,
    raw: rawIntent.trim(),
    mode,
    options,
  });

  const result = await withCache('intent-optimization', cacheKey, async () => {
    const optimized = await optimizeIntentWithLLM(rawIntent, mode, options);
    const confidence = calculateConfidence(optimized, mode);

    return {
      ...optimized,
      confidence,
    };
  });

  const processingTime = Date.now() - startTime;
  logger.info(
    {
      processingTime,
      mode,
      confidence: result.confidence,
      featuresCount: result.features.length,
    },
    'Intent optimization completed'
  );

  return result;
}

/**
 * Full optimization with metadata response
 * Used by the API endpoint
 */
export async function optimizeIntentWithMetadata(
  request: OptimizationRequest
): Promise<OptimizationResponse> {
  const startTime = Date.now();

  const optimized = await optimizeIntent(request.intent, request.mode, request.options);

  const processingTime = Date.now() - startTime;

  return {
    optimized,
    original: request.intent,
    confidence: optimized.confidence,
    metadata: {
      processingTime,
      model: DEFAULT_INTENT_MODEL,
      mode: request.mode,
    },
  };
}

// Export types for external use
export type {
  OptimizationMode,
  OptimizationOptions,
  OptimizedIntent,
  OptimizationRequest,
  OptimizationResponse,
  Constraint,
  NonFunctionalRequirement,
  TechStackHint,
  ActorDefinition,
  DataFlowSummary,
  AmbiguityAnalysis,
  ClarificationQuestion,
};
