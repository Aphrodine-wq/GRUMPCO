# VibeCode IDE: Software Engineer's Standpoint - Implementation Plan

## 🎯 Vision
Transform the current G-Rump into a comprehensive **VibeCode IDE** that generates full-stack software projects through three sequential phases:
1. **Systems Architecture** (Mermaid C4 diagrams)
2. **Product Requirements** (PRD generation)
3. **Multi-Agent Code Generation** (Architect + Agent team)

---

## 📋 Phase Overview

### **Phase 1: Systems Architecture Generator** ✨ (New)
**Goal**: Convert natural language project descriptions into comprehensive system architecture diagrams

**Inputs**:
- Project description (natural language)
- Project type (web app, microservice, API, fullstack, SaaS)
- Tech stack preferences
- Complexity level (MVP, standard, enterprise)

**Outputs**:
- **C4 Context Diagram**: High-level system overview with external actors
- **C4 Container Diagram**: Major components (frontend, backend, database, services)
- **C4 Component Diagram**: Internal structure of key containers
- **Architecture metadata** (JSON): Structured system spec
- **System flow diagrams**: Data flow, API contracts

**Implementation**:
- Create new `architectureService.ts` to orchestrate architecture generation
- Create "architect" system prompt that uses few-shot examples of C4 diagrams
- Extend `intentParser` to extract architecture requirements from description
- New route: `POST /api/architecture/generate` (with streaming)
- New route: `POST /api/architecture/refine` (iterative refinement)

**Key Features**:
- Multi-turn refinement (user can ask to add components, change tech stack, etc.)
- Architecture validation (ensure diagrams are consistent and complete)
- Export architecture as JSON for downstream agents

---

### **Phase 2: PRD Generation Service** ✨ (New)
**Goal**: Transform system architecture into formal Product Requirements Document

**Inputs**:
- Generated system architecture (C4 diagrams + metadata)
- User requirements/constraints
- Market/domain context

**Outputs**:
- **Structured PRD** including:
  - Product Overview & Vision
  - User Personas & Jobs to be Done
  - Feature List (prioritized with MoSCoW: Must/Should/Could/Won't)
  - User Stories (As a... I want... So that...)
  - Acceptance Criteria
  - Non-Functional Requirements (performance, security, scalability)
  - API Specifications (from architecture)
  - Data Models (from diagrams)
  - Success Metrics & KPIs

**Implementation**:
- Create new `prdGeneratorService.ts`
- Create "prd-writer" system prompt (structured JSON output)
- Extract architecture components and translate to user stories
- New route: `POST /api/prd/generate` (from architecture)
- New route: `POST /api/prd/refine` (iterative refinement)
- PRD validation: ensure completeness and consistency

**Architecture**:
```
Input: Architecture JSON
  ↓
Parse Components → Identify User Interactions → Generate User Stories
  ↓
Extract Data Models → Define APIs → Spec Non-Functional Requirements
  ↓
Organize by Priority → Format as PRD JSON
  ↓
Output: Structured PRD
```

---

### **Phase 3: Multi-Agent Code Generation** ✨ (New)
**Goal**: Orchestrate multiple specialized AI agents to generate complete, production-ready code

**Agent Team**:
1. **Architect Agent**: Validates PRD, creates code structure plan
2. **Frontend Agent**: Generates UI components (Vue/React) + styling
3. **Backend Agent**: Generates APIs, database schemas, business logic
4. **DevOps Agent**: Generates Docker files, CI/CD, deployment configs
5. **Test Agent**: Generates unit tests, integration tests, E2E tests
6. **Documentation Agent**: Generates README, setup guides, API docs

**Implementation**:
- Create new `agentOrchestrator.ts` to manage agent lifecycle and message passing
- Create individual agent services: `frontendAgent.ts`, `backendAgent.ts`, etc.
- Each agent has:
  - System prompt (role + responsibilities)
  - State management (what it's built, decisions made)
  - Message interface (request/response format)
- Agent communication: Message queue pattern or sequential orchestration
- New routes:
  - `POST /api/codegen/start` (init multi-agent generation)
  - `GET /api/codegen/status/{sessionId}` (polling for progress)
  - `GET /api/codegen/download/{sessionId}` (retrieve generated code)
  - `POST /api/codegen/refine` (user feedback → agent refinement)

**Workflow**:
```
PRD Input
  ↓
[Architect Agent] → Validates PRD, creates generation plan
  ↓
[Frontend Agent] ─→ Generates components, pages, routing
[Backend Agent] ──→ Generates APIs, models, services
[DevOps Agent] ───→ Generates Docker, configs
  ↓ (parallel execution with dependency tracking)
[Test Agent] ─→ Generates tests for all components
  ↓
[Documentation Agent] → Generates docs, setup guides
  ↓
Assemble & Package → Zip file with complete project
```

**Code Generation Strategy**:
- Each agent generates code for their domain
- Agents share context (through PRD + architecture metadata)
- Generated code follows modern best practices:
  - TypeScript for type safety
  - Modular structure
  - Tests included
  - Docker-ready
  - Environment configuration
  - Error handling & logging

---

## 🏗️ Architecture Changes

### Backend Structure (New Components)
```
backend/src/
├── prompts/
│   ├── architect.ts          [NEW] Architecture design prompts
│   ├── prd-writer.ts         [NEW] PRD generation prompts
│   └── agents/               [NEW] Agent system prompts
│       ├── architect-agent.ts
│       ├── frontend-agent.ts
│       ├── backend-agent.ts
│       ├── devops-agent.ts
│       ├── test-agent.ts
│       └── docs-agent.ts
├── services/
│   ├── architectureService.ts [NEW]
│   ├── prdGeneratorService.ts [NEW]
│   ├── agentOrchestrator.ts    [NEW]
│   └── agents/                 [NEW]
│       ├── archAgent.ts
│       ├── frontendAgent.ts
│       ├── backendAgent.ts
│       ├── devopsAgent.ts
│       ├── testAgent.ts
│       └── docsAgent.ts
├── types/
│   ├── architecture.ts         [NEW] Architecture types
│   ├── prd.ts                 [NEW] PRD types
│   └── agents.ts              [NEW] Agent communication types
└── routes/
    ├── architecture.ts         [NEW] Architecture endpoints
    ├── prd.ts                 [NEW] PRD endpoints
    └── codegen.ts             [NEW] Code generation endpoints
```

### Frontend Structure (New Components)
```
frontend/src/
├── components/
│   ├── ArchitectureWorkspace.vue [NEW] Phase 1 UI
│   ├── PRDEditor.vue             [NEW] Phase 2 UI
│   ├── CodeGenStudio.vue         [NEW] Phase 3 UI
│   └── PhaseTransition.vue       [NEW] Phase navigation
├── composables/
│   ├── useArchitecture.ts        [NEW]
│   ├── usePRDGeneration.ts       [NEW]
│   ├── useCodeGeneration.ts      [NEW]
│   └── useAgentProgress.ts       [NEW]
└── data/
    ├── architecture-examples.ts   [NEW] C4 diagram templates
    └── prd-templates.ts          [NEW] PRD templates
```

---

## 🔄 Request/Response Flow

### Architecture Generation
```
POST /api/architecture/generate
{
  projectDescription: string
  projectType: 'web' | 'mobile' | 'api' | 'fullstack' | 'saas'
  techStack: string[]
  complexity: 'mvp' | 'standard' | 'enterprise'
}

Response:
{
  id: string (sessionId)
  status: 'generating' | 'complete'
  architecture: {
    c4Diagrams: {
      context: string (mermaid)
      container: string (mermaid)
      component: string (mermaid)
    }
    metadata: {
      components: Component[]
      integrations: Integration[]
      dataModels: DataModel[]
      apiEndpoints: APIEndpoint[]
    }
  }
  timestamp: ISO string
}
```

### PRD Generation
```
POST /api/prd/generate
{
  architectureId: string
  refinements?: string[] (user feedback)
}

Response:
{
  id: string
  prd: {
    overview: string
    personas: Persona[]
    features: Feature[]
    userStories: UserStory[]
    acceptanceCriteria: Criteria[]
    nonFunctionalRequirements: NFR[]
    dataModels: DataModel[]
    apiSpec: APISpec
    successMetrics: Metric[]
  }
  timestamp: ISO string
}
```

### Code Generation (Multi-Agent)
```
POST /api/codegen/start
{
  prdId: string
  architectureId: string
  preferences: {
    frontendFramework: 'vue' | 'react'
    backendRuntime: 'node' | 'python' | 'go'
    database: 'postgres' | 'mongodb'
    includeTests: boolean
    includeDocs: boolean
  }
}

Response:
{
  sessionId: string
  status: 'initializing'
  agents: {
    architect: AgentStatus
    frontend: AgentStatus
    backend: AgentStatus
    devops: AgentStatus
    tests: AgentStatus
    docs: AgentStatus
  }
}

// Polling for progress
GET /api/codegen/status/{sessionId}
Response: { sessionId, status, agents: [AgentStatus...], progress: number }

// Retrieve generated code
GET /api/codegen/download/{sessionId}
Response: Binary zip file
```

---

## 🎨 Frontend User Experience

### Three-Phase Workflow
```
┌─────────────────────────────────────────────────────────┐
│ 1. ARCHITECTURE DESIGN PHASE                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Chat: "Build a SaaS project management tool..."     │ │
│ │ Suggestions: [Project Type] [Tech Stack] [Complexity]│
│ │                                                       │ │
│ │ Generated Diagrams (tabs):                           │ │
│ │ ├─ Context Diagram (C4 Context)                      │
│ │ ├─ Container Diagram (Services, Databases)          │
│ │ └─ Component Diagram (Internal modules)             │
│ │                                                       │ │
│ │ Refinement: "Add payment service" → Diagram updates │
│ └─────────────────────────────────────────────────────┘ │
│                        ↓ Next Phase                       │
├─────────────────────────────────────────────────────────┤
│ 2. PRD GENERATION PHASE                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ PRD View (tabs):                                     │ │
│ │ ├─ Overview & Vision                                │
│ │ ├─ User Personas                                    │
│ │ ├─ Features (MoSCoW prioritized)                    │
│ │ ├─ User Stories                                     │
│ │ ├─ API Spec (auto-generated from architecture)     │
│ │ └─ Success Metrics                                  │
│ │                                                       │ │
│ │ Editor: Inline refinement of each section           │
│ │ Validation: Check completeness before code gen      │
│ └─────────────────────────────────────────────────────┘ │
│                        ↓ Next Phase                       │
├─────────────────────────────────────────────────────────┤
│ 3. MULTI-AGENT CODE GENERATION PHASE                    │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Agent Studio:                                        │ │
│ │ ┌─ Architect Agent: ████░░░░░░ 40% - Planning      │ │
│ │ ├─ Frontend Agent:  ██████░░░░░ 60%  - Components  │ │
│ │ ├─ Backend Agent:   ███████░░░░ 70%  - APIs        │ │
│ │ ├─ DevOps Agent:    ████░░░░░░ 40%  - Configs      │ │
│ │ ├─ Test Agent:      ██░░░░░░░░ 20%  - Tests        │ │
│ │ └─ Docs Agent:      ░░░░░░░░░░ 0%   - Ready        │ │
│ │                                                       │ │
│ │ Preview Pane: Generated code snippets (tab-based)   │ │
│ │ Controls:                                            │ │
│ │ [Regenerate] [Refine] [Preview] [Download Project] │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Key UI Components
1. **ArchitectureWorkspace.vue**: C4 diagram generator with interactive refinement
2. **PRDEditor.vue**: Structured PRD editor with section templates
3. **CodeGenStudio.vue**: Multi-agent progress tracking + code preview
4. **PhaseTransition.vue**: Navigation between phases with validation
5. **AgentMonitor.vue**: Real-time agent status, logs, error handling

---

## 🔌 Integration Points

### Existing Code Reuse
- ✅ Intent parser: Extend for architecture requirements detection
- ✅ Claude API integration: Reuse resilience patterns
- ✅ Prompt system: Add architect + agent prompts
- ✅ Streaming responses: Extend for agent streaming output
- ✅ Error handling: Leverage existing error classification

### New Dependencies
- None required! Built on existing tech stack:
  - Express.js for routing
  - Claude Haiku/Opus for LLM
  - TypeScript for type safety
  - Vue 3 for frontend

---

## 📊 Implementation Phases

### Phase A: Backend Infrastructure (Week 1-2)
1. Create architecture service with C4 prompt engineering
2. Build PRD generator with structured output
3. Implement agent orchestrator framework
4. Create 3 agent implementations (Architect, Frontend, Backend)
5. Add routes and integration tests

### Phase B: Remaining Agents (Week 2)
1. Implement DevOps agent (Docker, configs)
2. Implement Test agent (unit + integration tests)
3. Implement Documentation agent (README, guides)
4. Agent message passing & dependency management
5. Code assembly & packaging (zip generation)

### Phase C: Frontend UI (Week 3-4)
1. Architecture workspace with C4 diagram editing
2. PRD editor with section templates
3. Code generation studio with agent monitor
4. Phase navigation and validation
5. Code preview and download functionality
6. Streaming output for real-time feedback

### Phase D: Polish & Testing (Week 4+)
1. End-to-end testing (architecture → PRD → code)
2. Error handling and recovery
3. Performance optimization
4. Documentation and examples
5. User feedback integration

---

## 🚀 Success Criteria

### Functional Requirements
- ✅ Generate valid C4 system diagrams from natural language
- ✅ Create comprehensive PRD from architecture
- ✅ Generate working code via multi-agent orchestration
- ✅ Support iterative refinement at each phase
- ✅ Export complete project as zip file

### Quality Requirements
- ✅ Generated code passes linting and type checking
- ✅ Code includes tests (unit + integration)
- ✅ Docker-ready (includes Dockerfile + compose)
- ✅ PRD is complete and actionable
- ✅ Architecture diagrams are consistent with PRD

### Performance Requirements
- ✅ Architecture generation: < 30 seconds
- ✅ PRD generation: < 20 seconds
- ✅ Code generation: < 5 minutes (with streaming feedback)
- ✅ Real-time agent progress updates

---

## 🛠️ Technical Considerations

### Error Handling
- Invalid architecture detection → request user clarification
- PRD incompleteness → prompt user to fill gaps
- Agent failures → fallback generation or retry
- All errors logged with context for debugging

### Scaling Considerations
- Agent orchestration uses async/concurrent execution where possible
- Streaming responses to avoid timeouts
- Session-based progress tracking for long-running operations
- Graceful degradation (generate without tests if test agent fails)

### Security
- API key protection (existing)
- Rate limiting on generation endpoints
- Input validation for all user inputs
- Generated code is scanned before delivery (placeholder for future)

---

## 📚 Example Flow: E-Commerce SaaS

**User Input** (Natural Language):
```
"Build a SaaS e-commerce platform with multi-vendor support.
Need React frontend, Node/Express backend, PostgreSQL.
Include payment processing, user authentication, and admin dashboard.
Target MVP for early validation."
```

**Phase 1 Output** (Architecture):
```
C4 Context:
- External Users (Customers, Vendors, Admins)
- External Systems (Stripe, AWS S3, Email Service)

C4 Container:
- Frontend (React SPA)
- API Server (Node/Express)
- Database (PostgreSQL)
- Worker (Background jobs)

C4 Component:
- (Each container broken into modules)
```

**Phase 2 Output** (PRD):
```
Personas: Customer, Vendor, Admin
Features (Must/Should/Could):
- Must: User auth, Product listing, Checkout
- Should: Ratings, Reviews, Vendor analytics
- Could: Wishlist, Recommendations, Mobile app

User Stories:
- As a Vendor, I want to list products so that I can sell them
- As a Customer, I want to search products so that I can find items
- (20+ stories generated)

APIs:
- POST /api/auth/signup
- GET /api/products
- POST /api/orders
- (Full REST spec)
```

**Phase 3 Output** (Code):
```
Generated Files:
frontend/
├── src/
│   ├── components/ (pages, shared components)
│   ├── services/ (API clients)
│   ├── styles/ (Tailwind config)
│   └── App.vue

backend/
├── src/
│   ├── routes/ (auth, products, orders, payments)
│   ├── services/ (business logic)
│   ├── models/ (Prisma schema)
│   └── middleware/

tests/ (unit + integration)
docker-compose.yml
Dockerfile
README.md with setup instructions
```

---

## ⚡ Next Steps

1. **Get User Approval** on this architecture
2. **Phase A**: Implement backend services (architect + PRD generator)
3. **Phase B**: Implement agent orchestrator + agents
4. **Phase C**: Build frontend UI for all 3 phases
5. **Phase D**: Testing and refinement

---

## Questions for User

1. Should agents generate code sequentially or in parallel?
2. For MVP, should we include all 6 agents or prioritize a subset?
3. Do you want streaming agent updates or just final results?
4. Any specific code generation preferences (file structure, patterns)?
5. Should generated code include example data/seeding?

