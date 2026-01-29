/**
 * Claude Code Types
 * Types for code analysis, refactoring, optimization, security, testing, and documentation
 */

export interface CodeAnalysis {
  patterns: CodePattern[];
  complexity: ComplexityMetrics;
  dependencies: Dependency[];
  codeSmells: CodeSmell[];
  recommendations: string[];
}

export interface CodePattern {
  pattern: string;
  description: string;
  location: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maintainabilityIndex: number;
  linesOfCode: number;
  functionCount: number;
  classCount: number;
}

export interface Dependency {
  name: string;
  type: 'import' | 'require' | 'dependency';
  version?: string;
  location: string;
}

export interface CodeSmell {
  type: 'long_method' | 'large_class' | 'duplicate_code' | 'dead_code' | 'magic_number' | 'god_object' | 'feature_envy';
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: string;
  description: string;
  suggestion: string;
}

export interface RefactoringSuggestion {
  type: 'extract_method' | 'extract_class' | 'rename' | 'simplify' | 'move' | 'inline' | 'split';
  priority: 'high' | 'medium' | 'low';
  location: string;
  description: string;
  before: string;
  after: string;
  rationale: string;
}

export interface PerformanceOptimization {
  type: 'caching' | 'algorithm' | 'database' | 'network' | 'memory' | 'rendering';
  priority: 'high' | 'medium' | 'low';
  location: string;
  issue: string;
  suggestion: string;
  expectedImpact: string;
  code?: string;
}

export interface SecurityIssue {
  type: 'sql_injection' | 'xss' | 'csrf' | 'auth_bypass' | 'sensitive_data' | 'insecure_dependency' | 'weak_crypto';
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: string;
  description: string;
  vulnerability: string;
  fix: string;
  code?: string;
}

export interface TestSuite {
  unitTests: TestCase[];
  integrationTests: TestCase[];
  e2eTests: TestCase[];
  coverage: CoverageMetrics;
  mocks: MockDefinition[];
}

export interface TestCase {
  name: string;
  type: 'unit' | 'integration' | 'e2e';
  description: string;
  code: string;
  expectedBehavior: string;
  edgeCases: string[];
}

export interface CoverageMetrics {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  uncovered: string[];
}

export interface MockDefinition {
  name: string;
  type: 'function' | 'class' | 'module' | 'api';
  implementation: string;
  usage: string;
}

export interface Documentation {
  functions: FunctionDoc[];
  classes: ClassDoc[];
  modules: ModuleDoc[];
  api: APIDoc[];
  architecture: ArchitectureDoc;
}

export interface FunctionDoc {
  name: string;
  signature: string;
  description: string;
  parameters: ParameterDoc[];
  returns: ReturnDoc;
  examples: string[];
  throws?: string[];
}

export interface ParameterDoc {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: string;
}

export interface ReturnDoc {
  type: string;
  description: string;
}

export interface ClassDoc {
  name: string;
  description: string;
  methods: FunctionDoc[];
  properties: PropertyDoc[];
  examples: string[];
}

export interface PropertyDoc {
  name: string;
  type: string;
  description: string;
  access: 'public' | 'private' | 'protected';
}

export interface ModuleDoc {
  name: string;
  description: string;
  exports: string[];
  usage: string;
  examples: string[];
}

export interface APIDoc {
  endpoint: string;
  method: string;
  description: string;
  parameters: ParameterDoc[];
  requestBody?: unknown;
  responses: ResponseDoc[];
  examples: string[];
}

export interface ResponseDoc {
  status: number;
  description: string;
  schema?: unknown;
}

export interface ArchitectureDoc {
  overview: string;
  components: ComponentDoc[];
  dataFlow: string;
  diagrams?: string[];
}

export interface ComponentDoc {
  name: string;
  type: string;
  description: string;
  responsibilities: string[];
  dependencies: string[];
}

export interface CodeContext {
  projectType?: string;
  framework?: string;
  language?: string;
  existingCode?: string;
  requirements?: string[];
}

export interface PerformanceMetrics {
  responseTime?: number;
  throughput?: number;
  memoryUsage?: number;
  cpuUsage?: number;
}
