/**
 * Agent Registry
 *
 * Central registry for all agent definitions. Provides:
 * - Agent registration and discovery
 * - Capability-based agent selection
 * - Tier-based access control
 * - Dependency resolution
 */

import type { AgentDefinition, AgentType, AgentTier } from "./types.js";

// ============================================================================
// AGENT DEFINITIONS
// ============================================================================

const AGENT_DEFINITIONS: Record<AgentType, AgentDefinition> = {
  // Meta Agents
  supervisor: {
    id: "supervisor",
    type: "supervisor",
    name: "Supervisor",
    description: "Orchestrates other agents, manages spawning and coordination",
    capabilities: ["agent_spawn", "agent_monitor", "task_coordinate"],
    tools: ["agent_spawn", "agent_status", "agent_cancel", "broadcast"],
    systemPrompt: `You are the Supervisor agent. Your role is to:
1. Analyze incoming requests and determine which agents to spawn
2. Coordinate multi-agent workflows
3. Monitor agent health and handle failures
4. Synthesize results from multiple agents`,
    tier: "free",
    dependencies: [],
    maxConcurrency: 1,
    timeout: 300_000, // 5 minutes
  },

  planner: {
    id: "planner",
    type: "planner",
    name: "Planner",
    description: "Generates execution plans from goals",
    capabilities: ["task_decompose", "dependency_graph", "estimate"],
    tools: ["plan_create", "task_decompose", "task_validate", "pattern_match"],
    systemPrompt: `You are the Planner agent. Your role is to:
1. Decompose goals into actionable tasks
2. Identify dependencies between tasks
3. Estimate effort and duration
4. Match patterns from memory when applicable`,
    tier: "free",
    dependencies: [],
    maxConcurrency: 3,
    timeout: 60_000,
  },

  executor: {
    id: "executor",
    type: "executor",
    name: "Executor",
    description: "Executes individual tasks using available tools",
    capabilities: ["tool_execution", "file_ops", "bash"],
    tools: [
      "file_read",
      "file_write",
      "file_edit",
      "bash_execute",
      "codebase_search",
    ],
    systemPrompt: `You are the Executor agent. Your role is to:
1. Execute individual tasks using available tools
2. Report progress and results
3. Handle errors gracefully
4. Create checkpoints for resumability`,
    tier: "free",
    dependencies: [],
    maxConcurrency: 5,
    timeout: 120_000,
  },

  // Code Generation Specialists
  architect: {
    id: "architect",
    type: "architect",
    name: "Architect",
    description: "Designs system architecture and technical specifications",
    capabilities: ["architecture", "design", "documentation"],
    tools: ["file_read", "file_write", "codebase_search"],
    systemPrompt: `You are the Architecture agent. Your role is to:
1. Design system architecture based on requirements
2. Create technical specifications
3. Define component boundaries and interfaces
4. Produce Mermaid diagrams when helpful`,
    tier: "free",
    dependencies: [],
    maxConcurrency: 2,
    timeout: 180_000,
  },

  frontend: {
    id: "frontend",
    type: "frontend",
    name: "Frontend",
    description: "Generates frontend code, components, and UI logic",
    capabilities: ["frontend", "ui", "styling"],
    tools: [
      "file_read",
      "file_write",
      "file_edit",
      "bash_execute",
      "codebase_search",
    ],
    systemPrompt: `You are the Frontend agent. Your role is to:
1. Generate frontend components and pages
2. Implement UI logic and state management
3. Apply styling and responsive design
4. Follow project conventions

Accessibility (required): Use semantic HTML (nav, main, button, section, etc.); add ARIA attributes (aria-label, aria-describedby, role where needed) for custom widgets; ensure keyboard support and visible focus styles (:focus, :focus-visible); meet WCAG 2.1 contrast and touch targets.`,
    tier: "free",
    dependencies: ["architect"],
    maxConcurrency: 3,
    timeout: 180_000,
  },

  backend: {
    id: "backend",
    type: "backend",
    name: "Backend",
    description: "Generates backend code, APIs, and server logic",
    capabilities: ["backend", "api", "database"],
    tools: [
      "file_read",
      "file_write",
      "file_edit",
      "bash_execute",
      "codebase_search",
    ],
    systemPrompt: `You are the Backend agent. Your role is to:
1. Generate API endpoints and routes
2. Implement business logic and services
3. Design database schemas and queries
4. Handle authentication and authorization`,
    tier: "free",
    dependencies: ["architect"],
    maxConcurrency: 3,
    timeout: 180_000,
  },

  devops: {
    id: "devops",
    type: "devops",
    name: "DevOps",
    description:
      "Creates CI/CD pipelines, Docker configs, and deployment scripts",
    capabilities: ["devops", "ci", "deployment"],
    tools: [
      "file_read",
      "file_write",
      "bash_execute",
      "docker_ps",
      "docker_compose_up",
    ],
    systemPrompt: `You are the DevOps agent. Your role is to:
1. Create CI/CD pipeline configurations
2. Write Dockerfiles and compose files
3. Configure deployment scripts
4. Set up monitoring and logging`,
    tier: "free",
    dependencies: ["architect"],
    maxConcurrency: 2,
    timeout: 120_000,
  },

  test: {
    id: "test",
    type: "test",
    name: "Test",
    description: "Generates unit, integration, and E2E tests",
    capabilities: ["testing", "quality"],
    tools: [
      "file_read",
      "file_write",
      "file_edit",
      "bash_execute",
      "codebase_search",
    ],
    systemPrompt: `You are the Test agent. Your role is to:
1. Generate unit tests for components and services
2. Create integration tests for APIs
3. Write E2E tests for critical flows
4. Achieve good test coverage`,
    tier: "free",
    dependencies: ["frontend", "backend"],
    maxConcurrency: 3,
    timeout: 180_000,
  },

  docs: {
    id: "docs",
    type: "docs",
    name: "Documentation",
    description: "Creates documentation, READMEs, and API docs",
    capabilities: ["documentation"],
    tools: ["file_read", "file_write", "codebase_search"],
    systemPrompt: `You are the Documentation agent. Your role is to:
1. Write clear README files
2. Create API documentation
3. Document setup and usage instructions
4. Add inline code comments where helpful`,
    tier: "free",
    dependencies: ["frontend", "backend"],
    maxConcurrency: 2,
    timeout: 120_000,
  },

  security: {
    id: "security",
    type: "security",
    name: "Security",
    description: "Performs security reviews and implements hardening",
    capabilities: ["security", "audit"],
    tools: ["file_read", "file_edit", "codebase_search", "bash_execute"],
    systemPrompt: `You are the Security agent. Your role is to:
1. Review code for security vulnerabilities
2. Check for common security issues (OWASP Top 10)
3. Recommend security improvements
4. Implement security fixes when possible`,
    tier: "pro",
    dependencies: ["backend"],
    maxConcurrency: 2,
    timeout: 120_000,
  },

  i18n: {
    id: "i18n",
    type: "i18n",
    name: "Internationalization",
    description: "Handles internationalization and localization",
    capabilities: ["i18n", "localization"],
    tools: ["file_read", "file_write", "file_edit", "codebase_search"],
    systemPrompt: `You are the i18n agent. Your role is to:
1. Extract translatable strings
2. Set up i18n infrastructure
3. Create translation files
4. Implement locale switching`,
    tier: "pro",
    dependencies: ["frontend"],
    maxConcurrency: 2,
    timeout: 120_000,
  },

  // Swarm Specialists
  ux: {
    id: "ux",
    type: "ux",
    name: "UX",
    description: "Provides UX recommendations and improvements",
    capabilities: ["ux", "design"],
    tools: ["file_read", "codebase_search"],
    systemPrompt: `You are the UX agent. Your role is to:
1. Review user experience flows
2. Suggest usability improvements
3. Recommend accessibility enhancements
4. Provide design feedback`,
    tier: "free",
    dependencies: ["architect"],
    maxConcurrency: 2,
    timeout: 60_000,
  },

  perf: {
    id: "perf",
    type: "perf",
    name: "Performance",
    description: "Analyzes and optimizes performance",
    capabilities: ["performance", "optimization"],
    tools: ["file_read", "file_edit", "codebase_search", "bash_execute"],
    systemPrompt: `You are the Performance agent. Your role is to:
1. Identify performance bottlenecks
2. Suggest optimization strategies
3. Implement performance improvements
4. Recommend caching strategies`,
    tier: "pro",
    dependencies: ["frontend", "backend"],
    maxConcurrency: 2,
    timeout: 120_000,
  },

  a11y: {
    id: "a11y",
    type: "a11y",
    name: "Accessibility",
    description: "Ensures accessibility compliance",
    capabilities: ["accessibility", "a11y"],
    tools: ["file_read", "file_edit", "codebase_search"],
    systemPrompt: `You are the Accessibility agent. Your role is to:
1. Audit for WCAG compliance
2. Add ARIA labels and roles
3. Ensure keyboard navigation
4. Fix accessibility issues`,
    tier: "free",
    dependencies: ["frontend", "ux"],
    maxConcurrency: 2,
    timeout: 90_000,
  },

  data: {
    id: "data",
    type: "data",
    name: "Data",
    description: "Handles data modeling and migrations",
    capabilities: ["data", "database", "migrations"],
    tools: ["file_read", "file_write", "codebase_search", "db_schema"],
    systemPrompt: `You are the Data agent. Your role is to:
1. Design data models
2. Create database schemas
3. Write migration scripts
4. Optimize queries`,
    tier: "free",
    dependencies: ["architect"],
    maxConcurrency: 2,
    timeout: 120_000,
  },

  review: {
    id: "review",
    type: "review",
    name: "Review",
    description: "Performs code review and quality checks",
    capabilities: ["review", "quality"],
    tools: ["file_read", "codebase_search"],
    systemPrompt: `You are the Review agent. Your role is to:
1. Review generated code for quality
2. Check for best practices
3. Identify potential issues
4. Provide improvement suggestions`,
    tier: "free",
    dependencies: ["frontend", "backend", "test"],
    maxConcurrency: 2,
    timeout: 90_000,
  },
};

// ============================================================================
// AGENT REGISTRY CLASS
// ============================================================================

export class AgentRegistry {
  private agents: Map<string, AgentDefinition> = new Map();
  private static instance: AgentRegistry;

  private constructor() {
    // Register all built-in agents
    for (const [id, definition] of Object.entries(AGENT_DEFINITIONS)) {
      this.agents.set(id, definition);
    }
  }

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  /**
   * Register a new agent definition
   */
  register(definition: AgentDefinition): void {
    this.agents.set(definition.id, definition);
  }

  /**
   * Get an agent definition by ID
   */
  get(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  /**
   * Get an agent definition by type
   */
  getByType(type: AgentType): AgentDefinition | undefined {
    return Array.from(this.agents.values()).find((a) => a.type === type);
  }

  /**
   * Get all agent definitions
   */
  getAll(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  /**
   * Find agents by capability
   */
  findByCapability(capability: string): AgentDefinition[] {
    return Array.from(this.agents.values()).filter((a) =>
      a.capabilities.includes(capability),
    );
  }

  /**
   * Find agents by tool
   */
  findByTool(tool: string): AgentDefinition[] {
    return Array.from(this.agents.values()).filter((a) =>
      a.tools.includes(tool),
    );
  }

  /**
   * Get agents available for a given tier
   */
  getAvailableForTier(tier: AgentTier): AgentDefinition[] {
    const tierOrder: AgentTier[] = ["free", "pro", "team", "enterprise"];
    const tierIndex = tierOrder.indexOf(tier);

    return Array.from(this.agents.values()).filter((a) => {
      const agentTierIndex = tierOrder.indexOf(a.tier);
      return agentTierIndex <= tierIndex;
    });
  }

  /**
   * Check if an agent is available for a tier
   */
  isAvailable(agentId: string, tier: AgentTier): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    const tierOrder: AgentTier[] = ["free", "pro", "team", "enterprise"];
    const tierIndex = tierOrder.indexOf(tier);
    const agentTierIndex = tierOrder.indexOf(agent.tier);

    return agentTierIndex <= tierIndex;
  }

  /**
   * Resolve agent dependencies (topological sort)
   */
  resolveDependencies(agentTypes: AgentType[]): AgentType[] {
    const result: AgentType[] = [];
    const visited = new Set<AgentType>();
    const visiting = new Set<AgentType>();

    const visit = (type: AgentType): void => {
      if (visited.has(type)) return;
      if (visiting.has(type)) {
        throw new Error(`Circular dependency detected: ${type}`);
      }

      visiting.add(type);
      const agent = this.getByType(type);

      if (agent) {
        for (const dep of agent.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(type);
      visited.add(type);
      result.push(type);
    };

    for (const type of agentTypes) {
      visit(type);
    }

    return result;
  }

  /**
   * Get the execution order for a set of agents (respecting dependencies)
   */
  getExecutionOrder(agentTypes: AgentType[]): AgentType[][] {
    const resolved = this.resolveDependencies(agentTypes);
    const batches: AgentType[][] = [];
    const completed = new Set<AgentType>();

    while (completed.size < resolved.length) {
      const batch: AgentType[] = [];

      for (const type of resolved) {
        if (completed.has(type)) continue;

        const agent = this.getByType(type);
        if (!agent) continue;

        const depsComplete = agent.dependencies.every(
          (dep) => completed.has(dep) || !resolved.includes(dep),
        );

        if (depsComplete) {
          batch.push(type);
        }
      }

      if (batch.length === 0) {
        throw new Error("Unable to resolve execution order");
      }

      batches.push(batch);
      batch.forEach((t) => completed.add(t));
    }

    return batches;
  }

  /**
   * Select agents for a task based on intent
   */
  selectAgentsForTask(intent: string, tier: AgentTier): AgentType[] {
    const keywords = intent.toLowerCase();
    const selected: AgentType[] = [];
    const available = this.getAvailableForTier(tier);

    // Always include planner for complex tasks
    if (
      keywords.includes("plan") ||
      keywords.includes("build") ||
      keywords.includes("create")
    ) {
      selected.push("planner");
    }

    // Match by keywords
    const keywordMap: Record<string, AgentType[]> = {
      architecture: ["architect"],
      design: ["architect", "ux"],
      frontend: ["frontend"],
      ui: ["frontend", "ux"],
      component: ["frontend"],
      backend: ["backend"],
      api: ["backend"],
      server: ["backend"],
      database: ["data", "backend"],
      test: ["test"],
      testing: ["test"],
      docs: ["docs"],
      documentation: ["docs"],
      security: ["security"],
      deploy: ["devops"],
      docker: ["devops"],
      ci: ["devops"],
      performance: ["perf"],
      accessibility: ["a11y"],
      i18n: ["i18n"],
      translation: ["i18n"],
      review: ["review"],
    };

    for (const [keyword, agents] of Object.entries(keywordMap)) {
      if (keywords.includes(keyword)) {
        for (const agent of agents) {
          if (
            available.some((a) => a.type === agent) &&
            !selected.includes(agent)
          ) {
            selected.push(agent);
          }
        }
      }
    }

    // If nothing selected, use architect as default
    if (selected.length === 0) {
      selected.push("architect");
    }

    return selected;
  }
}

// Export singleton instance
export const agentRegistry = AgentRegistry.getInstance();
