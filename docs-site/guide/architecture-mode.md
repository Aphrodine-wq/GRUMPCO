# Architecture Mode

Architecture Mode is G-Rump's specialized interface for designing system architectures before writing code.

## Overview

Architecture Mode helps you:

- Design complete system architectures
- Create data models and schemas
- Define API contracts
- Make technology decisions
- Document architectural decisions

## Entering Architecture Mode

### CLI

```bash
# Start architecture mode
grump architect

# Start with a specific project
grump architect --project my-app

# Import existing architecture
grump architect --import architecture.yaml
```

### Desktop App

Click the **Architecture** tab or press `Cmd/Ctrl + 2`.

## Core Features

### System Design

Describe your system and G-Rump generates a complete architecture:

```
You: Design a real-time collaboration platform like Google Docs

G-Rump generates:
├── System Context Diagram
├── Container Diagram
├── Component Diagram
├── Data Flow Diagram
└── Technology Stack
```

**Generated System Context:**

```
┌─────────────────────────────────────────────────────────────┐
│                    Collaboration Platform                    │
└─────────────────────────────┬───────────────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    ▼                         ▼                         ▼
┌────────┐              ┌──────────┐              ┌──────────┐
│  User  │              │  Admin   │              │   API    │
│ (Web)  │              │ (Web)    │              │ Consumer │
└────────┘              └──────────┘              └──────────┘
```

### Data Modeling

Define your domain model in natural language:

```
You: Model a document collaboration system with:
- Documents with content and metadata
- Users who can own or collaborate on documents
- Real-time cursors and selections
- Version history with diffs
- Comments on document sections
```

**Generated Entity Relationship Diagram:**

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│     User     │───────│  Permission  │───────│   Document   │
├──────────────┤   M:N ├──────────────┤   M:1 ├──────────────┤
│ id           │       │ userId       │       │ id           │
│ email        │       │ documentId   │       │ title        │
│ name         │       │ role         │       │ content      │
│ avatar       │       │ grantedAt    │       │ ownerId      │
└──────────────┘       └──────────────┘       │ createdAt    │
                                              │ updatedAt    │
┌──────────────┐       ┌──────────────┐       └──────┬───────┘
│   Comment    │───────│   Version    │──────────────┘
├──────────────┤   M:1 ├──────────────┤   1:M
│ id           │       │ id           │
│ documentId   │       │ documentId   │
│ userId       │       │ content      │
│ content      │       │ diff         │
│ position     │       │ createdBy    │
│ resolved     │       │ createdAt    │
└──────────────┘       └──────────────┘
```

### API Design

Generate comprehensive API specifications:

```
You: Design the API for document operations

G-Rump generates OpenAPI spec:
```

```yaml
paths:
  /documents:
    get:
      summary: List user's documents
      parameters:
        - name: owned
          in: query
          description: Filter to owned documents only
        - name: shared
          in: query
          description: Filter to shared documents only
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/DocumentSummary'
    
    post:
      summary: Create a document
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateDocument'
      responses:
        201:
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Document'

  /documents/{id}:
    get:
      summary: Get document with content
    put:
      summary: Update document
    delete:
      summary: Delete document

  /documents/{id}/collaborators:
    get:
      summary: List document collaborators
    post:
      summary: Add collaborator
    delete:
      summary: Remove collaborator

  /documents/{id}/versions:
    get:
      summary: List document versions
    post:
      summary: Create version snapshot

  /documents/{id}/comments:
    get:
      summary: List comments
    post:
      summary: Add comment
```

### Technology Decisions

Get reasoned technology recommendations:

```
You: What stack should I use for real-time collaboration?

G-Rump Analysis:

## Recommended Stack

### Frontend
**React + Yjs** - Best real-time CRDT support
- Alternatives considered: Vue (less CRDT ecosystem), Svelte (newer)
- Decision: React has mature Yjs bindings and large ecosystem

### Backend
**Node.js + Express + Socket.io**
- Real-time: Native WebSocket support
- Performance: Good for I/O-bound operations
- Alternative: Elixir/Phoenix (better concurrency, smaller talent pool)

### Database
**PostgreSQL + Redis**
- PostgreSQL: Document storage, user data, ACID compliance
- Redis: Pub/sub for real-time, session cache
- Alternative: MongoDB (flexible schema, weaker consistency)

### Real-time Sync
**Yjs CRDT**
- Conflict-free replicated data types
- Works offline
- Alternative: Automerge (similar, less WebSocket focused)

### Infrastructure
**AWS / Vercel + Railway**
- Vercel: Frontend hosting, edge functions
- Railway: Backend, managed PostgreSQL, Redis
- Alternative: Self-hosted Kubernetes (more control, more ops)
```

## Visualization

### Diagram Types

Architecture Mode generates multiple diagram types:

1. **C4 Diagrams**
   - System Context
   - Container
   - Component
   - Code

2. **Data Diagrams**
   - Entity Relationship (ERD)
   - Data Flow (DFD)
   - State Machines

3. **Infrastructure**
   - Deployment Diagram
   - Network Topology
   - Cloud Architecture

### Export Formats

```bash
# Export to various formats
grump architect export --format mermaid
grump architect export --format plantuml
grump architect export --format svg
grump architect export --format png
```

## Architecture Decision Records (ADRs)

Document decisions with full context:

```markdown
# ADR-001: Use PostgreSQL for Document Storage

## Status
Accepted

## Context
We need a database for storing documents, user data, and collaboration metadata.
The system requires ACID compliance for document operations and good performance
for concurrent reads.

## Decision
Use PostgreSQL as the primary database.

## Consequences
### Positive
- ACID compliance ensures data integrity
- Rich querying capabilities (JSON support)
- Mature ecosystem and tooling
- Easy to find developers

### Negative
- Requires more ops than managed NoSQL
- Schema migrations needed
- Vertical scaling limits

### Risks
- May need read replicas at scale
- JSON queries slower than native document stores

## Alternatives Considered
1. **MongoDB**: Better schema flexibility, weaker consistency
2. **CockroachDB**: Better horizontal scaling, less mature
3. **Supabase**: Managed Postgres, vendor lock-in
```

## Collaboration

### Sharing Architectures

```bash
# Export architecture
grump architect export --output architecture.grump

# Share with team
grump architect share --team engineering

# Import shared architecture
grump architect import team://engineering/user-service
```

### Version Control

Architecture files are version-controlled:

```
.grump/
├── architecture/
│   ├── system.yaml
│   ├── data-model.yaml
│   ├── api-spec.yaml
│   └── adrs/
│       ├── 001-database.md
│       └── 002-auth-strategy.md
```

## Best Practices

1. **Start high-level** - Begin with system context, then drill down
2. **Validate early** - Review architecture before implementation
3. **Document decisions** - Use ADRs for important choices
4. **Keep it updated** - Architecture should evolve with code
5. **Review with team** - Multiple perspectives improve design

## Next Steps

- [Code Mode](/guide/code-mode) - Implement your architecture
- [SHIP Workflow](/guide/ship-workflow) - Architecture in context
- [API Reference](/api/architecture) - Architecture API endpoints
