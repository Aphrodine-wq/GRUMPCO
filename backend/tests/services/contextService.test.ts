/**
 * Context Service Tests - Comprehensive
 *
 * Tests for context generation and agent-specific context enrichment.
 * All external dependencies (LLM APIs, caching, metrics) are mocked.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';

// Mock all external dependencies before importing the module
vi.mock('../../src/middleware/logger.js', () => ({
  getRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/middleware/metrics.js', () => ({
  createApiTimer: vi.fn(() => ({
    success: vi.fn(),
    failure: vi.fn(),
  })),
  recordContextGeneration: vi.fn(),
  recordContextCacheHit: vi.fn(),
}));

vi.mock('../../src/services/contextCache.js', () => ({
  getCachedContext: vi.fn(),
  cacheContext: vi.fn(),
}));

vi.mock('../../src/services/resilience.js', () => ({
  withResilience: vi.fn((fn) => fn),
}));

vi.mock('../../src/services/architectureService.js', () => ({
  generateArchitecture: vi.fn(),
}));

vi.mock('../../src/services/prdGeneratorService.js', () => ({
  generatePRD: vi.fn(),
}));

vi.mock('../../src/services/intentCompilerService.js', () => ({
  parseAndEnrichIntent: vi.fn(),
  optimizeEnrichedIntent: vi.fn((intent) => intent),
}));

vi.mock('../../src/services/llmGatewayHelper.js', () => ({
  getCompletion: vi.fn(),
}));

import {
  generateMasterContext,
  enrichContextForAgent,
  generateContextSummary,
} from '../../src/services/contextService.js';
import { getCachedContext, cacheContext } from '../../src/services/contextCache.js';
import { getCompletion } from '../../src/services/llmGatewayHelper.js';
import { generateArchitecture } from '../../src/services/architectureService.js';
import { generatePRD } from '../../src/services/prdGeneratorService.js';
import { parseAndEnrichIntent } from '../../src/services/intentCompilerService.js';
import { recordContextCacheHit, recordContextGeneration } from '../../src/middleware/metrics.js';
import type { MasterContext, AgentContext } from '../../src/types/context.js';

describe('Context Service', () => {
  const mockEnrichedIntent = {
    actors: ['user', 'admin'],
    features: ['authentication', 'crud'],
    data_flows: ['user input -> backend -> database'],
    tech_stack_hints: ['typescript', 'express'],
    enriched: {
      code_patterns: ['REST'],
      architecture_hints: [{ pattern: 'MVC', description: 'Model-View-Controller', applicability: 'high' as const }],
      code_quality_requirements: {
        type_safety: 'strict',
        testing: { unit: true, integration: true, e2e: false, coverage_target: 80 },
        documentation: ['code_comments', 'api_docs'],
        performance: { response_time_ms: 200, throughput_rps: 1000 },
        security: ['authentication', 'authorization'],
      },
      optimization_opportunities: [],
    },
  };

  const mockArchitecture = {
    id: 'arch_test',
    projectName: 'Test Project',
    projectType: 'web' as const,
    complexity: 'standard' as const,
    techStack: ['typescript', 'express', 'postgres'],
    components: [],
    integrations: [],
    dataModels: [],
    apiEndpoints: [],
    metadata: {},
  };

  const mockPRD = {
    id: 'prd_test',
    projectName: 'Test Project',
    projectDescription: 'A test project',
    sections: {
      overview: 'Test overview',
      personas: [],
      features: [{ name: 'Feature 1', description: 'Desc' }],
      userStories: [],
      apiEndpoints: [],
      dataModels: [],
      nonFunctionalRequirements: {},
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getCachedContext as MockedFunction<typeof getCachedContext>).mockReturnValue(null);
  });

  describe('generateMasterContext', () => {
    describe('cache behavior', () => {
      it('should return cached context when available', async () => {
        const cachedContext: MasterContext = {
          id: 'cached_context',
          projectDescription: 'Cached project',
          enrichedIntent: mockEnrichedIntent as any,
          architecture: mockArchitecture as any,
          prd: mockPRD as any,
          codePatterns: [],
          architectureHints: [],
          qualityRequirements: {} as any,
          optimizationOpportunities: [],
          createdAt: new Date().toISOString(),
        };

        (getCachedContext as MockedFunction<typeof getCachedContext>).mockReturnValue(cachedContext);

        const result = await generateMasterContext({
          projectDescription: 'Cached project',
        });

        expect(result).toBe(cachedContext);
        expect(recordContextCacheHit).toHaveBeenCalledWith('hit');
        expect(getCompletion).not.toHaveBeenCalled();
      });

      it('should record cache miss and generate new context', async () => {
        const mockLLMResponse = {
          text: JSON.stringify({
            enrichedIntent: mockEnrichedIntent,
            architecture: mockArchitecture,
            prd: mockPRD,
            masterContext: {
              codePatterns: [],
              architectureHints: [],
              qualityRequirements: {},
              optimizationOpportunities: [],
            },
          }),
        };

        (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue(mockLLMResponse as any);

        await generateMasterContext({
          projectDescription: 'New project',
        });

        expect(recordContextCacheHit).toHaveBeenCalledWith('miss');
      });
    });

    describe('unified generation (all components)', () => {
      it('should generate all components in single unified call', async () => {
        const unifiedResponse = {
          enrichedIntent: mockEnrichedIntent,
          architecture: mockArchitecture,
          prd: mockPRD,
          masterContext: {
            codePatterns: [{ pattern: 'REST', description: 'RESTful API', applicability: 'high' }],
            architectureHints: [{ pattern: 'Microservices', description: 'Distributed services', applicability: 'medium' }],
            qualityRequirements: {
              type_safety: 'strict',
              testing: { unit: true, integration: true, e2e: false, coverage_target: 80 },
              documentation: ['code_comments'],
              performance: { response_time_ms: 200, throughput_rps: 1000 },
              security: ['authentication'],
            },
            optimizationOpportunities: [],
          },
        };

        (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
          text: JSON.stringify(unifiedResponse),
        } as any);

        const result = await generateMasterContext({
          projectDescription: 'New todo app with authentication',
        });

        expect(result).toBeDefined();
        expect(result.id).toMatch(/^context_/);
        expect(result.projectDescription).toBe('New todo app with authentication');
        expect(result.enrichedIntent).toBeDefined();
        expect(result.architecture).toBeDefined();
        expect(result.prd).toBeDefined();
        expect(result.codePatterns).toBeDefined();
        expect(result.architectureHints).toBeDefined();
        expect(result.qualityRequirements).toBeDefined();
        expect(result.createdAt).toBeDefined();
      });

      it('should handle JSON wrapped in markdown code blocks', async () => {
        const response = {
          enrichedIntent: mockEnrichedIntent,
          architecture: mockArchitecture,
          prd: mockPRD,
          masterContext: { codePatterns: [], architectureHints: [], qualityRequirements: {}, optimizationOpportunities: [] },
        };

        (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
          text: '```json\n' + JSON.stringify(response) + '\n```',
        } as any);

        const result = await generateMasterContext({
          projectDescription: 'Test project',
        });

        expect(result).toBeDefined();
        expect(result.enrichedIntent).toBeDefined();
      });

      it('should handle JSON wrapped in generic code blocks', async () => {
        const response = {
          enrichedIntent: mockEnrichedIntent,
          architecture: mockArchitecture,
          prd: mockPRD,
          masterContext: { codePatterns: [], architectureHints: [], qualityRequirements: {}, optimizationOpportunities: [] },
        };

        (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
          text: '```\n' + JSON.stringify(response) + '\n```',
        } as any);

        const result = await generateMasterContext({
          projectDescription: 'Test project',
        });

        expect(result).toBeDefined();
      });

      it('should cache generated context', async () => {
        const response = {
          enrichedIntent: mockEnrichedIntent,
          architecture: mockArchitecture,
          prd: mockPRD,
          masterContext: { codePatterns: [], architectureHints: [], qualityRequirements: {}, optimizationOpportunities: [] },
        };

        (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
          text: JSON.stringify(response),
        } as any);

        await generateMasterContext({
          projectDescription: 'Test project',
        });

        expect(cacheContext).toHaveBeenCalled();
      });

      it('should record generation metrics', async () => {
        const response = {
          enrichedIntent: mockEnrichedIntent,
          architecture: mockArchitecture,
          prd: mockPRD,
          masterContext: { codePatterns: [], architectureHints: [], qualityRequirements: {}, optimizationOpportunities: [] },
        };

        (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
          text: JSON.stringify(response),
        } as any);

        await generateMasterContext({
          projectDescription: 'Test project',
        });

        expect(recordContextGeneration).toHaveBeenCalledWith(expect.any(Number), 'success');
      });
    });

    describe('legacy path (partial components provided)', () => {
      it('should use provided enrichedIntent', async () => {
        (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
          text: JSON.stringify({ codePatterns: [], architectureHints: [], qualityRequirements: {}, optimizationOpportunities: [] }),
        } as any);

        (generateArchitecture as MockedFunction<typeof generateArchitecture>).mockResolvedValue({
          status: 'success',
          architecture: mockArchitecture,
        } as any);

        (generatePRD as MockedFunction<typeof generatePRD>).mockResolvedValue({
          status: 'success',
          prd: mockPRD,
        } as any);

        const result = await generateMasterContext({
          projectDescription: 'Test project',
          enrichedIntent: mockEnrichedIntent as any,
        });

        expect(result.enrichedIntent).toBeDefined();
        expect(parseAndEnrichIntent).not.toHaveBeenCalled();
      });

      it('should use provided architecture', async () => {
        (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
          text: JSON.stringify({ codePatterns: [], architectureHints: [], qualityRequirements: {}, optimizationOpportunities: [] }),
        } as any);

        (parseAndEnrichIntent as MockedFunction<typeof parseAndEnrichIntent>).mockResolvedValue(mockEnrichedIntent as any);

        (generatePRD as MockedFunction<typeof generatePRD>).mockResolvedValue({
          status: 'success',
          prd: mockPRD,
        } as any);

        const result = await generateMasterContext({
          projectDescription: 'Test project',
          architecture: mockArchitecture as any,
        });

        expect(result.architecture).toBe(mockArchitecture);
        expect(generateArchitecture).not.toHaveBeenCalled();
      });

      it('should use provided PRD', async () => {
        (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
          text: JSON.stringify({ codePatterns: [], architectureHints: [], qualityRequirements: {}, optimizationOpportunities: [] }),
        } as any);

        (parseAndEnrichIntent as MockedFunction<typeof parseAndEnrichIntent>).mockResolvedValue(mockEnrichedIntent as any);

        (generateArchitecture as MockedFunction<typeof generateArchitecture>).mockResolvedValue({
          status: 'success',
          architecture: mockArchitecture,
        } as any);

        const result = await generateMasterContext({
          projectDescription: 'Test project',
          prd: mockPRD as any,
        });

        expect(result.prd).toBe(mockPRD);
        expect(generatePRD).not.toHaveBeenCalled();
      });

      it('should generate missing components', async () => {
        (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
          text: JSON.stringify({ codePatterns: [], architectureHints: [], qualityRequirements: {}, optimizationOpportunities: [] }),
        } as any);

        (parseAndEnrichIntent as MockedFunction<typeof parseAndEnrichIntent>).mockResolvedValue(mockEnrichedIntent as any);

        (generateArchitecture as MockedFunction<typeof generateArchitecture>).mockResolvedValue({
          status: 'success',
          architecture: mockArchitecture,
        } as any);

        (generatePRD as MockedFunction<typeof generatePRD>).mockResolvedValue({
          status: 'success',
          prd: mockPRD,
        } as any);

        const result = await generateMasterContext({
          projectDescription: 'Test project',
          enrichedIntent: mockEnrichedIntent as any,
        });

        expect(result).toBeDefined();
        expect(generateArchitecture).toHaveBeenCalled();
        expect(generatePRD).toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should throw on LLM API error', async () => {
        (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
          error: 'API rate limit exceeded',
          text: '',
        } as any);

        await expect(
          generateMasterContext({
            projectDescription: 'Test project',
          })
        ).rejects.toThrow('LLM API error: API rate limit exceeded');
      });

      it('should throw on architecture generation failure', async () => {
        (parseAndEnrichIntent as MockedFunction<typeof parseAndEnrichIntent>).mockResolvedValue(mockEnrichedIntent as any);

        (generateArchitecture as MockedFunction<typeof generateArchitecture>).mockResolvedValue({
          status: 'error',
          error: 'Architecture generation failed',
        } as any);

        await expect(
          generateMasterContext({
            projectDescription: 'Test project',
            enrichedIntent: mockEnrichedIntent as any,
          })
        ).rejects.toThrow('Architecture generation failed');
      });

      it('should throw on PRD generation failure', async () => {
        (parseAndEnrichIntent as MockedFunction<typeof parseAndEnrichIntent>).mockResolvedValue(mockEnrichedIntent as any);

        (generateArchitecture as MockedFunction<typeof generateArchitecture>).mockResolvedValue({
          status: 'success',
          architecture: mockArchitecture,
        } as any);

        (generatePRD as MockedFunction<typeof generatePRD>).mockResolvedValue({
          status: 'error',
          error: 'PRD generation failed',
        } as any);

        await expect(
          generateMasterContext({
            projectDescription: 'Test project',
            enrichedIntent: mockEnrichedIntent as any,
          })
        ).rejects.toThrow('PRD generation failed');
      });

      it('should throw on JSON parse error', async () => {
        (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
          text: 'This is not valid JSON',
        } as any);

        await expect(
          generateMasterContext({
            projectDescription: 'Test project',
          })
        ).rejects.toThrow();
      });
    });

    describe('default values', () => {
      it('should apply default quality requirements when not provided', async () => {
        (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
          text: JSON.stringify({
            enrichedIntent: mockEnrichedIntent,
            architecture: mockArchitecture,
            prd: mockPRD,
            masterContext: {},
          }),
        } as any);

        const result = await generateMasterContext({
          projectDescription: 'Test project',
        });

        expect(result.qualityRequirements).toBeDefined();
        expect(result.qualityRequirements.type_safety).toBe('strict');
        expect(result.qualityRequirements.testing).toBeDefined();
      });
    });
  });

  describe('enrichContextForAgent', () => {
    const mockMasterContext: MasterContext = {
      id: 'test_context',
      projectDescription: 'Test project description',
      enrichedIntent: mockEnrichedIntent as any,
      architecture: mockArchitecture as any,
      prd: mockPRD as any,
      codePatterns: [{ pattern: 'REST', description: 'RESTful API', applicability: 'high' as const }],
      architectureHints: [{ pattern: 'MVC', description: 'Model-View-Controller', applicability: 'medium' as const }],
      qualityRequirements: {
        type_safety: 'strict',
        testing: { unit: true, integration: true, e2e: false, coverage_target: 80 },
        documentation: ['code_comments', 'api_docs'],
        performance: { response_time_ms: 200, throughput_rps: 1000 },
        security: ['authentication', 'authorization'],
      },
      optimizationOpportunities: [],
      createdAt: new Date().toISOString(),
    };

    it('should enrich context for frontend agent', async () => {
      (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
        text: JSON.stringify({
          focusAreas: ['UI components', 'state management', 'styling'],
          relevantPatterns: [{ pattern: 'Component', description: 'React components', applicability: 'high' }],
          relevantHints: [],
          qualityFocus: mockMasterContext.qualityRequirements,
          contextSummary: 'Frontend agent context for building UI components',
        }),
      } as any);

      const result = await enrichContextForAgent(mockMasterContext, 'frontend');

      expect(result.agentType).toBe('frontend');
      expect(result.masterContext).toBe(mockMasterContext);
      expect(result.agentSpecificContext).toBeDefined();
      expect(result.agentSpecificContext.focusAreas).toContain('UI components');
      expect(result.contextSummary).toBeDefined();
    });

    it('should enrich context for backend agent', async () => {
      (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
        text: JSON.stringify({
          focusAreas: ['APIs', 'database', 'business logic'],
          relevantPatterns: [{ pattern: 'REST', description: 'RESTful API', applicability: 'high' }],
          relevantHints: [{ pattern: 'Repository', description: 'Data access layer', applicability: 'high' }],
          qualityFocus: mockMasterContext.qualityRequirements,
          contextSummary: 'Backend agent context for building APIs and services',
        }),
      } as any);

      const result = await enrichContextForAgent(mockMasterContext, 'backend');

      expect(result.agentType).toBe('backend');
      expect(result.agentSpecificContext.focusAreas).toContain('APIs');
    });

    it('should enrich context for devops agent', async () => {
      (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
        text: JSON.stringify({
          focusAreas: ['CI/CD', 'Docker', 'deployment'],
          relevantPatterns: [],
          relevantHints: [],
          qualityFocus: mockMasterContext.qualityRequirements,
          contextSummary: 'DevOps agent context',
        }),
      } as any);

      const result = await enrichContextForAgent(mockMasterContext, 'devops');

      expect(result.agentType).toBe('devops');
    });

    it('should enrich context for test agent', async () => {
      (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
        text: JSON.stringify({
          focusAreas: ['unit tests', 'integration tests', 'test coverage'],
          relevantPatterns: [],
          relevantHints: [],
          qualityFocus: mockMasterContext.qualityRequirements,
          contextSummary: 'Test agent context',
        }),
      } as any);

      const result = await enrichContextForAgent(mockMasterContext, 'test');

      expect(result.agentType).toBe('test');
    });

    it('should enrich context for docs agent', async () => {
      (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
        text: JSON.stringify({
          focusAreas: ['API documentation', 'README', 'code comments'],
          relevantPatterns: [],
          relevantHints: [],
          qualityFocus: mockMasterContext.qualityRequirements,
          contextSummary: 'Docs agent context',
        }),
      } as any);

      const result = await enrichContextForAgent(mockMasterContext, 'docs');

      expect(result.agentType).toBe('docs');
    });

    it('should handle JSON in code blocks', async () => {
      (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
        text: '```json\n' + JSON.stringify({
          focusAreas: ['test'],
          relevantPatterns: [],
          relevantHints: [],
          qualityFocus: {},
          contextSummary: 'Test summary',
        }) + '\n```',
      } as any);

      const result = await enrichContextForAgent(mockMasterContext, 'frontend');

      expect(result).toBeDefined();
      expect(result.agentSpecificContext.focusAreas).toContain('test');
    });

    it('should fallback to master context on LLM error', async () => {
      (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
        error: 'API error',
        text: '',
      } as any);

      const result = await enrichContextForAgent(mockMasterContext, 'frontend');

      expect(result.agentType).toBe('frontend');
      expect(result.masterContext).toBe(mockMasterContext);
      expect(result.agentSpecificContext.focusAreas).toEqual([]);
      expect(result.agentSpecificContext.relevantPatterns).toBe(mockMasterContext.codePatterns);
      expect(result.agentSpecificContext.relevantHints).toBe(mockMasterContext.architectureHints);
      expect(result.contextSummary).toBe('Master context for frontend agent');
    });

    it('should fallback on JSON parse error', async () => {
      (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
        text: 'Invalid JSON response',
      } as any);

      const result = await enrichContextForAgent(mockMasterContext, 'backend');

      expect(result.agentType).toBe('backend');
      expect(result.agentSpecificContext.focusAreas).toEqual([]);
    });

    it('should use empty arrays for missing fields in response', async () => {
      (getCompletion as MockedFunction<typeof getCompletion>).mockResolvedValue({
        text: JSON.stringify({}),
      } as any);

      const result = await enrichContextForAgent(mockMasterContext, 'frontend');

      expect(result.agentSpecificContext.focusAreas).toEqual([]);
      expect(result.agentSpecificContext.relevantPatterns).toEqual([]);
      expect(result.agentSpecificContext.relevantHints).toEqual([]);
    });
  });

  describe('generateContextSummary', () => {
    const mockMasterContext: MasterContext = {
      id: 'test_context',
      projectDescription: 'A todo application with user authentication',
      enrichedIntent: mockEnrichedIntent as any,
      architecture: mockArchitecture as any,
      prd: mockPRD as any,
      codePatterns: [{ pattern: 'REST', description: 'RESTful API design', applicability: 'high' as const }],
      architectureHints: [{ pattern: 'MVC', description: 'Model-View-Controller pattern', applicability: 'medium' as const }],
      qualityRequirements: {
        type_safety: 'strict',
        testing: { unit: true, integration: true, e2e: false, coverage_target: 80 },
        documentation: ['code_comments', 'api_docs'],
        performance: { response_time_ms: 200, throughput_rps: 1000 },
        security: ['authentication', 'authorization'],
      },
      optimizationOpportunities: [
        { area: 'performance', suggestion: 'Add caching', impact: 'high' as const },
      ],
      createdAt: new Date().toISOString(),
    };

    const mockAgentContext: AgentContext = {
      agentType: 'frontend',
      masterContext: mockMasterContext,
      agentSpecificContext: {
        focusAreas: ['React components', 'State management'],
        relevantPatterns: mockMasterContext.codePatterns,
        relevantHints: mockMasterContext.architectureHints,
        qualityFocus: mockMasterContext.qualityRequirements,
      },
      contextSummary: 'Focus on building interactive UI components',
    };

    it('should generate summary with project info', () => {
      const summary = generateContextSummary(mockAgentContext);

      expect(summary).toContain('## Project Context');
      expect(summary).toContain('Test Project');
      expect(summary).toContain('A todo application with user authentication');
    });

    it('should include architecture overview', () => {
      const summary = generateContextSummary(mockAgentContext);

      expect(summary).toContain('## Architecture Overview');
      expect(summary).toContain('web');
      expect(summary).toContain('standard');
      expect(summary).toContain('typescript');
    });

    it('should include focus areas for agent', () => {
      const summary = generateContextSummary(mockAgentContext);

      expect(summary).toContain('## Focus Areas for frontend');
      expect(summary).toContain('React components');
      expect(summary).toContain('State management');
    });

    it('should include relevant code patterns', () => {
      const summary = generateContextSummary(mockAgentContext);

      expect(summary).toContain('## Relevant Code Patterns');
      expect(summary).toContain('REST');
      expect(summary).toContain('RESTful API design');
    });

    it('should include architecture hints', () => {
      const summary = generateContextSummary(mockAgentContext);

      expect(summary).toContain('## Architecture Hints');
      expect(summary).toContain('MVC');
      expect(summary).toContain('Model-View-Controller pattern');
    });

    it('should include quality requirements', () => {
      const summary = generateContextSummary(mockAgentContext);

      expect(summary).toContain('## Quality Requirements');
      expect(summary).toContain('Type Safety');
      expect(summary).toContain('strict');
      expect(summary).toContain('Testing');
      expect(summary).toContain('Unit: Yes');
      expect(summary).toContain('Coverage Target: 80%');
      expect(summary).toContain('Documentation');
      expect(summary).toContain('Performance');
      expect(summary).toContain('200ms');
      expect(summary).toContain('Security');
      expect(summary).toContain('authentication');
    });

    it('should include optimization opportunities', () => {
      const summary = generateContextSummary(mockAgentContext);

      expect(summary).toContain('## Optimization Opportunities');
      expect(summary).toContain('performance');
      expect(summary).toContain('Add caching');
      expect(summary).toContain('high impact');
    });

    it('should include context summary', () => {
      const summary = generateContextSummary(mockAgentContext);

      expect(summary).toContain('Focus on building interactive UI components');
    });

    it('should handle empty focus areas', () => {
      const contextWithEmptyFocus: AgentContext = {
        ...mockAgentContext,
        agentSpecificContext: {
          ...mockAgentContext.agentSpecificContext,
          focusAreas: [],
        },
      };

      const summary = generateContextSummary(contextWithEmptyFocus);

      expect(summary).not.toContain('## Focus Areas');
    });

    it('should handle empty patterns', () => {
      const contextWithEmptyPatterns: AgentContext = {
        ...mockAgentContext,
        agentSpecificContext: {
          ...mockAgentContext.agentSpecificContext,
          relevantPatterns: [],
        },
      };

      const summary = generateContextSummary(contextWithEmptyPatterns);

      expect(summary).not.toContain('## Relevant Code Patterns');
    });

    it('should handle empty hints', () => {
      const contextWithEmptyHints: AgentContext = {
        ...mockAgentContext,
        agentSpecificContext: {
          ...mockAgentContext.agentSpecificContext,
          relevantHints: [],
        },
      };

      const summary = generateContextSummary(contextWithEmptyHints);

      expect(summary).not.toContain('## Architecture Hints');
    });

    it('should handle missing optional quality requirement fields', () => {
      const contextWithMinimalQuality: AgentContext = {
        ...mockAgentContext,
        agentSpecificContext: {
          ...mockAgentContext.agentSpecificContext,
          qualityFocus: {
            type_safety: 'moderate',
          } as any,
        },
      };

      const summary = generateContextSummary(contextWithMinimalQuality);

      expect(summary).toContain('moderate');
      expect(summary).not.toContain('undefined');
    });

    it('should handle empty optimization opportunities', () => {
      const contextWithNoOptimizations: AgentContext = {
        ...mockAgentContext,
        masterContext: {
          ...mockMasterContext,
          optimizationOpportunities: [],
        },
      };

      const summary = generateContextSummary(contextWithNoOptimizations);

      expect(summary).not.toContain('## Optimization Opportunities');
    });
  });
});
