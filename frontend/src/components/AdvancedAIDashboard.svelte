<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Card, Button } from '../lib/design-system';
  import {
    getSystemOverview,
    getHolographicStats,
    getSwarmStatus,
    getPreloaderStats,
    getDistillationStats,
    getUserModel,
    createSwarm,
    submitSwarmTask,
    getSwarmTaskStatus,
    // Supervised swarm imports
    createSupervisedSwarm,
    submitSupervisedTask,
    getSupervisedTaskStatus,
    getSupervisedSwarmStatus,
    type SwarmTopology,
    type SwarmStats,
    type PreloaderStats,
    type DistillationStats,
    type UserModel,
    type AllHolographicStats,
    // Supervised swarm types
    type SupervisedSwarmStats,
    type SupervisedSwarmTopology,
    type SupervisedTask,
  } from '../lib/advancedAiApi';

  // Props
  interface Props {
    onBack: () => void;
  }
  let { onBack }: Props = $props();

  // State
  let activeTab = $state<
    'overview' | 'holographic' | 'swarm' | 'supervised' | 'preloader' | 'distill'
  >('overview');
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Data
  let holographicStats = $state<AllHolographicStats | null>(null);
  let swarmStats = $state<SwarmStats | null>(null);
  let swarmTopology = $state<SwarmTopology | null>(null);
  let preloaderStats = $state<PreloaderStats | null>(null);
  let distillationStats = $state<DistillationStats | null>(null);
  let userModel = $state<UserModel | null>(null);

  // Supervised Swarm state
  let supervisedStats = $state<SupervisedSwarmStats | null>(null);
  let supervisedTopology = $state<SupervisedSwarmTopology | null>(null);
  let supervisedQuery = $state('');
  let supervisedTask = $state<SupervisedTask | null>(null);
  let supervisedPolling = $state(false);
  let supervisedPollInterval: ReturnType<typeof setInterval> | null = null;

  // Swarm task state
  let swarmQuery = $state('');
  let swarmTaskId = $state<string | null>(null);
  let swarmTaskResult = $state<string | null>(null);
  let swarmTaskStatus = $state<string | null>(null);
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  // Load overview data
  async function loadData() {
    loading = true;
    error = null;
    try {
      switch (activeTab) {
        case 'overview':
          const overview = await getSystemOverview();
          if (overview.systems.holographicMemory.stats) {
            holographicStats = overview.systems.holographicMemory.stats;
          }
          if (overview.systems.predictivePreloader.stats) {
            preloaderStats = overview.systems.predictivePreloader.stats;
          }
          if (overview.systems.recursiveDistillation.stats) {
            distillationStats = overview.systems.recursiveDistillation.stats;
          }
          break;
        case 'holographic':
          holographicStats = await getHolographicStats();
          break;
        case 'swarm':
          const swarmData = await getSwarmStatus();
          swarmStats = swarmData.stats;
          swarmTopology = swarmData.topology;
          break;
        case 'supervised':
          try {
            const supData = await getSupervisedSwarmStatus();
            supervisedStats = supData.stats;
            supervisedTopology = supData.topology;
          } catch {
            // Swarm not created yet, that's ok
            supervisedStats = null;
            supervisedTopology = null;
          }
          break;
        case 'preloader':
          const preloaderData = await getPreloaderStats();
          preloaderStats = preloaderData.stats;
          break;
        case 'distill':
          distillationStats = await getDistillationStats();
          userModel = await getUserModel();
          break;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      loading = false;
    }
  }

  // Create a new swarm
  async function handleCreateSwarm() {
    try {
      const result = await createSwarm('interactive', 12);
      swarmStats = result.stats;
      swarmTopology = result.topology;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create swarm';
    }
  }

  // Submit task to swarm
  async function handleSubmitTask() {
    if (!swarmQuery.trim()) return;

    try {
      swarmTaskResult = null;
      swarmTaskStatus = 'processing';
      const result = await submitSwarmTask(swarmQuery, undefined, 'interactive');
      swarmTaskId = result.taskId;

      // Poll for completion
      pollInterval = setInterval(async () => {
        if (!swarmTaskId) return;
        const status = await getSwarmTaskStatus(swarmTaskId, 'interactive');
        swarmTaskStatus = status.task.status;

        if (status.task.status === 'completed' || status.task.status === 'failed') {
          swarmTaskResult = status.task.synthesizedResult || 'No result';
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      }, 1000);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to submit task';
      swarmTaskStatus = 'failed';
    }
  }

  // Create supervised swarm
  async function handleCreateSupervisedSwarm() {
    try {
      const result = await createSupervisedSwarm('supervised-interactive');
      supervisedStats = result.stats;
      supervisedTopology = result.topology;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create supervised swarm';
    }
  }

  // Submit task to supervised swarm
  async function handleSubmitSupervisedTask() {
    if (!supervisedQuery.trim()) return;

    try {
      supervisedTask = null;
      supervisedPolling = true;
      const result = await submitSupervisedTask(
        supervisedQuery,
        undefined,
        'supervised-interactive'
      );
      supervisedTask = result.task;

      // Poll for completion
      supervisedPollInterval = setInterval(async () => {
        if (!supervisedTask?.id) return;
        try {
          const status = await getSupervisedTaskStatus(supervisedTask.id, 'supervised-interactive');
          supervisedTask = status.task;

          if (status.task.status === 'completed' || status.task.status === 'failed') {
            supervisedPolling = false;
            if (supervisedPollInterval) {
              clearInterval(supervisedPollInterval);
              supervisedPollInterval = null;
            }
          }
        } catch (e) {
          // ignore polling errors
        }
      }, 1000);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to submit supervised task';
      supervisedPolling = false;
    }
  }

  // Get status color for supervised task
  function getSubtaskStatusColor(status: string): string {
    switch (status) {
      case 'approved':
        return '#10b981';
      case 'rejected':
        return '#ef4444';
      case 'submitted':
        return '#f59e0b';
      case 'working':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  }

  // Get decision color
  function getDecisionColor(decision: string): string {
    switch (decision) {
      case 'approve':
        return '#10b981';
      case 'reject':
        return '#ef4444';
      case 'revise':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  }

  onMount(() => {
    loadData();
  });

  onDestroy(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    if (supervisedPollInterval) {
      clearInterval(supervisedPollInterval);
    }
  });

  // Watch tab changes
  $effect(() => {
    if (activeTab) loadData();
  });

  // Helper to format bytes
  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  // Helper to get role color
  function getRoleColor(role: string): string {
    const colors: Record<string, string> = {
      analyst: '#3b82f6',
      researcher: '#10b981',
      coder: '#f59e0b',
      reviewer: '#ef4444',
      synthesizer: '#8b5cf6',
      validator: '#ec4899',
      creative: '#06b6d4',
      optimizer: '#84cc16',
    };
    return colors[role] || '#6b7280';
  }
</script>

<div class="advanced-ai-dashboard">
  <header class="dashboard-header">
    <button class="back-btn" onclick={onBack} aria-label="Go back">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back
    </button>
    <div class="header-content">
      <h1>Advanced AI Systems</h1>
      <p class="subtitle">
        Holographic Memory | Swarm Intelligence | Predictive AI | User Distillation
      </p>
    </div>
  </header>

  <nav class="tab-nav">
    <button class:active={activeTab === 'overview'} onclick={() => (activeTab = 'overview')}>
      Overview
    </button>
    <button class:active={activeTab === 'holographic'} onclick={() => (activeTab = 'holographic')}>
      Holographic Memory
    </button>
    <button class:active={activeTab === 'swarm'} onclick={() => (activeTab = 'swarm')}>
      Swarm (Legacy)
    </button>
    <button class:active={activeTab === 'supervised'} onclick={() => (activeTab = 'supervised')}>
      Kimi Supervised
    </button>
    <button class:active={activeTab === 'preloader'} onclick={() => (activeTab = 'preloader')}>
      Predictive Preloader
    </button>
    <button class:active={activeTab === 'distill'} onclick={() => (activeTab = 'distill')}>
      User Distillation
    </button>
  </nav>

  {#if error}
    <div class="error-banner">
      <span>{error}</span>
      <button onclick={() => (error = null)}>Dismiss</button>
    </div>
  {/if}

  <main class="dashboard-content">
    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading...</p>
      </div>
    {:else if activeTab === 'overview'}
      <div class="overview-grid">
        <Card title="Holographic Memory" padding="md">
          <div class="stat-grid">
            <div class="stat">
              <span class="label">Active Memories</span>
              <span class="value">{holographicStats?.memories.length || 0}</span>
            </div>
            <div class="stat">
              <span class="label">KV Caches</span>
              <span class="value">{holographicStats?.kvCaches.length || 0}</span>
            </div>
          </div>
          <p class="description">
            Fixed-size vector memory using FFT-based holographic encoding. O(1) memory for unlimited
            key-value pairs.
          </p>
        </Card>

        <Card title="Swarm Intelligence" padding="md">
          <div class="stat-grid">
            <div class="stat">
              <span class="label">Agents</span>
              <span class="value">{swarmStats?.totalAgents || 0}</span>
            </div>
            <div class="stat">
              <span class="label">Tasks</span>
              <span class="value">{swarmStats?.completedTasks || 0}</span>
            </div>
          </div>
          <p class="description">
            Distributed micro-agents with gossip protocol and stigmergy for emergent
            problem-solving.
          </p>
        </Card>

        <Card title="Predictive Preloader" padding="md">
          <div class="stat-grid">
            <div class="stat">
              <span class="label">Queries Learned</span>
              <span class="value">{preloaderStats?.totalQueries || 0}</span>
            </div>
            <div class="stat">
              <span class="label">Cache Hits</span>
              <span class="value">{preloaderStats?.cacheHits || 0}</span>
            </div>
          </div>
          <p class="description">
            N-gram and Markov chain prediction to anticipate user queries and pre-warm context.
          </p>
        </Card>

        <Card title="Recursive Distillation" padding="md">
          <div class="stat-grid">
            <div class="stat">
              <span class="label">Patterns</span>
              <span class="value">{distillationStats?.totalPatterns || 0}</span>
            </div>
            <div class="stat">
              <span class="label">Preferences</span>
              <span class="value">{distillationStats?.totalPreferences || 0}</span>
            </div>
          </div>
          <p class="description">
            Extract and compress conversation patterns into personalized user models.
          </p>
        </Card>
      </div>
    {:else if activeTab === 'holographic'}
      <div class="section">
        <h2>Holographic Memory - HoloKV</h2>
        <p class="section-desc">
          O(1) fixed memory for context. Uses FFT-based circular convolution for binding and
          correlation. Requires backend support.
        </p>

        {#if holographicStats}
          <div class="memory-list">
            <h3>Active Memories</h3>
            {#if holographicStats.memories.length === 0}
              <p class="empty">No active memories. Store key-value pairs to begin.</p>
            {:else}
              {#each holographicStats.memories as mem}
                <div class="memory-item">
                  <span class="name">{mem.name}</span>
                  <span class="stat">Dimension: {mem.stats.dimension}</span>
                  <span class="stat">Entries: {mem.stats.entryCount}</span>
                  <span class="stat">Size: {formatBytes(mem.stats.memoryUsageBytes)}</span>
                  <span class="stat">Capacity: ~{mem.stats.estimatedCapacity}</span>
                </div>
              {/each}
            {/if}
          </div>

          <div class="memory-list">
            <h3>KV Caches</h3>
            {#if holographicStats.kvCaches.length === 0}
              <p class="empty">No active KV caches.</p>
            {:else}
              {#each holographicStats.kvCaches as cache}
                <div class="memory-item">
                  <span class="name">{cache.name}</span>
                  <span class="stat">Layers: {cache.stats.numLayers}</span>
                  <span class="stat">Tokens: {cache.stats.tokenCount}</span>
                  <span class="stat">HoloKV Size: {formatBytes(cache.stats.totalMemoryBytes)}</span>
                  <span class="stat"
                    >Traditional: {formatBytes(cache.stats.traditionalKVCacheBytes)}</span
                  >
                  <span class="stat highlight"
                    >Compression: {cache.stats.compressionRatio.toFixed(1)}x</span
                  >
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    {:else if activeTab === 'swarm'}
      <div class="section">
        <h2>Swarm Intelligence</h2>
        <p class="section-desc">
          Distributed micro-agents communicate via gossip protocol. Pheromone trails (stigmergy)
          guide future agents. A meta-synthesizer aggregates swarm insights.
        </p>

        <div class="swarm-controls">
          <button onclick={handleCreateSwarm}>Create/Reset Swarm</button>
        </div>

        {#if swarmStats}
          <div class="swarm-stats">
            <div class="stat-card">
              <span class="value">{swarmStats.totalAgents}</span>
              <span class="label">Total Agents</span>
            </div>
            <div class="stat-card">
              <span class="value">{swarmStats.activeAgents}</span>
              <span class="label">Active</span>
            </div>
            <div class="stat-card">
              <span class="value">{swarmStats.pheromoneTrails}</span>
              <span class="label">Pheromone Trails</span>
            </div>
            <div class="stat-card">
              <span class="value">{swarmStats.completedTasks}</span>
              <span class="label">Tasks Completed</span>
            </div>
          </div>

          <div class="role-breakdown">
            <h3>Agents by Role</h3>
            <div class="roles">
              {#each Object.entries(swarmStats.agentsByRole) as [role, count]}
                <div class="role-badge" style="background-color: {getRoleColor(role)}">
                  {role}: {count}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <div class="swarm-task">
          <h3>Submit Task to Swarm</h3>
          <div class="task-input">
            <input
              type="text"
              bind:value={swarmQuery}
              placeholder="Enter a question or task for the swarm..."
            />
            <button onclick={handleSubmitTask} disabled={!swarmQuery.trim()}> Submit </button>
          </div>

          {#if swarmTaskStatus}
            <div class="task-result">
              <div class="status">
                Status: <span class="status-{swarmTaskStatus}">{swarmTaskStatus}</span>
              </div>
              {#if swarmTaskResult}
                <div class="result">
                  <pre>{swarmTaskResult}</pre>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        {#if swarmTopology}
          <div class="topology-viz">
            <h3>Swarm Topology</h3>
            <div class="topology-grid">
              {#each swarmTopology.nodes as node}
                <div
                  class="agent-node"
                  class:active={node.status !== 'idle'}
                  style="border-color: {getRoleColor(node.role)}"
                  title="{node.role} - {node.status}"
                >
                  <span class="role">{node.role.slice(0, 3)}</span>
                  <span class="status-dot" class:active={node.status !== 'idle'}></span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {:else if activeTab === 'supervised'}
      <div class="section">
        <h2>Kimi Supervised Swarm</h2>
        <p class="section-desc">
          Hierarchical swarm where Kimi acts as the central supervisor. All agents report to Kimi,
          who reviews, approves, or rejects their work. No chaotic gossip - full oversight and
          control.
        </p>

        <div class="swarm-controls">
          <button onclick={handleCreateSupervisedSwarm}>Create/Reset Supervised Swarm</button>
        </div>

        {#if supervisedStats}
          <div class="supervised-stats">
            <div class="stat-row">
              <div class="stat-card">
                <span class="value">{supervisedStats.totalAgents}</span>
                <span class="label">Total Agents</span>
              </div>
              <div class="stat-card">
                <span class="value">{supervisedStats.totalTasks}</span>
                <span class="label">Total Tasks</span>
              </div>
              <div class="stat-card">
                <span class="value">{supervisedStats.reviewStats?.approved || 0}</span>
                <span class="label">Approved</span>
              </div>
              <div class="stat-card">
                <span class="value">{supervisedStats.reviewStats?.rejected || 0}</span>
                <span class="label">Rejected</span>
              </div>
              <div class="stat-card">
                <span class="value"
                  >{((supervisedStats.reviewStats?.avgScore || 0) * 100).toFixed(0)}%</span
                >
                <span class="label">Avg Score</span>
              </div>
            </div>
          </div>
        {/if}

        <!-- Hub-and-Spoke Topology Visualization -->
        {#if supervisedTopology}
          <div class="supervised-topology">
            <h3>Kimi Supervised Topology</h3>
            <div class="hub-spoke-viz">
              <!-- Kimi in the center -->
              <div
                class="kimi-supervisor"
                class:active={supervisedTopology.supervisor.status === 'active'}
              >
                <div class="kimi-icon">K</div>
                <span class="kimi-label">KIMI</span>
                <span class="kimi-role">Supervisor</span>
              </div>

              <!-- Agents around Kimi -->
              <div class="agents-ring">
                {#each supervisedTopology.agents as agent, i}
                  {@const angle =
                    (i / supervisedTopology.agents.length) * 2 * Math.PI - Math.PI / 2}
                  {@const x = 50 + 35 * Math.cos(angle)}
                  {@const y = 50 + 35 * Math.sin(angle)}
                  <div
                    class="supervised-agent"
                    class:working={agent.status === 'working'}
                    class:approved={agent.status === 'approved'}
                    class:rejected={agent.status === 'rejected'}
                    style="left: {x}%; top: {y}%; border-color: {getRoleColor(agent.role)}"
                    title="{agent.role} - {agent.status}"
                  >
                    <span class="agent-role">{agent.role.slice(0, 3)}</span>
                    <div
                      class="agent-line"
                      style="
                      width: 35%;
                      transform: rotate({(angle * 180) / Math.PI + 180}deg);
                      transform-origin: 0 50%;
                    "
                    ></div>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}

        <div class="supervised-task">
          <h3>Submit Task (Kimi Oversees)</h3>
          <div class="task-input">
            <input
              type="text"
              bind:value={supervisedQuery}
              placeholder="Enter a task for the supervised swarm..."
            />
            <button
              onclick={handleSubmitSupervisedTask}
              disabled={!supervisedQuery.trim() || supervisedPolling}
            >
              {supervisedPolling ? 'Processing...' : 'Submit'}
            </button>
          </div>

          {#if supervisedTask}
            <div class="task-progress">
              <div class="task-header">
                <span class="task-id">Task: {supervisedTask.id.slice(0, 16)}...</span>
                <span
                  class="task-status"
                  style="color: {getSubtaskStatusColor(supervisedTask.status)}"
                  >{supervisedTask.status}</span
                >
              </div>

              {#if supervisedTask.plan}
                <div class="task-plan">
                  <h4>Kimi's Plan</h4>
                  <p class="plan-summary">{supervisedTask.plan.summary}</p>
                  <span class="complexity"
                    >Complexity: {supervisedTask.plan.estimatedComplexity}</span
                  >
                </div>
              {/if}

              {#if supervisedTask.subtasks.length > 0}
                <div class="subtasks-list">
                  <h4>Subtasks & Reviews</h4>
                  {#each supervisedTask.subtasks as subtask}
                    <div class="subtask-item">
                      <div class="subtask-header">
                        <span class="subtask-role" style="background: {getRoleColor(subtask.role)}"
                          >{subtask.role}</span
                        >
                        <span
                          class="subtask-status"
                          style="color: {getSubtaskStatusColor(subtask.status)}"
                          >{subtask.status}</span
                        >
                        <span class="subtask-attempts"
                          >Attempt {subtask.attempts}/{subtask.maxAttempts}</span
                        >
                      </div>
                      <p class="subtask-instruction">{subtask.instruction}</p>

                      {#if subtask.review}
                        <div
                          class="review-box"
                          class:approved={subtask.review.decision === 'approve'}
                          class:rejected={subtask.review.decision === 'reject'}
                        >
                          <div class="review-header">
                            <span
                              class="review-decision"
                              style="color: {getDecisionColor(subtask.review.decision)}"
                            >
                              {subtask.review.decision.toUpperCase()}
                            </span>
                            <span class="review-score"
                              >Score: {(subtask.review.score * 100).toFixed(0)}%</span
                            >
                          </div>
                          <p class="review-feedback">{subtask.review.feedback}</p>
                          {#if subtask.review.issues && subtask.review.issues.length > 0}
                            <div class="review-issues">
                              <strong>Issues:</strong>
                              <ul>
                                {#each subtask.review.issues as issue}
                                  <li>{issue}</li>
                                {/each}
                              </ul>
                            </div>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}

              {#if supervisedTask.synthesizedResult}
                <div class="final-result">
                  <h4>Final Synthesized Result (Kimi)</h4>
                  <pre>{supervisedTask.synthesizedResult}</pre>
                </div>
              {/if}

              {#if supervisedTask.events.length > 0}
                <details class="events-log">
                  <summary>Audit Trail ({supervisedTask.events.length} events)</summary>
                  <div class="events-list">
                    {#each supervisedTask.events.slice(-10) as event}
                      <div class="event-item">
                        <span class="event-time"
                          >{new Date(event.timestamp).toLocaleTimeString()}</span
                        >
                        <span class="event-type">{event.type}</span>
                        <span class="event-actor">{event.actorId}</span>
                        <span class="event-details">{event.details}</span>
                      </div>
                    {/each}
                  </div>
                </details>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {:else if activeTab === 'preloader'}
      <div class="section">
        <h2>Predictive Preloader</h2>
        <p class="section-desc">
          Learns from query patterns to anticipate what you'll ask next. Uses N-grams, Markov
          chains, and temporal patterns for prediction.
        </p>

        {#if preloaderStats}
          <div class="preloader-stats">
            <div class="stat-row">
              <div class="stat-card">
                <span class="value">{preloaderStats.totalQueries}</span>
                <span class="label">Queries Learned</span>
              </div>
              <div class="stat-card">
                <span class="value">{preloaderStats.predictionsGenerated}</span>
                <span class="label">Predictions Made</span>
              </div>
              <div class="stat-card">
                <span class="value">{preloaderStats.accuratePredictions}</span>
                <span class="label">Accurate Predictions</span>
              </div>
              <div class="stat-card">
                <span class="value"
                  >{(preloaderStats.avgPredictionConfidence * 100).toFixed(1)}%</span
                >
                <span class="label">Avg Confidence</span>
              </div>
            </div>

            <div class="cache-stats">
              <h3>Preload Cache</h3>
              <div class="cache-info">
                <span>Size: {preloaderStats.cacheStats.size}</span>
                <span>Used: {preloaderStats.cacheStats.used}</span>
                <span>Hit Rate: {(preloaderStats.cacheStats.hitRate * 100).toFixed(1)}%</span>
              </div>
            </div>

            {#if preloaderStats.topTopics.length > 0}
              <div class="top-topics">
                <h3>Top Topics</h3>
                <div class="topics">
                  {#each preloaderStats.topTopics.slice(0, 10) as topic}
                    <span class="topic-badge">{topic.topic} ({topic.count})</span>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {:else}
          <p class="coming-soon">
            Predictive Preloader requires backend support. Use the Cost Dashboard and model settings
            for now.
          </p>
        {/if}
      </div>
    {:else if activeTab === 'distill'}
      <div class="section">
        <h2>Recursive Distillation</h2>
        <p class="section-desc">
          Extracts patterns, preferences, and constraints from conversations to build a personalized
          user model that improves over time.
        </p>

        {#if distillationStats}
          <div class="distill-stats">
            <div class="stat-row">
              <div class="stat-card">
                <span class="value">{distillationStats.bufferSize}</span>
                <span class="label">Buffer Size</span>
              </div>
              <div class="stat-card">
                <span class="value">{distillationStats.userCount}</span>
                <span class="label">User Models</span>
              </div>
              <div class="stat-card">
                <span class="value">{distillationStats.totalPatterns}</span>
                <span class="label">Patterns</span>
              </div>
              <div class="stat-card">
                <span class="value">{distillationStats.totalPreferences}</span>
                <span class="label">Preferences</span>
              </div>
            </div>
          </div>
        {/if}

        {#if userModel}
          <div class="user-model">
            <h3>User Model: {userModel.userId}</h3>
            <span class="version">v{userModel.version}</span>

            {#if userModel.summary}
              <div class="summary">
                <h4>Summary</h4>
                <p>{userModel.summary}</p>
              </div>
            {/if}

            <div class="style-profile">
              <h4>Communication Style</h4>
              <div class="style-bars">
                <div class="style-bar">
                  <span class="label">Formality</span>
                  <div class="bar">
                    <div
                      class="fill"
                      style="width: {userModel.styleProfile.formality * 100}%"
                    ></div>
                  </div>
                  <span class="value">{(userModel.styleProfile.formality * 100).toFixed(0)}%</span>
                </div>
                <div class="style-bar">
                  <span class="label">Verbosity</span>
                  <div class="bar">
                    <div
                      class="fill"
                      style="width: {userModel.styleProfile.verbosity * 100}%"
                    ></div>
                  </div>
                  <span class="value">{(userModel.styleProfile.verbosity * 100).toFixed(0)}%</span>
                </div>
                <div class="style-bar">
                  <span class="label">Technicality</span>
                  <div class="bar">
                    <div
                      class="fill"
                      style="width: {userModel.styleProfile.technicality * 100}%"
                    ></div>
                  </div>
                  <span class="value"
                    >{(userModel.styleProfile.technicality * 100).toFixed(0)}%</span
                  >
                </div>
                <div class="style-bar">
                  <span class="label">Directness</span>
                  <div class="bar">
                    <div
                      class="fill"
                      style="width: {userModel.styleProfile.directness * 100}%"
                    ></div>
                  </div>
                  <span class="value">{(userModel.styleProfile.directness * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {#if userModel.patterns.length > 0}
              <div class="patterns">
                <h4>Extracted Patterns</h4>
                <div class="pattern-list">
                  {#each userModel.patterns.slice(0, 10) as pattern}
                    <div class="pattern-item">
                      <span class="type">{pattern.type}</span>
                      <span class="text">{pattern.pattern}</span>
                      <span class="confidence">{(pattern.confidence * 100).toFixed(0)}%</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {:else}
          <p class="empty">No user model yet. Chat to build one!</p>
        {/if}
      </div>
    {/if}
  </main>
</div>

<style>
  .advanced-ai-dashboard {
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
    font-family: var(--font-sans, system-ui, sans-serif);
    background: var(--color-bg, #fafafa);
    color: var(--color-text, #111827);
  }

  .dashboard-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .header-content {
    flex: 1;
    text-align: center;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    color: var(--color-text-secondary, #374151);
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: var(--color-bg-subtle, #f9fafb);
    color: var(--color-text, #111827);
  }

  .dashboard-header h1 {
    font-size: 1.75rem;
    margin: 0 0 0.5rem;
    color: var(--color-text, #111827);
  }

  .subtitle {
    color: var(--color-text-muted, #6b7280);
    font-size: 0.875rem;
  }

  .tab-nav {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .tab-nav button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border, #e5e7eb);
    background: var(--color-bg-card, #fff);
    color: var(--color-text-secondary, #6b7280);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .tab-nav button:hover {
    background: var(--color-bg-subtle, #f3f4f6);
    color: var(--color-text, #374151);
  }

  .tab-nav button.active {
    background: var(--color-primary, #6366f1);
    color: white;
    border-color: var(--color-primary, #6366f1);
  }

  .error-banner {
    background: #ef444420;
    border: 1px solid #ef4444;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    color: #ef4444;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    color: var(--text-secondary, #888);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color, #333);
    border-top-color: var(--accent-color, #3b82f6);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .overview-grid .stat-grid,
  .overview-grid .description {
    margin: 0;
  }

  .overview-grid .description {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    margin-top: 0.75rem;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
  }

  .stat .label {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
    text-transform: uppercase;
  }

  .stat .value {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--color-primary, #6366f1);
  }

  .description {
    font-size: 0.8rem;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.4;
  }

  .section {
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    padding: 1.5rem;
  }

  .section h2 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
    color: var(--color-text, #111827);
  }

  .section-desc {
    color: var(--text-secondary, #888);
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }

  .memory-list h3 {
    font-size: 0.9rem;
    margin: 1.5rem 0 0.75rem;
    color: var(--text-primary, #fff);
  }

  .memory-item {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--bg-tertiary, #252525);
    border-radius: 6px;
    margin-bottom: 0.5rem;
    font-size: 0.8rem;
  }

  .memory-item .name {
    font-weight: bold;
    color: var(--text-primary, #fff);
    min-width: 100px;
  }

  .memory-item .stat {
    color: var(--text-secondary, #888);
  }

  .memory-item .highlight {
    color: var(--accent-color, #3b82f6);
    font-weight: bold;
  }

  .coming-soon {
    padding: 1.5rem;
    text-align: center;
    color: var(--color-text-muted, #6b7280);
    font-size: 0.875rem;
  }

  .empty {
    color: var(--text-secondary, #888);
    font-style: italic;
    font-size: 0.875rem;
  }

  .swarm-controls {
    margin-bottom: 1.5rem;
  }

  .swarm-controls button {
    padding: 0.5rem 1rem;
    background: var(--accent-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .swarm-stats,
  .stat-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1.5rem;
  }

  .stat-card {
    background: var(--bg-tertiary, #252525);
    padding: 1rem;
    border-radius: 6px;
    text-align: center;
    min-width: 100px;
    flex: 1;
  }

  .stat-card .value {
    display: block;
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--accent-color, #3b82f6);
  }

  .stat-card .label {
    display: block;
    font-size: 0.7rem;
    color: var(--text-secondary, #888);
    text-transform: uppercase;
    margin-top: 0.25rem;
  }

  .role-breakdown h3,
  .swarm-task h3,
  .topology-viz h3 {
    font-size: 0.9rem;
    margin: 0 0 0.75rem;
    color: var(--text-primary, #fff);
  }

  .roles {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .role-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    color: white;
    text-transform: capitalize;
  }

  .swarm-task {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color, #333);
  }

  .task-input {
    display: flex;
    gap: 0.5rem;
  }

  .task-input input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    background: var(--bg-tertiary, #252525);
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 0.875rem;
  }

  .task-input button {
    padding: 0.5rem 1rem;
    background: var(--accent-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .task-input button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .task-result {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--bg-tertiary, #252525);
    border-radius: 6px;
  }

  .task-result .status {
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .status-processing {
    color: #f59e0b;
  }
  .status-completed {
    color: #10b981;
  }
  .status-failed {
    color: #ef4444;
  }

  .task-result pre {
    font-size: 0.8rem;
    white-space: pre-wrap;
    color: var(--text-primary, #fff);
    margin: 0;
    line-height: 1.5;
  }

  .topology-viz {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color, #333);
  }

  .topology-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
    gap: 0.5rem;
  }

  .agent-node {
    width: 50px;
    height: 50px;
    border: 2px solid;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary, #252525);
    position: relative;
  }

  .agent-node .role {
    font-size: 0.65rem;
    text-transform: uppercase;
    color: var(--text-secondary, #888);
  }

  .agent-node .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #333;
    margin-top: 4px;
  }

  .agent-node .status-dot.active {
    background: #10b981;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .cache-stats,
  .top-topics {
    margin-top: 1.5rem;
  }

  .cache-stats h3,
  .top-topics h3 {
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
    color: var(--text-primary, #fff);
  }

  .cache-info {
    display: flex;
    gap: 1.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary, #888);
  }

  .topics {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .topic-badge {
    padding: 0.25rem 0.5rem;
    background: var(--bg-tertiary, #252525);
    border-radius: 4px;
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
  }

  .user-model {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color, #333);
  }

  .user-model h3 {
    display: inline;
    font-size: 1rem;
    color: var(--text-primary, #fff);
  }

  .user-model .version {
    margin-left: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
  }

  .summary,
  .style-profile,
  .patterns {
    margin-top: 1rem;
  }

  .summary h4,
  .style-profile h4,
  .patterns h4 {
    font-size: 0.85rem;
    margin-bottom: 0.5rem;
    color: var(--text-secondary, #888);
  }

  .summary p {
    font-size: 0.875rem;
    color: var(--text-primary, #fff);
    line-height: 1.5;
  }

  .style-bars {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .style-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .style-bar .label {
    width: 80px;
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
  }

  .style-bar .bar {
    flex: 1;
    height: 8px;
    background: var(--bg-tertiary, #252525);
    border-radius: 4px;
    overflow: hidden;
  }

  .style-bar .fill {
    height: 100%;
    background: var(--accent-color, #3b82f6);
    transition: width 0.3s;
  }

  .style-bar .value {
    width: 40px;
    text-align: right;
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
  }

  .pattern-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .pattern-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-tertiary, #252525);
    border-radius: 6px;
    font-size: 0.8rem;
  }

  .pattern-item .type {
    padding: 0.125rem 0.5rem;
    background: var(--accent-color, #3b82f6);
    color: white;
    border-radius: 4px;
    font-size: 0.7rem;
    text-transform: uppercase;
  }

  .pattern-item .text {
    flex: 1;
    color: var(--text-primary, #fff);
  }

  .pattern-item .confidence {
    color: var(--text-secondary, #888);
  }

  /* ========== Supervised Swarm Styles ========== */

  .supervised-stats {
    margin-bottom: 1.5rem;
  }

  .supervised-topology {
    margin: 1.5rem 0;
    padding: 1.5rem;
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    background: var(--bg-tertiary, #252525);
  }

  .supervised-topology h3 {
    font-size: 0.9rem;
    margin: 0 0 1rem;
    color: var(--text-primary, #fff);
    text-align: center;
  }

  .hub-spoke-viz {
    position: relative;
    width: 100%;
    max-width: 400px;
    height: 300px;
    margin: 0 auto;
  }

  .kimi-supervisor {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
    z-index: 10;
    border: 3px solid #a78bfa;
  }

  .kimi-supervisor.active {
    animation: kimiBreathe 2s ease-in-out infinite;
  }

  @keyframes kimiBreathe {
    0%,
    100% {
      box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
    }
    50% {
      box-shadow: 0 0 35px rgba(139, 92, 246, 0.6);
    }
  }

  .kimi-icon {
    font-size: 1.5rem;
    font-weight: bold;
    color: white;
  }

  .kimi-label {
    font-size: 0.7rem;
    font-weight: bold;
    color: white;
    text-transform: uppercase;
  }

  .kimi-role {
    font-size: 0.6rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .agents-ring {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .supervised-agent {
    position: absolute;
    width: 45px;
    height: 45px;
    border-radius: 50%;
    background: var(--bg-secondary, #1a1a1a);
    border: 2px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translate(-50%, -50%);
    z-index: 5;
    transition: all 0.3s;
  }

  .supervised-agent.working {
    animation: agentWorking 1s ease-in-out infinite;
  }

  .supervised-agent.approved {
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
  }

  .supervised-agent.rejected {
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
  }

  @keyframes agentWorking {
    0%,
    100% {
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      transform: translate(-50%, -50%) scale(1.1);
    }
  }

  .supervised-agent .agent-role {
    font-size: 0.6rem;
    text-transform: uppercase;
    color: var(--text-secondary, #888);
    font-weight: bold;
  }

  .supervised-agent .agent-line {
    position: absolute;
    height: 1px;
    background: var(--border-color, #333);
    left: 50%;
  }

  .supervised-task {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color, #333);
  }

  .supervised-task h3 {
    font-size: 0.9rem;
    margin: 0 0 0.75rem;
    color: var(--text-primary, #fff);
  }

  .task-progress {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--bg-tertiary, #252525);
    border-radius: 6px;
  }

  .task-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .task-id {
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
    font-family: monospace;
  }

  .task-status {
    font-size: 0.8rem;
    font-weight: bold;
    text-transform: uppercase;
  }

  .task-plan {
    margin-bottom: 1rem;
    padding: 0.75rem;
    background: var(--bg-secondary, #1a1a1a);
    border-radius: 4px;
  }

  .task-plan h4 {
    font-size: 0.8rem;
    margin: 0 0 0.5rem;
    color: var(--accent-color, #8b5cf6);
  }

  .plan-summary {
    font-size: 0.8rem;
    color: var(--text-primary, #fff);
    margin: 0 0 0.5rem;
    line-height: 1.4;
  }

  .complexity {
    font-size: 0.7rem;
    color: var(--text-secondary, #888);
  }

  .subtasks-list {
    margin-bottom: 1rem;
  }

  .subtasks-list h4 {
    font-size: 0.8rem;
    margin: 0 0 0.75rem;
    color: var(--text-primary, #fff);
  }

  .subtask-item {
    padding: 0.75rem;
    background: var(--bg-secondary, #1a1a1a);
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }

  .subtask-header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .subtask-role {
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-size: 0.65rem;
    color: white;
    text-transform: uppercase;
    font-weight: bold;
  }

  .subtask-status {
    font-size: 0.7rem;
    font-weight: bold;
  }

  .subtask-attempts {
    font-size: 0.65rem;
    color: var(--text-secondary, #888);
    margin-left: auto;
  }

  .subtask-instruction {
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
    margin: 0;
    line-height: 1.4;
  }

  .review-box {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-tertiary, #252525);
    border-radius: 4px;
    border-left: 3px solid var(--border-color, #333);
  }

  .review-box.approved {
    border-left-color: #10b981;
    background: rgba(16, 185, 129, 0.1);
  }

  .review-box.rejected {
    border-left-color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .review-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .review-decision {
    font-size: 0.7rem;
    font-weight: bold;
    text-transform: uppercase;
  }

  .review-score {
    font-size: 0.7rem;
    color: var(--text-secondary, #888);
  }

  .review-feedback {
    font-size: 0.75rem;
    color: var(--text-primary, #fff);
    margin: 0;
    line-height: 1.4;
  }

  .review-issues {
    margin-top: 0.5rem;
    font-size: 0.7rem;
    color: #ef4444;
  }

  .review-issues ul {
    margin: 0.25rem 0 0 1rem;
    padding: 0;
  }

  .review-issues li {
    margin-bottom: 0.25rem;
  }

  .final-result {
    margin-top: 1rem;
    padding: 1rem;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%);
    border: 1px solid #8b5cf6;
    border-radius: 6px;
  }

  .final-result h4 {
    font-size: 0.8rem;
    margin: 0 0 0.75rem;
    color: #a78bfa;
  }

  .final-result pre {
    font-size: 0.8rem;
    white-space: pre-wrap;
    color: var(--text-primary, #fff);
    margin: 0;
    line-height: 1.5;
  }

  .events-log {
    margin-top: 1rem;
  }

  .events-log summary {
    cursor: pointer;
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
    padding: 0.5rem;
    background: var(--bg-secondary, #1a1a1a);
    border-radius: 4px;
  }

  .events-log summary:hover {
    color: var(--text-primary, #fff);
  }

  .events-list {
    margin-top: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .event-item {
    display: flex;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.65rem;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .event-time {
    color: var(--text-secondary, #888);
    min-width: 70px;
  }

  .event-type {
    color: var(--accent-color, #3b82f6);
    min-width: 120px;
  }

  .event-actor {
    color: #8b5cf6;
    min-width: 80px;
  }

  .event-details {
    color: var(--text-primary, #fff);
    flex: 1;
  }
</style>
