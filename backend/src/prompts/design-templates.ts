/**
 * Design templates – reusable Mermaid/architecture patterns for Design mode.
 * Injected into the design prompt so the model can use these patterns when appropriate.
 */

export const DESIGN_TEMPLATES = `
**You may use these patterns when they fit (or combine them):**

**Auth flow (sequence):**
\`\`\`mermaid
sequenceDiagram
  participant U as User
  participant F as Frontend
  participant A as AuthAPI
  participant DB as DB
  U->>F: Login
  F->>A: POST /auth/login
  A->>DB: Validate
  DB-->>A: User
  A-->>F: Token
  F-->>U: Redirect
\`\`\`

**CRUD API (flowchart):**
\`\`\`mermaid
flowchart LR
  Client[Client] --> API[REST API]
  API --> Auth[Auth]
  API --> Service[Service Layer]
  Service --> Repo[Repository]
  Repo --> DB[(DB)]
\`\`\`

**Event-driven:**
\`\`\`mermaid
flowchart TB
  Producers[Producers] --> Queue[Message Queue]
  Queue --> Consumers[Consumers]
  Consumers --> Store[(Event Store)]
\`\`\`
`;

export function getDesignTemplatesBlock(): string {
  return DESIGN_TEMPLATES.trim();
}
