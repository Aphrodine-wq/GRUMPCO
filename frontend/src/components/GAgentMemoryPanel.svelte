<script lang="ts">
  /**
   * GAgentMemoryPanel - Shows G-Agent's memory (patterns, skills, learnings)
   * Displays what the agent has learned and can apply
   */
  import { onMount } from 'svelte';
  import {
    Brain,
    Clipboard,
    Zap,
    BookOpen,
    Search,
    Clock,
    CheckCircle,
    Sparkles,
  } from 'lucide-svelte';

  interface Pattern {
    id: string;
    name: string;
    description: string;
    category: string;
    confidence: number;
    successCount: number;
    avgDurationMs: number;
    tags: string[];
  }

  interface Skill {
    id: string;
    name: string;
    description: string;
    category: string;
    successRate: number;
    usageCount: number;
  }

  interface LexiconEntry {
    id: string;
    term: string;
    definition: string;
    category: string;
  }

  interface MemoryStats {
    patterns: number;
    skills: number;
    lexicon: number;
    contexts: number;
  }

  interface Props {
    onPatternSelect?: (pattern: Pattern) => void;
    compact?: boolean;
  }

  let { onPatternSelect, compact = false }: Props = $props();

  let loading = $state(true);
  let activeTab = $state<'patterns' | 'skills' | 'lexicon'>('patterns');
  let stats = $state<MemoryStats>({ patterns: 0, skills: 0, lexicon: 0, contexts: 0 });
  let patterns = $state<Pattern[]>([]);
  let skills = $state<Skill[]>([]);
  let lexicon = $state<LexiconEntry[]>([]);
  let searchQuery = $state('');
  let showLearned = $state(false);
  let newlyLearned = $state<string[]>([]); // IDs of newly learned items

  const API_BASE = '/api/memory/gagent';

  async function fetchStats() {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      if (res.ok) {
        stats = await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch memory stats:', e);
    }
  }

  async function fetchPatterns() {
    try {
      const res = await fetch(`${API_BASE}/patterns`);
      if (res.ok) {
        const data = await res.json();
        patterns = data.patterns || [];
      }
    } catch (e) {
      console.error('Failed to fetch patterns:', e);
    }
  }

  async function fetchSkills() {
    try {
      const res = await fetch(`${API_BASE}/skills`);
      if (res.ok) {
        const data = await res.json();
        skills = data.skills || [];
      }
    } catch (e) {
      console.error('Failed to fetch skills:', e);
    }
  }

  async function fetchLexicon() {
    try {
      const res = await fetch(`${API_BASE}/lexicon`);
      if (res.ok) {
        const data = await res.json();
        lexicon = data.entries || [];
      }
    } catch (e) {
      console.error('Failed to fetch lexicon:', e);
    }
  }

  async function searchAll() {
    if (!searchQuery.trim()) {
      await fetchPatterns();
      await fetchSkills();
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, limit: 10 }),
      });
      if (res.ok) {
        const data = await res.json();
        patterns = data.patterns || [];
        skills = data.skills || [];
        lexicon = data.lexicon || [];
      }
    } catch (e) {
      console.error('Search failed:', e);
    }
  }

  // Called when a new pattern is learned (from parent component)
  export function notifyPatternLearned(patternId: string) {
    newlyLearned = [...newlyLearned, patternId];
    showLearned = true;
    fetchPatterns();
    fetchStats();

    // Hide the "new" badge after 10 seconds
    setTimeout(() => {
      newlyLearned = newlyLearned.filter((id) => id !== patternId);
      if (newlyLearned.length === 0) showLearned = false;
    }, 10000);
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return '#10b981';
    if (confidence >= 0.5) return '#f59e0b';
    return '#ef4444';
  }

  function getSuccessRateColor(rate: number): string {
    if (rate >= 0.9) return '#10b981';
    if (rate >= 0.7) return '#f59e0b';
    return '#ef4444';
  }

  onMount(async () => {
    loading = true;
    await Promise.all([fetchStats(), fetchPatterns(), fetchSkills(), fetchLexicon()]);
    loading = false;
  });
</script>

<div class="memory-panel" class:compact>
  <div class="panel-header">
    <div class="header-left">
      <span class="panel-icon">
        <Brain size={24} />
      </span>
      <h3>G-Agent Memory</h3>
      {#if showLearned}
        <span class="new-badge">NEW</span>
      {/if}
    </div>

    <div class="stats-row">
      <span class="stat" title="Learned patterns">
        <span class="stat-icon"><Clipboard size={14} /></span>
        {stats.patterns}
      </span>
      <span class="stat" title="Learned skills">
        <span class="stat-icon"><Zap size={14} /></span>
        {stats.skills}
      </span>
      <span class="stat" title="Lexicon entries">
        <span class="stat-icon"><BookOpen size={14} /></span>
        {stats.lexicon}
      </span>
    </div>
  </div>

  <div class="search-bar">
    <input
      type="text"
      placeholder="Search memories..."
      bind:value={searchQuery}
      onkeyup={(e) => e.key === 'Enter' && searchAll()}
    />
    <button onclick={searchAll}><Search size={16} /></button>
  </div>

  <div class="tabs">
    <button class:active={activeTab === 'patterns'} onclick={() => (activeTab = 'patterns')}>
      Patterns ({patterns.length})
    </button>
    <button class:active={activeTab === 'skills'} onclick={() => (activeTab = 'skills')}>
      Skills ({skills.length})
    </button>
    <button class:active={activeTab === 'lexicon'} onclick={() => (activeTab = 'lexicon')}>
      Lexicon ({lexicon.length})
    </button>
  </div>

  <div class="content">
    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading memories...</p>
      </div>
    {:else if activeTab === 'patterns'}
      {#if patterns.length === 0}
        <div class="empty-state">
          <span class="empty-icon"><Clipboard size={48} /></span>
          <p>No patterns learned yet</p>
          <p class="hint">Complete tasks to build patterns</p>
        </div>
      {:else}
        <div class="patterns-list">
          {#each patterns as pattern}
            <div
              class="pattern-card"
              class:new={newlyLearned.includes(pattern.id)}
              role="button"
              tabindex="0"
              onclick={() => onPatternSelect?.(pattern)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPatternSelect?.(pattern);
                }
              }}
            >
              <div class="pattern-header">
                <span class="pattern-name">{pattern.name}</span>
                <span
                  class="confidence-badge"
                  style="background: {getConfidenceColor(
                    pattern.confidence
                  )}20; color: {getConfidenceColor(pattern.confidence)}"
                >
                  {Math.round(pattern.confidence * 100)}%
                </span>
                {#if newlyLearned.includes(pattern.id)}
                  <span class="new-indicator"><Sparkles size={12} /> Just learned!</span>
                {/if}
              </div>
              <p class="pattern-description">{pattern.description}</p>
              <div class="pattern-meta">
                <span class="meta-item" title="Success count">
                  <CheckCircle size={12} />
                  {pattern.successCount}
                </span>
                <span class="meta-item" title="Average duration">
                  <Clock size={12} />
                  {formatDuration(pattern.avgDurationMs)}
                </span>
                <span class="meta-item category">{pattern.category}</span>
              </div>
              {#if pattern.tags.length > 0}
                <div class="tags">
                  {#each pattern.tags.slice(0, 3) as tag}
                    <span class="tag">{tag}</span>
                  {/each}
                  {#if pattern.tags.length > 3}
                    <span class="tag more">+{pattern.tags.length - 3}</span>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {:else if activeTab === 'skills'}
      {#if skills.length === 0}
        <div class="empty-state">
          <span class="empty-icon"><Zap size={48} /></span>
          <p>No skills learned yet</p>
          <p class="hint">Skills are extracted from successful patterns</p>
        </div>
      {:else}
        <div class="skills-list">
          {#each skills as skill}
            <div class="skill-card">
              <div class="skill-header">
                <span class="skill-name">{skill.name}</span>
                <span
                  class="success-badge"
                  style="background: {getSuccessRateColor(
                    skill.successRate
                  )}20; color: {getSuccessRateColor(skill.successRate)}"
                >
                  {Math.round(skill.successRate * 100)}%
                </span>
              </div>
              <p class="skill-description">{skill.description}</p>
              <div class="skill-meta">
                <span class="meta-item">Used {skill.usageCount}x</span>
                <span class="meta-item category">{skill.category}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {:else if activeTab === 'lexicon'}
      {#if lexicon.length === 0}
        <div class="empty-state">
          <span class="empty-icon"><BookOpen size={48} /></span>
          <p>Lexicon is empty</p>
          <p class="hint">Domain terms will be learned over time</p>
        </div>
      {:else}
        <div class="lexicon-list">
          {#each lexicon as entry}
            <div class="lexicon-card">
              <div class="lexicon-header">
                <span class="term">{entry.term}</span>
                <span class="category">{entry.category}</span>
              </div>
              <p class="definition">{entry.definition}</p>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .memory-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%);
    border-radius: 12px;
    overflow: hidden;
  }

  .memory-panel.compact {
    font-size: 12px;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(139, 92, 246, 0.2);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .panel-icon {
    font-size: 24px;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #e0e0ff;
    background: linear-gradient(90deg, #a78bfa, #818cf8);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .new-badge {
    padding: 2px 8px;
    background: linear-gradient(135deg, #10b981, #3b82f6);
    color: white;
    font-size: 10px;
    font-weight: 700;
    border-radius: 4px;
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%,
    100% {
      box-shadow: 0 0 5px rgba(16, 185, 129, 0.5);
    }
    50% {
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.8);
    }
  }

  .stats-row {
    display: flex;
    gap: 16px;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #a0a0ff;
    font-size: 13px;
    cursor: help;
  }

  .stat-icon {
    font-size: 14px;
  }

  .search-bar {
    display: flex;
    padding: 12px 16px;
    gap: 8px;
    border-bottom: 1px solid rgba(139, 92, 246, 0.1);
  }

  .search-bar input {
    flex: 1;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 6px;
    color: #e0e0ff;
    font-size: 13px;
  }

  .search-bar input::placeholder {
    color: #666;
  }

  .search-bar input:focus {
    outline: none;
    border-color: #8b5cf6;
  }

  .search-bar button {
    padding: 8px 12px;
    background: rgba(139, 92, 246, 0.2);
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .search-bar button:hover {
    background: rgba(139, 92, 246, 0.3);
  }

  .tabs {
    display: flex;
    padding: 0 16px;
    gap: 4px;
    border-bottom: 1px solid rgba(139, 92, 246, 0.1);
  }

  .tabs button {
    padding: 10px 16px;
    background: transparent;
    border: none;
    color: #888;
    font-size: 12px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.2s;
  }

  .tabs button.active {
    color: #a78bfa;
    border-bottom-color: #8b5cf6;
  }

  .tabs button:hover:not(.active) {
    color: #c0c0ff;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: #666;
    gap: 12px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(139, 92, 246, 0.2);
    border-top-color: #8b5cf6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    text-align: center;
    color: #666;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
  }

  .empty-state .hint {
    margin-top: 8px;
    font-size: 12px;
    color: #555;
  }

  .patterns-list,
  .skills-list,
  .lexicon-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .pattern-card,
  .skill-card,
  .lexicon-card {
    padding: 14px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(139, 92, 246, 0.15);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .pattern-card:hover,
  .skill-card:hover {
    background: rgba(139, 92, 246, 0.1);
    border-color: rgba(139, 92, 246, 0.3);
    transform: translateY(-1px);
  }

  .pattern-card.new {
    border-color: #10b981;
    animation: new-glow 2s ease-in-out infinite;
  }

  @keyframes new-glow {
    0%,
    100% {
      box-shadow: 0 0 5px rgba(16, 185, 129, 0.3);
    }
    50% {
      box-shadow: 0 0 15px rgba(16, 185, 129, 0.5);
    }
  }

  .pattern-header,
  .skill-header,
  .lexicon-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .pattern-name,
  .skill-name {
    font-weight: 600;
    color: #e0e0ff;
    flex: 1;
  }

  .confidence-badge,
  .success-badge {
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
  }

  .new-indicator {
    font-size: 11px;
    color: #10b981;
    animation: sparkle 1.5s ease-in-out infinite;
  }

  @keyframes sparkle {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .pattern-description,
  .skill-description,
  .definition {
    margin: 0 0 10px;
    color: #a0a0c0;
    font-size: 12px;
    line-height: 1.4;
  }

  .pattern-meta,
  .skill-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 11px;
    color: #666;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .meta-item.category {
    padding: 2px 8px;
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    border-radius: 4px;
    margin-left: auto;
  }

  .tags {
    display: flex;
    gap: 6px;
    margin-top: 10px;
    flex-wrap: wrap;
  }

  .tag {
    padding: 2px 8px;
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    font-size: 10px;
    border-radius: 4px;
  }

  .tag.more {
    background: rgba(100, 100, 100, 0.2);
    color: #888;
  }

  .term {
    font-weight: 600;
    color: #e0e0ff;
  }

  .lexicon-header .category {
    padding: 2px 8px;
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    font-size: 10px;
    border-radius: 4px;
    margin-left: auto;
  }
</style>
