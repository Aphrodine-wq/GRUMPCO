/**
 * Testing & QA Feature - Type Definitions
 */

export interface TestGenerationRequest {
  filePath: string;
  fileContent: string;
  testFramework?: 'vitest' | 'jest' | 'pytest' | 'go-test' | 'junit';
  testTypes?: ('unit' | 'integration' | 'e2e')[];
  coverageGoal?: number;
}

export interface GeneratedTest {
  testFile: string;
  testContent: string;
  testCount: number;
  coverageEstimate: number;
  framework: string;
  imports: string[];
}

export interface TestGenerationResult {
  tests: GeneratedTest[];
  summary: {
    totalTests: number;
    unitTests: number;
    integrationTests: number;
    estimatedCoverage: number;
  };
  recommendations: string[];
}

export interface LoadTestScenario {
  name: string;
  description: string;
  vus: number; // virtual users
  duration: string;
  stages?: Array<{ duration: string; target: number }>;
  thresholds?: Record<string, string[]>;
}

export interface LoadTestPlanRequest {
  projectName: string;
  endpoints: Array<{
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    expectedRps?: number;
    payload?: any;
  }>;
  tool?: 'k6' | 'locust' | 'artillery';
  baseUrl?: string;
}

export interface LoadTestPlanResult {
  tool: string;
  script: string;
  scenarios: LoadTestScenario[];
  readme: string;
  configFile?: string;
}

export interface CoverageAnalysisRequest {
  workspacePath: string;
  coverageReport?: string; // Path to coverage report
  language?: string;
}

export interface CoverageGap {
  file: string;
  uncoveredLines: number[];
  uncoveredFunctions: string[];
  currentCoverage: number;
  priority: 'high' | 'medium' | 'low';
}

export interface CoverageAnalysisResult {
  overallCoverage: number;
  fileCoverage: Record<string, number>;
  gaps: CoverageGap[];
  recommendations: string[];
  suggestedTests: Array<{
    file: string;
    testDescription: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

export interface MockGenerationRequest {
  filePath: string;
  fileContent: string;
  dependencies: string[];
  framework?: 'vitest' | 'jest' | 'unittest' | 'mockito';
}

export interface MockGenerationResult {
  mocks: Array<{
    name: string;
    code: string;
    description: string;
  }>;
  setupCode: string;
}
