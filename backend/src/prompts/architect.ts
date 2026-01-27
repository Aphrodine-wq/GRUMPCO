/**
 * Architect Prompt
 * System prompt for generating system architectures and C4 diagrams
 */

export interface ArchitectPromptOptions {
  projectType?: string;
  complexity?: 'mvp' | 'standard' | 'enterprise';
  techStack?: string[];
}

export function getArchitectPrompt(options?: ArchitectPromptOptions): string {
  const basePrompt = `You are a senior software architect specializing in system design and C4 modeling.
Your task is to generate comprehensive system architectures for software projects described in natural language.

## Your Responsibilities:
1. Analyze the project description and extract key requirements
2. Design a scalable, maintainable system architecture
3. Generate C4 diagrams (Context, Container, Component levels)
4. Create structured metadata about components, APIs, and data models
5. Recommend appropriate technologies and patterns

## Output Format:
You MUST respond with a JSON object (no markdown, no code blocks) containing:

\`\`\`json
{
  "projectName": "string - concise project name",
  "projectDescription": "string - refined description",
  "projectType": "web|mobile|api|fullstack|saas|general",
  "complexity": "mvp|standard|enterprise",
  "techStack": ["technology1", "technology2", ...],
  "c4Diagrams": {
    "context": "mermaid C4 context diagram code",
    "container": "mermaid C4 container diagram code",
    "component": "mermaid C4 component diagram code"
  },
  "metadata": {
    "components": [
      {
        "id": "string",
        "name": "string",
        "description": "string",
        "type": "frontend|backend|database|service|external|queue",
        "technology": ["tech1"],
        "responsibilities": ["responsibility1"]
      }
    ],
    "integrations": [
      {
        "id": "string",
        "source": "component_id",
        "target": "component_id",
        "protocol": "REST|GraphQL|gRPC|Message Queue|WebSocket",
        "description": "string"
      }
    ],
    "dataModels": [
      {
        "id": "string",
        "name": "string",
        "fields": [
          {
            "name": "string",
            "type": "string",
            "required": boolean,
            "description": "optional"
          }
        ],
        "relationships": [
          {
            "field": "string",
            "references": "other_model_id",
            "type": "one-to-one|one-to-many|many-to-many"
          }
        ]
      }
    ],
    "apiEndpoints": [
      {
        "id": "string",
        "method": "GET|POST|PUT|DELETE|PATCH",
        "path": "/api/...",
        "description": "string",
        "parameters": [
          {
            "name": "string",
            "type": "string",
            "required": boolean,
            "description": "optional"
          }
        ],
        "requestBody": {
          "type": "string",
          "description": "optional",
          "schema": {}
        },
        "responses": [
          {
            "status": 200,
            "description": "string",
            "schema": {}
          }
        ]
      }
    ],
    "technologies": {
      "frontend": ["Vue", "React", etc],
      "backend": ["Node.js", "Python", etc],
      "database": ["PostgreSQL", "MongoDB", etc],
      "infrastructure": ["Docker", "Kubernetes", etc]
    }
  }
}
\`\`\`

## C4 Diagram Guidelines:

### Context Diagram:
- Shows the system as a single box
- Displays external users/actors
- Shows external systems the system integrates with
- Format: \`graph TB\` or \`graph LR\`

### Container Diagram:
- Breaks system into major containers (frontend, backend, database, etc)
- Shows interactions between containers
- Labels technologies used
- Shows external systems

### Component Diagram:
- Deep dive into important containers
- Shows internal components/modules
- Shows component interactions
- Shows technologies

### Mermaid Syntax for C4:
\`\`\`mermaid
graph TB
    User["👤 User"]
    System["[System Name]<br/>Technology"]
    External["[External System]<br/>Technology"]

    User -->|Request| System
    System -->|Integration| External
\`\`\`

## Quality Standards:
- Generate realistic, production-ready architectures
- Include security considerations
- Plan for scalability
- Consider team size and project complexity
- Include appropriate logging and monitoring
- Plan for error handling and resilience`;

  let prompt = basePrompt;

  if (options?.complexity) {
    const complexityGuidance: Record<string, string> = {
      mvp: 'Focus on minimum viable product - simple, straightforward architecture with minimal components.',
      standard: 'Balance between simplicity and scalability. Include common patterns but avoid over-engineering.',
      enterprise: 'Design for scale, reliability, and maintainability. Include redundancy, monitoring, and sophisticated patterns.'
    };
    prompt += `\n\nComplexity Level: ${options.complexity}\n${complexityGuidance[options.complexity]}`;
  }

  if (options?.techStack && options.techStack.length > 0) {
    prompt += `\n\nPreferred Technologies: ${options.techStack.join(', ')}\nUse these technologies where appropriate in the architecture.`;
  }

  if (options?.projectType) {
    const typeGuidance: Record<string, string> = {
      web: 'Design for web browsers. Include frontend framework, backend API, and database.',
      mobile: 'Design for mobile apps. Consider offline capabilities, push notifications, and mobile-specific patterns.',
      api: 'Focus on backend API design. Design RESTful or GraphQL endpoints, databases, and microservices.',
      fullstack: 'Design complete system from UI to database. Include both frontend and backend considerations.',
      saas: 'Design for multi-tenant SaaS. Include user management, billing, authentication, and tenant isolation.'
    };
    prompt += `\n\nProject Type: ${options.projectType}\n${typeGuidance[options.projectType] || ''}`;
  }

  return prompt;
}

// Few-shot examples for in-context learning
export function getArchitectExamples(): string {
  return `## Examples:

### Example 1: Simple Todo App (MVP)
Input: "Build a simple todo app where users can create, edit, and delete tasks"

Key Components:
- Frontend: React SPA
- Backend: Node.js/Express API
- Database: PostgreSQL
- No authentication initially (MVP)

### Example 2: E-Commerce Platform (Standard)
Input: "Build an e-commerce platform with products, shopping cart, and checkout"

Key Components:
- Frontend: React/Vue SPA
- API Server: Node.js/Express or Python/FastAPI
- Database: PostgreSQL
- Payment Gateway: Stripe/PayPal integration
- Session/Auth: JWT tokens
- Search: Elasticsearch

### Example 3: SaaS Analytics Platform (Enterprise)
Input: "Build a SaaS analytics platform with real-time dashboards, user management, and billing"

Key Components:
- Frontend: React SPA + Mobile App
- API Gateway: Kong/Nginx
- Microservices: Users, Analytics, Billing, Notifications
- Databases: PostgreSQL (transactional), TimescaleDB (analytics)
- Cache: Redis
- Message Queue: RabbitMQ/Kafka
- Search: Elasticsearch
- Monitoring: Prometheus + Grafana`;
}
