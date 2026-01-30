# G-Rump (Legacy) - System Architecture

> **⚠️ LEGACY DOCUMENT**: This document is outdated and references the old Vue.js frontend and Anthropic Claude as the primary LLM. The current stack uses **Svelte 5** for the frontend and **NVIDIA NIM (Kimi K2.5)** or **OpenRouter** as the LLM provider. For up-to-date architecture documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md) and [OVERVIEW.md](./OVERVIEW.md).

> Comprehensive architectural documentation with visual diagrams covering current state and planned enhancements.

---

## Table of Contents

1. [System Context (C4 Level 1)](#1-system-context-c4-level-1)
2. [Container Diagram (C4 Level 2)](#2-container-diagram-c4-level-2)
3. [Frontend Component Architecture](#3-frontend-component-architecture)
4. [Backend Component Architecture](#4-backend-component-architecture)
5. [Main User Flow - Sequence Diagram](#5-main-user-flow---sequence-diagram)
6. [Code Generation Flow](#6-code-generation-flow)
7. [State Management & Data Flow](#7-state-management--data-flow)
8. [Deployment Architecture](#8-deployment-architecture)
9. [Technology Stack Overview](#9-technology-stack-overview)
10. [Planned Enhancements Roadmap](#10-planned-enhancements-roadmap)

---

## 1. System Context (C4 Level 1)

Shows the system boundaries and external actors/systems that interact with the G-Rump (Legacy).

```mermaid
flowchart TB
    subgraph actors["External Actors"]
        user["<b>User</b><br/>Creates diagrams via<br/>chat interface"]
        developer["<b>Developer</b><br/>Uses VS Code extension<br/>(Planned)"]
    end

    subgraph system["G-Rump (Legacy)"]
        app["<b>G-Rump</b><br/>AI-powered diagram<br/>generation platform<br/><br/>Vue 3 + Express"]
    end

    subgraph external["External Systems"]
        claude["<b>Anthropic Claude API</b><br/>AI model for diagram<br/>and code generation"]
        supabase["<b>Supabase</b><br/>Authentication &<br/>Database (Optional)"]
        github["<b>GitHub API</b><br/>Repository analysis<br/>(Planned)"]
        sandbox["<b>CodeSandbox/StackBlitz</b><br/>Live code preview<br/>(Planned)"]
    end

    user -->|"HTTPS<br/>Chat & Export"| app
    developer -.->|"HTTP API<br/>(Planned)"| app
    app -->|"HTTPS/SSE<br/>AI Requests"| claude
    app -->|"HTTPS<br/>Auth & Storage"| supabase
    app -.->|"HTTPS<br/>(Planned)"| github
    app -.->|"iFrame Embed<br/>(Planned)"| sandbox

    style app fill:#0066FF,color:#fff,stroke:#004499
    style claude fill:#FF6B35,color:#fff,stroke:#cc5522
    style supabase fill:#3ECF8E,color:#fff,stroke:#2a9d6a
    style github fill:#24292e,color:#fff,stroke:#1b1f23
    style sandbox fill:#151515,color:#fff,stroke:#0a0a0a
```

---

## 2. Container Diagram (C4 Level 2)

Details the major containers (applications/services) and data stores within the system.

```mermaid
flowchart TB
    subgraph users["Users"]
        user["<b>User</b><br/>Browser"]
        vscodeUser["<b>Developer</b><br/>VS Code"]
    end

    subgraph system["G-Rump System"]
        subgraph frontend["Frontend Container"]
            vue["<b>Vue 3 SPA</b><br/>Vite + TypeScript<br/><br/>Chat interface,<br/>Session management,<br/>Diagram rendering"]
        end

        subgraph backend["Backend Container"]
            express["<b>Express API</b><br/>Node.js + TypeScript<br/><br/>REST + SSE streaming,<br/>Intent parsing,<br/>Code generation"]
        end

        subgraph extension["VS Code Extension (Planned)"]
            vscode["<b>Webview Panel</b><br/>TypeScript<br/><br/>Wraps Vue frontend,<br/>Workspace integration"]
        end

        subgraph storage["Client Storage"]
            localStorage[("localStorage<br/><br/>Sessions<br/>Preferences<br/>App State")]
        end
    end

    subgraph external["External Services"]
        claude["<b>Claude API</b><br/>claude-sonnet-4"]
        supabase["<b>Supabase</b><br/>Auth + PostgreSQL"]
        mermaidLib["<b>Mermaid.js</b><br/>Client-side rendering"]
        githubApi["<b>GitHub API</b><br/>(Planned)"]
    end

    user -->|"HTTPS:8080"| vue
    vscodeUser -.->|"Extension"| vscode
    vue -->|"HTTP/SSE<br/>/api/*"| express
    vscode -.->|"HTTP API"| express
    vue -->|"JS API"| localStorage
    vue -->|"JS Import"| mermaidLib
    express -->|"HTTPS/SSE"| claude
    express -->|"HTTPS"| supabase
    express -.->|"HTTPS"| githubApi

    style vue fill:#42b883,color:#fff,stroke:#35a36e
    style express fill:#0066FF,color:#fff,stroke:#004499
    style claude fill:#FF6B35,color:#fff,stroke:#cc5522
    style localStorage fill:#6B7280,color:#fff,stroke:#4B5563
```

---

## 3. Frontend Component Architecture

Hierarchical view of Vue 3 components and composables.

```mermaid
flowchart TB
    subgraph root["Root"]
        App["<b>App.vue</b><br/>Screen Router<br/>Session Lifecycle"]
    end

    subgraph screens["Screen Components"]
        Splash["SplashScreen.vue<br/>Initial branding"]
        Auth["AuthScreen.vue<br/>API key validation"]
        Setup["OnboardingWizard.vue<br/>Preferences setup"]
        Resume["ResumeScreen.vue<br/>Continue session"]
        Main["Main App View<br/>Primary interface"]
    end

    subgraph mainComponents["Main View Components"]
        Header["MinimalHeader.vue<br/>Navigation"]
        Sidebar["SessionSidebar.vue<br/>Session list"]
        Chat["ChatInterface.vue<br/>Message handling"]
    end

    subgraph chatComponents["Chat Sub-Components"]
        Diagram["DiagramRenderer.vue<br/>Mermaid.js wrapper"]
        CodeGen["CodeGenPanel.vue<br/>ZIP download"]
        Refine["RefinementActions.vue<br/>Diagram modification"]
        Suggestions["SuggestionChips.vue<br/>Quick templates"]
        Feedback["FeedbackWidget.vue<br/>Rating system"]
    end

    subgraph composables["Composables (State Logic)"]
        useAppFlow["useAppFlow.ts<br/>Screen navigation"]
        useSessions["useSessions.ts<br/>Session CRUD"]
        useAuth["useAuth.ts<br/>Authentication"]
        useMermaid["useMermaid.ts<br/>Diagram rendering"]
        useCodeGen["useCodeGeneration.ts<br/>Code download"]
        useAnalytics["useAnalytics.ts<br/>Event tracking"]
    end

    subgraph planned["Planned Components"]
        GitHub["GitHubPanel.vue"]
        Share["ShareModal.vue"]
        Export["ExportModal.vue"]
        OpenAPI["OpenAPIPanel.vue"]
        Infra["InfrastructurePanel.vue"]
    end

    App --> Splash
    App --> Auth
    App --> Setup
    App --> Resume
    App --> Main
    
    Main --> Header
    Main --> Sidebar
    Main --> Chat
    
    Chat --> Diagram
    Chat --> CodeGen
    Chat --> Refine
    Chat --> Suggestions
    Chat --> Feedback
    
    Chat -.-> GitHub
    Chat -.-> Share
    Chat -.-> Export
    Chat -.-> OpenAPI
    Chat -.-> Infra

    App -.uses.-> useAppFlow
    Sidebar -.uses.-> useSessions
    Chat -.uses.-> useSessions
    Auth -.uses.-> useAuth
    Chat -.uses.-> useCodeGen
    Diagram -.uses.-> useMermaid

    style App fill:#42b883,color:#fff
    style Chat fill:#42b883,color:#fff
    style useSessions fill:#0066FF,color:#fff
    style useAppFlow fill:#0066FF,color:#fff
```

---

## 4. Backend Component Architecture

Express.js service layer and middleware organization.

```mermaid
flowchart TB
    subgraph entry["Application Entry"]
        Index["<b>index.js</b><br/>Express App<br/>Middleware Chain<br/>Port Detection"]
    end

    subgraph routes["Route Handlers"]
        DiagramR["<b>diagram.js</b><br/>/api/generate-diagram-stream<br/>/api/generate-code"]
        AuthR["<b>auth.js</b><br/>/auth/login<br/>/auth/signup"]
        HealthR["<b>health.js</b><br/>/health<br/>/health/ready"]
        GitHubR["<b>github.js</b><br/>(Planned)<br/>/api/github/*"]
        OpenAPIR["<b>openapi.js</b><br/>(Planned)<br/>/api/openapi/*"]
    end

    subgraph services["Core Services"]
        Claude["<b>claudeService.ts</b><br/>Streaming generation<br/>Intent-aware prompts"]
        Intent["<b>intentParser.ts</b><br/>NLP analysis<br/>C4 level detection"]
        CodeGen["<b>codeGeneratorService.ts</b><br/>Template merging<br/>ZIP orchestration"]
        ClaudeCode["<b>claudeCodeService.ts</b><br/>Code scaffolding"]
        Resilience["<b>resilience.js</b><br/>Circuit breaker<br/>Retry logic"]
        MermaidUtil["<b>mermaidUtils.ts</b><br/>Code extraction"]
    end

    subgraph plannedServices["Planned Services"]
        GitHubSvc["githubService.ts<br/>OAuth + API"]
        RepoAnalyzer["repoAnalyzer.ts<br/>Code analysis"]
        ADRGen["adrGenerator.ts<br/>Documentation"]
        OpenAPISvc["openApiService.ts<br/>Spec parsing"]
        InfraParser["infraParser.ts<br/>IaC parsing"]
    end

    subgraph prompts["Prompt System"]
        PromptIndex["<b>index.ts</b><br/>Prompt factory"]
        MermaidBuilder["<b>mermaid-builder.ts</b><br/>Expert prompts"]
        C4Examples["<b>c4-examples.ts</b><br/>Architecture templates"]
    end

    subgraph middleware["Middleware Stack"]
        Logger["<b>logger.js</b><br/>Pino + Request IDs"]
        Metrics["<b>metrics.js</b><br/>Prometheus"]
        Validator["<b>validator.js</b><br/>Input validation"]
        AuthMW["<b>authMiddleware.js</b><br/>JWT verification"]
        RateLimit["<b>Rate Limiter</b><br/>100 req/15min"]
    end

    subgraph external["External APIs"]
        ClaudeAPI[("Claude API<br/>claude-sonnet-4")]
        SupabaseAPI[("Supabase<br/>Auth + DB")]
    end

    Index --> DiagramR
    Index --> AuthR
    Index --> HealthR
    Index -.-> GitHubR
    Index -.-> OpenAPIR

    Index --> Logger
    Index --> Metrics
    Index --> Validator
    Index --> AuthMW
    Index --> RateLimit

    DiagramR --> Claude
    DiagramR --> CodeGen
    
    Claude --> Intent
    Claude --> Resilience
    Claude --> MermaidUtil
    Claude --> PromptIndex
    
    PromptIndex --> MermaidBuilder
    MermaidBuilder --> C4Examples
    
    CodeGen --> ClaudeCode
    
    GitHubR -.-> GitHubSvc
    GitHubSvc -.-> RepoAnalyzer

    Claude --> ClaudeAPI
    ClaudeCode --> ClaudeAPI
    AuthR --> SupabaseAPI

    style Index fill:#0066FF,color:#fff
    style Claude fill:#0066FF,color:#fff
    style Intent fill:#FF6B35,color:#fff
    style Resilience fill:#00CC88,color:#fff
```

---

## 5. Main User Flow - Sequence Diagram

Complete flow from user input to rendered diagram.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Chat as ChatInterface.vue
    participant Backend as Express API
    participant Intent as intentParser.ts
    participant Claude as claudeService.ts
    participant API as Claude API
    participant Renderer as DiagramRenderer.vue
    participant Mermaid as Mermaid.js
    participant Sessions as useSessions.ts
    participant Storage as localStorage

    User->>Chat: Types "Show login flow"
    Chat->>Chat: Set streaming = true
    Chat->>Chat: Create AbortController (60s timeout)
    
    Chat->>Backend: POST /api/generate-diagram-stream<br/>{message, preferences}
    
    Backend->>Backend: validateDiagramRequest()
    Backend->>Intent: analyzeIntent(message)
    
    Note over Intent: Detect diagram type<br/>C4 level, complexity<br/>confidence scoring
    
    Intent-->>Backend: {type: 'sequence', confidence: 0.85}
    
    Backend->>Claude: generateDiagramStream(message, preferences)
    Claude->>Claude: Enrich preferences with intent
    Claude->>Claude: Build system prompt
    
    Claude->>API: messages.stream()<br/>model: claude-sonnet-4<br/>max_tokens: 1024
    
    loop SSE Streaming
        API-->>Claude: content_block_delta
        Claude-->>Backend: yield text chunk
        Backend-->>Chat: data: {"text": "..."}\n\n
        Chat->>Chat: Append to streamingContent
        Chat->>Chat: Update UI in real-time
    end
    
    API-->>Claude: Stream complete
    Backend-->>Chat: data: [DONE]\n\n
    
    Chat->>Chat: parseMessageContent()<br/>Extract ```mermaid blocks
    
    Chat->>Renderer: <DiagramRenderer :code="mermaidCode"/>
    Renderer->>Mermaid: renderDiagram(code, elementId)
    Mermaid->>Mermaid: Parse Mermaid syntax
    Mermaid-->>Renderer: SVG string
    Renderer->>Renderer: Inject SVG into DOM
    
    Chat->>Sessions: updateSession(id, messages)
    Sessions->>Storage: localStorage.setItem('mermaid-sessions')
    
    Renderer-->>User: Display rendered diagram
    
    Note over User,Storage: User can now:<br/>- Export SVG/PNG<br/>- Copy code<br/>- Refine diagram<br/>- Generate code
```

---

## 6. Code Generation Flow

From diagram to downloadable project ZIP.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Panel as CodeGenPanel.vue
    participant Backend as Express API
    participant CodeGen as codeGeneratorService.ts
    participant ClaudeCode as claudeCodeService.ts
    participant Templates as projectTemplates.ts
    participant Zip as zipService.ts
    participant API as Claude API

    User->>Panel: Click "Generate Code"
    User->>Panel: Select "react-express-prisma"
    
    Panel->>Backend: POST /api/generate-code<br/>{diagramType, mermaidCode,<br/>techStack, projectName}
    
    Backend->>Backend: Validate tech stack
    Backend->>CodeGen: generateProjectZip(request)
    
    CodeGen->>ClaudeCode: generateCodeFromDiagram()<br/>(diagramType, code, stack)
    
    ClaudeCode->>ClaudeCode: buildPrompt()<br/>Stack-specific instructions
    
    ClaudeCode->>API: messages.create<br/>max_tokens: 8192<br/>Returns JSON file structure
    
    Note over API: Claude generates:<br/>- Controllers<br/>- Models<br/>- Routes<br/>- Configs
    
    API-->>ClaudeCode: {files: [{path, content}], warnings: []}
    
    ClaudeCode->>ClaudeCode: Parse JSON response
    ClaudeCode->>ClaudeCode: Sanitize file paths
    ClaudeCode-->>CodeGen: FileDefinition[]
    
    CodeGen->>Templates: getBaseTemplate(techStack)
    Templates-->>CodeGen: Base files (.gitignore, etc.)
    
    CodeGen->>Templates: getPackageJson(projectName, stack)
    Templates-->>CodeGen: package.json definition
    
    CodeGen->>CodeGen: Merge files<br/>AI-generated takes precedence
    
    CodeGen->>Zip: createProjectZip(files)
    Zip->>Zip: Create archiver stream
    Zip->>Zip: Add README with instructions
    Zip->>Zip: Append all files
    
    Zip-->>Backend: PassThrough stream
    
    Backend->>Backend: Set headers<br/>Content-Type: application/zip<br/>Content-Disposition: attachment
    
    Backend-->>Panel: Stream ZIP file
    Panel-->>User: Browser downloads<br/>project-name.zip
    
    Note over User: User extracts ZIP,<br/>runs npm install,<br/>starts development
```

---

## 7. State Management & Data Flow

How state flows through the application.

```mermaid
flowchart LR
    subgraph userActions["User Actions"]
        Input["Chat Message"]
        Export["Export/Copy"]
        Switch["Session Switch"]
        Refine["Refine Diagram"]
    end

    subgraph composableState["Composable State (Reactive)"]
        AppFlow["<b>useAppFlow</b><br/>currentScreen<br/>hasCompletedSetup<br/>preferences<br/>lastSession"]
        
        Sessions["<b>useSessions</b><br/>sessions: Session[]<br/>currentSessionId<br/>sortedSessions"]
        
        ChatState["<b>ChatInterface</b><br/>messages<br/>streaming<br/>streamingContent<br/>inputText"]
        
        Toast["<b>useToast</b><br/>notifications"]
    end

    subgraph persistence["Persistence Layer"]
        LocalStorage[("localStorage<br/><br/>mermaid-app-state<br/>mermaid-sessions<br/>mermaid-auth")]
    end

    subgraph backend["Backend Integration"]
        API["Express API<br/>SSE Streaming"]
        ClaudeAPI["Claude API"]
    end

    subgraph rendering["Rendering Pipeline"]
        MermaidJS["Mermaid.js<br/>SVG Generation"]
        DOM["Browser DOM"]
    end

    Input -->|"sendMessage()"| ChatState
    Export -->|"exportAsSvg()"| MermaidJS
    Switch -->|"switchSession()"| Sessions
    Refine -->|"refineWith()"| ChatState

    AppFlow <-->|"watch + sync"| LocalStorage
    Sessions <-->|"watch + sync"| LocalStorage

    ChatState -->|"HTTP POST"| API
    API -->|"SSE chunks"| ChatState
    API -->|"AI requests"| ClaudeAPI

    ChatState -->|"emit messages-updated"| Sessions
    ChatState -->|"update lastSession"| AppFlow

    ChatState -->|"mermaid code"| MermaidJS
    MermaidJS -->|"SVG"| DOM

    API -->|"errors"| Toast
    ChatState -->|"success/error"| Toast

    style AppFlow fill:#0066FF,color:#fff
    style Sessions fill:#0066FF,color:#fff
    style ChatState fill:#42b883,color:#fff
    style API fill:#FF6B35,color:#fff
```

---

## 8. Deployment Architecture

Docker Compose orchestration and network topology.

```mermaid
flowchart TB
    subgraph host["Host Machine"]
        Port8080["Port 8080<br/>(Published)"]
        EnvFile[".env file<br/>ANTHROPIC_API_KEY<br/>PORT=3000"]
    end

    subgraph docker["Docker Environment"]
        subgraph network["mermaid-network (bridge)"]
            subgraph frontendContainer["Frontend Container"]
                Nginx["<b>Nginx</b><br/>Port 80<br/><br/>Static Vue build<br/>Reverse proxy"]
            end

            subgraph backendContainer["Backend Container"]
                Node["<b>Node.js</b><br/>Port 3000<br/><br/>Express server<br/>Health checks"]
            end
        end
    end

    subgraph external["External Services"]
        ClaudeAPI["<b>Claude API</b><br/>api.anthropic.com"]
        SupabaseCloud["<b>Supabase</b><br/>*.supabase.co"]
        GitHubAPI["<b>GitHub API</b><br/>api.github.com<br/>(Planned)"]
    end

    subgraph planned["Planned Extensions"]
        VSCode["<b>VS Code Extension</b><br/>Local execution"]
        ImageExport["<b>Image Export</b><br/>SVG to PNG/JPG"]
    end

    Port8080 -->|"HTTP"| Nginx
    Nginx -->|"/api/* proxy"| Node
    Nginx -->|"/health proxy"| Node
    
    EnvFile -.->|"mounted"| Node
    
    Node -->|"HTTPS"| ClaudeAPI
    Node -->|"HTTPS"| SupabaseCloud
    Node -.->|"HTTPS"| GitHubAPI
    
    Nginx -.->|"Canvas API"| ImageExport
    VSCode -.->|"HTTP"| Node

    style Nginx fill:#00CC88,color:#fff
    style Node fill:#0066FF,color:#fff
    style ClaudeAPI fill:#FF6B35,color:#fff
```

### Docker Compose Services

```yaml
# docker-compose.yml structure
services:
  backend:
    build: ./backend
    container_name: mermaid-backend
    expose: ["3000"]
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    
  frontend:
    build: ./frontend
    container_name: mermaid-frontend
    ports: ["8080:80"]
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:80/"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

networks:
  mermaid-network:
    driver: bridge
```

---

## 9. Technology Stack Overview

Complete technology inventory with versions.

```mermaid
mindmap
    root(("G-Rump<br/>Tech Stack"))
        Frontend
            Vue 3.4
                Composition API
                Reactive refs
                Computed properties
            Vite 5.0
                Hot Module Reload
                Build optimization
            TypeScript 5.3
                Strict mode
                Type safety
            Tailwind CSS 3.4
                Utility classes
                Dark mode
            Mermaid.js 10.9
                SVG rendering
                Multiple diagram types
            Tauri 2.9
                Desktop app support
                Native APIs
        Backend
            Express 4.18
                REST endpoints
                SSE streaming
            Node.js 20+
                ES Modules
                Async/await
            TypeScript 5.3
                Strict compilation
                Type definitions
            Anthropic SDK 0.24
                Claude integration
                Streaming support
            Pino 10.3
                Structured logging
                Request correlation
            Opossum 5.0
                Circuit breaker
                Fault tolerance
        Infrastructure
            Docker
                Multi-stage builds
                Health checks
            Nginx
                Reverse proxy
                Static serving
            GitHub Actions
                CI/CD pipeline
                Automated tests
        External
            Claude API
                claude-sonnet-4
                SSE streaming
            Supabase
                Authentication
                PostgreSQL
            GitHub API
                OAuth
                Repo analysis
```

---

## 10. Planned Enhancements Roadmap

Visual overview of upgrade phases.

```mermaid
timeline
    title G-Rump Upgrade Roadmap

    section Phase 1 - Foundation
        Quality Tooling : ESLint strict, Prettier, TypeScript strict mode
        AI Context : Conversation history, context window management
        Refinement : Free-text refinement, diff-based editing

    section Phase 2 - Export
        PNG/JPG Export : Canvas-based conversion, quality options
        Shareable Links : URL compression, client-side encoding

    section Phase 3 - GitHub
        OAuth Integration : GitHub Apps, token management
        Repo Analysis : Pattern-based code analysis
        Auto Diagrams : Generate architecture from repos

    section Phase 4 - VS Code
        Extension : Webview panel, API integration
        Commands : Generate from selection, insert at cursor

    section Phase 5 - Capabilities
        ADR Generation : Architecture Decision Records
        OpenAPI : Spec to diagram conversion
        Infrastructure : IaC file parsing

    section Phase 6 - Code Gen
        New Stacks : Svelte, Angular, Go templates
        Live Preview : CodeSandbox/StackBlitz embeds

    section Phase 7 - UI/UX
        Mobile : Responsive design, touch optimization
        Storybook : Component documentation
```

---

## API Endpoints Reference

### Current Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/generate-diagram` | Non-streaming diagram generation |
| POST | `/api/generate-diagram-stream` | SSE streaming diagram generation |
| POST | `/api/generate-code` | Generate project ZIP |
| POST | `/auth/signup` | User registration |
| POST | `/auth/login` | User authentication |
| POST | `/auth/logout` | Sign out |
| GET | `/auth/me` | Current user info |
| GET | `/auth/status` | Auth configuration status |
| GET | `/health` | Liveness probe |
| GET | `/health/ready` | Readiness probe |
| GET | `/metrics` | Prometheus metrics |

### Planned Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/github/auth` | Initiate GitHub OAuth |
| GET | `/api/github/callback` | OAuth callback handler |
| GET | `/api/github/repos` | List user repositories |
| POST | `/api/github/analyze` | Analyze repository |
| POST | `/api/openapi/to-diagram` | Convert OpenAPI to diagram |
| POST | `/api/diagram/to-openapi` | Convert diagram to OpenAPI |
| POST | `/api/generate-adr` | Generate ADR document |
| POST | `/api/infra/analyze` | Parse IaC files |

---

## File Structure Summary

```
grump/
├── frontend/                      # Vue 3 SPA
│   ├── src/
│   │   ├── App.vue               # Root component
│   │   ├── main.js               # Entry point
│   │   ├── components/           # UI components
│   │   │   ├── ChatInterface.vue
│   │   │   ├── DiagramRenderer.vue
│   │   │   └── ...
│   │   ├── composables/          # State logic
│   │   │   ├── useAppFlow.ts
│   │   │   ├── useSessions.ts
│   │   │   └── ...
│   │   └── types/                # TypeScript types
│   ├── vite.config.js
│   └── package.json
│
├── backend/                       # Express API
│   ├── src/
│   │   ├── index.js              # Server entry
│   │   ├── routes/               # API routes
│   │   │   ├── diagram.js
│   │   │   └── auth.js
│   │   ├── services/             # Business logic
│   │   │   ├── claudeService.ts
│   │   │   ├── intentParser.ts
│   │   │   └── ...
│   │   ├── middleware/           # Express middleware
│   │   └── prompts/              # AI prompt templates
│   └── package.json
│
├── docs/                          # Documentation
│   └── SYSTEM_ARCHITECTURE.md    # This file
│
├── docker-compose.yml            # Container orchestration
└── .github/workflows/            # CI/CD pipelines
```

---

## Quick Reference Cards

### Diagram Type Detection Keywords

| Diagram Type | Keywords |
|--------------|----------|
| Flowchart | flow, process, workflow, steps, decision |
| Sequence | sequence, interaction, request, response, API call |
| Class | class, object, inheritance, relationship, UML |
| ER | database, entity, schema, tables, relations |
| C4 Context | system context, high-level, external systems |
| C4 Container | containers, services, applications, deployment |
| C4 Component | components, modules, internal structure |

### Error Classification

| Error Type | HTTP Status | Retryable |
|------------|-------------|-----------|
| Circuit Open | 503 | Yes (after 60s) |
| Network Error | 503 | Yes |
| Auth Error | 401 | No |
| Rate Limit | 429 | Yes (after delay) |
| Extraction Failed | 422 | Yes (rephrase) |
| Timeout | 504 | Yes |
| Internal Error | 500 | Yes |

---

*Generated for G-Rump (Legacy) v1.0*
*Last Updated: January 2026*

