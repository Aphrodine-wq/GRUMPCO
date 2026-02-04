/**
 * Features Store - Unified state management for engineering features
 *
 * Handles: Codebase Analysis, Security & Compliance, Infrastructure Automation, Testing & QA
 */

import { writable, derived } from 'svelte/store';
import { fetchApi } from '../lib/api.js';

// ============ Types ============

export type FeatureCategory = 'analyze' | 'security' | 'infra' | 'testing';

/** Result can be any of the feature-specific result types */
export type FeatureResult =
  | AnalysisResult
  | SecurityScanResult
  | SBOMResult
  | InfraResult
  | TestGenerationResult
  | unknown;

export interface FeatureState {
  loading: boolean;
  error: string | null;
  result: FeatureResult | null;
}

interface FeaturesState {
  activeFeature: FeatureCategory | null;
  analyze: FeatureState;
  security: FeatureState;
  infra: FeatureState;
  testing: FeatureState;
}

// Analysis types
export interface AnalysisResult {
  overview: {
    projectName: string;
    language: string;
    framework?: string;
    totalFiles: number;
    totalLines: number;
  };
  architecture?: {
    mermaidDiagram: string;
    summary: string;
  };
  dependencies?: {
    direct: string[];
    dev: string[];
    graph?: string;
  };
  metrics?: {
    complexity: number;
    maintainability: number;
    testCoverage?: number;
  };
}

// Security types
export interface SecurityScanResult {
  vulnerabilities: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    file: string;
    line?: number;
    description: string;
    recommendation: string;
  }>;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface SBOMResult {
  format: 'cyclonedx' | 'spdx';
  content: string;
  componentCount: number;
}

// Infrastructure types
export interface InfraResult {
  files: Array<{
    filename: string;
    content: string;
  }>;
  readme?: string;
}

// Testing types
export interface TestGenerationResult {
  tests: Array<{
    testFile: string;
    testContent: string;
    testCount: number;
  }>;
  summary: {
    totalTests: number;
    estimatedCoverage: number;
  };
}

// ============ Store ============

const initialState: FeaturesState = {
  activeFeature: null,
  analyze: { loading: false, error: null, result: null },
  security: { loading: false, error: null, result: null },
  infra: { loading: false, error: null, result: null },
  testing: { loading: false, error: null, result: null },
};

const state = writable<FeaturesState>(initialState);

// Helper to update a specific feature's state
function updateFeature(category: FeatureCategory, update: Partial<FeatureState>) {
  state.update((s) => ({
    ...s,
    [category]: { ...s[category], ...update },
  }));
}

// ============ API Functions ============

async function apiCall<T>(
  endpoint: string,
  method: 'GET' | 'POST' = 'POST',
  body?: unknown
): Promise<T> {
  const response = await fetchApi(endpoint, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.data || data;
}

// ============ Codebase Analysis ============

export async function analyzeProject(workspacePath: string): Promise<AnalysisResult> {
  updateFeature('analyze', { loading: true, error: null });
  state.update((s) => ({ ...s, activeFeature: 'analyze' }));

  try {
    const result = await apiCall<AnalysisResult>('/api/analyze/project', 'POST', { workspacePath });
    updateFeature('analyze', { loading: false, result });
    return result;
  } catch (err) {
    const error = (err as Error).message;
    updateFeature('analyze', { loading: false, error });
    throw err;
  }
}

export async function analyzeArchitecture(
  workspacePath: string
): Promise<{ mermaidDiagram: string; summary: string }> {
  updateFeature('analyze', { loading: true, error: null });
  state.update((s) => ({ ...s, activeFeature: 'analyze' }));

  try {
    const result = await apiCall<{ mermaidDiagram: string; summary: string }>(
      '/api/analyze/architecture',
      'POST',
      { workspacePath }
    );
    updateFeature('analyze', { loading: false, result });
    return result;
  } catch (err) {
    const error = (err as Error).message;
    updateFeature('analyze', { loading: false, error });
    throw err;
  }
}

export async function analyzeDependencies(workspacePath: string): Promise<unknown> {
  updateFeature('analyze', { loading: true, error: null });

  try {
    const result = await apiCall('/api/analyze/dependencies', 'POST', { workspacePath });
    updateFeature('analyze', { loading: false, result });
    return result;
  } catch (err) {
    const error = (err as Error).message;
    updateFeature('analyze', { loading: false, error });
    throw err;
  }
}

// ============ Security & Compliance ============

export async function securityScan(
  workspacePath: string,
  scanTypes?: string[]
): Promise<SecurityScanResult> {
  updateFeature('security', { loading: true, error: null });
  state.update((s) => ({ ...s, activeFeature: 'security' }));

  try {
    const result = await apiCall<SecurityScanResult>('/api/security/scan', 'POST', {
      workspacePath,
      scanTypes,
    });
    updateFeature('security', { loading: false, result });
    return result;
  } catch (err) {
    const error = (err as Error).message;
    updateFeature('security', { loading: false, error });
    throw err;
  }
}

export async function generateSBOM(
  workspacePath: string,
  format: 'cyclonedx' | 'spdx' = 'cyclonedx'
): Promise<SBOMResult> {
  updateFeature('security', { loading: true, error: null });
  state.update((s) => ({ ...s, activeFeature: 'security' }));

  try {
    const result = await apiCall<SBOMResult>('/api/security/sbom', 'POST', {
      workspacePath,
      format,
    });
    updateFeature('security', { loading: false, result });
    return result;
  } catch (err) {
    const error = (err as Error).message;
    updateFeature('security', { loading: false, error });
    throw err;
  }
}

export async function complianceCheck(workspacePath: string, standard?: string): Promise<unknown> {
  updateFeature('security', { loading: true, error: null });

  try {
    const result = await apiCall('/api/security/compliance', 'POST', { workspacePath, standard });
    updateFeature('security', { loading: false, result });
    return result;
  } catch (err) {
    const error = (err as Error).message;
    updateFeature('security', { loading: false, error });
    throw err;
  }
}

export async function secretsAudit(workspacePath: string): Promise<unknown> {
  updateFeature('security', { loading: true, error: null });

  try {
    const result = await apiCall('/api/security/secrets-audit', 'POST', { workspacePath });
    updateFeature('security', { loading: false, result });
    return result;
  } catch (err) {
    const error = (err as Error).message;
    updateFeature('security', { loading: false, error });
    throw err;
  }
}

// ============ Infrastructure Automation ============

export interface K8sRequest {
  projectName: string;
  services: Array<{
    name: string;
    image: string;
    port: number;
    replicas?: number;
  }>;
  namespace?: string;
  environment?: string;
}

export async function generateK8s(request: K8sRequest): Promise<InfraResult> {
  updateFeature('infra', { loading: true, error: null });
  state.update((s) => ({ ...s, activeFeature: 'infra' }));

  try {
    const result = await apiCall<InfraResult>('/api/infra/kubernetes', 'POST', request);
    updateFeature('infra', { loading: false, result });
    return result;
  } catch (err) {
    const error = (err as Error).message;
    updateFeature('infra', { loading: false, error });
    throw err;
  }
}

export interface TerraformRequest {
  provider: 'aws' | 'gcp' | 'azure';
  projectName: string;
  resources: Array<{
    type: string;
    name: string;
    config?: Record<string, unknown>;
  }>;
  region?: string;
  environment?: string;
}

export async function generateTerraform(request: TerraformRequest): Promise<InfraResult> {
  updateFeature('infra', { loading: true, error: null });
  state.update((s) => ({ ...s, activeFeature: 'infra' }));

  try {
    const result = await apiCall<InfraResult>('/api/infra/terraform', 'POST', request);
    updateFeature('infra', { loading: false, result });
    return result;
  } catch (err) {
    const error = (err as Error).message;
    updateFeature('infra', { loading: false, error });
    throw err;
  }
}

export interface DockerRequest {
  projectType: 'node' | 'python' | 'go' | 'java' | 'rust' | 'custom';
  projectName: string;
  port?: number;
  includeCompose?: boolean;
}

export async function generateDocker(request: DockerRequest): Promise<InfraResult> {
  updateFeature('infra', { loading: true, error: null });
  state.update((s) => ({ ...s, activeFeature: 'infra' }));

  try {
    const result = await apiCall<InfraResult>('/api/infra/docker', 'POST', request);
    updateFeature('infra', { loading: false, result });
    return result;
  } catch (err) {
    const error = (err as Error).message;
    updateFeature('infra', { loading: false, error });
    throw err;
  }
}

export interface CICDRequest {
  platform: 'github-actions' | 'gitlab-ci' | 'jenkins' | 'circleci';
  projectType: string;
  stages: string[];
  deployTarget?: string;
}

export async function generateCICD(request: CICDRequest): Promise<InfraResult> {
  updateFeature('infra', { loading: true, error: null });
  state.update((s) => ({ ...s, activeFeature: 'infra' }));

  try {
    const result = await apiCall<InfraResult>('/api/infra/cicd', 'POST', request);
    updateFeature('infra', { loading: false, result });
    return result;
  } catch (err) {
    const error = (err as Error).message;
    updateFeature('infra', { loading: false, error });
    throw err;
  }
}

// ============ Testing & QA ============

export interface TestGenRequest {
  filePath: string;
  fileContent: string;
  testFramework?: 'vitest' | 'jest' | 'pytest' | 'go-test' | 'junit';
  testTypes?: ('unit' | 'integration' | 'e2e')[];
  coverageGoal?: number;
}

// ============ Intent Optimizer Types ============

export type OptimizationMode = 'codegen' | 'architecture';

export interface OptimizedIntent {
  features: string[];
  constraints: Array<{
    type: 'technical' | 'business' | 'regulatory' | 'resource';
    description: string;
    priority: 'must' | 'should' | 'nice_to_have';
    impact: string;
  }>;
  nonFunctionalRequirements: Array<{
    category:
      | 'performance'
      | 'security'
      | 'scalability'
      | 'reliability'
      | 'usability'
      | 'maintainability';
    requirement: string;
    metric?: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  }>;
  techStack: Array<{
    technology: string;
    category: string;
    rationale: string;
    confidence: number;
  }>;
  actors: Array<{
    id: string;
    name: string;
    type: 'human' | 'system' | 'external_service';
    responsibilities: string[];
    priority: 'primary' | 'secondary' | 'tertiary';
  }>;
  dataFlows: Array<{
    name: string;
    source: string;
    target: string;
    data: string;
    direction: 'inbound' | 'outbound' | 'bidirectional';
  }>;
  ambiguity: {
    score: number;
    reason: string;
    ambiguousAreas: string[];
  };
  reasoning: string;
  clarifications: Array<{
    id: string;
    question: string;
    importance: string;
    suggestedOptions?: string[];
  }>;
  confidence: number;
}

export interface IntentOptimizerResult {
  optimized: OptimizedIntent;
  original: string;
  confidence: number;
  metadata: {
    processingTime: number;
    model: string;
    mode: OptimizationMode;
  };
}

export interface OptimizeIntentRequest {
  intent: string;
  mode: OptimizationMode;
  projectContext?: {
    name?: string;
    existingTechStack?: string[];
    phase?: 'greenfield' | 'maintenance' | 'migration';
    teamSize?: number;
    timeline?: string;
    budget?: string;
  };
  options?: {
    includeImplementationDetails?: boolean;
    includeDesignPatterns?: boolean;
    clarificationQuestionsCount?: number;
    includeNFRs?: boolean;
    maxFeatures?: number;
  };
}

export async function generateTests(request: TestGenRequest): Promise<TestGenerationResult> {
  updateFeature('testing', { loading: true, error: null });
  state.update((s) => ({ ...s, activeFeature: 'testing' }));

  try {
    const result = await apiCall<TestGenerationResult>('/api/testing/generate', 'POST', request);
    updateFeature('testing', { loading: false, result });
    return result;
  } catch (err) {
    const error = (err as Error).message;
    updateFeature('testing', { loading: false, error });
    throw err;
  }
}

export interface LoadTestRequest {
  projectName: string;
  endpoints: Array<{
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    expectedRps?: number;
    payload?: unknown;
  }>;
  tool?: 'k6' | 'locust' | 'artillery';
  baseUrl?: string;
}

export async function generateLoadTestPlan(request: LoadTestRequest): Promise<unknown> {
  updateFeature('testing', { loading: true, error: null });
  state.update((s) => ({ ...s, activeFeature: 'testing' }));

  try {
    const result = await apiCall('/api/testing/load-plan', 'POST', request);
    updateFeature('testing', { loading: false, result });
    return result;
  } catch (err) {
    const error = (err as Error).message;
    updateFeature('testing', { loading: false, error });
    throw err;
  }
}

export async function analyzeCoverage(workspacePath: string): Promise<unknown> {
  updateFeature('testing', { loading: true, error: null });

  try {
    const result = await apiCall('/api/testing/coverage-analysis', 'POST', { workspacePath });
    updateFeature('testing', { loading: false, result });
    return result;
  } catch (err) {
    const error = (err as Error).message;
    updateFeature('testing', { loading: false, error });
    throw err;
  }
}

// ============ Intent Optimizer ============

export async function optimizeIntent(
  intent: string,
  mode: OptimizationMode,
  projectContext?: OptimizeIntentRequest['projectContext'],
  options?: OptimizeIntentRequest['options']
): Promise<IntentOptimizerResult> {
  const response = await fetchApi('/api/intent/optimize', {
    method: 'POST',
    body: JSON.stringify({
      intent,
      mode,
      projectContext,
      options,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.data || data;
}

// ============ Store Export ============

export const featuresStore = {
  subscribe: state.subscribe,

  setActiveFeature(feature: FeatureCategory | null) {
    state.update((s) => ({ ...s, activeFeature: feature }));
  },

  clearResult(category: FeatureCategory) {
    updateFeature(category, { result: null, error: null });
  },

  reset() {
    state.set(initialState);
  },
};

// Derived stores for convenience
export const isLoading = derived(
  state,
  ($s) => $s.analyze.loading || $s.security.loading || $s.infra.loading || $s.testing.loading
);

export const activeFeature = derived(state, ($s) => $s.activeFeature);

export const analyzeState = derived(state, ($s) => $s.analyze);
export const securityState = derived(state, ($s) => $s.security);
export const infraState = derived(state, ($s) => $s.infra);
export const testingState = derived(state, ($s) => $s.testing);
