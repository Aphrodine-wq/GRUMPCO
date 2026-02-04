<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide, fly } from 'svelte/transition';
  import { writable, derived } from 'svelte/store';

  // Props
  interface Props {
    onBack?: () => void;
  }
  let { onBack }: Props = $props();

  // Types
  interface DockerContainer {
    id: string;
    name: string;
    image: string;
    status: 'running' | 'stopped' | 'paused' | 'restarting' | 'exited';
    ports: Array<{ host: number; container: number; protocol: string }>;
    created: string;
    state: {
      running: boolean;
      paused: boolean;
      restarting: boolean;
      health?: 'healthy' | 'unhealthy' | 'starting';
    };
    stats?: {
      cpuPercent: number;
      memoryUsage: number;
      memoryLimit: number;
      networkRx: number;
      networkTx: number;
    };
  }

  interface DockerImage {
    id: string;
    tags: string[];
    size: number;
    created: string;
  }

  interface DockerVolume {
    name: string;
    driver: string;
    mountpoint: string;
    created: string;
  }

  interface DockerNetwork {
    id: string;
    name: string;
    driver: string;
    scope: string;
    containers: string[];
  }

  // State
  const containers = writable<DockerContainer[]>([]);
  const images = writable<DockerImage[]>([]);
  const volumes = writable<DockerVolume[]>([]);
  const networks = writable<DockerNetwork[]>([]);
  const isLoading = writable(true);
  const error = writable<string | null>(null);
  const dockerAvailable = writable(true);
  const selectedTab = writable<'containers' | 'images' | 'volumes' | 'networks'>('containers');
  const selectedContainer = writable<string | null>(null);
  const logs = writable<string[]>([]);
  const isPolling = writable(false);

  // Derived
  const runningContainers = derived(containers, ($c) => $c.filter((c) => c.status === 'running'));
  const stoppedContainers = derived(containers, ($c) => $c.filter((c) => c.status !== 'running'));

  // IPC functions (will call Electron or Backend API)
  async function invokeDocker(method: string, args: unknown = {}): Promise<unknown> {
    // Priority 1: Electron IPC
    if (typeof window !== 'undefined' && 'electronAPI' in window) {
      try {
        return await (
          window as { electronAPI: { docker: (method: string, args: unknown) => Promise<unknown> } }
        ).electronAPI.docker(method, args);
      } catch (err) {
        console.error('Docker IPC error:', err);
        throw err;
      }
    }

    // Priority 2: Backend API (for browser-based access)
    try {
      return await invokeDockerViaApi(method, args);
    } catch (err) {
      console.warn('Docker API not available, using mock data:', err);
      return mockDockerCall(method, args);
    }
  }

  // Call Docker operations via backend API
  async function invokeDockerViaApi(method: string, args: unknown = {}): Promise<unknown> {
    const baseUrl = '/api/docker';

    switch (method) {
      case 'listContainers': {
        const res = await fetch(`${baseUrl}/containers`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      }
      case 'listImages': {
        const res = await fetch(`${baseUrl}/images`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      }
      case 'listVolumes': {
        const res = await fetch(`${baseUrl}/volumes`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      }
      case 'listNetworks': {
        const res = await fetch(`${baseUrl}/networks`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      }
      case 'startContainer': {
        const { id } = args as { id: string };
        const res = await fetch(`${baseUrl}/containers/${id}/start`, { method: 'POST' });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      }
      case 'stopContainer': {
        const { id } = args as { id: string };
        const res = await fetch(`${baseUrl}/containers/${id}/stop`, { method: 'POST' });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      }
      case 'restartContainer': {
        const { id } = args as { id: string };
        const res = await fetch(`${baseUrl}/containers/${id}/restart`, { method: 'POST' });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      }
      case 'removeContainer': {
        const { id } = args as { id: string };
        const res = await fetch(`${baseUrl}/containers/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      }
      case 'removeImage': {
        const { id } = args as { id: string };
        const res = await fetch(`${baseUrl}/images/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      }
      case 'removeVolume': {
        const { name } = args as { name: string };
        const res = await fetch(`${baseUrl}/volumes/${name}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      }
      case 'getLogs': {
        const { id, tail } = args as { id: string; tail?: number };
        const res = await fetch(`${baseUrl}/containers/${id}/logs?tail=${tail || 100}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        return data.logs;
      }
      case 'composeUp': {
        const res = await fetch(`${baseUrl}/compose/up`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      }
      case 'composeDown': {
        const res = await fetch(`${baseUrl}/compose/down`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      }
      default:
        throw new Error(`Unknown Docker method: ${method}`);
    }
  }

  function mockDockerCall(method: string, _args: unknown): unknown {
    if (method === 'listContainers') {
      return [
        {
          id: 'abc123',
          name: 'my-app-dev',
          image: 'node:20-alpine',
          status: 'running',
          ports: [{ host: 3000, container: 3000, protocol: 'tcp' }],
          created: new Date().toISOString(),
          state: { running: true, paused: false, restarting: false, health: 'healthy' },
          stats: {
            cpuPercent: 2.5,
            memoryUsage: 128 * 1024 * 1024,
            memoryLimit: 512 * 1024 * 1024,
            networkRx: 1024,
            networkTx: 512,
          },
        },
        {
          id: 'def456',
          name: 'postgres-db',
          image: 'postgres:15',
          status: 'running',
          ports: [{ host: 5432, container: 5432, protocol: 'tcp' }],
          created: new Date().toISOString(),
          state: { running: true, paused: false, restarting: false, health: 'healthy' },
          stats: {
            cpuPercent: 0.8,
            memoryUsage: 64 * 1024 * 1024,
            memoryLimit: 256 * 1024 * 1024,
            networkRx: 2048,
            networkTx: 1024,
          },
        },
        {
          id: 'ghi789',
          name: 'redis-cache',
          image: 'redis:7-alpine',
          status: 'stopped',
          ports: [],
          created: new Date().toISOString(),
          state: { running: false, paused: false, restarting: false },
        },
      ];
    }
    if (method === 'listImages') {
      return [
        {
          id: 'sha256:abc',
          tags: ['node:20-alpine'],
          size: 150 * 1024 * 1024,
          created: new Date().toISOString(),
        },
        {
          id: 'sha256:def',
          tags: ['postgres:15'],
          size: 350 * 1024 * 1024,
          created: new Date().toISOString(),
        },
        {
          id: 'sha256:ghi',
          tags: ['redis:7-alpine'],
          size: 30 * 1024 * 1024,
          created: new Date().toISOString(),
        },
      ];
    }
    if (method === 'listVolumes') {
      return [
        {
          name: 'postgres_data',
          driver: 'local',
          mountpoint: '/var/lib/docker/volumes/postgres_data/_data',
          created: new Date().toISOString(),
        },
        {
          name: 'redis_data',
          driver: 'local',
          mountpoint: '/var/lib/docker/volumes/redis_data/_data',
          created: new Date().toISOString(),
        },
      ];
    }
    if (method === 'listNetworks') {
      return [
        { id: 'net1', name: 'bridge', driver: 'bridge', scope: 'local', containers: [] },
        {
          id: 'net2',
          name: 'my-app-network',
          driver: 'bridge',
          scope: 'local',
          containers: ['abc123', 'def456'],
        },
      ];
    }
    return null;
  }

  async function loadData() {
    try {
      isLoading.set(true);
      error.set(null);

      const [containerList, imageList, volumeList, networkList] = await Promise.all([
        invokeDocker('listContainers'),
        invokeDocker('listImages'),
        invokeDocker('listVolumes'),
        invokeDocker('listNetworks'),
      ]);

      containers.set(containerList as DockerContainer[]);
      images.set(imageList as DockerImage[]);
      volumes.set(volumeList as DockerVolume[]);
      networks.set(networkList as DockerNetwork[]);
      dockerAvailable.set(true);
    } catch (err) {
      error.set((err as Error).message);
      if ((err as Error).message.includes('Docker daemon')) {
        dockerAvailable.set(false);
      }
    } finally {
      isLoading.set(false);
    }
  }

  // Container actions
  async function startContainer(id: string) {
    try {
      await invokeDocker('startContainer', { id });
      await loadData();
    } catch (err) {
      error.set(`Failed to start container: ${(err as Error).message}`);
    }
  }

  async function stopContainer(id: string) {
    try {
      await invokeDocker('stopContainer', { id });
      await loadData();
    } catch (err) {
      error.set(`Failed to stop container: ${(err as Error).message}`);
    }
  }

  async function restartContainer(id: string) {
    try {
      await invokeDocker('restartContainer', { id });
      await loadData();
    } catch (err) {
      error.set(`Failed to restart container: ${(err as Error).message}`);
    }
  }

  async function removeContainer(id: string) {
    try {
      await invokeDocker('removeContainer', { id });
      await loadData();
    } catch (err) {
      error.set(`Failed to remove container: ${(err as Error).message}`);
    }
  }

  async function viewLogs(id: string) {
    try {
      selectedContainer.set(id);
      const result = await invokeDocker('containerLogs', { id, tail: 100 });
      logs.set((result as string).split('\n'));
    } catch (err) {
      error.set(`Failed to fetch logs: ${(err as Error).message}`);
    }
  }

  async function removeImage(id: string) {
    try {
      await invokeDocker('removeImage', { id });
      await loadData();
    } catch (err) {
      error.set(`Failed to remove image: ${(err as Error).message}`);
    }
  }

  // Volume actions
  async function removeVolume(name: string) {
    try {
      await invokeDocker('removeVolume', { name });
      await loadData();
    } catch (err) {
      error.set(`Failed to remove volume: ${(err as Error).message}`);
    }
  }

  // Compose actions
  async function composeUp() {
    try {
      await invokeDocker('composeUp');
      await loadData();
    } catch (err) {
      error.set(`Docker Compose up failed: ${(err as Error).message}`);
    }
  }

  async function composeDown() {
    try {
      await invokeDocker('composeDown');
      await loadData();
    } catch (err) {
      error.set(`Docker Compose down failed: ${(err as Error).message}`);
    }
  }

  // Format helpers
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatPercent(value: number): string {
    return value.toFixed(1) + '%';
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'running':
        return 'text-green-400';
      case 'paused':
        return 'text-yellow-400';
      case 'stopped':
      case 'exited':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  }

  function getHealthColor(health?: string): string {
    switch (health) {
      case 'healthy':
        return 'bg-green-500';
      case 'unhealthy':
        return 'bg-red-500';
      case 'starting':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  }

  // Lifecycle
  let pollInterval: ReturnType<typeof setInterval>;

  onMount(() => {
    loadData();
    pollInterval = setInterval(() => {
      if ($isPolling) {
        loadData();
      }
    }, 5000);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });
</script>

<div class="docker-panel" in:fade={{ duration: 200 }}>
  <!-- Header -->
  <header class="panel-header">
    <div class="header-left">
      {#if onBack}
        <button class="back-btn" onclick={onBack} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      {/if}
      <svg
        class="docker-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          d="M22 12.5c-.5-1.5-2-2-3.5-2h-1c-.4-1.5-1.5-2.5-3-3V5h-3v2.5H9V5H6v2.5H4.5c-1 0-2 .5-2.5 1.5-1 2 0 4.5 2 6h.5c1.5 2.5 4.5 4 8 4 5 0 9-3.5 9.5-6.5z"
        />
        <rect x="6" y="9" width="2" height="2" />
        <rect x="9" y="9" width="2" height="2" />
        <rect x="12" y="9" width="2" height="2" />
        <rect x="9" y="6" width="2" height="2" />
      </svg>
      <h2>Docker Control Panel</h2>
      {#if $dockerAvailable}
        <span class="status-badge running">Docker Running</span>
      {:else}
        <span class="status-badge stopped">Docker Not Available</span>
      {/if}
    </div>
    <div class="header-right">
      <label class="poll-toggle">
        <input type="checkbox" bind:checked={$isPolling} />
        <span>Auto-refresh</span>
      </label>
      <button class="refresh-btn" onclick={loadData} disabled={$isLoading} aria-label="Refresh">
        <svg
          class="icon"
          class:spinning={$isLoading}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
          />
        </svg>
      </button>
    </div>
  </header>

  <!-- Quick Actions -->
  <div class="quick-actions">
    <button class="action-btn compose-up" onclick={composeUp}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
      Compose Up
    </button>
    <button class="action-btn compose-down" onclick={composeDown}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
      </svg>
      Compose Down
    </button>
    <div class="stats-summary">
      <div class="stat">
        <span class="stat-value">{$runningContainers.length}</span>
        <span class="stat-label">Running</span>
      </div>
      <div class="stat">
        <span class="stat-value">{$stoppedContainers.length}</span>
        <span class="stat-label">Stopped</span>
      </div>
      <div class="stat">
        <span class="stat-value">{$images.length}</span>
        <span class="stat-label">Images</span>
      </div>
    </div>
  </div>

  <!-- Error display -->
  {#if $error}
    <div class="error-banner" transition:slide>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{$error}</span>
      <button onclick={() => error.set(null)}>×</button>
    </div>
  {/if}

  <!-- Tabs -->
  <nav class="tabs">
    <button
      class="tab"
      class:active={$selectedTab === 'containers'}
      onclick={() => selectedTab.set('containers')}
    >
      Containers ({$containers.length})
    </button>
    <button
      class="tab"
      class:active={$selectedTab === 'images'}
      onclick={() => selectedTab.set('images')}
    >
      Images ({$images.length})
    </button>
    <button
      class="tab"
      class:active={$selectedTab === 'volumes'}
      onclick={() => selectedTab.set('volumes')}
    >
      Volumes ({$volumes.length})
    </button>
    <button
      class="tab"
      class:active={$selectedTab === 'networks'}
      onclick={() => selectedTab.set('networks')}
    >
      Networks ({$networks.length})
    </button>
  </nav>

  <!-- Content -->
  <div class="tab-content">
    {#if $isLoading}
      <div class="loading">
        <div class="spinner"></div>
        <span>Loading Docker resources...</span>
      </div>
    {:else if $selectedTab === 'containers'}
      <div class="container-list">
        {#each $containers as container (container.id)}
          <div
            class="container-card"
            class:running={container.status === 'running'}
            transition:fly={{ y: 20, duration: 200 }}
          >
            <div class="container-header">
              <div class="container-info">
                <div class="container-name">
                  {#if container.state.health}
                    <span class="health-dot {getHealthColor(container.state.health)}"></span>
                  {/if}
                  {container.name}
                </div>
                <div class="container-image">{container.image}</div>
              </div>
              <span class="status-pill {getStatusColor(container.status)}">{container.status}</span>
            </div>

            {#if container.ports.length > 0}
              <div class="container-ports">
                {#each container.ports as port}
                  <span class="port-badge">
                    {port.host}:{port.container}/{port.protocol}
                  </span>
                {/each}
              </div>
            {/if}

            {#if container.stats}
              <div class="container-stats">
                <div class="stat-bar">
                  <span class="stat-label">CPU</span>
                  <div class="progress-bar">
                    <div
                      class="progress-fill cpu"
                      style="width: {Math.min(container.stats.cpuPercent, 100)}%"
                    ></div>
                  </div>
                  <span class="stat-value">{formatPercent(container.stats.cpuPercent)}</span>
                </div>
                <div class="stat-bar">
                  <span class="stat-label">MEM</span>
                  <div class="progress-bar">
                    <div
                      class="progress-fill mem"
                      style="width: {(container.stats.memoryUsage / container.stats.memoryLimit) *
                        100}%"
                    ></div>
                  </div>
                  <span class="stat-value">{formatBytes(container.stats.memoryUsage)}</span>
                </div>
              </div>
            {/if}

            <div class="container-actions">
              {#if container.status === 'running'}
                <button
                  class="action-btn-sm stop"
                  onclick={() => stopContainer(container.id)}
                  title="Stop"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="6" width="12" height="12" />
                  </svg>
                </button>
                <button
                  class="action-btn-sm restart"
                  onclick={() => restartContainer(container.id)}
                  title="Restart"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path
                      d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                    />
                  </svg>
                </button>
              {:else}
                <button
                  class="action-btn-sm start"
                  onclick={() => startContainer(container.id)}
                  title="Start"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </button>
              {/if}
              <button
                class="action-btn-sm logs"
                onclick={() => viewLogs(container.id)}
                title="Logs"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </button>
              <button
                class="action-btn-sm remove"
                onclick={() => removeContainer(container.id)}
                title="Remove"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path
                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                  />
                </svg>
              </button>
            </div>
          </div>
        {:else}
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="9" x2="15" y2="15" />
              <line x1="15" y1="9" x2="9" y2="15" />
            </svg>
            <p>No containers found</p>
            <button class="action-btn" onclick={composeUp}>Run Docker Compose</button>
          </div>
        {/each}
      </div>
    {:else if $selectedTab === 'images'}
      <div class="image-list">
        {#each $images as image (image.id)}
          <div class="image-card" transition:fly={{ y: 20, duration: 200 }}>
            <div class="image-info">
              <div class="image-tags">
                {#each image.tags as tag}
                  <span class="tag">{tag}</span>
                {/each}
              </div>
              <div class="image-meta">
                <span>{formatBytes(image.size)}</span>
                <span class="id">{image.id.slice(7, 19)}</span>
              </div>
            </div>
            <div class="image-actions">
              <button
                class="action-btn-sm remove"
                onclick={() => removeImage(image.id)}
                title="Remove"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path
                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                  />
                </svg>
              </button>
            </div>
          </div>
        {:else}
          <div class="empty-state">
            <p>No images found</p>
          </div>
        {/each}
      </div>
    {:else if $selectedTab === 'volumes'}
      <div class="volume-list">
        {#each $volumes as volume (volume.name)}
          <div class="volume-card" transition:fly={{ y: 20, duration: 200 }}>
            <div class="volume-info">
              <div class="volume-name">{volume.name}</div>
              <div class="volume-meta">
                <span>Driver: {volume.driver}</span>
              </div>
            </div>
            <div class="volume-actions">
              <button
                class="action-btn-sm remove"
                onclick={() => removeVolume(volume.name)}
                title="Remove"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path
                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                  />
                </svg>
              </button>
            </div>
          </div>
        {:else}
          <div class="empty-state">
            <p>No volumes found</p>
          </div>
        {/each}
      </div>
    {:else if $selectedTab === 'networks'}
      <div class="network-list">
        {#each $networks as network (network.id)}
          <div class="network-card" transition:fly={{ y: 20, duration: 200 }}>
            <div class="network-info">
              <div class="network-name">{network.name}</div>
              <div class="network-meta">
                <span>Driver: {network.driver}</span>
                <span>Scope: {network.scope}</span>
                <span>{network.containers.length} containers</span>
              </div>
            </div>
          </div>
        {:else}
          <div class="empty-state">
            <p>No networks found</p>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Logs Modal -->
  {#if $selectedContainer}
    <div class="logs-modal" transition:fade>
      <div class="logs-content">
        <header class="logs-header">
          <h3>Container Logs</h3>
          <button onclick={() => selectedContainer.set(null)}>×[5~</button>
        </header>
        <pre class="logs-output">{$logs.join('\n')}</pre>
      </div>
    </div>
  {/if}
</div>

<style>
  .docker-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #1a1a2e);
    color: var(--text-primary, #e8e8e8);
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    background: var(--bg-secondary, #16213e);
    border-bottom: 1px solid var(--border, #333);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .back-btn {
    padding: 0.5rem;
    background: transparent;
    border: none;
    color: var(--text-secondary, #888);
    cursor: pointer;
    border-radius: 8px;
    transition: background 0.2s;
  }

  .back-btn:hover {
    background: var(--bg-hover, #222);
  }

  .back-btn svg {
    width: 20px;
    height: 20px;
  }

  .docker-icon {
    width: 28px;
    height: 28px;
    color: #0db7ed;
  }

  .panel-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  .status-badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-weight: 500;
  }

  .status-badge.running {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .status-badge.stopped {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .poll-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary, #888);
    cursor: pointer;
  }

  .poll-toggle input {
    accent-color: #0db7ed;
  }

  .refresh-btn {
    padding: 0.5rem;
    background: transparent;
    border: 1px solid var(--border, #333);
    border-radius: 0.5rem;
    color: var(--text-primary, #e8e8e8);
    cursor: pointer;
    transition: all 0.2s;
  }

  .refresh-btn:hover {
    background: var(--bg-hover, #222);
  }

  .refresh-btn .icon {
    width: 18px;
    height: 18px;
  }

  .refresh-btn .icon.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .quick-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: var(--bg-secondary, #16213e);
    border-bottom: 1px solid var(--border, #333);
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--bg-hover, #222);
    border: 1px solid var(--border, #333);
    border-radius: 0.5rem;
    color: var(--text-primary, #e8e8e8);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: var(--bg-active, #333);
  }

  .action-btn svg {
    width: 16px;
    height: 16px;
  }

  .action-btn.compose-up:hover {
    background: rgba(34, 197, 94, 0.2);
    border-color: #22c55e;
  }

  .action-btn.compose-down:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
  }

  .stats-summary {
    display: flex;
    gap: 1.5rem;
    margin-left: auto;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary, #e8e8e8);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
    text-transform: uppercase;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: rgba(239, 68, 68, 0.1);
    border-bottom: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .error-banner svg {
    width: 18px;
    height: 18px;
  }

  .error-banner button {
    margin-left: auto;
    background: transparent;
    border: none;
    color: #ef4444;
    font-size: 1.25rem;
    cursor: pointer;
  }

  .tabs {
    display: flex;
    padding: 0 1.5rem;
    border-bottom: 1px solid var(--border, #333);
    background: var(--bg-secondary, #16213e);
  }

  .tab {
    padding: 0.75rem 1.25rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-secondary, #888);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab:hover {
    color: var(--text-primary, #e8e8e8);
  }

  .tab.active {
    color: #0db7ed;
    border-bottom-color: #0db7ed;
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.5rem;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
    color: var(--text-secondary, #888);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border, #333);
    border-top-color: #0db7ed;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .container-list,
  .image-list,
  .volume-list,
  .network-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .container-card,
  .image-card,
  .volume-card,
  .network-card {
    background: var(--bg-secondary, #16213e);
    border: 1px solid var(--border, #333);
    border-radius: 0.75rem;
    padding: 1rem;
    transition: all 0.2s;
  }

  .container-card:hover,
  .image-card:hover {
    border-color: var(--border-hover, #444);
  }

  .container-card.running {
    border-left: 3px solid #22c55e;
  }

  .container-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }

  .container-name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 1rem;
  }

  .health-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .container-image {
    font-size: 0.8rem;
    color: var(--text-secondary, #888);
    font-family: monospace;
  }

  .status-pill {
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }

  .container-ports {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .port-badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: rgba(13, 183, 237, 0.1);
    color: #0db7ed;
    border-radius: 0.25rem;
    font-family: monospace;
  }

  .container-stats {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .stat-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stat-bar .stat-label {
    width: 32px;
    font-size: 0.7rem;
    color: var(--text-secondary, #888);
  }

  .progress-bar {
    flex: 1;
    height: 6px;
    background: var(--bg-hover, #222);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s;
  }

  .progress-fill.cpu {
    background: linear-gradient(90deg, #22c55e, #eab308);
  }

  .progress-fill.mem {
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  }

  .stat-bar .stat-value {
    width: 50px;
    font-size: 0.75rem;
    text-align: right;
    font-family: monospace;
    color: var(--text-secondary, #888);
  }

  .container-actions {
    display: flex;
    gap: 0.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border, #333);
  }

  .action-btn-sm {
    padding: 0.4rem;
    background: var(--bg-hover, #222);
    border: 1px solid var(--border, #333);
    border-radius: 0.375rem;
    color: var(--text-secondary, #888);
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn-sm:hover {
    color: var(--text-primary, #e8e8e8);
    background: var(--bg-active, #333);
  }

  .action-btn-sm svg {
    width: 16px;
    height: 16px;
  }

  .action-btn-sm.start:hover {
    color: #22c55e;
    border-color: #22c55e;
  }

  .action-btn-sm.stop:hover {
    color: #ef4444;
    border-color: #ef4444;
  }

  .action-btn-sm.restart:hover {
    color: #eab308;
    border-color: #eab308;
  }

  .action-btn-sm.logs:hover {
    color: #3b82f6;
    border-color: #3b82f6;
  }

  .action-btn-sm.remove:hover {
    color: #ef4444;
    border-color: #ef4444;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
    color: var(--text-secondary, #888);
  }

  .empty-state svg {
    width: 48px;
    height: 48px;
    opacity: 0.5;
  }

  .image-card,
  .volume-card,
  .network-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .image-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .tag {
    font-family: monospace;
    font-size: 0.875rem;
  }

  .image-meta,
  .volume-meta,
  .network-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
  }

  .image-meta .id {
    font-family: monospace;
  }

  .volume-name,
  .network-name {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .logs-modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .logs-content {
    width: 80%;
    max-width: 900px;
    max-height: 80vh;
    background: var(--bg-primary, #1a1a2e);
    border: 1px solid var(--border, #333);
    border-radius: 0.75rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .logs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--bg-secondary, #16213e);
    border-bottom: 1px solid var(--border, #333);
  }

  .logs-header h3 {
    margin: 0;
    font-size: 1rem;
  }

  .logs-header button {
    background: transparent;
    border: none;
    color: var(--text-secondary, #888);
    font-size: 1.5rem;
    cursor: pointer;
  }

  .logs-output {
    flex: 1;
    overflow: auto;
    padding: 1rem;
    margin: 0;
    font-family: 'Fira Code', 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--text-primary, #e8e8e8);
  }
</style>
