/**
 * Context Service
 * Generates master context and enriches it for specific agents
 */

import Anthropic from '@anthropic-ai/sdk';
import { getRequestLogger } from '../middleware/logger.js';
import { createApiTimer } from '../middleware/metrics.js';
import logger from '../middleware/logger.js';
import type { MasterContext, AgentContext, ContextGenerationRequest } from '../types/context.js';
import type { EnrichedIntent } from './intentCompilerService.js';
import type { SystemArchitecture } from '../types/architecture.js';
import type { PRD } from '../types/prd.js';
import type { AgentType } from '../types/agents.js';
import { generateArchitecture } from './architectureService.js';
import { generatePRD } from './prdGeneratorService.js';
import { parseAndEnrichIntent } from './intentCompilerService.js';
import { getCachedContext, cacheContext } from './contextCache.js';
import { withResilience } from './resilience.js';
import { recordContextGeneration, recordContextCacheHit } from '../middleware/metrics.js';

if (!process.env.ANTHROPIC_API_KEY) {
  logger.error('ANTHROPIC_API_KEY is not set');
  process.exit(1);
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Create resilient wrapper for Claude API calls
// Type assertion: since we never pass stream: true, the response is always a Message
const resilientClaudeCall = withResilience(
  async (params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> => {
    return await client.messages.create(params);
  },
  'claude-context'
);

const UNIFIED_CONTEXT_PROMPT = `You are a comprehensive project context generator. Your role is to generate ALL project artifacts (enriched intent, architecture, PRD, and master context) in a single unified response.

## Your Task:
From a project description, generate:
1. **Enriched Intent**: Structured intent with code patterns, architecture hints, quality requirements
2. **System Architecture**: Complete C4-style architecture with components, integrations, data models
3. **PRD**: Full product requirements document with personas, features, user stories
4. **Master Context**: Unified context synthesizing all of the above

## Output Format:
Return a JSON object with this structure:
\`\`\`json
{
  "enrichedIntent": {
    "actors": ["actor1", "actor2"],
    "features": ["feature1", "feature2"],
    "data_flows": ["flow1", "flow2"],
    "tech_stack_hints": ["tech1", "tech2"],
    "enriched": {
      "code_patterns": ["REST", "GraphQL"],
      "architecture_hints": [
        {
          "pattern": "Microservices",
          "description": "...",
          "applicability": "high|medium|low"
        }
      ],
      "code_quality_requirements": {
        "type_safety": "strict|moderate|loose",
        "testing": {
          "unit": true,
          "integration": true,
          "e2e": false,
          "coverage_target": 80
        },
        "documentation": ["code_comments", "api_docs"],
        "performance": {
          "response_time_ms": 200,
          "throughput_rps": 1000
        },
        "security": ["authentication", "authorization"]
      },
      "optimization_opportunities": [
        {
          "area": "performance|security|scalability|maintainability",
          "suggestion": "...",
          "impact": "high|medium|low"
        }
      ]
    }
  },
  "architecture": {
    "id": "arch_...",
    "projectName": "...",
    "projectType": "web|mobile|api|fullstack|saas|general",
    "complexity": "mvp|standard|enterprise",
    "techStack": ["tech1", "tech2"],
    "components": [...],
    "integrations": [...],
    "dataModels": [...],
    "apiEndpoints": [...],
    "metadata": {...}
  },
  "prd": {
    "id": "prd_...",
    "projectName": "...",
    "projectDescription": "...",
    "sections": {
      "overview": "...",
      "personas": [...],
      "features": [...],
      "userStories": [...],
      "apiEndpoints": [...],
      "dataModels": [...],
      "nonFunctionalRequirements": {...}
    }
  },
  "masterContext": {
    "codePatterns": [
      {
        "pattern": "REST",
        "description": "...",
        "applicability": "high|medium|low"
      }
    ],
    "architectureHints": [
      {
        "pattern": "Microservices",
        "description": "...",
        "applicability": "high|medium|low"
      }
    ],
    "qualityRequirements": {
      "type_safety": "strict|moderate|loose",
      "testing": {...},
      "documentation": [...],
      "performance": {...},
      "security": [...]
    },
    "optimizationOpportunities": [...]
  }
}
\`\`\`

Generate a complete, production-ready set of artifacts that will guide all agents in the code generation pipeline.`;

const MASTER_CONTEXT_PROMPT = `You are a master context generator. Your role is to synthesize project information into a comprehensive context document that will guide all agents in the code generation pipeline.

## Your Task:
Generate a unified master context that includes:
1. Project overview and vision
2. Key architectural decisions and patterns
3. Code patterns detected (REST, GraphQL, microservices, etc.)
4. Architecture hints and recommendations
5. Quality requirements (type safety, testing, documentation, performance, security)
6. Optimization opportunities

## Output Format:
Return a JSON object with this structure:
\`\`\`json
{
  "codePatterns": [
    {
      "pattern": "REST",
      "description": "RESTful API design pattern",
      "applicability": "high|medium|low"
    }
  ],
  "architectureHints": [
    {
      "pattern": "Microservices",
      "description": "Break into microservices for scalability",
      "applicability": "high|medium|low"
    }
  ],
  "qualityRequirements": {
    "type_safety": "strict|moderate|loose",
    "testing": {
      "unit": true,
      "integration": true,
      "e2e": false,
      "coverage_target": 80
    },
    "documentation": ["code_comments", "api_docs", "readme"],
    "performance": {
      "response_time_ms": 200,
      "throughput_rps": 1000
    },
    "security": ["authentication", "authorization", "encryption"]
  },
  "optimizationOpportunities": [
    {
      "area": "performance|security|scalability|maintainability",
      "suggestion": "specific optimization",
      "impact": "high|medium|low"
    }
  ]
}
\`\`\`

Extract and synthesize information from the provided intent, architecture, and PRD to create this comprehensive context.`;

/**
 * Generate master context from project description and optional components
 * OPTIMIZED: Uses single comprehensive API call when all components need generation
 */
export async function generateMasterContext(
  request: ContextGenerationRequest
): Promise<MasterContext> {
  const log = getRequestLogger();
  const timer = createApiTimer('generate_master_context');

  try {
    // Check cache first
    const cached = getCachedContext(request.projectDescription, {
      enrichedIntent: request.enrichedIntent,
      architecture: request.architecture,
      prd: request.prd,
    });

    if (cached) {
      log.info({ contextId: cached.id }, 'Using cached master context');
      recordContextCacheHit('hit');
      timer.success();
      return cached;
    }

    recordContextCacheHit('miss');
    const contextStart = process.hrtime.bigint();

    // Check if we need to generate all components (optimized path)
    const needsAllGeneration = !request.enrichedIntent && !request.architecture && !request.prd;

    if (needsAllGeneration) {
      // OPTIMIZED: Single comprehensive API call for all components
      log.info({}, 'Generating all components in single unified call');
      
      const response = await resilientClaudeCall({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 8192, // Increased for comprehensive output
        system: UNIFIED_CONTEXT_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Project Description: ${request.projectDescription}\n\nGenerate all project artifacts (enriched intent, architecture, PRD, and master context) in a single comprehensive response.`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      let jsonText = content.text;
      if (jsonText.includes('```json')) {
        const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
        if (match) jsonText = match[1];
      } else if (jsonText.includes('```')) {
        const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
        if (match) jsonText = match[1];
      } else {
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonText = jsonMatch[0];
      }

      const unifiedData = JSON.parse(jsonText);

      // Extract all components from unified response
      const enrichedIntent = unifiedData.enrichedIntent as EnrichedIntent;
      const architecture = unifiedData.architecture as SystemArchitecture;
      const prd = unifiedData.prd as PRD;
      const masterContextData = unifiedData.masterContext;

      const masterContext: MasterContext = {
        id: `context_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        projectDescription: request.projectDescription,
        enrichedIntent,
        architecture,
        prd,
        codePatterns: masterContextData.codePatterns || [],
        architectureHints: masterContextData.architectureHints || [],
        qualityRequirements: masterContextData.qualityRequirements || {
          type_safety: 'strict',
          testing: { unit: true, integration: true, e2e: false, coverage_target: 80 },
          documentation: ['code_comments', 'api_docs', 'readme'],
          performance: { response_time_ms: 200, throughput_rps: 1000 },
          security: ['authentication', 'authorization'],
        },
        optimizationOpportunities: masterContextData.optimizationOpportunities || [],
        createdAt: new Date().toISOString(),
      };

      log.info({ contextId: masterContext.id }, 'Master context generated successfully (unified call)');
      
      // Cache the result
      cacheContext(request.projectDescription, masterContext);
      
      const contextDuration = Number(process.hrtime.bigint() - contextStart) / 1e9;
      recordContextGeneration(contextDuration, 'success');
      timer.success();

      return masterContext;
    }

    // LEGACY PATH: Generate components individually if some are provided
    // Step 1: Parse and enrich intent if not provided
    let enrichedIntent: EnrichedIntent;
    if (request.enrichedIntent) {
      enrichedIntent = request.enrichedIntent;
    } else {
      log.info({}, 'Parsing and enriching intent');
      enrichedIntent = await parseAndEnrichIntent(request.projectDescription);
    }

    // Step 2: Generate architecture if not provided
    let architecture: SystemArchitecture;
    if (request.architecture) {
      architecture = request.architecture;
    } else {
      log.info({}, 'Generating architecture');
      const archResponse = await generateArchitecture(
        {
          projectDescription: request.projectDescription,
        },
        undefined,
        enrichedIntent
      );
      if (archResponse.status === 'error' || !archResponse.architecture) {
        throw new Error(archResponse.error || 'Architecture generation failed');
      }
      architecture = archResponse.architecture;
    }

    // Step 3: Generate PRD if not provided
    let prd: PRD;
    if (request.prd) {
      prd = request.prd;
    } else {
      log.info({}, 'Generating PRD');
      const prdResponse = await generatePRD(
        {
          architectureId: architecture.id,
          projectName: architecture.projectName,
          projectDescription: request.projectDescription,
        },
        architecture
      );
      if (prdResponse.status === 'error' || !prdResponse.prd) {
        throw new Error(prdResponse.error || 'PRD generation failed');
      }
      prd = prdResponse.prd;
    }

    // Step 4: Generate unified context via Claude
    log.info({}, 'Generating unified master context');
    const contextJson = JSON.stringify({
      enrichedIntent: {
        actors: enrichedIntent.actors,
        features: enrichedIntent.features,
        data_flows: enrichedIntent.data_flows,
        tech_stack_hints: enrichedIntent.tech_stack_hints,
        enriched: enrichedIntent.enriched,
      },
      architecture: {
        projectName: architecture.projectName,
        projectType: architecture.projectType,
        complexity: architecture.complexity,
        techStack: architecture.techStack,
        metadata: architecture.metadata,
      },
      prd: {
        projectName: prd.projectName,
        sections: prd.sections,
      },
    }, null, 2);

    const response = await resilientClaudeCall({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4096,
      system: MASTER_CONTEXT_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Project Description: ${request.projectDescription}\n\nContext Data:\n${contextJson}\n\nGenerate the master context document.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    let jsonText = content.text;
    if (jsonText.includes('```json')) {
      const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    } else if (jsonText.includes('```')) {
      const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    } else {
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonText = jsonMatch[0];
    }

    const contextData = JSON.parse(jsonText);

    // Extract patterns and hints from enriched intent if available
    const codePatterns = contextData.codePatterns || 
      (enrichedIntent.enriched?.code_patterns?.map(p => ({
        pattern: p,
        description: `Code pattern: ${p}`,
        applicability: 'medium' as const,
      })) || []);

    const architectureHints = contextData.architectureHints ||
      (enrichedIntent.enriched?.architecture_hints || []);

    const qualityRequirements = contextData.qualityRequirements ||
      enrichedIntent.enriched?.code_quality_requirements || {
        type_safety: 'strict',
        testing: { unit: true, integration: true, e2e: false, coverage_target: 80 },
        documentation: ['code_comments', 'api_docs', 'readme'],
        performance: { response_time_ms: 200, throughput_rps: 1000 },
        security: ['authentication', 'authorization'],
      };

    const optimizationOpportunities = contextData.optimizationOpportunities ||
      enrichedIntent.enriched?.optimization_opportunities || [];

    const masterContext: MasterContext = {
      id: `context_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectDescription: request.projectDescription,
      enrichedIntent,
      architecture,
      prd,
      codePatterns,
      architectureHints,
      qualityRequirements,
      optimizationOpportunities,
      createdAt: new Date().toISOString(),
    };

    log.info({ contextId: masterContext.id }, 'Master context generated successfully');
    
    // Cache the result
    cacheContext(request.projectDescription, masterContext, {
      enrichedIntent: request.enrichedIntent,
      architecture: request.architecture,
      prd: request.prd,
    });
    
    timer.success();

    return masterContext;
  } catch (error) {
    timer.failure('context_generation_error');
    const err = error as Error;
    log.error({ error: err.message, stack: err.stack }, 'Master context generation failed');
    throw error;
  }
}

const AGENT_CONTEXT_PROMPT = `You are an agent context enricher. Your role is to create agent-specific context from the master context.

## Your Task:
For a given agent type, extract and focus on:
- Relevant patterns and architecture hints
- Quality requirements specific to that agent's domain
- Focus areas for the agent's work

## Agent Types:
- **architect**: System design, architecture decisions, component planning
- **frontend**: UI components, client-side logic, state management, styling
- **backend**: APIs, services, business logic, data models, authentication
- **devops**: Docker, CI/CD, deployment, infrastructure, monitoring
- **test**: Testing strategies, test cases, coverage, test infrastructure
- **docs**: Documentation, README, API docs, architecture docs

## Output Format:
Return a JSON object:
\`\`\`json
{
  "focusAreas": ["area1", "area2"],
  "relevantPatterns": [...],
  "relevantHints": [...],
  "qualityFocus": {
    "type_safety": "strict",
    "testing": {...},
    "documentation": [...],
    "performance": {...},
    "security": [...]
  },
  "contextSummary": "Brief summary of what this agent should focus on"
}
\`\`\``;

/**
 * Enrich master context for a specific agent type
 */
export async function enrichContextForAgent(
  masterContext: MasterContext,
  agentType: AgentType
): Promise<AgentContext> {
  const log = getRequestLogger();
  const timer = createApiTimer('enrich_agent_context');

  try {
    const masterContextJson = JSON.stringify({
      projectDescription: masterContext.projectDescription,
      codePatterns: masterContext.codePatterns,
      architectureHints: masterContext.architectureHints,
      qualityRequirements: masterContext.qualityRequirements,
      optimizationOpportunities: masterContext.optimizationOpportunities,
      architecture: {
        projectType: masterContext.architecture.projectType,
        complexity: masterContext.architecture.complexity,
        techStack: masterContext.architecture.techStack,
      },
      prd: {
        projectName: masterContext.prd.projectName,
        features: masterContext.prd.sections.features,
      },
    }, null, 2);

    const response = await resilientClaudeCall({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: AGENT_CONTEXT_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Agent Type: ${agentType}\n\nMaster Context:\n${masterContextJson}\n\nGenerate agent-specific context.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    let jsonText = content.text;
    if (jsonText.includes('```json')) {
      const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    } else if (jsonText.includes('```')) {
      const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    } else {
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonText = jsonMatch[0];
    }

    const agentData = JSON.parse(jsonText);

    const agentContext: AgentContext = {
      agentType,
      masterContext,
      agentSpecificContext: {
        focusAreas: agentData.focusAreas || [],
        relevantPatterns: agentData.relevantPatterns || [],
        relevantHints: agentData.relevantHints || [],
        qualityFocus: agentData.qualityFocus || masterContext.qualityRequirements,
      },
      contextSummary: agentData.contextSummary || `Context for ${agentType} agent`,
    };

    log.info({ agentType, contextId: masterContext.id }, 'Agent context enriched');
    timer.success();

    return agentContext;
  } catch (error) {
    timer.failure('agent_context_error');
    const err = error as Error;
    log.warn({ agentType, error: err.message }, 'Agent context enrichment failed, using master context');
    
    // Fallback to basic agent context
    return {
      agentType,
      masterContext,
      agentSpecificContext: {
        focusAreas: [],
        relevantPatterns: masterContext.codePatterns,
        relevantHints: masterContext.architectureHints,
        qualityFocus: masterContext.qualityRequirements,
      },
      contextSummary: `Master context for ${agentType} agent`,
    };
  }
}

/**
 * Generate context summary string for inclusion in prompts
 */
export function generateContextSummary(agentContext: AgentContext): string {
  const { masterContext, agentSpecificContext } = agentContext;
  
  let summary = `## Project Context\n\n`;
  summary += `**Project**: ${masterContext.prd.projectName}\n`;
  summary += `**Description**: ${masterContext.projectDescription}\n\n`;
  
  summary += `## Architecture Overview\n`;
  summary += `- **Type**: ${masterContext.architecture.projectType}\n`;
  summary += `- **Complexity**: ${masterContext.architecture.complexity}\n`;
  summary += `- **Tech Stack**: ${masterContext.architecture.techStack.join(', ')}\n\n`;
  
  if (agentSpecificContext.focusAreas.length > 0) {
    summary += `## Focus Areas for ${agentContext.agentType}\n`;
    summary += agentSpecificContext.focusAreas.map(a => `- ${a}`).join('\n') + '\n\n';
  }
  
  if (agentSpecificContext.relevantPatterns.length > 0) {
    summary += `## Relevant Code Patterns\n`;
    summary += agentSpecificContext.relevantPatterns.map(p => 
      `- **${p.pattern}**: ${p.description} (${p.applicability})`
    ).join('\n') + '\n\n';
  }
  
  if (agentSpecificContext.relevantHints.length > 0) {
    summary += `## Architecture Hints\n`;
    summary += agentSpecificContext.relevantHints.map(h => 
      `- **${h.pattern}**: ${h.description} (${h.applicability})`
    ).join('\n') + '\n\n';
  }
  
  summary += `## Quality Requirements\n`;
  const qr = agentSpecificContext.qualityFocus;
  summary += `- **Type Safety**: ${qr.type_safety || 'moderate'}\n`;
  if (qr.testing) {
    summary += `- **Testing**: Unit: ${qr.testing.unit ? 'Yes' : 'No'}, Integration: ${qr.testing.integration ? 'Yes' : 'No'}, E2E: ${qr.testing.e2e ? 'Yes' : 'No'}`;
    if (qr.testing.coverage_target) {
      summary += `, Coverage Target: ${qr.testing.coverage_target}%`;
    }
    summary += '\n';
  }
  if (qr.documentation && qr.documentation.length > 0) {
    summary += `- **Documentation**: ${qr.documentation.join(', ')}\n`;
  }
  if (qr.performance) {
    summary += `- **Performance**: Response Time: ${qr.performance.response_time_ms}ms, Throughput: ${qr.performance.throughput_rps} req/s\n`;
  }
  if (qr.security && qr.security.length > 0) {
    summary += `- **Security**: ${qr.security.join(', ')}\n`;
  }
  summary += '\n';
  
  if (masterContext.optimizationOpportunities.length > 0) {
    summary += `## Optimization Opportunities\n`;
    summary += masterContext.optimizationOpportunities.map(o => 
      `- **${o.area}**: ${o.suggestion} (${o.impact} impact)`
    ).join('\n') + '\n\n';
  }
  
  summary += agentSpecificContext.contextSummary;
  
  return summary;
}
