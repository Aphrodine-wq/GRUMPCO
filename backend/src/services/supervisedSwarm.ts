/**
 * Supervised Swarm Orchestrator
 *
 * Replaces the chaotic gossip protocol with a hierarchical command structure
 * where Kimi (the main AI) acts as the Supervisor that:
 *
 * 1. ASSIGNS tasks to specialist agents based on their roles
 * 2. REVIEWS all agent outputs before accepting them
 * 3. CAN REJECT bad work and request retries
 * 4. SYNTHESIZES the final answer with full visibility
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                     KIMI SUPERVISED SWARM                                   │
 * │                                                                             │
 * │                        ┌─────────────────┐                                  │
 * │                        │      KIMI       │                                  │
 * │                        │   SUPERVISOR    │                                  │
 * │                        │                 │                                  │
 * │                        │  - Assigns      │                                  │
 * │                        │  - Reviews      │                                  │
 * │                        │  - Approves     │                                  │
 * │                        │  - Synthesizes  │                                  │
 * │                        └────────┬────────┘                                  │
 * │                                 │                                           │
 * │              ┌──────────────────┼──────────────────┐                        │
 * │              │                  │                  │                        │
 * │              ▼                  ▼                  ▼                        │
 * │        ┌──────────┐      ┌──────────┐      ┌──────────┐                     │
 * │        │ ANALYST  │      │  CODER   │      │ REVIEWER │    ... more        │
 * │        │          │      │          │      │          │                     │
 * │        │ Reports  │      │ Reports  │      │ Reports  │                     │
 * │        │ to Kimi  │      │ to Kimi  │      │ to Kimi  │                     │
 * │        └──────────┘      └──────────┘      └──────────┘                     │
 * │                                                                             │
 * │   Workflow:                                                                 │
 * │   1. User query → Kimi decomposes into subtasks                            │
 * │   2. Kimi assigns subtasks to specialist agents                            │
 * │   3. Agents work and submit results to Kimi                                │
 * │   4. Kimi reviews each result: APPROVE / REJECT / REVISE                   │
 * │   5. Rejected work gets sent back with feedback                            │
 * │   6. Once all approved, Kimi synthesizes final response                    │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

import { EventEmitter } from "events";
import type { CompressedContext as _CompressedContext } from "./contextCompressor.js";

// Agent roles (same as before)
export type AgentRole =
  | "analyst" // Breaks down problems, identifies requirements
  | "researcher" // Gathers information, finds relevant context
  | "coder" // Writes and fixes code
  | "reviewer" // Reviews code and logic for issues
  | "synthesizer" // Combines multiple outputs into coherent whole
  | "validator" // Tests and validates solutions
  | "creative" // Generates alternative approaches
  | "optimizer"; // Improves performance and efficiency

export type AgentStatus =
  | "idle"
  | "assigned" // Has a task assigned
  | "working" // Actively processing
  | "submitted" // Submitted work for review
  | "approved" // Work approved by supervisor
  | "rejected" // Work rejected, needs revision
  | "completed";

// Review decision by Kimi
export type ReviewDecision = "approve" | "reject" | "revise";

/**
 * A subtask assigned by Kimi to a specialist agent
 */
export interface AgentSubtask {
  id: string;
  parentTaskId: string;
  agentId: string;
  role: AgentRole;
  instruction: string; // What Kimi wants the agent to do
  context?: string; // Relevant context for the subtask
  status: "pending" | "working" | "submitted" | "approved" | "rejected";
  attempts: number; // How many times agent has tried
  maxAttempts: number; // Max retries before escalation
  result?: AgentResult; // Agent's submitted work
  review?: SupervisorReview; // Kimi's review
  createdAt: number;
  updatedAt: number;
}

/**
 * Result submitted by an agent
 */
export interface AgentResult {
  content: string;
  confidence: number; // 0-1, how confident the agent is
  reasoning?: string; // Agent's reasoning/explanation
  artifacts?: {
    // Optional structured outputs
    type: "code" | "analysis" | "list" | "data";
    content: string;
    metadata?: Record<string, unknown>;
  }[];
  submittedAt: number;
}

/**
 * Kimi's review of an agent's work
 */
export interface SupervisorReview {
  decision: ReviewDecision;
  feedback: string; // Explanation for the agent
  score: number; // 0-1 quality score
  issues?: string[]; // Specific issues found
  suggestions?: string[]; // How to improve
  reviewedAt: number;
}

/**
 * Specialist agent in the swarm
 */
export interface SpecialistAgent {
  id: string;
  role: AgentRole;
  status: AgentStatus;
  currentTask?: string; // Current subtask ID
  stats: {
    tasksCompleted: number;
    tasksRejected: number;
    avgScore: number;
    totalAttempts: number;
  };
  createdAt: number;
  lastActiveAt: number;
}

/**
 * Main task submitted to the supervised swarm
 */
export interface SupervisedTask {
  id: string;
  query: string;
  context?: string;
  status:
    | "planning"
    | "executing"
    | "reviewing"
    | "synthesizing"
    | "completed"
    | "failed";

  // Kimi's task decomposition
  plan?: TaskPlan;

  // Subtasks assigned to agents
  subtasks: AgentSubtask[];

  // Final synthesized result
  synthesizedResult?: string;

  // Audit trail
  events: TaskEvent[];

  createdAt: number;
  completedAt?: number;
}

/**
 * Kimi's plan for how to tackle the task
 */
export interface TaskPlan {
  summary: string; // High-level approach
  subtasks: {
    role: AgentRole;
    instruction: string;
    priority: "high" | "medium" | "low";
    dependsOn?: string[]; // IDs of subtasks that must complete first
  }[];
  estimatedComplexity: "simple" | "moderate" | "complex";
  reasoning: string; // Why this plan
}

/**
 * Audit event for task history
 */
export interface TaskEvent {
  timestamp: number;
  type:
    | "plan_created"
    | "subtask_assigned"
    | "subtask_submitted"
    | "subtask_approved"
    | "subtask_rejected"
    | "synthesis_started"
    | "task_completed"
    | "task_failed"
    | "supervisor_intervention";
  actorId: string; // 'kimi' or agent ID
  details: string;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for the supervised swarm
 */
export interface SupervisedSwarmConfig {
  maxAgentsPerRole: number;
  maxRetries: number;
  reviewStrictness: "lenient" | "moderate" | "strict";
  autoApproveThreshold: number; // Confidence above this auto-approves (0-1)
  timeoutMs: number; // Max time for a subtask
}

const DEFAULT_CONFIG: SupervisedSwarmConfig = {
  maxAgentsPerRole: 2,
  maxRetries: 3,
  reviewStrictness: "moderate",
  autoApproveThreshold: 0.95, // Very high confidence can auto-approve
  timeoutMs: 30000,
};

/**
 * Kimi Supervised Swarm Orchestrator
 *
 * Unlike the gossip-based swarm, this is a hierarchical system where
 * Kimi maintains full oversight and control over all agents.
 */
export class SupervisedSwarmOrchestrator extends EventEmitter {
  private agents: Map<string, SpecialistAgent> = new Map();
  private tasks: Map<string, SupervisedTask> = new Map();
  private config: SupervisedSwarmConfig;

  // Simulation mode (in production, these would call actual LLMs)
  private simulationMode: boolean = true;

  constructor(config: Partial<SupervisedSwarmConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the swarm with specialist agents
   */
  initialize(agentsPerRole: number = 1): void {
    const roles: AgentRole[] = [
      "analyst",
      "researcher",
      "coder",
      "reviewer",
      "synthesizer",
      "validator",
      "creative",
      "optimizer",
    ];

    for (const role of roles) {
      for (
        let i = 0;
        i < Math.min(agentsPerRole, this.config.maxAgentsPerRole);
        i++
      ) {
        this.spawnAgent(role);
      }
    }

    this.emit("initialized", { agentCount: this.agents.size });
  }

  /**
   * Spawn a specialist agent
   */
  spawnAgent(role: AgentRole): SpecialistAgent {
    const id = `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

    const agent: SpecialistAgent = {
      id,
      role,
      status: "idle",
      stats: {
        tasksCompleted: 0,
        tasksRejected: 0,
        avgScore: 0,
        totalAttempts: 0,
      },
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    this.agents.set(id, agent);
    this.emit("agentSpawned", { agent });

    return agent;
  }

  /**
   * Submit a task to the supervised swarm
   *
   * Flow:
   * 1. Kimi analyzes the query and creates a plan
   * 2. Subtasks are assigned to specialist agents
   * 3. Agents work and submit results
   * 4. Kimi reviews each result
   * 5. Once all approved, Kimi synthesizes final answer
   */
  async submitTask(query: string, context?: string): Promise<SupervisedTask> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const task: SupervisedTask = {
      id: taskId,
      query,
      context,
      status: "planning",
      subtasks: [],
      events: [],
      createdAt: Date.now(),
    };

    this.tasks.set(taskId, task);
    this.addEvent(task, "plan_created", "kimi", "Task received, creating plan");
    this.emit("taskSubmitted", { task });

    // Step 1: Kimi creates a plan
    const plan = await this.kimiCreatePlan(query, context);
    task.plan = plan;
    task.status = "executing";
    this.addEvent(
      task,
      "plan_created",
      "kimi",
      `Plan created with ${plan.subtasks.length} subtasks`,
    );

    // Step 2: Assign subtasks to agents
    await this.assignSubtasks(task);

    // Step 3: Execute subtasks (in parallel where possible)
    await this.executeSubtasks(task);

    // Step 4: Review all results
    task.status = "reviewing";
    await this.reviewAllSubtasks(task);

    // Step 5: Synthesize final result
    task.status = "synthesizing";
    const finalResult = await this.kimiSynthesize(task);
    task.synthesizedResult = finalResult;
    task.status = "completed";
    task.completedAt = Date.now();

    this.addEvent(
      task,
      "task_completed",
      "kimi",
      "Task completed successfully",
    );
    this.emit("taskCompleted", { task });

    return task;
  }

  /**
   * Kimi creates a task plan by decomposing the query
   */
  private async kimiCreatePlan(
    query: string,
    _context?: string,
  ): Promise<TaskPlan> {
    // In production, this would call the actual Kimi/Claude model
    // For now, we use heuristics to create a reasonable plan

    const queryLower = query.toLowerCase();
    const subtasks: TaskPlan["subtasks"] = [];

    // Always start with analysis
    subtasks.push({
      role: "analyst",
      instruction: `Analyze the following request and identify key requirements, constraints, and potential challenges: "${query}"`,
      priority: "high",
    });

    // Add role-specific subtasks based on query content
    if (
      queryLower.includes("code") ||
      queryLower.includes("implement") ||
      queryLower.includes("function") ||
      queryLower.includes("fix")
    ) {
      subtasks.push({
        role: "coder",
        instruction: `Write or fix code to address: "${query}". Ensure code is clean, documented, and follows best practices.`,
        priority: "high",
        dependsOn: [subtasks[0].role + "_0"],
      });

      subtasks.push({
        role: "reviewer",
        instruction: `Review the code solution for bugs, security issues, and best practices violations.`,
        priority: "medium",
        dependsOn: ["coder_0"],
      });
    }

    if (
      queryLower.includes("research") ||
      queryLower.includes("find") ||
      queryLower.includes("information") ||
      queryLower.includes("learn")
    ) {
      subtasks.push({
        role: "researcher",
        instruction: `Research and gather relevant information about: "${query}". Cite sources where possible.`,
        priority: "high",
        dependsOn: [subtasks[0].role + "_0"],
      });
    }

    if (
      queryLower.includes("idea") ||
      queryLower.includes("alternative") ||
      queryLower.includes("creative") ||
      queryLower.includes("brainstorm")
    ) {
      subtasks.push({
        role: "creative",
        instruction: `Generate creative alternatives and novel approaches for: "${query}"`,
        priority: "medium",
        dependsOn: [subtasks[0].role + "_0"],
      });
    }

    if (
      queryLower.includes("optimize") ||
      queryLower.includes("improve") ||
      queryLower.includes("performance") ||
      queryLower.includes("faster")
    ) {
      subtasks.push({
        role: "optimizer",
        instruction: `Identify optimization opportunities and performance improvements for: "${query}"`,
        priority: "medium",
      });
    }

    if (
      queryLower.includes("test") ||
      queryLower.includes("verify") ||
      queryLower.includes("validate") ||
      queryLower.includes("check")
    ) {
      subtasks.push({
        role: "validator",
        instruction: `Create validation criteria and test cases for: "${query}"`,
        priority: "medium",
      });
    }

    // Always end with synthesis
    subtasks.push({
      role: "synthesizer",
      instruction: `Combine all agent outputs into a coherent, well-structured response to: "${query}"`,
      priority: "high",
      dependsOn: subtasks
        .slice(0, -1)
        .map((_, i) => `${subtasks[i].role}_${i}`),
    });

    // Determine complexity
    let complexity: TaskPlan["estimatedComplexity"] = "simple";
    if (subtasks.length > 4) complexity = "moderate";
    if (subtasks.length > 6 || queryLower.includes("complex"))
      complexity = "complex";

    return {
      summary: `Breaking down "${query.slice(0, 50)}..." into ${subtasks.length} specialized subtasks`,
      subtasks,
      estimatedComplexity: complexity,
      reasoning: `Based on query analysis, identified need for: ${subtasks.map((s) => s.role).join(", ")}`,
    };
  }

  /**
   * Assign subtasks to available specialist agents
   */
  private async assignSubtasks(task: SupervisedTask): Promise<void> {
    if (!task.plan) return;

    for (let i = 0; i < task.plan.subtasks.length; i++) {
      const planned = task.plan.subtasks[i];

      // Find an available agent with the required role
      const agent = this.findAvailableAgent(planned.role);

      if (!agent) {
        // Spawn a new agent if needed
        const newAgent = this.spawnAgent(planned.role);
        await this.assignToAgent(task, planned, newAgent, i);
      } else {
        await this.assignToAgent(task, planned, agent, i);
      }
    }
  }

  /**
   * Find an available agent with the specified role
   */
  private findAvailableAgent(role: AgentRole): SpecialistAgent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.role === role && agent.status === "idle") {
        return agent;
      }
    }
    return undefined;
  }

  /**
   * Assign a subtask to a specific agent
   */
  private async assignToAgent(
    task: SupervisedTask,
    planned: TaskPlan["subtasks"][0],
    agent: SpecialistAgent,
    index: number,
  ): Promise<void> {
    const subtaskId = `${task.id}_${planned.role}_${index}`;

    const subtask: AgentSubtask = {
      id: subtaskId,
      parentTaskId: task.id,
      agentId: agent.id,
      role: planned.role,
      instruction: planned.instruction,
      context: task.context,
      status: "pending",
      attempts: 0,
      maxAttempts: this.config.maxRetries,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    task.subtasks.push(subtask);
    agent.status = "assigned";
    agent.currentTask = subtaskId;
    agent.lastActiveAt = Date.now();

    this.addEvent(
      task,
      "subtask_assigned",
      "kimi",
      `Assigned subtask to ${agent.role} agent: ${planned.instruction.slice(0, 50)}...`,
      { subtaskId, agentId: agent.id },
    );
  }

  /**
   * Execute all subtasks (agents work on their assignments)
   */
  private async executeSubtasks(task: SupervisedTask): Promise<void> {
    // In real implementation, this would orchestrate actual LLM calls
    // For simulation, we process all subtasks with simulated agent responses

    const pendingSubtasks = task.subtasks.filter(
      (st) => st.status === "pending",
    );

    // Process subtasks (respecting dependencies in production)
    for (const subtask of pendingSubtasks) {
      await this.agentWork(subtask);
    }
  }

  /**
   * Simulate an agent working on its subtask
   */
  private async agentWork(subtask: AgentSubtask): Promise<void> {
    const agent = this.agents.get(subtask.agentId);
    if (!agent) return;

    agent.status = "working";
    subtask.status = "working";
    subtask.attempts++;
    subtask.updatedAt = Date.now();

    // Simulate work delay
    if (this.simulationMode) {
      await new Promise((resolve) =>
        setTimeout(resolve, 100 + Math.random() * 200),
      );
    }

    // Generate result based on role
    const result = this.generateAgentResult(subtask);
    subtask.result = result;
    subtask.status = "submitted";
    agent.status = "submitted";
    agent.stats.totalAttempts++;

    this.emit("subtaskSubmitted", { subtask, agent });
  }

  /**
   * Generate a simulated agent result based on role
   */
  private generateAgentResult(subtask: AgentSubtask): AgentResult {
    const baseConfidence = 0.7 + Math.random() * 0.25;

    let content = "";
    let reasoning = "";

    switch (subtask.role) {
      case "analyst":
        content =
          `**Analysis of Request**\n\n` +
          `Key Requirements:\n` +
          `- Primary goal: ${subtask.instruction.slice(0, 100)}\n` +
          `- Identified constraints: Standard best practices\n` +
          `- Potential challenges: Complexity management\n\n` +
          `Recommendation: Proceed with structured approach.`;
        reasoning = "Decomposed the request into actionable components.";
        break;

      case "coder":
        content =
          `**Code Solution**\n\n` +
          `\`\`\`typescript\n` +
          `// Implementation for: ${subtask.instruction.slice(0, 50)}\n` +
          `function solution() {\n` +
          `  // Core logic here\n` +
          `  return result;\n` +
          `}\n` +
          `\`\`\`\n\n` +
          `This implementation follows best practices and handles edge cases.`;
        reasoning =
          "Created clean, maintainable code with proper error handling.";
        break;

      case "reviewer":
        content =
          `**Code Review**\n\n` +
          `Findings:\n` +
          `- Code structure: Good\n` +
          `- Error handling: Adequate\n` +
          `- Performance: Acceptable\n` +
          `- Security: No obvious issues\n\n` +
          `Suggestions: Consider adding more comments.`;
        reasoning = "Performed thorough review checking for common issues.";
        break;

      case "researcher":
        content =
          `**Research Findings**\n\n` +
          `Relevant Information:\n` +
          `1. Key concept A: Important for the solution\n` +
          `2. Best practice B: Industry standard approach\n` +
          `3. Alternative C: Could be considered\n\n` +
          `Sources: Internal knowledge base, best practices documentation.`;
        reasoning = "Gathered relevant information from available sources.";
        break;

      case "creative":
        content =
          `**Creative Alternatives**\n\n` +
          `Option 1: Traditional approach - reliable but conventional\n` +
          `Option 2: Innovative approach - novel but requires validation\n` +
          `Option 3: Hybrid approach - combines best of both\n\n` +
          `Recommendation: Option 3 offers best balance.`;
        reasoning = "Explored multiple angles to find creative solutions.";
        break;

      case "optimizer":
        content =
          `**Optimization Opportunities**\n\n` +
          `Performance Improvements:\n` +
          `- Caching: Can reduce redundant computations\n` +
          `- Lazy loading: Defer non-critical operations\n` +
          `- Batching: Group related operations\n\n` +
          `Estimated improvement: 20-40% performance gain.`;
        reasoning = "Identified bottlenecks and proposed optimizations.";
        break;

      case "validator":
        content =
          `**Validation Report**\n\n` +
          `Test Cases:\n` +
          `- Happy path: PASS\n` +
          `- Edge cases: PASS\n` +
          `- Error handling: PASS\n\n` +
          `Overall: Solution meets requirements.`;
        reasoning = "Created comprehensive test suite covering key scenarios.";
        break;

      case "synthesizer":
        content =
          `**Synthesized Response**\n\n` +
          `Combining insights from all agents:\n\n` +
          `The analysis identified key requirements. ` +
          `The proposed solution addresses these effectively. ` +
          `Code review confirmed quality standards. ` +
          `Validation confirmed correctness.\n\n` +
          `Final recommendation: Proceed with implementation.`;
        reasoning = "Aggregated all agent outputs into coherent response.";
        break;

      default:
        content = `Processed: ${subtask.instruction}`;
        reasoning = "Standard processing completed.";
    }

    return {
      content,
      confidence: baseConfidence,
      reasoning,
      submittedAt: Date.now(),
    };
  }

  /**
   * Kimi reviews all submitted subtask results
   */
  private async reviewAllSubtasks(task: SupervisedTask): Promise<void> {
    for (const subtask of task.subtasks) {
      if (subtask.status === "submitted" && subtask.result) {
        const review = await this.kimiReview(subtask);
        subtask.review = review;

        const agent = this.agents.get(subtask.agentId);

        if (review.decision === "approve") {
          subtask.status = "approved";
          if (agent) {
            agent.status = "approved";
            agent.stats.tasksCompleted++;
            agent.stats.avgScore =
              (agent.stats.avgScore * (agent.stats.tasksCompleted - 1) +
                review.score) /
              agent.stats.tasksCompleted;
          }
          this.addEvent(
            task,
            "subtask_approved",
            "kimi",
            `Approved ${subtask.role}'s work (score: ${(review.score * 100).toFixed(0)}%)`,
            { subtaskId: subtask.id, score: review.score },
          );
        } else {
          subtask.status = "rejected";
          if (agent) {
            agent.status = "rejected";
            agent.stats.tasksRejected++;
          }
          this.addEvent(
            task,
            "subtask_rejected",
            "kimi",
            `Rejected ${subtask.role}'s work: ${review.feedback}`,
            { subtaskId: subtask.id, issues: review.issues },
          );

          // Retry if attempts remaining
          if (subtask.attempts < subtask.maxAttempts) {
            subtask.status = "pending";
            subtask.instruction = `REVISION NEEDED: ${review.feedback}\n\nOriginal task: ${subtask.instruction}`;
            if (agent) agent.status = "assigned";
            await this.agentWork(subtask);
            await this.kimiReview(subtask);
          }
        }
      }
    }
  }

  /**
   * Kimi reviews a single subtask result
   */
  private async kimiReview(subtask: AgentSubtask): Promise<SupervisorReview> {
    if (!subtask.result) {
      return {
        decision: "reject",
        feedback: "No result submitted",
        score: 0,
        issues: ["Missing result"],
        reviewedAt: Date.now(),
      };
    }

    // In production, this would be an actual LLM call to evaluate the result
    // For simulation, we use heuristics

    const result = subtask.result;
    let score = result.confidence;
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check content quality
    if (result.content.length < 50) {
      score -= 0.2;
      issues.push("Response too brief");
      suggestions.push("Provide more detailed explanation");
    }

    if (!result.content.includes("\n")) {
      score -= 0.1;
      issues.push("Poor formatting");
      suggestions.push("Use proper formatting with sections");
    }

    // Role-specific checks
    if (subtask.role === "coder" && !result.content.includes("```")) {
      score -= 0.15;
      issues.push("No code blocks found");
      suggestions.push("Include properly formatted code");
    }

    if (
      subtask.role === "reviewer" &&
      !result.content.toLowerCase().includes("finding")
    ) {
      score -= 0.1;
      issues.push("Review lacks specific findings");
      suggestions.push("List specific issues or confirmations");
    }

    // Apply strictness
    const thresholds = {
      lenient: 0.5,
      moderate: 0.65,
      strict: 0.8,
    };

    const threshold = thresholds[this.config.reviewStrictness];

    // Determine decision
    let decision: ReviewDecision;
    if (score >= this.config.autoApproveThreshold) {
      decision = "approve";
    } else if (score >= threshold) {
      decision = "approve";
    } else if (
      score >= threshold - 0.15 &&
      subtask.attempts < subtask.maxAttempts
    ) {
      decision = "revise";
    } else {
      decision = "reject";
    }

    // Generate feedback
    let feedback = "";
    if (decision === "approve") {
      feedback =
        `Good work! Score: ${(score * 100).toFixed(0)}%. ` +
        (suggestions.length > 0
          ? `Minor suggestions: ${suggestions.join("; ")}`
          : "No issues found.");
    } else if (decision === "revise") {
      feedback = `Needs improvement. Issues: ${issues.join("; ")}. Please revise and resubmit.`;
    } else {
      feedback = `Does not meet standards. Issues: ${issues.join("; ")}. ${suggestions.join("; ")}`;
    }

    return {
      decision,
      feedback,
      score: Math.max(0, Math.min(1, score)),
      issues: issues.length > 0 ? issues : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      reviewedAt: Date.now(),
    };
  }

  /**
   * Kimi synthesizes all approved results into final response
   */
  private async kimiSynthesize(task: SupervisedTask): Promise<string> {
    const approvedSubtasks = task.subtasks.filter(
      (st) => st.status === "approved",
    );

    if (approvedSubtasks.length === 0) {
      return "Unable to complete task: No subtasks were approved.";
    }

    const parts: string[] = [];
    parts.push(`# Response to: ${task.query.slice(0, 100)}`);
    parts.push("");
    parts.push("## Summary");
    parts.push(
      `Completed analysis with ${approvedSubtasks.length} specialist agents.`,
    );
    parts.push("");

    // Group by role
    const byRole = new Map<AgentRole, AgentSubtask[]>();
    for (const st of approvedSubtasks) {
      const existing = byRole.get(st.role) || [];
      existing.push(st);
      byRole.set(st.role, existing);
    }

    // Add each role's contribution
    for (const [role, subtasks] of byRole) {
      parts.push(`## ${role.charAt(0).toUpperCase() + role.slice(1)} Insights`);
      for (const st of subtasks) {
        if (st.result) {
          parts.push(st.result.content);
          parts.push("");
        }
      }
    }

    // Add quality metrics
    parts.push("## Quality Metrics");
    const avgScore =
      approvedSubtasks.reduce((sum, st) => sum + (st.review?.score || 0), 0) /
      approvedSubtasks.length;
    parts.push(`- Average quality score: ${(avgScore * 100).toFixed(1)}%`);
    parts.push(`- Agents involved: ${approvedSubtasks.length}`);
    parts.push(`- Complexity: ${task.plan?.estimatedComplexity || "unknown"}`);

    this.addEvent(
      task,
      "synthesis_started",
      "kimi",
      `Synthesized ${approvedSubtasks.length} approved results`,
    );

    return parts.join("\n");
  }

  /**
   * Add an event to the task audit trail
   */
  private addEvent(
    task: SupervisedTask,
    type: TaskEvent["type"],
    actorId: string,
    details: string,
    metadata?: Record<string, unknown>,
  ): void {
    task.events.push({
      timestamp: Date.now(),
      type,
      actorId,
      details,
      metadata,
    });
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): SupervisedTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get swarm statistics
   */
  getStats(): {
    totalAgents: number;
    agentsByRole: Record<AgentRole, number>;
    agentsByStatus: Record<AgentStatus, number>;
    pendingTasks: number;
    completedTasks: number;
    avgApprovalRate: number;
    avgQualityScore: number;
  } {
    const roleCount: Record<AgentRole, number> = {
      analyst: 0,
      researcher: 0,
      coder: 0,
      reviewer: 0,
      synthesizer: 0,
      validator: 0,
      creative: 0,
      optimizer: 0,
    };

    const statusCount: Record<AgentStatus, number> = {
      idle: 0,
      assigned: 0,
      working: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
    };

    let totalCompleted = 0;
    let totalRejected = 0;
    let totalScore = 0;
    let scoreCount = 0;

    for (const agent of this.agents.values()) {
      roleCount[agent.role]++;
      statusCount[agent.status]++;
      totalCompleted += agent.stats.tasksCompleted;
      totalRejected += agent.stats.tasksRejected;
      if (agent.stats.avgScore > 0) {
        totalScore += agent.stats.avgScore;
        scoreCount++;
      }
    }

    const tasks = Array.from(this.tasks.values());

    return {
      totalAgents: this.agents.size,
      agentsByRole: roleCount,
      agentsByStatus: statusCount,
      pendingTasks: tasks.filter(
        (t) => t.status !== "completed" && t.status !== "failed",
      ).length,
      completedTasks: tasks.filter((t) => t.status === "completed").length,
      avgApprovalRate:
        totalCompleted / Math.max(1, totalCompleted + totalRejected),
      avgQualityScore: scoreCount > 0 ? totalScore / scoreCount : 0,
    };
  }

  /**
   * Get visualization data
   */
  getVisualization(): {
    supervisor: { id: string; status: string };
    agents: {
      id: string;
      role: AgentRole;
      status: AgentStatus;
      currentTask?: string;
    }[];
    connections: { from: string; to: string; type: "command" | "report" }[];
  } {
    const agents = Array.from(this.agents.values()).map((a) => ({
      id: a.id,
      role: a.role,
      status: a.status,
      currentTask: a.currentTask,
    }));

    // All agents connect to Kimi (hub-and-spoke)
    const connections: {
      from: string;
      to: string;
      type: "command" | "report";
    }[] = agents.map((a) => ({
      from: "kimi_supervisor",
      to: a.id,
      type: "command" as const,
    }));

    // Add report connections (agents back to Kimi)
    for (const agent of agents) {
      if (agent.status === "submitted" || agent.status === "approved") {
        connections.push({
          from: agent.id,
          to: "kimi_supervisor",
          type: "report",
        });
      }
    }

    return {
      supervisor: { id: "kimi_supervisor", status: "active" },
      agents,
      connections,
    };
  }

  /**
   * Shutdown the swarm
   */
  shutdown(): void {
    this.agents.clear();
    this.tasks.clear();
    this.emit("shutdown");
  }
}

/**
 * Supervised Swarm Service singleton
 */
export class SupervisedSwarmService {
  private static instance: SupervisedSwarmService;
  private swarms: Map<string, SupervisedSwarmOrchestrator> = new Map();

  private constructor() {}

  static getInstance(): SupervisedSwarmService {
    if (!SupervisedSwarmService.instance) {
      SupervisedSwarmService.instance = new SupervisedSwarmService();
    }
    return SupervisedSwarmService.instance;
  }

  /**
   * Create or get a named supervised swarm
   */
  getSwarm(
    name: string,
    config?: Partial<SupervisedSwarmConfig>,
  ): SupervisedSwarmOrchestrator {
    let swarm = this.swarms.get(name);
    if (!swarm) {
      swarm = new SupervisedSwarmOrchestrator(config);
      swarm.initialize();
      this.swarms.set(name, swarm);
    }
    return swarm;
  }

  /**
   * List all swarms
   */
  listSwarms(): {
    name: string;
    stats: ReturnType<SupervisedSwarmOrchestrator["getStats"]>;
  }[] {
    return Array.from(this.swarms.entries()).map(([name, swarm]) => ({
      name,
      stats: swarm.getStats(),
    }));
  }

  /**
   * Delete a swarm
   */
  deleteSwarm(name: string): boolean {
    const swarm = this.swarms.get(name);
    if (swarm) {
      swarm.shutdown();
      return this.swarms.delete(name);
    }
    return false;
  }
}

export default SupervisedSwarmService;
