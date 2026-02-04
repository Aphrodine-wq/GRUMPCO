/**
 * PRD Generator Service
 * Generates Product Requirements Documents from system architecture
 */

import { getRequestLogger, default as logger } from '../middleware/logger.js';
import { createApiTimer } from '../middleware/metrics.js';
import { getPRDStructurePrompt } from '../prompts/prd-writer.js';
import type { PRDRequest, PRD, PRDResponse } from '../types/prd.js';
import type { SystemArchitecture } from '../types/architecture.js';
import type { ConversationMessage } from '../types/index.js';
import { withResilience } from './resilience.js';
import { withCache } from './cacheService.js';
import { getCompletion } from './llmGatewayHelper.js';
import { getStream, type LLMProvider } from './llmGateway.js';

// Create resilient wrapper for LLM gateway non-streaming calls
const resilientLlmCall = withResilience(
  async (params: {
    model: string;
    max_tokens: number;
    system: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  }) => {
    return await getCompletion(params);
  },
  'llm-prd'
);

// Create resilient wrapper for LLM gateway streaming calls
const resilientLlmStream = withResilience(
  async (params: {
    model: string;
    max_tokens: number;
    system: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    provider?: LLMProvider;
  }) => {
    return getStream(
      {
        model: params.model,
        max_tokens: params.max_tokens,
        system: params.system,
        messages: params.messages,
      },
      { provider: params.provider ?? 'nim' }
    );
  },
  'llm-prd-stream'
);

/**
 * Generate PRD from system architecture
 */
async function _generatePRD(
  request: PRDRequest,
  architecture: SystemArchitecture,
  conversationHistory?: ConversationMessage[]
): Promise<PRD> {
  const log = getRequestLogger();
  const timer = createApiTimer('generate_prd');

  try {
    // Build system prompt with architecture context
    const architectureJson = JSON.stringify(architecture.metadata, null, 2);
    const systemPrompt = getPRDStructurePrompt(request.projectName, architectureJson);

    // Build conversation messages
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Build user message
    let userMessage = `Generate a comprehensive PRD for:\n\nProject: ${request.projectName}\nDescription: ${request.projectDescription}`;

    if (request.refinements && request.refinements.length > 0) {
      userMessage += `\n\nRefinements requested:\n${request.refinements.map((r) => `- ${r}`).join('\n')}`;
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    log.info({ messageCount: messages.length }, 'Calling LLM API for PRD generation');

    // Call LLM API
    const result = await resilientLlmCall({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 6000,
      system: systemPrompt,
      messages,
    });

    if (result.error) {
      throw new Error(`LLM API error: ${result.error}`);
    }

    let jsonText = result.text;

    // Remove markdown code blocks if present
    if (jsonText.includes('```json')) {
      const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) {
        jsonText = match[1];
      }
    } else if (jsonText.includes('```')) {
      const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (match) {
        jsonText = match[1];
      }
    }

    // Parse JSON
    let prdData;
    try {
      prdData = JSON.parse(jsonText);
    } catch (e) {
      log.error(
        { error: String(e), jsonText: jsonText.substring(0, 200) },
        'Failed to parse PRD JSON'
      );
      throw new Error('Failed to parse PRD from Claude response');
    }

    // Construct PRD object
    const prd: PRD = {
      id: `prd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectName: prdData.projectName || request.projectName,
      projectDescription: prdData.projectDescription || request.projectDescription,
      version: prdData.version || '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sections: {
        overview: prdData.sections?.overview || {
          vision: '',
          problem: '',
          solution: '',
          targetMarket: '',
        },
        personas: prdData.sections?.personas || [],
        features: prdData.sections?.features || [],
        userStories: prdData.sections?.userStories || [],
        nonFunctionalRequirements: prdData.sections?.nonFunctionalRequirements || [],
        apis: prdData.sections?.apis || [],
        dataModels: prdData.sections?.dataModels || [],
        successMetrics: prdData.sections?.successMetrics || [],
      },
    };

    log.info(
      {
        prdId: prd.id,
        personas: prd.sections.personas.length,
        features: prd.sections.features.length,
        stories: prd.sections.userStories.length,
      },
      'PRD generated successfully'
    );

    timer.success();
    return prd;
  } catch (error) {
    timer.success();
    const err = error as Error;
    log.error({ error: err.message, stack: err.stack }, 'PRD generation failed');
    throw error;
  }
}

/**
 * Public API with error handling
 */
export async function generatePRD(
  request: PRDRequest,
  architecture: SystemArchitecture,
  conversationHistory?: ConversationMessage[]
): Promise<PRDResponse> {
  try {
    // Create cache key from request and architecture
    const cacheKey = JSON.stringify({
      projectName: request.projectName,
      projectDescription: request.projectDescription,
      architectureId: architecture.id,
      refinements: request.refinements,
    });

    const prd = await withCache('prd', cacheKey, async () => {
      return await _generatePRD(request, architecture, conversationHistory);
    });

    return {
      id: prd.id,
      status: 'complete',
      prd,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'PRD generation error');
    return {
      id: `err_${Date.now()}`,
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Generate PRD with streaming
 */
export async function* generatePRDStream(
  request: PRDRequest,
  architecture: SystemArchitecture,
  conversationHistory?: ConversationMessage[]
): AsyncGenerator<string> {
  const log = getRequestLogger();

  try {
    const architectureJson = JSON.stringify(architecture.metadata, null, 2);
    const systemPrompt = getPRDStructurePrompt(request.projectName, architectureJson);

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    let userMessage = `Generate a comprehensive PRD for:\n\nProject: ${request.projectName}\nDescription: ${request.projectDescription}`;

    if (request.refinements && request.refinements.length > 0) {
      userMessage += `\n\nRefinements:\n${request.refinements.map((r) => `- ${r}`).join('\n')}`;
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    log.info({}, 'Starting PRD stream');

    // Create streaming response
    const stream = await resilientLlmStream({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 6000,
      system: systemPrompt,
      messages,
    });

    let buffer = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        buffer += chunk.delta.text;
        yield `data: ${JSON.stringify({ type: 'text', content: chunk.delta.text })}\n\n`;
      }
    }

    // Parse final JSON
    let jsonText = buffer;
    if (jsonText.includes('```json')) {
      const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) {
        jsonText = match[1];
      }
    } else if (jsonText.includes('```')) {
      const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (match) {
        jsonText = match[1];
      }
    }

    const prdData = JSON.parse(jsonText);
    const prd: PRD = {
      id: `prd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectName: prdData.projectName || request.projectName,
      projectDescription: prdData.projectDescription || request.projectDescription,
      version: prdData.version || '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sections: prdData.sections || {
        overview: { vision: '', problem: '', solution: '', targetMarket: '' },
        personas: [],
        features: [],
        userStories: [],
        nonFunctionalRequirements: [],
        apis: [],
        dataModels: [],
        successMetrics: [],
      },
    };

    yield `data: ${JSON.stringify({ type: 'complete', prd })}\n\n`;
    log.info({ prdId: prd.id }, 'PRD stream completed');
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, 'PRD streaming failed');
    yield `data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`;
  }
}

export interface SuggestedComponent {
  id: string;
  label: string;
  type?: string;
}

const COMPONENTS_PROMPT = `You suggest "major" system components from an architecture for PRD-per-component workflow.
Given architecture metadata (components, integrations, etc.), return a JSON array of suggested major components.
Each item: { "id": "component id from architecture", "label": "human-readable label e.g. Auth System, Core API, Frontend UI", "type": "frontend|backend|database|service" }.
Pick 3–8 major components that warrant their own PRD. Prefer logical groupings (e.g. Auth, Core API, Frontend UI).
Respond with only the JSON array, no markdown.`;

/**
 * Suggest major components from architecture for PRD-per-component.
 */
export async function suggestComponentsFromArchitecture(
  architecture: SystemArchitecture
): Promise<SuggestedComponent[]> {
  const log = getRequestLogger();
  const timer = createApiTimer('suggest_components');
  try {
    const meta = JSON.stringify(architecture.metadata, null, 2);
    const result = await resilientLlmCall({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: COMPONENTS_PROMPT,
      messages: [
        { role: 'user', content: `Architecture metadata:\n${meta}\n\nSuggest major components.` },
      ],
    });
    if (result.error) throw new Error(result.error);
    let raw = result.text.trim();
    const arr = raw.match(/\[[\s\S]*\]/);
    if (arr) raw = arr[0];
    const parsed = JSON.parse(raw) as SuggestedComponent[];
    timer.success();
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    timer.success();
    log.error({ err: (e as Error).message }, 'Suggest components failed');
    return [];
  }
}

const COMPONENT_PRD_PROMPT = `You generate a Product Requirements Document scoped to a single major component within a larger system.
Given architecture metadata and the component id/label, produce a PRD focused only on that component: vision, features, user stories, APIs, data models relevant to it.
Use the same JSON structure as the full PRD (sections.overview, sections.features, etc.) but scope everything to this component.`;

/**
 * Generate one PRD for a single component.
 */
export async function generatePRDForComponent(
  componentId: string,
  componentLabel: string | undefined,
  architecture: SystemArchitecture,
  projectName: string,
  projectDescription: string
): Promise<PRD> {
  const log = getRequestLogger();
  const timer = createApiTimer('generate_prd_component');
  try {
    const meta = JSON.stringify(architecture.metadata, null, 2);
    const label = componentLabel || componentId;
    const userMsg = `Project: ${projectName}\nDescription: ${projectDescription}\n\nComponent: ${label} (id: ${componentId})\n\nArchitecture metadata:\n${meta}\n\nGenerate a PRD for this component only.`;
    const result = await resilientLlmCall({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 6000,
      system: COMPONENT_PRD_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    });
    if (result.error) throw new Error(result.error);
    let jsonText = result.text.trim();
    if (jsonText.includes('```json')) {
      const m = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (m) jsonText = m[1];
    } else if (jsonText.includes('```')) {
      const m = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (m) jsonText = m[1];
    }
    const prdData = JSON.parse(jsonText);
    const prd: PRD = {
      id: `prd_${componentId}_${Date.now()}`,
      projectName: prdData.projectName ?? projectName,
      projectDescription: prdData.projectDescription ?? projectDescription,
      version: prdData.version ?? '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sections: prdData.sections ?? {
        overview: { vision: '', problem: '', solution: '', targetMarket: '' },
        personas: [],
        features: [],
        userStories: [],
        nonFunctionalRequirements: [],
        apis: [],
        dataModels: [],
        successMetrics: [],
      },
    };
    timer.success();
    return prd;
  } catch (e) {
    timer.success();
    log.error({ err: (e as Error).message, componentId }, 'Generate PRD for component failed');
    throw e;
  }
}
