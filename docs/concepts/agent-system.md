# G-Agent System Documentation

## Overview

G-Rump features **G-Agent**, an autonomous AI agent that handles comprehensive code generation through specialized capabilities. G-Agent uses **NVIDIA NIM (Nemotron)** for inference.

**G-Agent orchestration** ([agentOrchestrator](../../backend/src/services/agentOrchestrator.ts)) — PRD + architecture → G-Agent code generation with capabilities for architecture, frontend, backend, DevOps, testing, and documentation. Used by Ship and Codegen flows. See [backend/src/routes/codegen.ts](../../backend/src/routes/codegen.ts) and [shipModeService](../../backend/src/services/shipModeService.ts).

**G-Agent Quality Assurance** — G-Agent includes built-in quality analysis and auto-fix capabilities to ensure generated code meets standards.

Evals: run `npm run evals` in the backend (requires a running backend at `EVAL_BASE_URL`); results in `frontend/test-results/g-agent-evals.json`. CI runs G-Agent evals on PRs and main; see [Deployment](../../guides/deployment.md) for operations.

The G-Agent codegen pipeline includes design mode documentation generation and automatic quality assurance.

## System Architecture

```mermaid
flowchart TB
    subgraph Input["Input Layer"]
        NL[Natural Language Input]
        PRD[Product Requirements Document]
        ARCH[System Architecture]
    end

    subgraph Intent["Intent Compiler"]
        IC[Intent Parser<br/>Rust CLI]
        CE[Claude Enrichment<br/>Code Optimization]
        SI[Structured Intent]
    end

    subgraph Orchestrator["Agent Orchestrator"]
        AO[Orchestration Engine]
        WR[Work Report Generator]
    end

    subgraph GAgent["G-Agent Capabilities"]
        A1[Architecture<br/>Validation & Planning]
        A2[Frontend<br/>UI Components]
        A3[Backend<br/>APIs & Services]
        A4[DevOps<br/>Docker & CI/CD]
        A5[Testing<br/>Test Suites]
        A6[Documentation<br/>Docs & Guides]
    end

    subgraph Design["Design Mode"]
        DR[Work Reports<br/>Per Agent]
        WA[WRunner Analysis<br/>Quality Assurance]
        AF[Auto-Fix Engine]
    end

    subgraph Output["Output Layer"]
        CF[Generated Code Files]
        DOC[Documentation]
        REP[Work Reports]
        FIX[Applied Fixes]
    end

    NL --> IC
    PRD --> AO
    ARCH --> AO
    IC --> CE
    CE --> SI
    SI --> AO

    AO --> A1
    A1 --> A2
    A1 --> A3
    A2 --> A4
    A3 --> A4
    A4 --> A5
    A5 --> A6

    A1 --> WR
    A2 --> WR
    A3 --> WR
    A4 --> WR
    A5 --> WR
    A6 --> WR

    WR --> DR
    DR --> WA
    WA --> AF
    AF --> FIX

    A2 --> CF
    A3 --> CF
    A4 --> CF
    A5 --> CF
    A6 --> DOC

    CF --> Output
    DOC --> Output
    REP --> Output
    FIX --> Output
```

## G-Agent Capabilities

### 1. Architecture Capability
**Role**: Validates PRD and creates detailed code generation plan

**Responsibilities**:
- Validates PRD completeness and consistency
- Identifies potential issues or missing specifications
- Creates detailed generation plan with tasks for each agent
- Defines dependencies between components
- Suggests optimizations and best practices
- Applies Claude Code patterns and architecture principles

**Output**: Generation plan with task breakdown, tech stack validation, risk assessment, and architecture patterns

### 2. Frontend Capability
**Role**: Generates production-ready frontend code (Vue/React)

**Responsibilities**:
- Generates page components for each user flow
- Creates reusable component library
- Implements routing based on features
- Sets up state management
- Creates API client/services
- Adds form handling and validation
- Implements error handling UI
- Adds loading states and optimistic updates

**Tech Stack Support**:
- Vue 3 with Composition API + TypeScript
- React 18+ with TypeScript
- TailwindCSS for styling
- Vite as build tool
- Pinia/Zustand for state management

### 3. Backend Capability
**Role**: Generates production-ready backend code (Node/Python/Go)

**Responsibilities**:
- Generates API endpoints for all features
- Creates database schema/models
- Implements business logic services
- Adds authentication and authorization
- Implements error handling
- Adds input validation
- Creates database migrations
- Adds logging and monitoring
- Implements caching strategies

**Tech Stack Support**:
- Node.js/Express.js with TypeScript
- Python 3.11+ with FastAPI/Django
- Go 1.21+ with Gin/Echo
- PostgreSQL or MongoDB

### 4. DevOps Capability
**Role**: Generates Docker, CI/CD, and deployment configurations

**Responsibilities**:
- Generates Dockerfiles for frontend and backend
- Creates docker-compose.yml for local development
- Creates GitHub Actions workflows for CI/CD
- Generates deployment configurations
- Creates environment configuration files
- Adds health checks and monitoring setup
- Implements logging configuration

### 5. Testing Capability
**Role**: Generates comprehensive test suites

**Responsibilities**:
- Generates unit tests for services and components
- Creates integration tests for API endpoints
- Generates E2E tests for critical user flows
- Sets up test infrastructure and fixtures
- Creates test utilities and helpers
- Adds code coverage configuration
- Generates test documentation

**Testing Frameworks**:
- Backend: Jest with Supertest
- Frontend: Vitest with Vue Test Utils / React Testing Library
- E2E: Playwright

### 6. Documentation Capability
**Role**: Generates comprehensive documentation

**Responsibilities**:
- Generates comprehensive README.md
- Creates API documentation
- Creates setup and installation guides
- Generates architecture documentation
- Creates deployment guides
- Generates contributing guidelines
- Creates troubleshooting guides

## Intent Compiler

The Intent Compiler is a two-stage system that parses natural language and enriches it with code-specific insights. It supports three modes (env `INTENT_COMPILER_MODE` or `mode` in `POST /api/intent/parse`):

- **rust-first** (default): Parse via Rust CLI (or WASM), fallback to LLM on failure, then enrich via LLM Gateway.
- **hybrid**: Same as rust-first, but when `ambiguity_analysis.score` exceeds `INTENT_AMBIGUITY_THRESHOLD` (default 0.6), an extra LLM step resolves the ambiguity.
- **llm-first**: Extract structured intent via LLM first (no Rust parse), then enrich. Use for very unstructured prompts.

Intent is also used to guide RAG retrieval (query expansion from features, tech stack, and data flows) when fetching document context for architecture, spec, plan, and chat; and RAG can augment intent enrichment by injecting knowledge-base excerpts into the enrichment prompt.

### Stage 1: Rust Parser
- Parses raw natural language input
- Extracts structured intent (actors, features, data flows, tech stack hints)
- Returns structured JSON

### Stage 2: Claude Code Enrichment
- Analyzes structured intent with Claude Code optimization
- Detects code patterns (REST, GraphQL, microservices, etc.)
- Identifies architecture hints and optimization opportunities
- Extracts code quality requirements
- Suggests optimal tech stack

**Enhanced Output Fields**:
- `code_patterns`: Detected architectural patterns
- `architecture_hints`: Suggested architecture patterns with applicability
- `optimization_opportunities`: Performance/security/scalability suggestions
- `code_quality_requirements`: Type safety, testing, documentation, performance, security requirements

## Design Mode: Work Reports

After G-Agent completes code generation, it automatically generates a comprehensive work report documenting:

1. **Summary**: Brief overview of work completed
2. **Files Generated**: List of all files with purposes and key decisions
3. **Architecture Decisions**: Decisions made, rationale, and alternatives considered
4. **Code Quality Metrics**: Coverage, complexity, and identified issues
5. **Integration Points**: Components, dependencies, and contracts
6. **Testing Strategy**: Approach to testing
7. **Known Issues**: Issues found with severity and suggested fixes
8. **Recommendations**: Suggestions for improvements

These reports are stored in the session and used by WRunner for analysis.

## G-Agent Quality Assurance

G-Agent includes quality assurance capabilities that analyze work reports and identify issues.

### Analysis Categories

1. **Missing Components**: Features, files, API endpoints, database models, tests, or documentation that should exist but don't
2. **Inconsistencies**: Mismatched API contracts, naming conventions, architecture decisions, tech stack mismatches, data model inconsistencies
3. **Integration Gaps**: Missing API client implementations, unconnected components, missing authentication integration, database connection issues
4. **Quality Concerns**: Low test coverage, high complexity, missing error handling, performance issues, security vulnerabilities, code style inconsistencies
5. **Security Issues**: Missing authentication, insecure API endpoints, SQL injection risks, XSS vulnerabilities, missing input validation

### Output

WRunner generates a comprehensive analysis with:
- **Issues**: Detailed list of issues with severity, category, affected agents, and suggested fixes
- **Missing Components**: List of missing components
- **Integration Gaps**: Components with missing connections
- **Quality Concerns**: List of quality issues
- **Recommendations**: Actionable recommendations
- **Auto-Fixable Flag**: Indicates if issues can be automatically fixed

## G-Agent Auto-Fix System

G-Agent automatically applies fixes for identified issues.

### Auto-Fixable Criteria

An issue is auto-fixable if:
- It can be fixed by adding/editing code files
- The fix is clear and unambiguous
- No human judgment required
- Can be automated via code generation

### Fix Process

1. **Fix Plan Generation**: WRunner analysis is processed to create a fix plan
2. **Auto-Fix Application**: Fixes are applied automatically
3. **Validation**: Applied fixes are validated
4. **Reporting**: Fix status is stored in the session

### Fix Categories

- **Missing**: Missing files, components, or configurations
- **Quality**: Code quality improvements (formatting, error handling, etc.)
- **Inconsistency**: Fixing inconsistencies between agents

## Workflow

```mermaid
sequenceDiagram
    participant User
    participant IC as Intent Compiler
    participant AO as Orchestrator
    participant A1 as Architect Agent
    participant A2 as Frontend Agent
    participant A3 as Backend Agent
    participant A4 as DevOps Agent
    participant A5 as Test Agent
    participant A6 as Docs Agent
    participant WR as Work Report Generator
    participant WA as WRunner Agent
    participant AF as Auto-Fix Engine

    User->>IC: Natural Language Input
    IC->>IC: Parse Intent (Rust)
    IC->>IC: Enrich with Claude Code
    IC->>AO: Structured Intent

    User->>AO: PRD + Architecture
    AO->>A1: Validate PRD & Create Plan
    A1->>AO: Generation Plan
    A1->>WR: Generate Work Report

    AO->>A2: Generate Frontend Code
    A2->>AO: Generated Files
    A2->>WR: Generate Work Report

    AO->>A3: Generate Backend Code
    A3->>AO: Generated Files
    A3->>WR: Generate Work Report

    AO->>A4: Generate DevOps Configs
    A4->>AO: Generated Files
    A4->>WR: Generate Work Report

    AO->>A5: Generate Tests
    A5->>AO: Generated Files
    A5->>WR: Generate Work Report

    AO->>A6: Generate Documentation
    A6->>AO: Generated Files
    A6->>WR: Generate Work Report

    AO->>WA: All Work Reports
    WA->>WA: Analyze Reports
    WA->>AO: WRunner Analysis

    alt Auto-Fixable Issues Found
        AO->>AF: Apply Auto-Fixes
        AF->>AO: Fixes Applied
        AO->>AO: Validate Fixes
    end

    AO->>User: Complete Project + Reports + Fixes
```

## Usage

### Basic Usage

1. **Create PRD**: Generate or provide a Product Requirements Document
2. **Generate Architecture**: Create system architecture
3. **Start Code Generation**: Initiate G-Agent orchestration
4. **Review Work Reports**: Check G-Agent work reports in the session
5. **Review Quality Analysis**: Check G-Agent quality assurance analysis
6. **Review Applied Fixes**: Check G-Agent automatically applied fixes
7. **Download Project**: Download the complete generated project

### API Usage

```typescript
// Initialize session
const session = initializeSessionMulti({
  prds: [{ prd: myPRD, componentLabel: 'Frontend' }],
  architecture: myArchitecture,
  preferences: {
    frontendFramework: 'vue',
    backendRuntime: 'node',
    database: 'postgres',
    includeTests: true,
    includeDocs: true
  }
});

// Execute code generation
await executeCodeGenerationMulti(session);

// Access results
const files = session.generatedFiles;
const workReports = session.workReports;
const wrunnerAnalysis = session.wrunnerAnalysis;
const autoFixes = session.autoFixesApplied;
```

### Session Structure

```typescript
interface GenerationSession {
  sessionId: string;
  status: 'initializing' | 'running' | 'completed' | 'failed';
  prdId: string;
  architectureId: string;
  gAgentTasks: Record<CapabilityType, GAgentTask>;
  generatedFiles?: GeneratedFile[];
  
  // Design Mode
  workReports?: Record<CapabilityType, GAgentWorkReport>;
  qualityAnalysis?: QualityAnalysis;
  autoFixesApplied?: Array<{
    issueId: string;
    fix: string;
    status: 'applied' | 'failed';
  }>;
}
```

## Best Practices

1. **PRD Quality**: Ensure PRD is complete and detailed for best results
2. **Architecture First**: Generate architecture before code generation
3. **Review Work Reports**: Check agent work reports for insights
4. **Review WRunner Analysis**: Address critical and high-severity issues
5. **Iterate**: Use feedback to improve PRD and regenerate

## Configuration

### G-Agent Preferences

```typescript
interface GenerationPreferences {
  frontendFramework?: 'vue' | 'react';
  backendRuntime?: 'node' | 'python' | 'go';
  database?: 'postgres' | 'mongodb';
  includeTests?: boolean;
  includeDocs?: boolean;
  styleGuide?: 'airbnb' | 'google' | 'standard';
}
```

### Intent Compiler Constraints

```typescript
interface Constraints {
  complexity?: 'simple' | 'detailed' | 'mvp' | 'standard' | 'enterprise';
  focusAreas?: string[];
  excludeAreas?: string[];
  style?: 'technical' | 'business';
}
```

## Troubleshooting

### Common Issues

1. **Agent Failures**: Check agent task error messages in session
2. **Missing Files**: Review WRunner analysis for missing components
3. **Integration Issues**: Check integration gaps in WRunner analysis
4. **Quality Issues**: Review quality concerns and apply recommendations

### Debugging

- Check session status and agent task statuses
- Review work reports for detailed agent output
- Review WRunner analysis for identified issues
- Check auto-fix status for applied fixes

## Future Enhancements

- Enhanced auto-fix implementation with actual code generation
- Agent regeneration with fixes applied
- Real-time progress updates
- Custom agent configurations
- Agent collaboration patterns
