/**
 * Architecture Service
 * Generates system architectures and C4 diagrams using LLM Gateway
 */

import { getRequestLogger } from '../middleware/logger.js';
import { createApiTimer } from '../middleware/metrics.js';
import logger from '../middleware/logger.js';
import { getArchitectPrompt } from '../prompts/architect.js';
import { analyzeProjectIntent } from './intentParser.js';
import type { ArchitectureRequest, SystemArchitecture, ArchitectureResponse } from '../types/architecture.js';
import type { ConversationMessage } from '../types/index.js';
import type { EnrichedIntent } from './intentCompilerService.js';
import { withCache } from './cacheService.js';
import { getStream, type StreamEvent, type StreamParams } from './llmGateway.js';

const DEFAULT_MODEL = 'moonshotai/kimi-k2.5';

/**
 * Generate system architecture from project description
 */
async function _generateArchitecture(
  request: ArchitectureRequest,
  conversationHistory?: ConversationMessage[],
  enrichedIntent?: EnrichedIntent
): Promise<SystemArchitecture> {
  const log = getRequestLogger();
  const timer = createApiTimer('generate_architecture');

  try {
    const projectDescription = enrichedIntent?.raw ?? request.projectDescription;
    const techStack = request.techStack ??
      enrichedIntent?.enriched?.tech_stack ??
      enrichedIntent?.tech_stack_hints ??
      (enrichedIntent ? [] : undefined);
    const intent = enrichedIntent
      ? {
          projectType: (request.projectType as 'general') ?? 'general',
          techStack: techStack ?? [],
          features: enrichedIntent.enriched?.features ?? enrichedIntent.features ?? [],
        }
      : analyzeProjectIntent(request.projectDescription);

    log.info({
      projectType: intent.projectType,
      techStack: intent.techStack,
      features: intent.features,
    }, 'Building architecture');

    const basePrompt = getArchitectPrompt({
      projectType: request.projectType || intent.projectType || 'general',
      complexity: request.complexity || intent.features.length > 5 ? 'standard' : 'mvp',
      techStack: (request.techStack || techStack || intent.techStack) as string[],
    });
    const systemPrompt = request.systemPromptPrefix
      ? `${request.systemPromptPrefix}\n\n${basePrompt}`
      : basePrompt;

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    let userMessage = projectDescription;
    if (enrichedIntent) {
      userMessage += '\n\nExtracted intent:';
      const e = enrichedIntent.enriched;
      if (e?.features?.length) userMessage += `\n- Features: ${e.features.join(', ')}`;
      else if (enrichedIntent.features?.length) userMessage += `\n- Features: ${enrichedIntent.features.join(', ')}`;
      if (e?.users?.length) userMessage += `\n- Users: ${e.users.join(', ')}`;
      if (e?.data_flows?.length) userMessage += `\n- Data flows: ${e.data_flows.join(', ')}`;
      if (e?.tech_stack?.length) userMessage += `\n- Tech stack: ${e.tech_stack.join(', ')}`;
      else if (enrichedIntent.tech_stack_hints?.length) userMessage += `\n- Tech hints: ${enrichedIntent.tech_stack_hints.join(', ')}`;
    }
    if (request.refinements && request.refinements.length > 0) {
      userMessage += `\n\nRefinements requested:\n${request.refinements.map((r) => `- ${r}`).join('\n')}`;
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    log.info({ messageCount: messages.length }, 'Calling LLM Gateway for architecture generation');

    // Call LLM Gateway via streaming and collect full response
    const params: StreamParams = {
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    };

    const stream = getStream(params, { provider: 'nim', modelId: DEFAULT_MODEL });
    let fullText = '';

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text;
      }
    }

    // Extract JSON from response
    let jsonText = fullText;

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
    let architectureData;
    try {
      architectureData = JSON.parse(jsonText);
    } catch (e) {
      log.error({ error: String(e), jsonText: jsonText.substring(0, 200) }, 'Failed to parse architecture JSON');
      throw new Error('Failed to parse architecture from LLM response');
    }

    // Validate and construct SystemArchitecture
    const architecture: SystemArchitecture = {
      id: `arch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectName: architectureData.projectName || 'Unnamed Project',
      projectDescription: architectureData.projectDescription || request.projectDescription,
      projectType: architectureData.projectType || 'general',
      complexity: architectureData.complexity || 'standard',
      techStack: architectureData.techStack || [],
      c4Diagrams: {
        context: architectureData.c4Diagrams?.context || '',
        container: architectureData.c4Diagrams?.container || '',
        component: architectureData.c4Diagrams?.component || '',
      },
      metadata: architectureData.metadata || {
        components: [],
        integrations: [],
        dataModels: [],
        apiEndpoints: [],
        technologies: {},
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    log.info(
      { architectureId: architecture.id, components: architecture.metadata.components.length },
      'Architecture generated successfully'
    );

    timer.success();
    return architecture;
  } catch (error) {
    timer.success();
    const err = error as Error;
    log.error({ error: err.message, stack: err.stack }, 'Architecture generation failed');
    throw error;
  }
}

/**
 * Public API with error handling
 */
export async function generateArchitecture(
  request: ArchitectureRequest,
  conversationHistory?: ConversationMessage[],
  enrichedIntent?: EnrichedIntent
): Promise<ArchitectureResponse> {
  try {
    // Create cache key from request
    const cacheKey = JSON.stringify({
      projectDescription: enrichedIntent?.raw ?? request.projectDescription,
      projectType: request.projectType,
      techStack: request.techStack,
      complexity: request.complexity,
      refinements: request.refinements,
    });

    const architecture = await withCache(
      'architecture',
      cacheKey,
      async () => {
        return await _generateArchitecture(request, conversationHistory, enrichedIntent);
      }
    );

    return {
      id: architecture.id,
      status: 'complete',
      architecture,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Architecture generation error');
    return {
      id: `err_${Date.now()}`,
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Generate architecture with streaming (returns async iterator)
 */
export async function* generateArchitectureStream(
  request: ArchitectureRequest,
  conversationHistory?: ConversationMessage[],
  enrichedIntent?: EnrichedIntent
): AsyncGenerator<string> {
  const log = getRequestLogger();

  try {
    const projectDescription = enrichedIntent?.raw ?? request.projectDescription;
    const techStack = request.techStack ??
      enrichedIntent?.enriched?.tech_stack ??
      enrichedIntent?.tech_stack_hints ??
      undefined;
    const intent = enrichedIntent
      ? {
          projectType: (request.projectType as 'general') ?? 'general',
          techStack: (techStack ?? []) as string[],
          features: enrichedIntent.enriched?.features ?? enrichedIntent.features ?? [],
        }
      : analyzeProjectIntent(request.projectDescription);

    const basePrompt = getArchitectPrompt({
      projectType: request.projectType || intent.projectType || 'general',
      complexity: request.complexity || 'standard',
      techStack: (request.techStack || techStack || intent.techStack) as string[],
    });
    const systemPrompt = request.systemPromptPrefix
      ? `${request.systemPromptPrefix}\n\n${basePrompt}`
      : basePrompt;

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    let userMessage = projectDescription;
    if (enrichedIntent) {
      userMessage += '\n\nExtracted intent:';
      const e = enrichedIntent.enriched;
      if (e?.features?.length) userMessage += `\n- Features: ${e.features.join(', ')}`;
      else if (enrichedIntent.features?.length) userMessage += `\n- Features: ${enrichedIntent.features.join(', ')}`;
      if (e?.users?.length) userMessage += `\n- Users: ${e.users.join(', ')}`;
      if (e?.data_flows?.length) userMessage += `\n- Data flows: ${e.data_flows.join(', ')}`;
      if (e?.tech_stack?.length) userMessage += `\n- Tech stack: ${e.tech_stack.join(', ')}`;
      else if (enrichedIntent.tech_stack_hints?.length) userMessage += `\n- Tech hints: ${enrichedIntent.tech_stack_hints.join(', ')}`;
    }
    if (request.refinements && request.refinements.length > 0) {
      userMessage += `\n\nRefinements:\n${request.refinements.map((r) => `- ${r}`).join('\n')}`;
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    log.info({}, 'Starting architecture stream');

    // Create streaming response via LLM Gateway
    const params: StreamParams = {
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    };

    const stream = getStream(params, { provider: 'nim', modelId: DEFAULT_MODEL });

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

    const architectureData = JSON.parse(jsonText);
    const architecture: SystemArchitecture = {
      id: `arch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectName: architectureData.projectName || 'Unnamed Project',
      projectDescription: architectureData.projectDescription || (enrichedIntent?.raw ?? request.projectDescription),
      projectType: architectureData.projectType || 'general',
      complexity: architectureData.complexity || 'standard',
      techStack: architectureData.techStack || [],
      c4Diagrams: architectureData.c4Diagrams || { context: '', container: '', component: '' },
      metadata: architectureData.metadata || { components: [], integrations: [], dataModels: [], apiEndpoints: [], technologies: {} },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    yield `data: ${JSON.stringify({ type: 'complete', architecture })}\n\n`;
    log.info({ architectureId: architecture.id }, 'Architecture stream completed');
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, 'Architecture streaming failed');
    yield `data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`;
  }
}
