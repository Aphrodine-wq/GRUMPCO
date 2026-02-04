# ADR-003: Architecture-as-Code Philosophy

## Status

**Accepted**

**Date:** 2025-06-01  
**Author:** Product Team  
**Reviewers:** Architecture Team, UX Team

## Context

Traditional AI code generators follow a linear flow:

```
User Prompt → Code Generation → Output Files
```

This approach has several problems:

1. **Black Box**: Users don't see the design before code is written
2. **No Iteration**: Can't refine architecture without regenerating all code
3. **Coupling**: Architecture and code are tightly coupled
4. **Documentation Drift**: Architecture diagrams become outdated immediately
5. **Cognitive Load**: Hard to understand what will be built before it's built

**User Research Findings:**
- 73% of users want to see/approve architecture before code generation
- 68% want to iterate on architecture without rebuilding
- 82% value architecture diagrams as documentation
- "Code generation feels like a black box" (common feedback)

### Requirements

- Visual architecture representation before code
- Ability to edit architecture independently
- Architecture diagrams stay in sync with code
- Support "diagram-first" workflow
- Enable non-technical stakeholders to understand the system

## Decision

Adopt **Architecture-as-Code** philosophy where:

### Core Principle

> The architecture diagram and specification (PRD) are the **source of truth**.  
> Code generation is **optional** and derived from the architecture.

### Two Primary Modes

#### 1. Architecture Mode (Design-First)

```
Natural Language → Architecture (Mermaid) → Spec (PRD) → [Optional] Code
                        ↓
                   Editable, Versionable, Shareable
```

**Workflow:**
1. User describes intent: "Build an e-commerce platform"
2. G-Rump generates Mermaid architecture diagram
3. User reviews/edits diagram visually
4. G-Rump generates detailed PRD from architecture
5. **Optional**: Generate code from PRD

#### 2. Code Mode (Generate-First)

```
Natural Language → Code + Tools (file operations, git, etc.)
```

Traditional AI coding assistant for direct code manipulation.

### Three Flows to Production

1. **Chat-First**: Conversational refinement before generating anything
2. **Phase Bar**: Step-by-step guided workflow (Intent → Architecture → Spec → Code)
3. **SHIP**: One-shot "ship it" command for rapid prototyping

### Architecture as First-Class Citizen

- Architecture diagrams are **version controlled** (Mermaid text)
- Diagrams can be **exported** (SVG, PNG, PDF) for documentation
- **Live editing** of diagrams updates the spec
- **Diff view** shows architecture changes over time

## Consequences

### Positive

- **Transparency**: Users see what will be built before code is written
- **Iteration Speed**: Change architecture without regenerating all code
- **Better Communication**: Diagrams facilitate stakeholder discussions
- **Documentation**: Architecture always reflects current state
- **Flexibility**: Code generation is optional, not mandatory
- **Non-Technical Friendly**: Product managers can understand/edit architecture
- **Version Control**: Architecture changes are tracked in git

### Negative

- **Complexity**: More steps in workflow (could feel slower)
- **Learning Curve**: Users need to understand Architecture Mode vs Code Mode
- **Mermaid Limitations**: Not all architectures map well to Mermaid syntax
- **Maintenance**: Need to keep diagram ↔ spec ↔ code in sync
- **Performance**: Rendering large diagrams can be slow

### Neutral

- Need diagram editing UI (or rely on external tools)
- Architecture validation rules required
- Mermaid version compatibility considerations

## Alternatives Considered

### Alternative 1: Traditional Linear Code Generation

**Pros:**
- Simpler UX (one-step)
- Faster for experienced developers
- Less cognitive overhead

**Cons:**
- Black box experience
- No architecture visibility
- Hard to iterate
- No stakeholder communication aid

**Why not chosen:** User research showed need for transparency

### Alternative 2: Visual Drag-and-Drop Architecture Editor

**Pros:**
- More intuitive for non-technical users
- Rich visual editing
- No syntax learning required

**Cons:**
- Much harder to version control
- Difficult to diff changes
- Performance issues at scale
- Vendor lock-in to UI format

**Why not chosen:** Mermaid is text-based, git-friendly, and portable

### Alternative 3: UML/Enterprise Architecture Tools

**Pros:**
- Standardized notation
- Industry familiarity
- Powerful modeling

**Cons:**
- Too heavyweight for rapid prototyping
- Complex syntax
- Poor web rendering
- Not developer-friendly

**Why not chosen:** Mermaid is simpler and more developer-friendly

## Implementation Notes

### Mermaid Diagram Types Supported

- **Flowchart**: System architecture, data flow
- **Sequence Diagram**: API interactions, workflows
- **Class Diagram**: Data models, OOP structure
- **ER Diagram**: Database schema
- **Gantt**: Project timeline
- **User Journey**: UX flows

### Architecture → PRD Generation

```typescript
// Architecture analyzer
const components = extractComponentsFromMermaid(diagram);
const relationships = extractRelationships(diagram);

// PRD generator
const prd = generatePRD({
  components,
  relationships,
  userIntent: originalPrompt,
});
```

### PRD → Code Generation

```typescript
// G-Agent orchestrator
const agents = assignAgentsToComponents(prd);

for (const agent of agents) {
  await agent.generateCode(prd, dependencies);
}
```

### User Experience Flow

```
1. User: "Build a social media app"
2. G-Rump: [Shows Mermaid diagram with Frontend, Backend, Database, Auth]
3. User: "Add Redis cache between Backend and Database"
4. G-Rump: [Updates diagram, regenerates PRD]
5. User: "Looks good, generate code"
6. G-Rump: [Runs G-Agent to create files]
```

## References

- [Mermaid.js Documentation](https://mermaid.js.org/)
- [C4 Model for Architecture](https://c4model.com/)
- [User Research Report](https://docs.google.com/document/d/abc123)
- [Architecture Mode Spec](./docs/ARCHITECTURE_MODE.md)
- [Implementation PR](https://github.com/Aphrodine-wq/G-rump.com/pull/12)

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2025-06-01 | Initial draft | Product Team |
| 2025-06-10 | Added user research | UX Team |
| 2025-06-15 | Accepted | Architecture Team |
