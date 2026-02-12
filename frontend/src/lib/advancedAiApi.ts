/**
 * Advanced AI API Client
 * Handles communication with the holographic memory, context compression,
 * swarm orchestration, predictive preloading, and recursive distillation APIs
 */

import { fetchApi } from './api';

// ============================================================================
// Types - Holographic Memory
// ============================================================================

export interface HolographicMemoryStats {
  dimension: number;
  entryCount: number;
  memoryMagnitude: number;
  estimatedCapacity: number;
  memoryUsageBytes: number;
}

export interface HoloKVCacheStats {
  numLayers: number;
  dimension: number;
  tokenCount: number;
  totalMemoryBytes: number;
  memoryPerLayer: number;
  traditionalKVCacheBytes: number;
  compressionRatio: number;
}

export interface AllHolographicStats {
  memories: Array<{ name: string; stats: HolographicMemoryStats }>;
  kvCaches: Array<{ name: string; stats: HoloKVCacheStats }>;
}

// ============================================================================
// Types - Context Compression
// ============================================================================

export interface CompressionStats {
  originalTokens: number;
  compressedDimension: number;
  compressionRatio: number;
  chunkCount: number;
  processingTimeMs: number;
}

export interface CompressedContextInfo {
  id: string;
  stats: CompressionStats;
  source: string;
}

export interface SimilarityResult {
  id: string;
  similarity: number;
}

// ============================================================================
// Types - Swarm Orchestration
// ============================================================================

export type AgentRole =
  | 'analyst'
  | 'researcher'
  | 'coder'
  | 'reviewer'
  | 'synthesizer'
  | 'validator'
  | 'creative'
  | 'optimizer';

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'waiting' | 'completed' | 'failed';

export interface SwarmAgent {
  id: string;
  role: AgentRole;
  status: AgentStatus;
}

export interface SwarmTopology {
  nodes: SwarmAgent[];
  edges: Array<{ source: string; target: string; strength: number }>;
}

export interface SwarmStats {
  totalAgents: number;
  activeAgents: number;
  agentsByRole: Record<AgentRole, number>;
  totalMessages: number;
  pheromoneTrails: number;
  avgPheromoneStrength: number;
  pendingTasks: number;
  completedTasks: number;
}

export interface SwarmTask {
  id: string;
  query: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  synthesizedResult?: string;
  resultCount: number;
  createdAt: number;
  completedAt?: number;
}

// ============================================================================
// Types - Predictive Preloader
// ============================================================================

export interface PredictionResult {
  query: string;
  confidence: number;
  source: 'ngram' | 'markov' | 'temporal' | 'semantic' | 'frequent';
  topics: string[];
  preloadedAt?: number;
}

export interface PreloaderStats {
  totalQueries: number;
  predictionsGenerated: number;
  accuratePredictions: number;
  cacheHits: number;
  avgPredictionConfidence: number;
  topTopics: Array<{ topic: string; count: number }>;
  cacheStats: {
    size: number;
    used: number;
    hitRate: number;
  };
}

export interface TopicTransition {
  from: string;
  to: string;
  count: number;
  avgTimeGap: number;
}

export interface TemporalPattern {
  hour: number;
  day: number;
  topTopics: string[];
}

// ============================================================================
// Types - Recursive Distillation
// ============================================================================

export interface StyleProfile {
  formality: number;
  verbosity: number;
  technicality: number;
  emotiveness: number;
  directness: number;
  samples: string[];
}

export interface UserPreference {
  category: string;
  preference: string;
  positive: boolean;
  confidence: number;
  evidence: string[];
}

export interface Constraint {
  id: string;
  rule: string;
  context: string[];
  priority: number;
  softness: number;
}

export interface ExtractedPattern {
  type: 'preference' | 'constraint' | 'style' | 'topic' | 'workflow' | 'correction';
  pattern: string;
  confidence: number;
  frequency: number;
}

export interface KnowledgeNode {
  id: string;
  type: 'concept' | 'entity' | 'action' | 'preference';
  label: string;
  properties: Record<string, unknown>;
  mentions: number;
  lastMentioned: number;
}

export interface KnowledgeEdge {
  from: string;
  to: string;
  relation: string;
  weight: number;
  evidence: string[];
}

export interface UserModel {
  userId: string;
  version: number;
  summary?: string;
  styleProfile: StyleProfile;
  preferences: UserPreference[];
  constraints: Constraint[];
  patterns: ExtractedPattern[];
  stats: {
    totalConversations: number;
    totalTurns: number;
    distillationCycles: number;
    nodeCount: number;
    edgeCount: number;
  };
}

export interface DistillationStats {
  bufferSize: number;
  userCount: number;
  totalPatterns: number;
  totalPreferences: number;
  totalConstraints: number;
}

export interface DistillationResult {
  patternsExtracted: number;
  preferencesUpdated: number;
  constraintsFound: number;
  compressionRatio: number;
  modelVersion: number;
}

// ============================================================================
// Types - Overview
// ============================================================================

export interface SystemOverview {
  holographicMemory: {
    status: string;
    stats: AllHolographicStats;
  };
  contextCompressor: {
    status: string;
    description: string;
  };
  swarmOrchestrator: {
    status: string;
    description: string;
  };
  predictivePreloader: {
    status: string;
    stats: PreloaderStats;
  };
  recursiveDistillation: {
    status: string;
    stats: DistillationStats;
  };
}

// ============================================================================
// API Functions - Overview
// ============================================================================

export async function getSystemOverview(): Promise<{ ok: boolean; systems: SystemOverview }> {
  const res = await fetchApi('/api/advanced-ai/overview');
  if (!res.ok) throw new Error(`Failed to get overview: ${res.status}`);
  return res.json();
}

// ============================================================================
// API Functions - Holographic Memory
// ============================================================================

export async function storeInHolographicMemory(
  key: string,
  value: string,
  memoryId?: string
): Promise<{ ok: boolean; memoryId: string; entryCount: number; dimension: number }> {
  const res = await fetchApi('/api/advanced-ai/holographic/store', {
    method: 'POST',
    body: JSON.stringify({ key, value, memoryId }),
  });
  if (!res.ok) throw new Error(`Failed to store: ${res.status}`);
  return res.json();
}

export async function retrieveFromHolographicMemory(
  key: string,
  memoryId?: string,
  expectedValue?: string
): Promise<{ ok: boolean; key: string; similarity?: number; vectorMagnitude: number }> {
  const res = await fetchApi('/api/advanced-ai/holographic/retrieve', {
    method: 'POST',
    body: JSON.stringify({ key, memoryId, expectedValue }),
  });
  if (!res.ok) throw new Error(`Failed to retrieve: ${res.status}`);
  return res.json();
}

export async function getHolographicStats(): Promise<AllHolographicStats> {
  const res = await fetchApi('/api/advanced-ai/holographic/stats');
  if (!res.ok) throw new Error(`Failed to get stats: ${res.status}`);
  const data = await res.json();
  return { memories: data.memories || [], kvCaches: data.kvCaches || [] };
}

// ============================================================================
// API Functions - Context Compression
// ============================================================================

export async function compressContext(
  text: string,
  source?: string
): Promise<{
  ok: boolean;
  id: string;
  originalLength: number;
  stats: CompressionStats;
  metadata: Record<string, unknown>;
}> {
  const res = await fetchApi('/api/advanced-ai/context/compress', {
    method: 'POST',
    body: JSON.stringify({ text, source }),
  });
  if (!res.ok) throw new Error(`Failed to compress: ${res.status}`);
  return res.json();
}

export async function getContextSimilarity(
  contextId1: string,
  contextId2: string
): Promise<{ ok: boolean; similarity: number }> {
  const res = await fetchApi('/api/advanced-ai/context/similarity', {
    method: 'POST',
    body: JSON.stringify({ contextId1, contextId2 }),
  });
  if (!res.ok) throw new Error(`Failed to compare: ${res.status}`);
  return res.json();
}

export async function compareTexts(
  text1: string,
  text2: string
): Promise<{ ok: boolean; similarity: number }> {
  const res = await fetchApi('/api/advanced-ai/context/similarity', {
    method: 'POST',
    body: JSON.stringify({ text1, text2 }),
  });
  if (!res.ok) throw new Error(`Failed to compare: ${res.status}`);
  return res.json();
}

export async function queryContext(
  query: string,
  topK?: number
): Promise<{ ok: boolean; query: string; results: SimilarityResult[] }> {
  const res = await fetchApi('/api/advanced-ai/context/query', {
    method: 'POST',
    body: JSON.stringify({ query, topK }),
  });
  if (!res.ok) throw new Error(`Failed to query: ${res.status}`);
  return res.json();
}

export async function listContexts(): Promise<CompressedContextInfo[]> {
  const res = await fetchApi('/api/advanced-ai/context/list');
  if (!res.ok) throw new Error(`Failed to list contexts: ${res.status}`);
  const data = await res.json();
  return data.contexts || [];
}

// ============================================================================
// API Functions - Swarm Orchestration
// ============================================================================

export async function createSwarm(
  swarmId?: string,
  maxAgents?: number
): Promise<{ ok: boolean; swarmId: string; stats: SwarmStats; topology: SwarmTopology }> {
  const res = await fetchApi('/api/advanced-ai/swarm/create', {
    method: 'POST',
    body: JSON.stringify({ swarmId, maxAgents }),
  });
  if (!res.ok) throw new Error(`Failed to create swarm: ${res.status}`);
  return res.json();
}

export async function submitSwarmTask(
  query: string,
  context?: string,
  swarmId?: string
): Promise<{ ok: boolean; taskId: string; swarmId: string; status: string }> {
  const res = await fetchApi('/api/advanced-ai/swarm/task', {
    method: 'POST',
    body: JSON.stringify({ query, context, swarmId }),
  });
  if (!res.ok) throw new Error(`Failed to submit task: ${res.status}`);
  return res.json();
}

export async function getSwarmTaskStatus(
  taskId: string,
  swarmId?: string
): Promise<{ ok: boolean; task: SwarmTask }> {
  const url = swarmId
    ? `/api/advanced-ai/swarm/task/${taskId}?swarmId=${swarmId}`
    : `/api/advanced-ai/swarm/task/${taskId}`;
  const res = await fetchApi(url);
  if (!res.ok) throw new Error(`Failed to get task status: ${res.status}`);
  return res.json();
}

export async function getSwarmStatus(
  swarmId?: string
): Promise<{ ok: boolean; swarmId: string; stats: SwarmStats; topology: SwarmTopology }> {
  const res = await fetchApi(`/api/advanced-ai/swarm/status/${swarmId || 'default'}`);
  if (!res.ok) throw new Error(`Failed to get swarm status: ${res.status}`);
  return res.json();
}

export async function injectSwarmDiscovery(
  content: string,
  confidence?: number,
  tags?: string[],
  swarmId?: string
): Promise<{ ok: boolean; swarmId: string; injected: boolean }> {
  const res = await fetchApi('/api/advanced-ai/swarm/inject', {
    method: 'POST',
    body: JSON.stringify({ content, confidence, tags, swarmId }),
  });
  if (!res.ok) throw new Error(`Failed to inject: ${res.status}`);
  return res.json();
}

export async function stopSwarm(
  swarmId?: string
): Promise<{ ok: boolean; swarmId: string; status: string }> {
  const res = await fetchApi(`/api/advanced-ai/swarm/stop/${swarmId || 'default'}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to stop swarm: ${res.status}`);
  return res.json();
}

export async function listSwarms(): Promise<Array<{ name: string; stats: SwarmStats }>> {
  const res = await fetchApi('/api/advanced-ai/swarm/list');
  if (!res.ok) throw new Error(`Failed to list swarms: ${res.status}`);
  const data = await res.json();
  return data.swarms || [];
}

// ============================================================================
// API Functions - Predictive Preloader
// ============================================================================

export async function recordQuery(
  query: string,
  sessionId?: string,
  userId?: string
): Promise<{ ok: boolean; session: string; stats: PreloaderStats }> {
  const res = await fetchApi('/api/advanced-ai/preloader/record', {
    method: 'POST',
    body: JSON.stringify({ query, sessionId, userId }),
  });
  if (!res.ok) throw new Error(`Failed to record query: ${res.status}`);
  return res.json();
}

export async function getPredictions(userId?: string, topK?: number): Promise<PredictionResult[]> {
  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  if (topK) params.set('topK', topK.toString());
  const res = await fetchApi(`/api/advanced-ai/preloader/predict?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to get predictions: ${res.status}`);
  const data = await res.json();
  return data.predictions || [];
}

export async function triggerPreload(
  userId?: string
): Promise<{ ok: boolean; preloadedCount: number; stats: PreloaderStats }> {
  const res = await fetchApi('/api/advanced-ai/preloader/preload', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`Failed to preload: ${res.status}`);
  return res.json();
}

export async function getPreloaderStats(userId?: string): Promise<{
  stats: PreloaderStats;
  topicTransitions: TopicTransition[];
  temporalPatterns: TemporalPattern[];
}> {
  const params = userId ? `?userId=${userId}` : '';
  const res = await fetchApi(`/api/advanced-ai/preloader/stats${params}`);
  if (!res.ok) throw new Error(`Failed to get stats: ${res.status}`);
  return res.json();
}

// ============================================================================
// API Functions - Recursive Distillation
// ============================================================================

export async function addConversationTurn(
  role: 'user' | 'assistant',
  content: string,
  sessionId?: string,
  metadata?: Record<string, unknown>
): Promise<{ ok: boolean; stats: DistillationStats }> {
  const res = await fetchApi('/api/advanced-ai/distill/turn', {
    method: 'POST',
    body: JSON.stringify({ role, content, sessionId, metadata }),
  });
  if (!res.ok) throw new Error(`Failed to add turn: ${res.status}`);
  return res.json();
}

export async function runDistillation(
  userId?: string
): Promise<{ ok: boolean; result: DistillationResult; stats: DistillationStats }> {
  const res = await fetchApi('/api/advanced-ai/distill/run', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`Failed to distill: ${res.status}`);
  return res.json();
}

export async function getUserModel(userId?: string): Promise<UserModel | null> {
  const res = await fetchApi(`/api/advanced-ai/distill/model/${userId || 'default'}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get model: ${res.status}`);
  return res.json();
}

export async function getKnowledgeGraph(
  userId?: string
): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } | null> {
  const res = await fetchApi(`/api/advanced-ai/distill/knowledge/${userId || 'default'}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get graph: ${res.status}`);
  return res.json();
}

export async function getDistillationStats(): Promise<DistillationStats> {
  const res = await fetchApi('/api/advanced-ai/distill/stats');
  if (!res.ok) throw new Error(`Failed to get stats: ${res.status}`);
  return res.json();
}

// ============================================================================
// Types - Supervised Swarm
// ============================================================================

export type SupervisedAgentStatus =
  | 'idle'
  | 'assigned' // Has a task assigned
  | 'working' // Actively processing
  | 'submitted' // Submitted work for review
  | 'approved' // Work approved by supervisor
  | 'rejected' // Work rejected, needs revision
  | 'completed';

export type ReviewDecision = 'approve' | 'reject' | 'revise';

export interface AgentResult {
  content: string;
  confidence: number;
  reasoning?: string;
  artifacts?: {
    type: 'code' | 'analysis' | 'list' | 'data';
    content: string;
    metadata?: Record<string, unknown>;
  }[];
  submittedAt: number;
}

export interface SupervisorReview {
  decision: ReviewDecision;
  feedback: string;
  score: number;
  issues?: string[];
  suggestions?: string[];
  reviewedAt: number;
}

export interface AgentSubtask {
  id: string;
  parentTaskId: string;
  agentId: string;
  role: AgentRole;
  instruction: string;
  context?: string;
  status: 'pending' | 'working' | 'submitted' | 'approved' | 'rejected';
  attempts: number;
  maxAttempts: number;
  result?: AgentResult;
  review?: SupervisorReview;
  createdAt: number;
  updatedAt: number;
}

export interface SpecialistAgent {
  id: string;
  role: AgentRole;
  status: SupervisedAgentStatus;
  currentTask?: string;
  stats: {
    tasksCompleted: number;
    tasksRejected: number;
    avgScore: number;
    totalAttempts: number;
  };
  createdAt: number;
  lastActiveAt: number;
}

export interface TaskPlan {
  summary: string;
  subtasks: {
    role: AgentRole;
    instruction: string;
    priority: 'high' | 'medium' | 'low';
    dependsOn?: string[];
  }[];
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  reasoning: string;
}

export interface TaskEvent {
  timestamp: number;
  type:
    | 'plan_created'
    | 'subtask_assigned'
    | 'subtask_submitted'
    | 'subtask_approved'
    | 'subtask_rejected'
    | 'synthesis_started'
    | 'task_completed'
    | 'task_failed'
    | 'supervisor_intervention';
  actorId: string;
  details: string;
  metadata?: Record<string, unknown>;
}

export interface SupervisedTask {
  id: string;
  query: string;
  context?: string;
  status: 'planning' | 'executing' | 'reviewing' | 'synthesizing' | 'completed' | 'failed';
  plan?: TaskPlan;
  subtasks: AgentSubtask[];
  synthesizedResult?: string;
  events: TaskEvent[];
  createdAt: number;
  completedAt?: number;
}

export interface SupervisedSwarmStats {
  totalAgents: number;
  agentsByRole: Record<AgentRole, number>;
  agentsByStatus: Record<SupervisedAgentStatus, number>;
  totalTasks: number;
  tasksByStatus: Record<string, number>;
  reviewStats: {
    totalReviews: number;
    approved: number;
    rejected: number;
    revised: number;
    avgScore: number;
  };
}

export interface SupervisedSwarmConfig {
  maxAgentsPerRole: number;
  maxRetries: number;
  reviewStrictness: 'lenient' | 'moderate' | 'strict';
  autoApproveThreshold: number;
  timeoutMs: number;
}

export interface SupervisedSwarmTopology {
  supervisor: { id: 'supervisor'; status: 'active' | 'idle' };
  agents: SpecialistAgent[];
}

// ============================================================================
// API Functions - Supervised Swarm
// ============================================================================

export async function createSupervisedSwarm(
  swarmId?: string,
  config?: Partial<SupervisedSwarmConfig>
): Promise<{
  ok: boolean;
  swarmId: string;
  stats: SupervisedSwarmStats;
  topology: SupervisedSwarmTopology;
}> {
  const res = await fetchApi('/api/advanced-ai/supervised/create', {
    method: 'POST',
    body: JSON.stringify({ swarmId, config }),
  });
  if (!res.ok) throw new Error(`Failed to create supervised swarm: ${res.status}`);
  return res.json();
}

export async function submitSupervisedTask(
  query: string,
  context?: string,
  swarmId?: string
): Promise<{ ok: boolean; task: SupervisedTask }> {
  const res = await fetchApi('/api/advanced-ai/supervised/task', {
    method: 'POST',
    body: JSON.stringify({ query, context, swarmId }),
  });
  if (!res.ok) throw new Error(`Failed to submit supervised task: ${res.status}`);
  return res.json();
}

export async function getSupervisedTaskStatus(
  taskId: string,
  swarmId?: string
): Promise<{
  ok: boolean;
  task: SupervisedTask;
  subtaskDetails: AgentSubtask[];
  reviews: SupervisorReview[];
}> {
  const params = swarmId ? `?swarmId=${swarmId}` : '';
  const res = await fetchApi(`/api/advanced-ai/supervised/task/${taskId}${params}`);
  if (!res.ok) throw new Error(`Failed to get supervised task status: ${res.status}`);
  return res.json();
}

export async function getSupervisedSwarmStatus(swarmId?: string): Promise<{
  ok: boolean;
  swarmId: string;
  stats: SupervisedSwarmStats;
  topology: SupervisedSwarmTopology;
  config: SupervisedSwarmConfig;
}> {
  const res = await fetchApi(`/api/advanced-ai/supervised/status/${swarmId || 'default'}`);
  if (!res.ok) throw new Error(`Failed to get supervised swarm status: ${res.status}`);
  return res.json();
}

export async function listSupervisedSwarms(): Promise<
  Array<{
    name: string;
    stats: SupervisedSwarmStats;
    config: SupervisedSwarmConfig;
  }>
> {
  const res = await fetchApi('/api/advanced-ai/supervised/list');
  if (!res.ok) throw new Error(`Failed to list supervised swarms: ${res.status}`);
  const data = await res.json();
  return data.swarms || [];
}
