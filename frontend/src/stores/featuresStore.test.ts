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
      let state: any;
      featuresStore.subscribe(s => { state = s; })();
      expect(state.activeFeature).toBeNull();
    });

    it('should have all features not loading', async () => {
      const { featuresStore } = await import('./featuresStore');
      let state: any;
      featuresStore.subscribe(s => { state = s; })();
      expect(state.analyze.loading).toBe(false);
      expect(state.security.loading).toBe(false);
      expect(state.infra.loading).toBe(false);
      expect(state.testing.loading).toBe(false);
    });

    it('should have no errors initially', async () => {
      const { featuresStore } = await import('./featuresStore');
      let state: any;
      featuresStore.subscribe(s => { state = s; })();
      expect(state.analyze.error).toBeNull();
      expect(state.security.error).toBeNull();
      expect(state.infra.error).toBeNull();
      expect(state.testing.error).toBeNull();
    });
  });

  describe('analyzeProject', () => {
    it('should set loading state during analysis', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { analyzeProject, analyzeState } = await import('./featuresStore');

      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => { resolvePromise = resolve; });
      (fetchApi as any).mockReturnValue(promise);

      const analyzePromise = analyzeProject('/test/path');
      
      expect(get(analyzeState).loading).toBe(true);

      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({
          data: { overview: { projectName: 'test' } }
        }),
      });

      await analyzePromise;
      expect(get(analyzeState).loading).toBe(false);
    });

    it('should update result on success', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { analyzeProject, analyzeState } = await import('./featuresStore');

      const mockResult = {
        overview: { projectName: 'TestProject', language: 'TypeScript' }
      };

      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      });

      await analyzeProject('/test/path');
      
      expect(get(analyzeState).result).toEqual(mockResult);
      expect(get(analyzeState).error).toBeNull();
    });

    it('should set error on failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { analyzeProject, analyzeState } = await import('./featuresStore');

      (fetchApi as any).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Analysis failed' }),
      });

      await expect(analyzeProject('/test/path')).rejects.toThrow();
      expect(get(analyzeState).error).toBe('Analysis failed');
    });
  });

  describe('securityScan', () => {
    it('should perform security scan', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { securityScan, securityState } = await import('./featuresStore');

      const mockResult = {
        vulnerabilities: [],
        summary: { critical: 0, high: 0, medium: 0, low: 0 }
      };

      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      });

      await securityScan('/test/path', ['dependencies']);
      
      expect(get(securityState).result).toEqual(mockResult);
    });

    it('should set error on scan failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { securityScan, securityState } = await import('./featuresStore');

      (fetchApi as any).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Scan failed' }),
      });

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
        componentCount: 42
      };

      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      });

      const result = await generateSBOM('/test/path', 'cyclonedx');
      
      expect(result.format).toBe('cyclonedx');
      expect(result.componentCount).toBe(42);
    });
  });

  describe('generateK8s', () => {
    it('should generate Kubernetes manifests', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateK8s, infraState } = await import('./featuresStore');

      const mockResult = {
        files: [{ filename: 'deployment.yaml', content: 'apiVersion: apps/v1...' }],
        readme: 'K8s setup guide'
      };

      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      });

      const result = await generateK8s({
        projectName: 'test',
        services: [{ name: 'api', image: 'api:latest', port: 8080 }]
      });
      
      expect(result.files).toHaveLength(1);
      expect(get(infraState).result).toEqual(mockResult);
    });
  });

  describe('generateTerraform', () => {
    it('should generate Terraform config', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateTerraform, infraState } = await import('./featuresStore');

      const mockResult = {
        files: [{ filename: 'main.tf', content: 'resource "aws_instance"...' }]
      };

      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      });

      const result = await generateTerraform({
        provider: 'aws',
        projectName: 'test',
        resources: [{ type: 'ec2', name: 'web' }]
      });
      
      expect(result.files).toHaveLength(1);
    });
  });

  describe('generateDocker', () => {
    it('should generate Dockerfile', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateDocker } = await import('./featuresStore');

      const mockResult = {
        files: [{ filename: 'Dockerfile', content: 'FROM node:18...' }]
      };

      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      });

      const result = await generateDocker({
        projectType: 'node',
        projectName: 'test',
        port: 3000,
        includeCompose: true
      });
      
      expect(result.files.some(f => f.filename === 'Dockerfile')).toBe(true);
    });
  });

  describe('generateCICD', () => {
    it('should generate CI/CD config', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateCICD } = await import('./featuresStore');

      const mockResult = {
        files: [{ filename: '.github/workflows/ci.yml', content: 'name: CI...' }]
      };

      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      });

      const result = await generateCICD({
        platform: 'github-actions',
        projectType: 'node',
        stages: ['test', 'build', 'deploy']
      });
      
      expect(result.files).toHaveLength(1);
    });
  });

  describe('generateTests', () => {
    it('should generate tests for file', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateTests, testingState } = await import('./featuresStore');

      const mockResult = {
        tests: [{ testFile: 'src/utils.test.ts', testContent: 'describe...', testCount: 5 }],
        summary: { totalTests: 5, estimatedCoverage: 80 }
      };

      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      });

      const result = await generateTests({
        filePath: 'src/utils.ts',
        fileContent: 'export function add(a, b) { return a + b; }',
        testFramework: 'vitest',
        coverageGoal: 80
      });
      
      expect(result.summary.totalTests).toBe(5);
      expect(get(testingState).result).toEqual(mockResult);
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
          confidence: 0.9
        },
        original: 'Build a todo app',
        confidence: 0.9,
        metadata: { processingTime: 100, model: 'gpt-4', mode: 'codegen' }
      };

      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      });

      const result = await optimizeIntent('Build a todo app', 'codegen');
      
      expect(result.confidence).toBe(0.9);
      expect(result.metadata.mode).toBe('codegen');
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

      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { overview: {} } }),
      });

      await analyzeProject('/test');
      expect(get(analyzeState).result).not.toBeNull();

      featuresStore.clearResult('analyze');
      expect(get(analyzeState).result).toBeNull();
    });

    it('should reset entire store', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { featuresStore, analyzeProject, activeFeature, analyzeState } = await import('./featuresStore');

      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { overview: {} } }),
      });

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

      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => { resolvePromise = resolve; });
      (fetchApi as any).mockReturnValue(promise);

      expect(get(isLoading)).toBe(false);

      const analyzePromise = analyzeProject('/test');
      expect(get(isLoading)).toBe(true);

      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      await analyzePromise;
      expect(get(isLoading)).toBe(false);
    });
  });
});
