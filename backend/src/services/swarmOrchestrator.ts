/**
 * Swarm Orchestrator Service
 *
 * Implements a distributed micro-agent architecture with gossip protocol
 * for emergent intelligence. Think of it as "ant colony optimization" for
 * LLM reasoning.
 *
 * Key concepts:
 * 1. Micro-agents: Small, specialized agents that handle specific sub-tasks
 * 2. Gossip protocol: Agents share discoveries with neighbors, information propagates
 * 3. Stigmergy: Agents leave "pheromone trails" (weighted edges) that guide future agents
 * 4. Meta-synthesizer: Aggregates swarm insights into coherent response
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                           SWARM TOPOLOGY                                │
 * │                                                                         │
 * │     ┌─────┐         ┌─────┐         ┌─────┐                            │
 * │     │Agent│◄───────►│Agent│◄───────►│Agent│                            │
 * │     │  A  │         │  B  │         │  C  │                            │
 * │     └──┬──┘         └──┬──┘         └──┬──┘                            │
 * │        │               │               │                               │
 * │        ▼               ▼               ▼                               │
 * │     ┌─────┐         ┌─────┐         ┌─────┐                            │
 * │     │Agent│◄───────►│Agent│◄───────►│Agent│                            │
 * │     │  D  │         │  E  │         │  F  │                            │
 * │     └─────┘         └─────┘         └─────┘                            │
 * │                         │                                               │
 * │                         ▼                                               │
 * │                   ┌──────────┐                                          │
 * │                   │   META   │                                          │
 * │                   │SYNTHESIZER│                                         │
 * │                   └──────────┘                                          │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { EventEmitter } from "events";
import type { HRRVector as _HRRVector } from "./holographicMemory.js";
import {
  ContextCompressor,
  type CompressedContext,
} from "./contextCompressor.js";

// Agent types
export type AgentRole =
  | "analyst" // Breaks down problems
  | "researcher" // Gathers information
  | "coder" // Writes code
  | "reviewer" // Reviews and critiques
  | "synthesizer" // Combines insights
  | "validator" // Checks correctness
  | "creative" // Generates alternatives
  | "optimizer"; // Improves solutions

export type AgentStatus =
  | "idle"
  | "thinking"
  | "working"
  | "waiting"
  | "completed"
  | "failed";

/**
 * Message passed between agents via gossip protocol
 */
export interface GossipMessage {
  id: string;
  fromAgentId: string;
  timestamp: number;
  type: "discovery" | "question" | "answer" | "alert" | "pheromone";
  payload: {
    content: string;
    confidence: number;
    relevance: number;
    tags: string[];
    context?: CompressedContext;
  };
  ttl: number; // Time-to-live (hops remaining)
  hopPath: string[]; // Track propagation path
}

/**
 * Pheromone trail - weighted edge in the swarm graph
 */
export interface PheromoneTrail {
  fromAgentId: string;
  toAgentId: string;
  strength: number;
  lastUpdate: number;
  associatedTask: string;
}

/**
 * Individual micro-agent in the swarm
 */
export interface SwarmAgent {
  id: string;
  role: AgentRole;
  status: AgentStatus;
  neighbors: string[]; // Connected agent IDs
  inbox: GossipMessage[];
  outbox: GossipMessage[];
  discoveries: GossipMessage[];
  workingMemory: Map<string, unknown>;
  stats: {
    messagesReceived: number;
    messagesSent: number;
    tasksCompleted: number;
    avgConfidence: number;
  };
  createdAt: number;
  lastActiveAt: number;
}

/**
 * Task submitted to the swarm
 */
export interface SwarmTask {
  id: string;
  query: string;
  context?: string;
  status: "pending" | "processing" | "completed" | "failed";
  assignedAgents: string[];
  results: GossipMessage[];
  synthesizedResult?: string;
  createdAt: number;
  completedAt?: number;
}

/**
 * Swarm configuration
 */
export interface SwarmConfig {
  minAgents: number;
  maxAgents: number;
  gossipInterval: number; // ms between gossip rounds
  pheromoneDecay: number; // decay rate per tick
  messageTTL: number; // default message hops
  convergenceThreshold: number; // when to stop
}

const DEFAULT_CONFIG: SwarmConfig = {
  minAgents: 3,
  maxAgents: 12,
  gossipInterval: 100,
  pheromoneDecay: 0.95,
  messageTTL: 5,
  convergenceThreshold: 0.85,
};

/**
 * Swarm Orchestrator - manages the distributed agent network
 */
export class SwarmOrchestrator extends EventEmitter {
  private agents: Map<string, SwarmAgent> = new Map();
  private pheromones: PheromoneTrail[] = [];
  private tasks: Map<string, SwarmTask> = new Map();
  private config: SwarmConfig;
  private gossipTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private contextCompressor: ContextCompressor;

  constructor(config: Partial<SwarmConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.contextCompressor = new ContextCompressor({ dimension: 2048 });
  }

  /**
   * Initialize the swarm with agents
   */
  initialize(agentCount?: number): void {
    const count = agentCount || this.config.minAgents;

    // Create diverse agent pool
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

    for (let i = 0; i < count; i++) {
      const role = roles[i % roles.length];
      this.spawnAgent(role);
    }

    // Create small-world network topology
    this.buildTopology();

    this.emit("initialized", { agentCount: this.agents.size });
  }

  /**
   * Spawn a new agent
   */
  spawnAgent(role: AgentRole): SwarmAgent {
    const id = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const agent: SwarmAgent = {
      id,
      role,
      status: "idle",
      neighbors: [],
      inbox: [],
      outbox: [],
      discoveries: [],
      workingMemory: new Map(),
      stats: {
        messagesReceived: 0,
        messagesSent: 0,
        tasksCompleted: 0,
        avgConfidence: 0,
      },
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    this.agents.set(id, agent);
    this.emit("agentSpawned", { agent });

    // Re-wire topology if swarm is already running
    if (this.agents.size > 1) {
      this.connectToNeighbors(id);
    }

    return agent;
  }

  /**
   * Build small-world network topology (Watts-Strogatz)
   */
  private buildTopology(): void {
    const agentIds = Array.from(this.agents.keys());
    const n = agentIds.length;
    const k = Math.min(4, Math.floor(n / 2)); // Each node connects to k nearest neighbors

    // Create ring lattice
    for (let i = 0; i < n; i++) {
      const agent = this.agents.get(agentIds[i]);
      if (!agent) continue;
      for (let j = 1; j <= k / 2; j++) {
        const leftNeighbor = agentIds[(i - j + n) % n];
        const rightNeighbor = agentIds[(i + j) % n];
        if (!agent.neighbors.includes(leftNeighbor)) {
          agent.neighbors.push(leftNeighbor);
        }
        if (!agent.neighbors.includes(rightNeighbor)) {
          agent.neighbors.push(rightNeighbor);
        }
      }
    }

    // Rewire with probability p = 0.3 for small-world effect
    const p = 0.3;
    for (const agent of this.agents.values()) {
      for (let i = 0; i < agent.neighbors.length; i++) {
        if (Math.random() < p) {
          // Rewire to random non-neighbor
          const candidates = agentIds.filter(
            (id) => id !== agent.id && !agent.neighbors.includes(id),
          );
          if (candidates.length > 0) {
            const newNeighbor =
              candidates[Math.floor(Math.random() * candidates.length)];
            agent.neighbors[i] = newNeighbor;
          }
        }
      }
    }
  }

  /**
   * Connect a new agent to existing neighbors
   */
  private connectToNeighbors(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const agentIds = Array.from(this.agents.keys()).filter(
      (id) => id !== agentId,
    );
    const numNeighbors = Math.min(3, agentIds.length);

    // Connect to random subset
    const shuffled = agentIds.sort(() => Math.random() - 0.5);
    agent.neighbors = shuffled.slice(0, numNeighbors);

    // Make connections bidirectional
    for (const neighborId of agent.neighbors) {
      const neighbor = this.agents.get(neighborId);
      if (neighbor && !neighbor.neighbors.includes(agentId)) {
        neighbor.neighbors.push(agentId);
      }
    }
  }

  /**
   * Submit a task to the swarm
   */
  async submitTask(query: string, context?: string): Promise<SwarmTask> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const task: SwarmTask = {
      id: taskId,
      query,
      context,
      status: "pending",
      assignedAgents: [],
      results: [],
      createdAt: Date.now(),
    };

    this.tasks.set(taskId, task);

    // Compress context if provided
    let compressedContext: CompressedContext | undefined;
    if (context) {
      compressedContext = this.contextCompressor.compress(context, taskId);
    }

    // Assign initial agents based on query analysis
    const initialAgents = this.selectAgentsForTask(query);
    task.assignedAgents = initialAgents.map((a) => a.id);

    // Create initial gossip messages
    for (const agent of initialAgents) {
      const message = this.createGossipMessage(
        "system",
        "discovery",
        query,
        1.0,
        ["task", "initial"],
        compressedContext,
      );
      agent.inbox.push(message);
    }

    task.status = "processing";
    this.emit("taskSubmitted", { task });

    // Start gossip if not already running
    if (!this.isRunning) {
      this.startGossip();
    }

    return task;
  }

  /**
   * Select initial agents for a task based on query content
   */
  private selectAgentsForTask(query: string): SwarmAgent[] {
    const queryLower = query.toLowerCase();
    const selected: SwarmAgent[] = [];

    // Always include analyst for task breakdown
    const analyst = this.findAgentByRole("analyst");
    if (analyst) selected.push(analyst);

    // Role-based selection
    if (
      queryLower.includes("code") ||
      queryLower.includes("implement") ||
      queryLower.includes("function")
    ) {
      const coder = this.findAgentByRole("coder");
      if (coder) selected.push(coder);
    }

    if (
      queryLower.includes("review") ||
      queryLower.includes("check") ||
      queryLower.includes("bug")
    ) {
      const reviewer = this.findAgentByRole("reviewer");
      if (reviewer) selected.push(reviewer);
    }

    if (
      queryLower.includes("research") ||
      queryLower.includes("find") ||
      queryLower.includes("search")
    ) {
      const researcher = this.findAgentByRole("researcher");
      if (researcher) selected.push(researcher);
    }

    if (
      queryLower.includes("idea") ||
      queryLower.includes("alternative") ||
      queryLower.includes("creative")
    ) {
      const creative = this.findAgentByRole("creative");
      if (creative) selected.push(creative);
    }

    // Always include synthesizer for final aggregation
    const synthesizer = this.findAgentByRole("synthesizer");
    if (synthesizer && !selected.includes(synthesizer)) {
      selected.push(synthesizer);
    }

    // Ensure minimum agents
    if (selected.length < 2) {
      for (const agent of this.agents.values()) {
        if (!selected.includes(agent)) {
          selected.push(agent);
          if (selected.length >= 3) break;
        }
      }
    }

    return selected;
  }

  private findAgentByRole(role: AgentRole): SwarmAgent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.role === role && agent.status === "idle") {
        return agent;
      }
    }
    // Fallback to any agent with the role
    for (const agent of this.agents.values()) {
      if (agent.role === role) {
        return agent;
      }
    }
    return undefined;
  }

  /**
   * Start the gossip protocol loop
   */
  startGossip(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.gossipTimer = setInterval(
      () => this.gossipRound(),
      this.config.gossipInterval,
    );
    this.emit("gossipStarted");
  }

  /**
   * Stop the gossip protocol
   */
  stopGossip(): void {
    if (this.gossipTimer) {
      clearInterval(this.gossipTimer);
      this.gossipTimer = null;
    }
    this.isRunning = false;
    this.emit("gossipStopped");
  }

  /**
   * Execute one round of gossip protocol
   */
  private gossipRound(): void {
    // 1. Process inboxes for all agents
    for (const agent of this.agents.values()) {
      this.processAgentInbox(agent);
    }

    // 2. Each agent generates responses/discoveries
    for (const agent of this.agents.values()) {
      this.agentThink(agent);
    }

    // 3. Propagate outbox messages to neighbors
    for (const agent of this.agents.values()) {
      this.propagateMessages(agent);
    }

    // 4. Decay pheromones
    this.decayPheromones();

    // 5. Check for convergence on active tasks
    this.checkConvergence();

    this.emit("gossipRound", {
      activeAgents: Array.from(this.agents.values()).filter(
        (a) => a.status !== "idle",
      ).length,
      totalMessages: this.countActiveMessages(),
    });
  }

  private processAgentInbox(agent: SwarmAgent): void {
    if (agent.inbox.length === 0) return;

    agent.status = "thinking";
    agent.lastActiveAt = Date.now();

    for (const message of agent.inbox) {
      agent.stats.messagesReceived++;

      // Store high-value discoveries
      if (message.payload.confidence > 0.7) {
        agent.discoveries.push(message);
      }

      // Update pheromone trails
      if (message.type === "discovery" || message.type === "answer") {
        this.updatePheromone(
          message.fromAgentId,
          agent.id,
          message.payload.confidence,
        );
      }
    }

    // Clear inbox
    agent.inbox = [];
  }

  private agentThink(agent: SwarmAgent): void {
    if (agent.status !== "thinking") return;

    // Simulate agent processing (in real impl, this would call LLM)
    const discoveries = agent.discoveries;
    if (discoveries.length === 0) {
      agent.status = "idle";
      return;
    }

    agent.status = "working";

    // Aggregate discoveries based on role
    const aggregated = this.aggregateByRole(agent, discoveries);

    if (aggregated) {
      agent.outbox.push(aggregated);
      agent.stats.messagesSent++;
    }

    agent.status = "idle";
  }

  private aggregateByRole(
    agent: SwarmAgent,
    discoveries: GossipMessage[],
  ): GossipMessage | null {
    if (discoveries.length === 0) return null;

    // Calculate average confidence
    const avgConfidence =
      discoveries.reduce((sum, d) => sum + d.payload.confidence, 0) /
      discoveries.length;

    // Combine content based on role
    let combinedContent = "";
    const newTags: string[] = [agent.role];

    switch (agent.role) {
      case "analyst":
        combinedContent = `[Analysis] Breaking down: ${discoveries.map((d) => d.payload.content).join(" | ")}`;
        newTags.push("analysis", "breakdown");
        break;
      case "synthesizer":
        combinedContent = `[Synthesis] Combining insights: ${discoveries.map((d) => d.payload.content.slice(0, 100)).join(" + ")}`;
        newTags.push("synthesis", "aggregation");
        break;
      case "coder":
        combinedContent = `[Code] Implementation consideration: ${discoveries.map((d) => d.payload.content.slice(0, 100)).join("; ")}`;
        newTags.push("code", "implementation");
        break;
      case "reviewer":
        combinedContent = `[Review] Quality check: ${discoveries.map((d) => d.payload.content.slice(0, 100)).join("; ")}`;
        newTags.push("review", "quality");
        break;
      case "creative":
        combinedContent = `[Creative] Alternative approaches: ${discoveries.map((d) => d.payload.content.slice(0, 100)).join("; ")}`;
        newTags.push("creative", "alternatives");
        break;
      default:
        combinedContent = discoveries.map((d) => d.payload.content).join(" ");
    }

    return this.createGossipMessage(
      agent.id,
      "discovery",
      combinedContent,
      Math.min(avgConfidence * 1.05, 1.0), // Slight confidence boost for aggregation
      newTags,
    );
  }

  private propagateMessages(agent: SwarmAgent): void {
    for (const message of agent.outbox) {
      if (message.ttl <= 0) continue;

      // Add to hop path
      message.hopPath.push(agent.id);
      message.ttl--;

      // Send to neighbors not already in hop path
      for (const neighborId of agent.neighbors) {
        if (message.hopPath.includes(neighborId)) continue;

        const neighbor = this.agents.get(neighborId);
        if (neighbor) {
          // Clone message for neighbor
          const clonedMessage = { ...message, hopPath: [...message.hopPath] };
          neighbor.inbox.push(clonedMessage);
        }
      }
    }

    // Clear outbox
    agent.outbox = [];
  }

  private updatePheromone(
    fromId: string,
    toId: string,
    strength: number,
  ): void {
    // Find existing trail
    const trail = this.pheromones.find(
      (p) => p.fromAgentId === fromId && p.toAgentId === toId,
    );

    if (trail) {
      // Reinforce existing trail
      trail.strength = Math.min(trail.strength + strength * 0.2, 1.0);
      trail.lastUpdate = Date.now();
    } else {
      // Create new trail
      this.pheromones.push({
        fromAgentId: fromId,
        toAgentId: toId,
        strength: strength * 0.5,
        lastUpdate: Date.now(),
        associatedTask: "",
      });
    }
  }

  private decayPheromones(): void {
    for (const trail of this.pheromones) {
      trail.strength *= this.config.pheromoneDecay;
    }

    // Remove very weak trails
    this.pheromones = this.pheromones.filter((t) => t.strength > 0.01);
  }

  private checkConvergence(): void {
    for (const task of this.tasks.values()) {
      if (task.status !== "processing") continue;

      // Collect all discoveries from assigned agents
      const allDiscoveries: GossipMessage[] = [];
      for (const agentId of task.assignedAgents) {
        const agent = this.agents.get(agentId);
        if (agent) {
          allDiscoveries.push(...agent.discoveries);
        }
      }

      // Check if we have enough high-confidence discoveries
      const highConfidence = allDiscoveries.filter(
        (d) => d.payload.confidence > 0.7,
      );

      if (highConfidence.length >= 3) {
        // Attempt synthesis
        const synthesized = this.synthesizeResults(task, allDiscoveries);
        if (synthesized) {
          task.results = allDiscoveries;
          task.synthesizedResult = synthesized;
          task.status = "completed";
          task.completedAt = Date.now();

          this.emit("taskCompleted", { task });

          // Mark agents as completed
          for (const agentId of task.assignedAgents) {
            const agent = this.agents.get(agentId);
            if (agent) {
              agent.stats.tasksCompleted++;
              agent.discoveries = []; // Clear for next task
            }
          }
        }
      }
    }
  }

  private synthesizeResults(
    task: SwarmTask,
    discoveries: GossipMessage[],
  ): string {
    // Sort by confidence
    const sorted = discoveries.sort(
      (a, b) => b.payload.confidence - a.payload.confidence,
    );

    // Take top discoveries
    const top = sorted.slice(0, 5);

    // Build synthesized response
    const parts: string[] = [];
    parts.push(`# Swarm Analysis: ${task.query.slice(0, 50)}...`);
    parts.push("");
    parts.push("## Key Insights");

    for (const discovery of top) {
      const roleTag =
        discovery.payload.tags.find((t) =>
          [
            "analyst",
            "coder",
            "reviewer",
            "synthesizer",
            "creative",
            "researcher",
            "validator",
            "optimizer",
          ].includes(t),
        ) || "agent";
      parts.push(
        `- **[${roleTag}]** ${discovery.payload.content.slice(0, 200)}`,
      );
    }

    parts.push("");
    parts.push("## Confidence");
    const avgConfidence =
      top.reduce((sum, d) => sum + d.payload.confidence, 0) / top.length;
    parts.push(`Overall confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    parts.push(
      `Contributing agents: ${new Set(discoveries.map((d) => d.fromAgentId)).size}`,
    );

    return parts.join("\n");
  }

  private createGossipMessage(
    fromAgentId: string,
    type: GossipMessage["type"],
    content: string,
    confidence: number,
    tags: string[],
    context?: CompressedContext,
  ): GossipMessage {
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fromAgentId,
      timestamp: Date.now(),
      type,
      payload: {
        content,
        confidence,
        relevance: 1.0,
        tags,
        context,
      },
      ttl: this.config.messageTTL,
      hopPath: [],
    };
  }

  private countActiveMessages(): number {
    let count = 0;
    for (const agent of this.agents.values()) {
      count += agent.inbox.length + agent.outbox.length;
    }
    return count;
  }

  /**
   * Inject a discovery directly into the swarm
   */
  injectDiscovery(
    content: string,
    confidence: number = 0.8,
    tags: string[] = [],
  ): void {
    const message = this.createGossipMessage(
      "external",
      "discovery",
      content,
      confidence,
      ["external", ...tags],
    );

    // Inject into random subset of agents
    const agents = Array.from(this.agents.values());
    const targetCount = Math.ceil(agents.length / 3);
    const shuffled = agents.sort(() => Math.random() - 0.5);

    for (let i = 0; i < targetCount; i++) {
      shuffled[i].inbox.push({ ...message });
    }
  }

  /**
   * Get task status
   */
  getTask(taskId: string): SwarmTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get swarm statistics
   */
  getStats(): {
    totalAgents: number;
    activeAgents: number;
    agentsByRole: Record<AgentRole, number>;
    totalMessages: number;
    pheromoneTrails: number;
    avgPheromoneStrength: number;
    pendingTasks: number;
    completedTasks: number;
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

    let activeCount = 0;
    let totalMessages = 0;

    for (const agent of this.agents.values()) {
      roleCount[agent.role]++;
      if (agent.status !== "idle") activeCount++;
      totalMessages += agent.stats.messagesReceived + agent.stats.messagesSent;
    }

    const avgPheromone =
      this.pheromones.length > 0
        ? this.pheromones.reduce((sum, p) => sum + p.strength, 0) /
          this.pheromones.length
        : 0;

    const tasks = Array.from(this.tasks.values());

    return {
      totalAgents: this.agents.size,
      activeAgents: activeCount,
      agentsByRole: roleCount,
      totalMessages,
      pheromoneTrails: this.pheromones.length,
      avgPheromoneStrength: avgPheromone,
      pendingTasks: tasks.filter(
        (t) => t.status === "pending" || t.status === "processing",
      ).length,
      completedTasks: tasks.filter((t) => t.status === "completed").length,
    };
  }

  /**
   * Get visualization data for the swarm topology
   */
  getTopologyVisualization(): {
    nodes: { id: string; role: AgentRole; status: AgentStatus }[];
    edges: { source: string; target: string; strength: number }[];
  } {
    const nodes = Array.from(this.agents.values()).map((a) => ({
      id: a.id,
      role: a.role,
      status: a.status,
    }));

    const edgeSet = new Set<string>();
    const edges: { source: string; target: string; strength: number }[] = [];

    for (const agent of this.agents.values()) {
      for (const neighborId of agent.neighbors) {
        const edgeKey = [agent.id, neighborId].sort().join("|");
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);

          // Find pheromone strength for this edge
          const trail = this.pheromones.find(
            (p) =>
              (p.fromAgentId === agent.id && p.toAgentId === neighborId) ||
              (p.fromAgentId === neighborId && p.toAgentId === agent.id),
          );

          edges.push({
            source: agent.id,
            target: neighborId,
            strength: trail?.strength || 0.1,
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Shutdown the swarm
   */
  shutdown(): void {
    this.stopGossip();
    this.agents.clear();
    this.pheromones = [];
    this.tasks.clear();
    this.emit("shutdown");
  }
}

/**
 * Swarm Orchestrator Service singleton
 */
export class SwarmOrchestratorService {
  private static instance: SwarmOrchestratorService;
  private swarms: Map<string, SwarmOrchestrator> = new Map();

  private constructor() {}

  static getInstance(): SwarmOrchestratorService {
    if (!SwarmOrchestratorService.instance) {
      SwarmOrchestratorService.instance = new SwarmOrchestratorService();
    }
    return SwarmOrchestratorService.instance;
  }

  /**
   * Create or get a named swarm
   */
  getSwarm(name: string, config?: Partial<SwarmConfig>): SwarmOrchestrator {
    let swarm = this.swarms.get(name);
    if (!swarm) {
      swarm = new SwarmOrchestrator(config);
      swarm.initialize();
      this.swarms.set(name, swarm);
    }
    return swarm;
  }

  /**
   * List all active swarms
   */
  listSwarms(): {
    name: string;
    stats: ReturnType<SwarmOrchestrator["getStats"]>;
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

export default SwarmOrchestratorService;
