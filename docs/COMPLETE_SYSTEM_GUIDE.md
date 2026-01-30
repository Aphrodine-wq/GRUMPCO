# Complete System Guide: How G-Rump Works

> **⚠️ LEGACY DOCUMENT**: This document may contain outdated references to Claude as the primary LLM. The current stack uses **NVIDIA NIM (Kimi K2.5)** or **OpenRouter** as the LLM provider. For up-to-date architecture documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md) and [OVERVIEW.md](./OVERVIEW.md).

## Table of Contents

1. [System Overview](#system-overview)
2. [Complete Architecture](#complete-architecture)
3. [How It Works](#how-it-works)
4. [Agent System](#agent-system)
5. [Intent Compiler](#intent-compiler)
6. [Design Mode & WRunner](#design-mode--wrunner)
7. [Usage Guide](#usage-guide)
8. [Mermaid Diagrams](#mermaid-diagrams)

## System Overview

G-Rump is an AI-powered development assistant that transforms natural language into complete, production-ready applications. It uses a multi-agent architecture where specialized AI agents work together to generate code, each optimized for Claude Code best practices.

### Key Components

1. **Intent Compiler**: Parses natural language and enriches it with code-specific insights
2. **Agent Orchestrator**: Coordinates multiple specialized agents
3. **Specialized Agents**: 6 agents (Architect, Frontend, Backend, DevOps, Test, Docs)
4. **Design Mode**: Automatic work report generation
5. **WRunner**: Quality assurance and auto-fix system

## Complete Architecture

```mermaid
graph TB
    subgraph UI["User Interface Layer"]
        Desktop[Tauri Desktop App<br/>Svelte 5]
    end

    subgraph API["API Layer"]
        Express[Express Server<br/>REST API]
    end

    subgraph Core["Core Services"]
        IC[Intent Compiler<br/>Rust + Claude]
        AO[Agent Orchestrator<br/>Multi-Agent Coordinator]
        WR[WRunner Service<br/>Quality Assurance]
    end

    subgraph Agents["AI Agents"]
        A1[Architect<br/>Validation & Planning]
        A2[Frontend<br/>Vue/React Components]
        A3[Backend<br/>APIs & Services]
        A4[DevOps<br/>Docker & CI/CD]
        A5[Test<br/>Test Suites]
        A6[Docs<br/>Documentation]
        WA[WRunner<br/>Analysis & Fixes]
    end

    subgraph AI["AI Services"]
        Claude[Claude API<br/>Anthropic]
    end

    subgraph Storage["Session Storage"]
        Session[Generation Session<br/>In-Memory]
        Reports[Work Reports<br/>Per Agent]
        Analysis[WRunner Analysis<br/>Quality Report]
    end

    Desktop --> Express
    Express --> IC
    Express --> AO
    Express --> WR

    IC --> Claude
    AO --> A1
    AO --> A2
    AO --> A3
    AO --> A4
    AO --> A5
    AO --> A6

    A1 --> Claude
    A2 --> Claude
    A3 --> Claude
    A4 --> Claude
    A5 --> Claude
    A6 --> Claude

    A1 --> Reports
    A2 --> Reports
    A3 --> Reports
    A4 --> Reports
    A5 --> Reports
    A6 --> Reports

    WR --> WA
    WA --> Claude
    WA --> Analysis

    Reports --> Session
    Analysis --> Session
```

## How It Works

### Complete Workflow

```mermaid
sequenceDiagram
    participant User
    participant UI as Desktop App
    participant IC as Intent Compiler
    participant Arch as Architect Service
    participant PRD as PRD Service
    participant AO as Orchestrator
    participant A1 as Architect Agent
    participant A2 as Frontend Agent
    participant A3 as Backend Agent
    participant A4 as DevOps Agent
    participant A5 as Test Agent
    participant A6 as Docs Agent
    participant WR as Work Reports
    participant WA as WRunner
    participant AF as Auto-Fix

    User->>UI: Natural Language Input
    UI->>IC: Parse & Enrich Intent
    IC-->>UI: Code-Optimized Intent

    User->>UI: Generate Architecture
    UI->>Arch: Create Architecture
    Arch-->>UI: C4 Diagrams

    User->>UI: Generate PRD
    UI->>PRD: Create PRD
    PRD-->>UI: Complete PRD

    User->>UI: Generate Code
    UI->>AO: Start Generation

    AO->>A1: Validate PRD
    A1->>Claude: Generate Plan
    Claude-->>A1: Generation Plan
    A1-->>AO: Plan + Report
    A1->>WR: Work Report

    par Frontend & Backend
        AO->>A2: Generate Frontend
        A2->>Claude: Generate Code
        Claude-->>A2: Frontend Files
        A2-->>AO: Files
        A2->>WR: Work Report
    and
        AO->>A3: Generate Backend
        A3->>Claude: Generate Code
        Claude-->>A3: Backend Files
        A3-->>AO: Files
        A3->>WR: Work Report
    end

    AO->>A4: Generate DevOps
    A4->>Claude: Generate Configs
    Claude-->>A4: Config Files
    A4-->>AO: Files
    A4->>WR: Work Report

    AO->>A5: Generate Tests
    A5->>Claude: Generate Tests
    Claude-->>A5: Test Files
    A5-->>AO: Files
    A5->>WR: Work Report

    AO->>A6: Generate Docs
    A6->>Claude: Generate Docs
    Claude-->>A6: Doc Files
    A6-->>AO: Files
    A6->>WR: Work Report

    AO->>WA: Analyze All Reports
    WA->>Claude: Analyze Quality
    Claude-->>WA: Analysis + Fixes
    WA-->>AO: WRunner Analysis

    alt Auto-Fixable Issues
        AO->>AF: Apply Fixes
        AF-->>AO: Fixes Applied
    end

    AO-->>UI: Complete Project
    UI-->>User: Download Ready
```

## Agent System

### Agent Types and Responsibilities

```mermaid
mindmap
    root((Agent System))
        Architect
            PRD Validation
            Generation Planning
            Risk Assessment
            Architecture Patterns
        Frontend
            Vue Components
            React Components
            State Management
            Routing
            API Clients
        Backend
            API Endpoints
            Database Models
            Business Logic
            Authentication
            Error Handling
        DevOps
            Dockerfiles
            docker-compose
            CI/CD Pipelines
            Environment Configs
        Test
            Unit Tests
            Integration Tests
            E2E Tests
            Test Infrastructure
        Docs
            README
            API Docs
            Setup Guides
            Architecture Docs
```

### Agent Execution Flow

```mermaid
stateDiagram-v2
    [*] --> Initialize: User Starts
    Initialize --> Architect: Session Created
    Architect --> Planning: Plan Generated
    Planning --> Frontend: Plan Ready
    Planning --> Backend: Plan Ready
    Frontend --> DevOps: Code Generated
    Backend --> DevOps: Code Generated
    DevOps --> Test: Configs Generated
    Test --> Docs: Tests Generated
    Docs --> WorkReports: Docs Generated
    WorkReports --> WRunner: All Reports Ready
    WRunner --> AutoFix: Issues Found
    AutoFix --> Complete: Fixes Applied
    WRunner --> Complete: No Issues
    Complete --> [*]
```

## Intent Compiler

### Two-Stage Process

```mermaid
flowchart TD
    A[Natural Language Input] --> B[Stage 1: Rust Parser]
    B --> C[Structured Intent<br/>Basic Structure]
    C --> D[Stage 2: Claude Enrichment]
    D --> E[Enriched Intent<br/>Code-Optimized]
    
    E --> F[Code Patterns]
    E --> G[Architecture Hints]
    E --> H[Optimization Opportunities]
    E --> I[Quality Requirements]
    
    style B fill:#e1f5ff
    style D fill:#fff4e1
    style E fill:#e8f5e9
```

### Enrichment Process

```mermaid
graph LR
    SI[Structured Intent] --> CE[Claude Code Analysis]
    CE --> CP[Code Patterns<br/>REST, GraphQL, etc.]
    CE --> AH[Architecture Hints<br/>Scalability, Security]
    CE --> OO[Optimization<br/>Performance, Security]
    CE --> CQR[Quality Requirements<br/>Type Safety, Testing]
    
    CP --> EI[Enriched Intent]
    AH --> EI
    OO --> EI
    CQR --> EI
```

## Design Mode & WRunner

### Work Report Generation

```mermaid
flowchart TD
    A[Agent Completes] --> B[Generate Work Report]
    B --> C[Extract Summary]
    B --> D[Document Files]
    B --> E[Record Decisions]
    B --> F[Identify Issues]
    B --> G[Note Integration Points]
    
    C --> H[Work Report]
    D --> H
    E --> H
    F --> H
    G --> H
    
    H --> I[Store in Session]
```

### WRunner Analysis Flow

```mermaid
flowchart TD
    A[All Agents Complete] --> B[Collect Work Reports]
    B --> C[WRunner Analysis]
    
    C --> D[Check Missing Components]
    C --> E[Detect Inconsistencies]
    C --> F[Find Integration Gaps]
    C --> G[Identify Quality Issues]
    C --> H[Check Security]
    
    D --> I[Generate Analysis]
    E --> I
    F --> I
    G --> I
    H --> I
    
    I --> J{Auto-Fixable?}
    J -->|Yes| K[Apply Auto-Fixes]
    J -->|No| L[Manual Fix Required]
    
    K --> M[Validate Fixes]
    M --> N[Store Results]
    L --> N
```

## Usage Guide

### Step-by-Step Process

```mermaid
graph TD
    Start([Start]) --> Step1[1. Describe Project<br/>Natural Language]
    Step1 --> Step2[2. Generate Architecture<br/>C4 Diagrams]
    Step2 --> Step3[3. Generate PRD<br/>Requirements Document]
    Step3 --> Step4[4. Configure Preferences<br/>Framework, Runtime, DB]
    Step4 --> Step5[5. Generate Code<br/>Agent Orchestration]
    Step5 --> Step6[6. Review Work Reports<br/>Agent Decisions]
    Step6 --> Step7[7. Review WRunner Analysis<br/>Quality Report]
    Step7 --> Step8[8. Download Project<br/>Complete ZIP]
    Step8 --> End([Complete])
    
    style Step1 fill:#e3f2fd
    style Step2 fill:#f3e5f5
    style Step3 fill:#e8f5e9
    style Step5 fill:#fff3e0
    style Step7 fill:#fce4ec
```

### Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Initializing: Create Session
    Initializing --> Running: Start Generation
    
    Running --> Architect: Run Architect
    Architect --> Frontend: Run Frontend
    Architect --> Backend: Run Backend
    Frontend --> DevOps: Run DevOps
    Backend --> DevOps
    DevOps --> Test: Run Test
    Test --> Docs: Run Docs
    Docs --> WRunner: Run WRunner
    WRunner --> Running: Continue
    
    Running --> Completed: All Done
    Running --> Failed: Error
    
    Completed --> [*]
    Failed --> [*]
```

## Mermaid Diagrams

### System Architecture Overview

```mermaid
graph TB
    subgraph User["User"]
        Input[Natural Language<br/>Description]
    end

    subgraph Processing["Processing Pipeline"]
        IC[Intent Compiler]
        Arch[Architecture Service]
        PRD[PRD Service]
        AO[Agent Orchestrator]
    end

    subgraph Agents["Specialized Agents"]
        A1[Architect]
        A2[Frontend]
        A3[Backend]
        A4[DevOps]
        A5[Test]
        A6[Docs]
    end

    subgraph Quality["Quality Assurance"]
        WR[Work Reports]
        WA[WRunner]
        AF[Auto-Fix]
    end

    subgraph Output["Output"]
        Code[Generated Code]
        Docs[Documentation]
        Reports[Work Reports]
        Analysis[Quality Analysis]
    end

    Input --> IC
    IC --> Arch
    Arch --> PRD
    PRD --> AO
    
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
    
    WR --> WA
    WA --> AF
    
    A2 --> Code
    A3 --> Code
    A4 --> Code
    A5 --> Code
    A6 --> Docs
    WR --> Reports
    WA --> Analysis
```

### Data Flow

```mermaid
flowchart LR
    NL[Natural Language] --> IC[Intent Compiler]
    IC --> SI[Structured Intent]
    SI --> CE[Claude Enrichment]
    CE --> EI[Enriched Intent]
    
    PRD[PRD] --> AO[Orchestrator]
    ARCH[Architecture] --> AO
    EI --> AO
    
    AO --> A1[Architect]
    AO --> A2[Frontend]
    AO --> A3[Backend]
    AO --> A4[DevOps]
    AO --> A5[Test]
    AO --> A6[Docs]
    
    A1 --> WR[Work Reports]
    A2 --> WR
    A3 --> WR
    A4 --> WR
    A5 --> WR
    A6 --> WR
    
    WR --> WA[WRunner]
    WA --> AF[Auto-Fix]
    
    A2 --> CF[Code Files]
    A3 --> CF
    A4 --> CF
    A5 --> CF
    A6 --> DOC[Documentation]
    
    CF --> ZIP[Project ZIP]
    DOC --> ZIP
    WR --> ZIP
    WA --> ZIP
```

## Key Features Explained

### 1. Claude Code Optimization

All prompts are optimized for Claude Code, ensuring:
- **Type Safety**: Strict typing throughout
- **Best Practices**: Industry-standard patterns
- **Code Quality**: High-quality, maintainable code
- **Documentation**: Self-documenting code
- **Testing**: Comprehensive test coverage
- **Security**: Security-first approach

### 2. Design Mode

Automatic work report generation provides:
- **Transparency**: See what each agent did
- **Traceability**: Track decisions and rationale
- **Quality**: Identify issues early
- **Learning**: Understand agent reasoning

### 3. WRunner Quality Assurance

Automatic quality assurance includes:
- **Comprehensive Analysis**: Checks all aspects
- **Issue Detection**: Finds problems automatically
- **Auto-Fixes**: Applies fixes when possible
- **Recommendations**: Suggests improvements

## Best Practices

1. **Be Specific**: Detailed descriptions yield better results
2. **Review Architecture**: Ensure architecture matches your needs
3. **Check PRD**: Verify all features are captured
4. **Review Work Reports**: Understand agent decisions
5. **Address WRunner Issues**: Fix critical issues before deployment
6. **Iterate**: Refine and regenerate as needed

## Next Steps

- [QUICK_START.md](QUICK_START.md) - Get started quickly
- [HOW_IT_WORKS.md](HOW_IT_WORKS.md) - Detailed explanation
- [AGENT_SYSTEM.md](AGENT_SYSTEM.md) - Agent documentation
- [INTENT_COMPILER.md](INTENT_COMPILER.md) - Intent compiler details
