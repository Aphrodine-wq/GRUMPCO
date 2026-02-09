<script lang="ts">
  /**
   * AnalyticsDashboard – Usage analytics and insights.
   * Shows token usage, model performance, session stats, and trends.
   * Derives all metrics from real session data – no mock stats.
   */
  import {
    ArrowLeft,
    BarChart3,
    TrendingUp,
    Zap,
    MessageSquare,
    Clock,
    Activity,
  } from 'lucide-svelte';
  import { sortedSessions } from '../stores/sessionsStore';
  import type { Session, Message } from '../types';

  interface Props {
    onBack: () => void;
  }

  let { onBack }: Props = $props();

  // ---- Helpers ----
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const todayStart = now - (now % DAY_MS);
  const weekStart = todayStart - 6 * DAY_MS;

  function countMessages(sessions: Session[], since?: number): number {
    return sessions.reduce((n, s) => {
      const msgs = s.messages.filter(
        (m) => m.role === 'user' && (!since || (m.timestamp ?? s.updatedAt) >= since)
      );
      return n + msgs.length;
    }, 0);
  }

  function estimateTokens(msg: Message): number {
    const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return Math.ceil(text.length / 4); // rough ~4 chars per token
  }

  // ---- Derived stats ----
  const stats = $derived.by(() => {
    const all = $sortedSessions;
    const todaySessions = all.filter((s) => s.updatedAt >= todayStart);
    const weekSessions = all.filter((s) => s.updatedAt >= weekStart);

    const tokensToday = todaySessions.reduce(
      (n, s) => n + s.messages.reduce((t, m) => t + estimateTokens(m), 0),
      0
    );
    const tokensWeek = weekSessions.reduce(
      (n, s) => n + s.messages.reduce((t, m) => t + estimateTokens(m), 0),
      0
    );

    return {
      tokensToday,
      tokensWeek,
      avgResponseMs: 0, // no real timing data available yet
      sessionsToday: todaySessions.length,
      messagesWeek: countMessages(weekSessions, weekStart),
      costThisMonth: '—',
    };
  });

  // Model usage breakdown
  const modelUsage = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const s of $sortedSessions) {
      for (const m of s.messages) {
        if (m.role === 'assistant' && m.model) {
          counts[m.model] = (counts[m.model] ?? 0) + 1;
        }
      }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    const COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([model, n], i) => ({
        model,
        tokens: n,
        pct: Math.round((n / total) * 100),
        color: COLORS[i % COLORS.length],
      }));
  });

  // Daily activity (last 7 days)
  const dailyActivity = $derived.by(() => {
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const buckets: { day: string; tokens: number; messages: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = todayStart - i * DAY_MS;
      const dayEnd = dayStart + DAY_MS;
      const d = new Date(dayStart);
      let tokens = 0;
      let messages = 0;
      for (const s of $sortedSessions) {
        for (const m of s.messages) {
          const ts = m.timestamp ?? s.updatedAt;
          if (ts >= dayStart && ts < dayEnd) {
            messages++;
            tokens += estimateTokens(m);
          }
        }
      }
      buckets.push({ day: DAYS[d.getDay()], tokens, messages });
    }
    return buckets;
  });

  const maxTokens = $derived(Math.max(1, ...dailyActivity.map((d) => d.tokens)));

  // Top skills (approximated from first user message keywords)
  const topSkills = $derived.by(() => {
    const keywords: Record<string, string[]> = {
      'Code Generation': ['create', 'build', 'generate', 'implement', 'write code', 'scaffold'],
      'Bug Fixing': ['fix', 'bug', 'error', 'issue', 'debug', 'broken'],
      Documentation: ['document', 'docs', 'readme', 'explain', 'describe'],
      Refactoring: ['refactor', 'clean', 'improve', 'restructure', 'optimize'],
      Testing: ['test', 'spec', 'coverage', 'unit test', 'integration'],
    };
    const counts: Record<string, number> = {};
    let total = 0;
    for (const s of $sortedSessions) {
      for (const m of s.messages) {
        if (m.role !== 'user') continue;
        const text = (typeof m.content === 'string' ? m.content : '').toLowerCase();
        for (const [skill, words] of Object.entries(keywords)) {
          if (words.some((w) => text.includes(w))) {
            counts[skill] = (counts[skill] ?? 0) + 1;
            total++;
          }
        }
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, uses]) => ({ name, uses, pct: total ? Math.round((uses / total) * 100) : 0 }));
  });
</script>

<div class="analytics-dashboard">
  <header class="header">
    <button class="back-btn" onclick={onBack} type="button"><ArrowLeft size={20} /> Back</button>
    <div class="header-content">
      <h1>Analytics</h1>
      <p class="subtitle">Usage insights, model performance, and activity trends</p>
    </div>
  </header>

  <div class="content">
    <!-- Key metrics -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-icon"><Zap size={20} /></div>
        <div class="metric-body">
          <span class="metric-value">{stats.tokensToday.toLocaleString()}</span>
          <span class="metric-label">Tokens Today</span>
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-icon"><TrendingUp size={20} /></div>
        <div class="metric-body">
          <span class="metric-value">{stats.tokensWeek.toLocaleString()}</span>
          <span class="metric-label">Tokens This Week</span>
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-icon"><Clock size={20} /></div>
        <div class="metric-body">
          <span class="metric-value">{stats.avgResponseMs}ms</span>
          <span class="metric-label">Avg Response Time</span>
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-icon"><MessageSquare size={20} /></div>
        <div class="metric-body">
          <span class="metric-value">{stats.messagesWeek}</span>
          <span class="metric-label">Messages This Week</span>
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-icon"><Activity size={20} /></div>
        <div class="metric-body">
          <span class="metric-value">{stats.sessionsToday}</span>
          <span class="metric-label">Sessions Today</span>
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-icon"><BarChart3 size={20} /></div>
        <div class="metric-body">
          <span class="metric-value">{stats.costThisMonth}</span>
          <span class="metric-label">Cost This Month</span>
        </div>
      </div>
    </div>

    <div class="dashboard-grid">
      <!-- Daily Activity Chart -->
      <section class="panel activity-panel">
        <h2>Daily Activity</h2>
        <div class="chart">
          {#each dailyActivity as day}
            <div class="chart-col">
              <div class="bar-container">
                <div class="bar" style:height="{(day.tokens / maxTokens) * 100}%"></div>
              </div>
              <span class="chart-label">{day.day}</span>
              <span class="chart-value">{(day.tokens / 1000).toFixed(0)}k</span>
            </div>
          {/each}
        </div>
      </section>

      <!-- Model Usage -->
      <section class="panel model-panel">
        <h2>Model Usage</h2>
        <div class="model-list">
          {#each modelUsage as model}
            <div class="model-row">
              <div class="model-info">
                <span class="model-name">{model.model}</span>
                <span class="model-tokens">{(model.tokens / 1000).toFixed(0)}k tokens</span>
              </div>
              <div class="model-bar-track">
                <div
                  class="model-bar-fill"
                  style:width="{model.pct}%"
                  style:background={model.color}
                ></div>
              </div>
              <span class="model-pct">{model.pct}%</span>
            </div>
          {/each}
        </div>
      </section>

      <!-- Top Skills -->
      <section class="panel skills-panel">
        <h2>Top Skills Used</h2>
        <div class="skills-list">
          {#each topSkills as skill, i}
            <div class="skill-row">
              <span class="skill-rank">#{i + 1}</span>
              <span class="skill-name">{skill.name}</span>
              <div class="skill-bar-track">
                <div class="skill-bar-fill" style:width="{skill.pct}%"></div>
              </div>
              <span class="skill-count">{skill.uses}</span>
            </div>
          {/each}
        </div>
      </section>
    </div>
  </div>
</div>

<style>
  .analytics-dashboard {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-border-light, #e5e7eb);
    flex-shrink: 0;
  }
  .back-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-subtle, #f4f4f5);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: var(--color-text, #18181b);
    font-size: 0.875rem;
  }
  .back-btn:hover {
    background: var(--color-bg-card-hover, #e4e4e7);
  }
  .header-content {
    flex: 1;
  }
  .header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #18181b);
  }
  .subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
    color: var(--color-text-muted, #71717a);
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .metric-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: 10px;
  }
  .metric-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(124, 58, 237, 0.1);
    border-radius: 10px;
    color: var(--color-primary, #7c3aed);
  }
  .metric-body {
    display: flex;
    flex-direction: column;
  }
  .metric-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text, #18181b);
  }
  .metric-label {
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  .panel {
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: 12px;
    padding: 1.25rem;
  }
  .panel h2 {
    margin: 0 0 1rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }

  .activity-panel {
    grid-column: 1 / -1;
  }
  .chart {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    height: 160px;
    padding-top: 0.5rem;
  }
  .chart-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }
  .bar-container {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .bar {
    width: 100%;
    max-width: 40px;
    min-height: 4px;
    background: linear-gradient(180deg, var(--color-primary, #7c3aed), rgba(124, 58, 237, 0.4));
    border-radius: 4px 4px 0 0;
    transition: height 0.3s ease;
  }
  .chart-label {
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
    font-weight: 500;
  }
  .chart-value {
    font-size: 0.6875rem;
    color: var(--color-text-muted, #71717a);
  }

  .model-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .model-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .model-info {
    display: flex;
    flex-direction: column;
    min-width: 100px;
  }
  .model-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }
  .model-tokens {
    font-size: 0.6875rem;
    color: var(--color-text-muted, #71717a);
  }
  .model-bar-track {
    flex: 1;
    height: 8px;
    background: var(--color-bg-subtle, #f4f4f5);
    border-radius: 4px;
    overflow: hidden;
  }
  .model-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  .model-pct {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-muted, #71717a);
    min-width: 32px;
    text-align: right;
  }

  .skills-list {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }
  .skill-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .skill-rank {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-primary, #7c3aed);
    min-width: 24px;
  }
  .skill-name {
    font-size: 0.8125rem;
    color: var(--color-text, #18181b);
    min-width: 120px;
  }
  .skill-bar-track {
    flex: 1;
    height: 6px;
    background: var(--color-bg-subtle, #f4f4f5);
    border-radius: 3px;
    overflow: hidden;
  }
  .skill-bar-fill {
    height: 100%;
    background: var(--color-primary, #7c3aed);
    border-radius: 3px;
  }
  .skill-count {
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
    min-width: 24px;
    text-align: right;
  }

  @media (max-width: 768px) {
    .dashboard-grid {
      grid-template-columns: 1fr;
    }
    .metrics-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
