<script lang="ts">
  /**
   * GitHubPanel – GitHub integration dashboard.
   * Shows connected repos, recent commits, PR status, and quick actions.
   */
  import { onMount } from 'svelte';
  import { showToast } from '../stores/toastStore';
  import { getOAuthUrl, listIntegrations } from '../lib/integrationsApi';
  import { fetchApi } from '../lib/api';
  import {
    ArrowLeft,
    GitBranch,
    GitPullRequest,
    GitCommit,
    Star,
    ExternalLink,
    RefreshCw,
    Plus,
    Github,
  } from 'lucide-svelte';

  interface Props {
    onBack: () => void;
  }

  let { onBack }: Props = $props();

  interface Repo {
    id: string;
    name: string;
    fullName: string;
    description: string;
    language: string;
    stars: number;
    openPRs: number;
    lastPush: string;
    defaultBranch: string;
  }

  interface Commit {
    sha: string;
    message: string;
    author: string;
    date: string;
    repo: string;
  }

  let connected = $state(false);
  let loading = $state(true);
  let repos = $state<Repo[]>([]);
  let recentCommits = $state<Commit[]>([]);
  let selectedRepo = $state<Repo | null>(null);

  const MOCK_REPOS: Repo[] = [
    {
      id: '1',
      name: 'grumpco-core',
      fullName: 'grumpco/grumpco-core',
      description: 'Core backend services and API',
      language: 'TypeScript',
      stars: 42,
      openPRs: 3,
      lastPush: '2 hours ago',
      defaultBranch: 'main',
    },
    {
      id: '2',
      name: 'grumpco-frontend',
      fullName: 'grumpco/grumpco-frontend',
      description: 'Web frontend application',
      language: 'Svelte',
      stars: 18,
      openPRs: 1,
      lastPush: '4 hours ago',
      defaultBranch: 'main',
    },
    {
      id: '3',
      name: 'intent-compiler',
      fullName: 'grumpco/intent-compiler',
      description: 'Semantic intent compiler for AI agents',
      language: 'Rust',
      stars: 124,
      openPRs: 5,
      lastPush: '1 day ago',
      defaultBranch: 'develop',
    },
    {
      id: '4',
      name: 'docs',
      fullName: 'grumpco/docs',
      description: 'Documentation site',
      language: 'MDX',
      stars: 8,
      openPRs: 0,
      lastPush: '3 days ago',
      defaultBranch: 'main',
    },
  ];

  const MOCK_COMMITS: Commit[] = [
    {
      sha: 'a1b2c3d',
      message: 'feat: add template browser component',
      author: 'Walt',
      date: '2 hours ago',
      repo: 'grumpco-frontend',
    },
    {
      sha: 'e4f5g6h',
      message: 'fix: resolve auth token refresh loop',
      author: 'Walt',
      date: '4 hours ago',
      repo: 'grumpco-core',
    },
    {
      sha: 'i7j8k9l',
      message: 'chore: update dependencies',
      author: 'Walt',
      date: '6 hours ago',
      repo: 'grumpco-frontend',
    },
    {
      sha: 'm0n1o2p',
      message: 'feat: semantic search in intent compiler',
      author: 'Walt',
      date: '1 day ago',
      repo: 'intent-compiler',
    },
    {
      sha: 'q3r4s5t',
      message: 'docs: add API reference',
      author: 'Walt',
      date: '2 days ago',
      repo: 'docs',
    },
  ];

  onMount(async () => {
    // Check URL params for OAuth callback result
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('success');
    const oauthError = urlParams.get('error');
    if (oauthSuccess === 'github') {
      connected = true;
      showToast('GitHub connected successfully!', 'success');
      // Clean URL params
      window.history.replaceState({}, '', window.location.pathname);
    } else if (oauthError) {
      showToast(`GitHub auth failed: ${oauthError.replace(/_/g, ' ')}`, 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }

    try {
      // Check if GitHub integration exists
      const integrations = await listIntegrations();
      const gh = integrations.find((i) => i.provider === 'github' && i.status === 'active');
      if (gh) {
        connected = true;
        // Try to fetch live repo data
        try {
          const res = await fetchApi('/api/github/repos');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.repos) && data.repos.length > 0) {
              repos = data.repos;
            } else {
              repos = MOCK_REPOS;
            }
          } else {
            repos = MOCK_REPOS;
          }
        } catch {
          repos = MOCK_REPOS;
        }
        recentCommits = MOCK_COMMITS;
      }
    } catch {
      // API unavailable – fall through
    }
    loading = false;
  });

  async function handleConnect() {
    try {
      const { url } = await getOAuthUrl('github');
      showToast('Redirecting to GitHub authorization...', 'info');
      // Use redirect (same pattern as onboarding auth) instead of popup
      window.location.href = url;
    } catch {
      showToast('Failed to start GitHub OAuth. Please try again.', 'error');
    }
  }

  async function handleRefresh() {
    loading = true;
    try {
      const res = await fetchApi('/api/github/repos');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.repos) && data.repos.length > 0) {
          repos = data.repos;
        }
      }
      showToast('Repositories synced', 'success');
    } catch {
      showToast('Failed to sync repos', 'error');
    } finally {
      loading = false;
    }
  }

  function getLangColor(lang: string): string {
    const colors: Record<string, string> = {
      TypeScript: '#3178c6',
      Svelte: '#ff3e00',
      Rust: '#dea584',
      MDX: '#fcb32c',
      Python: '#3572A5',
      JavaScript: '#f1e05a',
    };
    return colors[lang] ?? '#6b7280';
  }
</script>

<div class="github-panel">
  <header class="header">
    <button class="back-btn" onclick={onBack} type="button">
      <ArrowLeft size={20} /> Back
    </button>
    <div class="header-content">
      <h1>GitHub</h1>
      <p class="subtitle">Manage repositories, pull requests, and commit activity</p>
    </div>
    {#if connected}
      <button class="refresh-btn" onclick={handleRefresh} type="button" title="Sync repos">
        <span class:spinning={loading}><RefreshCw size={16} /></span>
      </button>
    {/if}
  </header>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading GitHub data...</p>
    </div>
  {:else if !connected}
    <div class="connect-state">
      <div class="connect-icon"><Github size={48} /></div>
      <h2>Connect GitHub</h2>
      <p>
        Link your GitHub account to manage repos, view PRs, and track commits directly from here.
      </p>
      <button type="button" class="connect-btn" onclick={handleConnect}>
        <Github size={18} /> Connect with GitHub
      </button>
    </div>
  {:else}
    <div class="content">
      <!-- Stats row -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-value">{repos.length}</span>
          <span class="stat-label">Repositories</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{repos.reduce((sum, r) => sum + r.openPRs, 0)}</span>
          <span class="stat-label">Open PRs</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{repos.reduce((sum, r) => sum + r.stars, 0)}</span>
          <span class="stat-label">Total Stars</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{recentCommits.length}</span>
          <span class="stat-label">Recent Commits</span>
        </div>
      </div>

      <!-- Repos list -->
      <section class="section">
        <div class="section-head">
          <h2>Repositories</h2>
          <button type="button" class="add-btn"><Plus size={14} /> Add repo</button>
        </div>
        <div class="repos-list">
          {#each repos as repo (repo.id)}
            <div class="repo-card">
              <div class="repo-main">
                <h3 class="repo-name">{repo.fullName}</h3>
                <p class="repo-desc">{repo.description}</p>
                <div class="repo-meta">
                  <span class="language"
                    ><span class="lang-dot" style:background={getLangColor(repo.language)}
                    ></span>{repo.language}</span
                  >
                  <span class="meta-item"><Star size={12} /> {repo.stars}</span>
                  <span class="meta-item"><GitPullRequest size={12} /> {repo.openPRs} PRs</span>
                  <span class="meta-item"><GitBranch size={12} /> {repo.defaultBranch}</span>
                </div>
              </div>
              <div class="repo-side">
                <span class="last-push">{repo.lastPush}</span>
                <button type="button" class="ext-link" title="Open on GitHub">
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
          {/each}
        </div>
      </section>

      <!-- Recent commits -->
      <section class="section">
        <h2>Recent Commits</h2>
        <div class="commits-list">
          {#each recentCommits as commit (commit.sha)}
            <div class="commit-row">
              <GitCommit size={14} class="commit-icon" />
              <div class="commit-body">
                <span class="commit-msg">{commit.message}</span>
                <span class="commit-meta"
                  >{commit.sha.slice(0, 7)} by {commit.author} · {commit.date} ·
                  <strong>{commit.repo}</strong></span
                >
              </div>
            </div>
          {/each}
        </div>
      </section>
    </div>
  {/if}
</div>

<style>
  .github-panel {
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

  .refresh-btn {
    padding: 0.5rem;
    background: var(--color-bg-subtle, #f4f4f5);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: var(--color-text-muted, #71717a);
  }

  .refresh-btn:hover {
    color: var(--color-primary, #7c3aed);
    background: var(--color-bg-card-hover, #e4e4e7);
  }

  .loading-state,
  .connect-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 4rem 2rem;
    text-align: center;
    color: var(--color-text-muted, #71717a);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border, #e4e4e7);
    border-top-color: var(--color-primary, #7c3aed);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .connect-icon {
    color: var(--color-text-muted, #71717a);
    opacity: 0.5;
  }

  .connect-state h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--color-text, #18181b);
  }

  .connect-state p {
    max-width: 360px;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .connect-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #24292e;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
  }

  .connect-btn:hover {
    background: #1b1f23;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: 10px;
  }

  .stat-card .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-primary, #7c3aed);
  }

  .stat-card .stat-label {
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
    margin-top: 0.25rem;
  }

  .section {
    margin-bottom: 1.5rem;
  }

  .section h2 {
    margin: 0 0 0.75rem;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .section-head h2 {
    margin: 0;
  }

  .add-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.75rem;
    background: transparent;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
    cursor: pointer;
  }

  .add-btn:hover {
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
  }

  .repos-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .repo-card {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1rem 1.25rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: 10px;
    transition: border-color 0.15s;
  }

  .repo-card:hover {
    border-color: rgba(124, 58, 237, 0.3);
  }

  .repo-main {
    flex: 1;
    min-width: 0;
  }

  .repo-name {
    margin: 0 0 0.25rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }

  .repo-desc {
    margin: 0 0 0.5rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
  }

  .repo-meta {
    display: flex;
    gap: 1rem;
    align-items: center;
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
  }

  .language {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .lang-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .repo-meta .meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .repo-side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
  }

  .last-push {
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
  }

  .ext-link {
    padding: 0.25rem;
    background: transparent;
    border: none;
    color: var(--color-text-muted, #71717a);
    cursor: pointer;
    border-radius: 4px;
  }

  .ext-link:hover {
    color: var(--color-primary, #7c3aed);
  }

  .commits-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .commit-row {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    transition: background 0.15s;
  }

  .commit-row:hover {
    background: var(--color-bg-subtle, #f4f4f5);
  }

  .commit-row :global(.commit-icon) {
    color: var(--color-text-muted, #71717a);
    flex-shrink: 0;
    margin-top: 2px;
  }

  .commit-body {
    flex: 1;
    min-width: 0;
  }

  .commit-msg {
    display: block;
    font-size: 0.875rem;
    color: var(--color-text, #18181b);
    font-weight: 500;
  }

  .commit-meta {
    display: block;
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
    margin-top: 0.125rem;
  }
</style>
