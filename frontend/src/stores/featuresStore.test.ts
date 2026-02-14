/**
 * Features Store Tests
 *
 * Comprehensive tests for engineering features state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { resetMocks } from '../test/setup';

// Mock the API module
vi.mock('../lib/api.js', () => ({
  fetchApi: vi.fn(),
}));

describe('featuresStore', () => {
  beforeEach(async () => {
    resetMocks();
    vi.resetModules();
  });

  describe('initial state', () => {
    it('should have null active feature', async () => {
      const { featuresStore } = await import('./featuresStore');
      let state: Record<string, unknown> | undefined;
      featuresStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state?.activeFeature).toBeNull();
    });

    it('should have all features not loading', async () => {
      const { featuresStore } = await import('./featuresStore');
      let state: Record<string, unknown> | undefined;
      featuresStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect((state?.analyze as Record<string, unknown>)?.loading).toBe(false);
      expect((state?.security as Record<string, unknown>)?.loading).toBe(false);
      expect((state?.infra as Record<string, unknown>)?.loading).toBe(false);
      expect((state?.testing as Record<string, unknown>)?.loading).toBe(false);
    });

    it('should have no errors initially', async () => {
      const { featuresStore } = await import('./featuresStore');
      let state: Record<string, unknown> | undefined;
      featuresStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect((state?.analyze as Record<string, unknown>)?.error).toBeNull();
      expect((state?.security as Record<string, unknown>)?.error).toBeNull();
      expect((state?.infra as Record<string, unknown>)?.error).toBeNull();
      expect((state?.testing as Record<string, unknown>)?.error).toBeNull();
    });
  });

  describe('analyzeProject', () => {
    it('should set loading state during analysis', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { analyzeProject, analyzeState } = await import('./featuresStore');

      let resolvePromise: ((value: unknown) => void) | undefined;
      const controlledPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve as (value: unknown) => void;
      });
      vi.mocked(fetchApi).mockReturnValue(controlledPromise);

      const analyzePromise = analyzeProject('/test/path');

      expect(get(analyzeState).loading).toBe(true);

      if (resolvePromise) {
        resolvePromise({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { overview: { projectName: 'test' } },
            }),
        } as Response);
      }

      await analyzePromise;
      expect(get(analyzeState).loading).toBe(false);
    });

    it('should update result on success', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { analyzeProject, analyzeState } = await import('./featuresStore');

      const mockResult = {
        overview: { projectName: 'TestProject', language: 'TypeScript' },
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      } as Response);

      await analyzeProject('/test/path');

      expect(get(analyzeState).result).toEqual(mockResult);
      expect(get(analyzeState).error).toBeNull();
    });

    it('should set error on failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { analyzeProject, analyzeState } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Analysis failed' }),
      } as Response);

      await expect(analyzeProject('/test/path')).rejects.toThrow();
      expect(get(analyzeState).error).toBe('Analysis failed');
    });
  });

  describe('analyzeDependencies', () => {
    it('should analyze dependencies for workspace', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { analyzeDependencies, analyzeState } = await import('./featuresStore');

      const mockResult = {
        direct: ['lodash', 'express'],
        dev: ['vitest', 'typescript'],
        graph: 'graph representation',
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      } as Response);

      const result = await analyzeDependencies('/test/path');

      expect(result).toEqual(mockResult);
      expect(get(analyzeState).result).toEqual(mockResult);
      expect(get(analyzeState).loading).toBe(false);
    });

    it('should set error on dependencies analysis failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { analyzeDependencies, analyzeState } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Dependencies analysis failed' }),
      } as Response);

      await expect(analyzeDependencies('/test/path')).rejects.toThrow(
        'Dependencies analysis failed'
      );

      expect(get(analyzeState).error).toBe('Dependencies analysis failed');
      expect(get(analyzeState).loading).toBe(false);
    });
  });

  describe('analyzeArchitecture', () => {
    it('should analyze architecture and return mermaid diagram', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { analyzeArchitecture, analyzeState, activeFeature } = await import('./featuresStore');

      const mockResult = {
        mermaidDiagram: 'graph TD\nA-->B',
        summary: 'Project uses microservices architecture',
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      } as Response);

      const result = await analyzeArchitecture('/test/workspace');

      expect(result).toEqual(mockResult);
      expect(get(analyzeState).result).toEqual(mockResult);
      expect(get(analyzeState).loading).toBe(false);
      expect(get(activeFeature)).toBe('analyze');
    });

    it('should set error on architecture analysis failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { analyzeArchitecture, analyzeState } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Architecture analysis failed' }),
      } as Response);

      await expect(analyzeArchitecture('/test/workspace')).rejects.toThrow(
        'Architecture analysis failed'
      );

      expect(get(analyzeState).error).toBe('Architecture analysis failed');
      expect(get(analyzeState).loading).toBe(false);
    });
  });

  describe('securityScan', () => {
    it('should perform security scan', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { securityScan, securityState } = await import('./featuresStore');

      const mockResult = {
        vulnerabilities: [],
        summary: { critical: 0, high: 0, medium: 0, low: 0 },
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      } as Response);

      await securityScan('/test/path', ['dependencies']);

      expect(get(securityState).result).toEqual(mockResult);
    });

    it('should set error on scan failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { securityScan, securityState } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Scan failed' }),
      } as Response);

      await expect(securityScan('/test/path')).rejects.toThrow();
      expect(get(securityState).error).toBe('Scan failed');
    });
  });

  describe('generateSBOM', () => {
    it('should generate SBOM in specified format', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateSBOM, securityState } = await import('./featuresStore');

      const mockResult = {
        format: 'cyclonedx',
        content: '<sbom>...</sbom>',
        componentCount: 42,
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      } as Response);

      const result = await generateSBOM('/test/path', 'cyclonedx');

      expect(result.format).toBe('cyclonedx');
      expect(result.componentCount).toBe(42);
      expect(get(securityState).result).toEqual(mockResult);
    });

    it('should set error on SBOM generation failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateSBOM, securityState } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'SBOM generation failed' }),
      } as Response);

      await expect(generateSBOM('/test/path')).rejects.toThrow('SBOM generation failed');

      expect(get(securityState).error).toBe('SBOM generation failed');
      expect(get(securityState).loading).toBe(false);
    });
  });

  describe('complianceCheck', () => {
    it('should perform compliance check', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { complianceCheck, securityState } = await import('./featuresStore');

      const mockResult = {
        compliant: true,
        violations: [],
        standard: 'SOC2',
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      } as Response);

      const result = await complianceCheck('/test/path', 'SOC2');

      expect(result).toEqual(mockResult);
      expect(get(securityState).result).toEqual(mockResult);
      expect(get(securityState).loading).toBe(false);
    });

    it('should set error on compliance check failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { complianceCheck, securityState } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Compliance check failed' }),
      } as Response);

      await expect(complianceCheck('/test/path')).rejects.toThrow('Compliance check failed');

      expect(get(securityState).error).toBe('Compliance check failed');
      expect(get(securityState).loading).toBe(false);
    });
  });

  describe('secretsAudit', () => {
    it('should perform secrets audit', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { secretsAudit, securityState } = await import('./featuresStore');

      const mockResult = {
        secrets: [],
        exposedCount: 0,
        scannedFiles: 100,
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      } as Response);

      const result = await secretsAudit('/test/path');

      expect(result).toEqual(mockResult);
      expect(get(securityState).result).toEqual(mockResult);
      expect(get(securityState).loading).toBe(false);
    });

    it('should set error on secrets audit failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { secretsAudit, securityState } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Secrets audit failed' }),
      } as Response);

      await expect(secretsAudit('/test/path')).rejects.toThrow('Secrets audit failed');

      expect(get(securityState).error).toBe('Secrets audit failed');
      expect(get(securityState).loading).toBe(false);
    });
  });

  describe('generateK8s', () => {
    it('should generate Kubernetes manifests', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateK8s, infraState } = await import('./featuresStore');

      const mockResult = {
        files: [{ filename: 'deployment.yaml', content: 'apiVersion: apps/v1...' }],
        readme: 'K8s setup guide',
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      } as Response);

      const result = await generateK8s({
        projectName: 'test',
        services: [{ name: 'api', image: 'api:latest', port: 8080 }],
      });

      expect(result.files).toHaveLength(1);
      expect(get(infraState).result).toEqual(mockResult);
    });

    it('should set error on K8s generation failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateK8s, infraState } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'K8s generation failed' }),
      } as Response);

      await expect(
        generateK8s({
          projectName: 'test',
          services: [{ name: 'api', image: 'api:latest', port: 8080 }],
        })
      ).rejects.toThrow('K8s generation failed');

      expect(get(infraState).error).toBe('K8s generation failed');
      expect(get(infraState).loading).toBe(false);
    });
  });

  describe('generateTerraform', () => {
    it('should generate Terraform config', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateTerraform, infraState: _infraState } = await import('./featuresStore');

      const mockResult = {
        files: [{ filename: 'main.tf', content: 'resource "aws_instance"...' }],
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      } as Response);

      const result = await generateTerraform({
        provider: 'aws',
        projectName: 'test',
        resources: [{ type: 'ec2', name: 'web' }],
      });

      expect(result.files).toHaveLength(1);
    });

    it('should set error on Terraform generation failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateTerraform, infraState } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Terraform generation failed' }),
      } as Response);

      await expect(
        generateTerraform({
          provider: 'aws',
          projectName: 'test',
          resources: [{ type: 'ec2', name: 'web' }],
        })
      ).rejects.toThrow('Terraform generation failed');

      expect(get(infraState).error).toBe('Terraform generation failed');
      expect(get(infraState).loading).toBe(false);
    });
  });

  describe('generateDocker', () => {
    it('should generate Dockerfile', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateDocker } = await import('./featuresStore');

      const mockResult = {
        files: [{ filename: 'Dockerfile', content: 'FROM node:18...' }],
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      } as Response);

      const result = await generateDocker({
        projectType: 'node',
        projectName: 'test',
        port: 3000,
        includeCompose: true,
      });

      expect(result.files.some((f) => f.filename === 'Dockerfile')).toBe(true);
    });

    it('should set error on Docker generation failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateDocker, infraState } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Docker generation failed' }),
      } as Response);

      await expect(
        generateDocker({
          projectType: 'node',
          projectName: 'test',
        })
      ).rejects.toThrow('Docker generation failed');

      expect(get(infraState).error).toBe('Docker generation failed');
      expect(get(infraState).loading).toBe(false);
    });
  });

  describe('generateCICD', () => {
    it('should generate CI/CD config', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateCICD } = await import('./featuresStore');

      const mockResult = {
        files: [{ filename: '.github/workflows/ci.yml', content: 'name: CI...' }],
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      } as Response);

      const result = await generateCICD({
        platform: 'github-actions',
        projectType: 'node',
        stages: ['test', 'build', 'deploy'],
      });

      expect(result.files).toHaveLength(1);
    });

    it('should set error on CICD generation failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateCICD, infraState } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'CICD generation failed' }),
      } as Response);

      await expect(
        generateCICD({
          platform: 'github-actions',
          projectType: 'node',
          stages: ['test', 'build'],
        })
      ).rejects.toThrow('CICD generation failed');

      expect(get(infraState).error).toBe('CICD generation failed');
      expect(get(infraState).loading).toBe(false);
    });
  });

  describe('generateTests', () => {
    it('should generate tests for file', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateTests, testingState } = await import('./featuresStore');

      const mockResult = {
        tests: [{ testFile: 'src/utils.test.ts', testContent: 'describe...', testCount: 5 }],
        summary: { totalTests: 5, estimatedCoverage: 80 },
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      } as Response);

      const result = await generateTests({
        filePath: 'src/utils.ts',
        fileContent: 'export function add(a, b) { return a + b; }',
        testFramework: 'vitest',
        coverageGoal: 80,
      });

      expect(result.summary.totalTests).toBe(5);
      expect(get(testingState).result).toEqual(mockResult);
    });

    it('should set error on test generation failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateTests, testingState } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Test generation failed' }),
      } as Response);

      await expect(
        generateTests({
          filePath: 'src/utils.ts',
          fileContent: 'export function add(a, b) { return a + b; }',
        })
      ).rejects.toThrow('Test generation failed');

      expect(get(testingState).error).toBe('Test generation failed');
      expect(get(testingState).loading).toBe(false);
    });
  });

  describe('generateLoadTestPlan', () => {
    it('should generate load test plan', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateLoadTestPlan, testingState } = await import('./featuresStore');

      const mockResult = {
        script: 'k6 run test.js',
        endpoints: [{ path: '/api/users', expectedRps: 100 }],
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      } as Response);

      const result = await generateLoadTestPlan({
        projectName: 'test-api',
        endpoints: [{ method: 'GET', path: '/api/users', expectedRps: 100 }],
        tool: 'k6',
      });

      expect(result).toEqual(mockResult);
      expect(get(testingState).result).toEqual(mockResult);
    });

    it('should set error on load test plan failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateLoadTestPlan, testingState } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Load test generation failed' }),
      } as Response);

      await expect(
        generateLoadTestPlan({
          projectName: 'test-api',
          endpoints: [{ method: 'POST', path: '/api/data' }],
        })
      ).rejects.toThrow('Load test generation failed');

      expect(get(testingState).error).toBe('Load test generation failed');
      expect(get(testingState).loading).toBe(false);
    });
  });

  describe('optimizeIntent', () => {
    it('should optimize intent for codegen', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { optimizeIntent } = await import('./featuresStore');

      const mockResult = {
        optimized: {
          features: ['auth', 'crud'],
          constraints: [],
          confidence: 0.9,
        },
        original: 'Build a todo app',
        confidence: 0.9,
        metadata: { processingTime: 100, model: 'gpt-4', mode: 'codegen' },
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      } as Response);

      const result = await optimizeIntent('Build a todo app', 'codegen');

      expect(result.confidence).toBe(0.9);
      expect(result.metadata.mode).toBe('codegen');
    });

    it('should optimize intent for architecture mode', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { optimizeIntent } = await import('./featuresStore');

      const mockResult = {
        optimized: {
          features: ['API layer', 'database', 'workers'],
          constraints: [],
          nonFunctionalRequirements: [],
          confidence: 0.85,
        },
        original: 'Multi-tenant SaaS todo app',
        confidence: 0.85,
        metadata: { processingTime: 150, model: 'nemotron-ultra', mode: 'architecture' },
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      } as Response);

      const result = await optimizeIntent('Multi-tenant SaaS todo app', 'architecture');

      expect(result.optimized.features).toContain('API layer');
      expect(result.metadata.mode).toBe('architecture');
      expect(result.original).toBe('Multi-tenant SaaS todo app');
    });
  });

  describe('store actions', () => {
    it('should set active feature', async () => {
      const { featuresStore, activeFeature } = await import('./featuresStore');

      featuresStore.setActiveFeature('analyze');
      expect(get(activeFeature)).toBe('analyze');

      featuresStore.setActiveFeature('security');
      expect(get(activeFeature)).toBe('security');
    });

    it('should clear result for category', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { featuresStore, analyzeProject, analyzeState } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { overview: {} } }),
      } as Response);

      await analyzeProject('/test');
      expect(get(analyzeState).result).not.toBeNull();

      featuresStore.clearResult('analyze');
      expect(get(analyzeState).result).toBeNull();
    });

    it('should reset entire store', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { featuresStore, analyzeProject, activeFeature, analyzeState } =
        await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { overview: {} } }),
      } as Response);

      await analyzeProject('/test');
      featuresStore.setActiveFeature('analyze');

      featuresStore.reset();

      expect(get(activeFeature)).toBeNull();
      expect(get(analyzeState).result).toBeNull();
    });
  });

  describe('derived stores', () => {
    it('should report loading state', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { isLoading, analyzeProject } = await import('./featuresStore');

      let resolvePromise: ((value: unknown) => void) | undefined;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(fetchApi).mockReturnValue(promise as ReturnType<typeof fetchApi>);

      expect(get(isLoading)).toBe(false);

      const analyzePromise = analyzeProject('/test');
      expect(get(isLoading)).toBe(true);

      if (resolvePromise) {
        resolvePromise({
          ok: true,
          json: () => Promise.resolve({ data: {} }),
        });
      }

      await analyzePromise;
      expect(get(isLoading)).toBe(false);
    });
  });

  describe('analyzeCoverage', () => {
    it('should analyze test coverage for workspace', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { analyzeCoverage, testingState } = await import('./featuresStore');

      const mockResult = {
        totalCoverage: 85.5,
        files: [
          { file: 'src/utils.ts', coverage: 90 },
          { file: 'src/api.ts', coverage: 80 },
        ],
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      } as Response);

      const result = await analyzeCoverage('/test/workspace');

      expect(result).toEqual(mockResult);
      expect(get(testingState).result).toEqual(mockResult);
      expect(get(testingState).loading).toBe(false);
    });

    it('should set error on coverage analysis failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { analyzeCoverage, testingState } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Coverage analysis failed' }),
      } as Response);

      await expect(analyzeCoverage('/test/workspace')).rejects.toThrow();
      expect(get(testingState).error).toBe('Coverage analysis failed');
      expect(get(testingState).loading).toBe(false);
    });

    it('should set loading state during coverage analysis', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { analyzeCoverage, testingState } = await import('./featuresStore');

      let resolvePromise: ((value: unknown) => void) | undefined;
      const controlledPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve as (value: unknown) => void;
      });
      vi.mocked(fetchApi).mockReturnValue(controlledPromise);

      const analyzePromise = analyzeCoverage('/test/workspace');

      expect(get(testingState).loading).toBe(true);

      if (resolvePromise) {
        resolvePromise({
          ok: true,
          json: () => Promise.resolve({ data: { totalCoverage: 100 } }),
        } as Response);
      }

      await analyzePromise;
      expect(get(testingState).loading).toBe(false);
    });
  });

  describe('optimizeIntent error handling', () => {
    it('should throw error with message from API response', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { optimizeIntent } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid intent format' }),
      } as Response);

      await expect(optimizeIntent('bad intent', 'codegen')).rejects.toThrow(
        'Invalid intent format'
      );
    });

    it('should throw with fallback error when json parsing fails', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { optimizeIntent } = await import('./featuresStore');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Parse error')),
      } as Response);

      await expect(optimizeIntent('test intent', 'codegen')).rejects.toThrow('Request failed');
    });

    it('should return data directly when no data wrapper', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { optimizeIntent } = await import('./featuresStore');

      const mockResult = {
        optimized: { features: ['feature1'] },
        original: 'test',
        confidence: 0.9,
        metadata: { processingTime: 50, model: 'test', mode: 'codegen' },
      };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResult),
      } as Response);

      const result = await optimizeIntent('test', 'codegen');
      expect(result).toEqual(mockResult);
    });
  });
});
