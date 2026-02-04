/**
 * Docker IPC Handlers for Electron
 * Provides Docker container, image, volume, and network management via IPC
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import Dockerode from 'dockerode';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Docker client instance
let docker: Dockerode | null = null;

/**
 * Initialize Docker client with platform-specific socket
 */
function getDockerClient(): Dockerode {
  if (!docker) {
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      // Windows: Use named pipe
      docker = new Dockerode({ socketPath: '//./pipe/docker_engine' });
    } else {
      // macOS/Linux: Use Unix socket
      docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
    }
  }
  return docker;
}

/**
 * Check if Docker daemon is running
 */
async function isDockerRunning(): Promise<boolean> {
  try {
    const client = getDockerClient();
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Container Types
// ============================================

interface ContainerInfo {
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

interface ImageInfo {
  id: string;
  tags: string[];
  size: number;
  created: string;
}

interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
  created: string;
}

interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
  scope: string;
  containers: string[];
}

// ============================================
// Container Management
// ============================================

/**
 * List all containers with stats
 */
async function listContainers(): Promise<ContainerInfo[]> {
  const client = getDockerClient();
  const containers = await client.listContainers({ all: true });
  
  const result: ContainerInfo[] = await Promise.all(
    containers.map(async (container) => {
      const containerInstance = client.getContainer(container.Id);
      let stats: ContainerInfo['stats'] | undefined;
      
      // Get stats for running containers
      if (container.State === 'running') {
        try {
          const statsStream = await containerInstance.stats({ stream: false });
          const cpuDelta = statsStream.cpu_stats.cpu_usage.total_usage - 
                          (statsStream.precpu_stats?.cpu_usage?.total_usage || 0);
          const systemDelta = statsStream.cpu_stats.system_cpu_usage - 
                             (statsStream.precpu_stats?.system_cpu_usage || 0);
          const cpuPercent = systemDelta > 0 
            ? (cpuDelta / systemDelta) * (statsStream.cpu_stats.online_cpus || 1) * 100 
            : 0;
          
          stats = {
            cpuPercent: Math.round(cpuPercent * 100) / 100,
            memoryUsage: statsStream.memory_stats.usage || 0,
            memoryLimit: statsStream.memory_stats.limit || 0,
            networkRx: (Object.values(statsStream.networks || {}) as Array<{ rx_bytes?: number }>).reduce((sum, n) => sum + (n.rx_bytes || 0), 0),
            networkTx: (Object.values(statsStream.networks || {}) as Array<{ tx_bytes?: number }>).reduce((sum, n) => sum + (n.tx_bytes || 0), 0),
          };
        } catch {
          // Stats not available
        }
      }
      
      // Parse ports
      const ports = (container.Ports || [])
        .filter(p => p.PublicPort)
        .map(p => ({
          host: p.PublicPort || 0,
          container: p.PrivatePort,
          protocol: p.Type || 'tcp',
        }));
      
      // Determine status
      let status: ContainerInfo['status'] = 'stopped';
      switch (container.State) {
        case 'running':
          status = 'running';
          break;
        case 'paused':
          status = 'paused';
          break;
        case 'restarting':
          status = 'restarting';
          break;
        case 'exited':
        case 'dead':
          status = 'exited';
          break;
        default:
          status = 'stopped';
      }
      
      // Get health status
      let health: 'healthy' | 'unhealthy' | 'starting' | undefined;
      const healthStatus = container.Status;
      if (healthStatus?.includes('healthy')) {
        health = healthStatus.includes('unhealthy') ? 'unhealthy' : 'healthy';
      } else if (healthStatus?.includes('starting')) {
        health = 'starting';
      }
      
      return {
        id: container.Id,
        name: container.Names[0]?.replace(/^\//, '') || 'unnamed',
        image: container.Image,
        status,
        ports,
        created: new Date(container.Created * 1000).toISOString(),
        state: {
          running: container.State === 'running',
          paused: container.State === 'paused',
          restarting: container.State === 'restarting',
          health,
        },
        stats,
      };
    })
  );
  
  return result;
}

/**
 * Start a container
 */
async function startContainer(id: string): Promise<void> {
  const client = getDockerClient();
  const container = client.getContainer(id);
  await container.start();
}

/**
 * Stop a container
 */
async function stopContainer(id: string): Promise<void> {
  const client = getDockerClient();
  const container = client.getContainer(id);
  await container.stop();
}

/**
 * Restart a container
 */
async function restartContainer(id: string): Promise<void> {
  const client = getDockerClient();
  const container = client.getContainer(id);
  await container.restart();
}

/**
 * Remove a container
 */
async function removeContainer(id: string, force = false): Promise<void> {
  const client = getDockerClient();
  const container = client.getContainer(id);
  await container.remove({ force });
}

/**
 * Get container logs
 */
async function containerLogs(id: string, tail = 100): Promise<string> {
  const client = getDockerClient();
  const container = client.getContainer(id);
  
  const logs = await container.logs({
    stdout: true,
    stderr: true,
    tail,
    follow: false,
  });
  
  // Parse docker log stream format (remove header bytes)
  const logString = logs.toString('utf-8');
  const lines = logString.split('\n').map(line => {
    // Docker log format has 8-byte header per line
    if (line.length > 8) {
      return line.substring(8);
    }
    return line;
  });
  
  return lines.join('\n');
}

/**
 * Get container stats (streaming disabled for single snapshot)
 */
async function containerStats(id: string): Promise<ContainerInfo['stats']> {
  const client = getDockerClient();
  const container = client.getContainer(id);
  const statsData = await container.stats({ stream: false });
  
  const cpuDelta = statsData.cpu_stats.cpu_usage.total_usage - 
                  (statsData.precpu_stats?.cpu_usage?.total_usage || 0);
  const systemDelta = statsData.cpu_stats.system_cpu_usage - 
                     (statsData.precpu_stats?.system_cpu_usage || 0);
  const cpuPercent = systemDelta > 0 
    ? (cpuDelta / systemDelta) * (statsData.cpu_stats.online_cpus || 1) * 100 
    : 0;
  
  return {
    cpuPercent: Math.round(cpuPercent * 100) / 100,
    memoryUsage: statsData.memory_stats.usage || 0,
    memoryLimit: statsData.memory_stats.limit || 0,
    networkRx: (Object.values(statsData.networks || {}) as Array<{ rx_bytes?: number }>).reduce((sum, n) => sum + (n.rx_bytes || 0), 0),
    networkTx: (Object.values(statsData.networks || {}) as Array<{ tx_bytes?: number }>).reduce((sum, n) => sum + (n.tx_bytes || 0), 0),
  };
}

// ============================================
// Image Management
// ============================================

/**
 * List all images
 */
async function listImages(): Promise<ImageInfo[]> {
  const client = getDockerClient();
  const images = await client.listImages();
  
  return images.map(image => ({
    id: image.Id,
    tags: image.RepoTags || ['<none>:<none>'],
    size: image.Size,
    created: new Date(image.Created * 1000).toISOString(),
  }));
}

/**
 * Pull an image
 */
async function pullImage(name: string): Promise<void> {
  const client = getDockerClient();
  
  return new Promise((resolve, reject) => {
    client.pull(name, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) {
        reject(err);
        return;
      }
      
      client.modem.followProgress(stream, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

/**
 * Remove an image
 */
async function removeImage(id: string, force = false): Promise<void> {
  const client = getDockerClient();
  const image = client.getImage(id);
  await image.remove({ force });
}

// ============================================
// Volume Management
// ============================================

/**
 * List all volumes
 */
async function listVolumes(): Promise<VolumeInfo[]> {
  const client = getDockerClient();
  const { Volumes } = await client.listVolumes();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Docker SDK volume shape (intentional)
  return (Volumes || []).map((volume: any) => ({
    name: volume.Name,
    driver: volume.Driver,
    mountpoint: volume.Mountpoint,
    created: volume.CreatedAt || new Date().toISOString(),
  }));
}

/**
 * Remove a volume
 */
async function removeVolume(name: string): Promise<void> {
  const client = getDockerClient();
  const volume = client.getVolume(name);
  await volume.remove();
}

// ============================================
// Network Management
// ============================================

/**
 * List all networks
 */
async function listNetworks(): Promise<NetworkInfo[]> {
  const client = getDockerClient();
  const networks = await client.listNetworks();
  
  return networks.map(network => ({
    id: network.Id,
    name: network.Name,
    driver: network.Driver || 'bridge',
    scope: network.Scope || 'local',
    containers: Object.keys(network.Containers || {}),
  }));
}

// ============================================
// Docker Compose
// ============================================

/**
 * Run docker-compose up
 */
async function composeUp(cwd?: string): Promise<{ stdout: string; stderr: string }> {
  const workDir = cwd || process.cwd();
  
  // Try docker compose (v2) first, fall back to docker-compose (v1)
  try {
    const result = await execAsync('docker compose up -d', { cwd: workDir });
    return result;
  } catch {
    // Try docker-compose v1
    const result = await execAsync('docker-compose up -d', { cwd: workDir });
    return result;
  }
}

/**
 * Run docker-compose down
 */
async function composeDown(cwd?: string): Promise<{ stdout: string; stderr: string }> {
  const workDir = cwd || process.cwd();
  
  // Try docker compose (v2) first, fall back to docker-compose (v1)
  try {
    const result = await execAsync('docker compose down', { cwd: workDir });
    return result;
  } catch {
    // Try docker-compose v1
    const result = await execAsync('docker-compose down', { cwd: workDir });
    return result;
  }
}

/**
 * Run docker-compose logs
 */
async function composeLogs(cwd?: string, tail = 100): Promise<string> {
  const workDir = cwd || process.cwd();
  
  try {
    const { stdout } = await execAsync(`docker compose logs --tail=${tail}`, { cwd: workDir });
    return stdout;
  } catch {
    const { stdout } = await execAsync(`docker-compose logs --tail=${tail}`, { cwd: workDir });
    return stdout;
  }
}

/**
 * Run docker-compose ps
 */
async function composePs(cwd?: string): Promise<string> {
  const workDir = cwd || process.cwd();
  
  try {
    const { stdout } = await execAsync('docker compose ps', { cwd: workDir });
    return stdout;
  } catch {
    const { stdout } = await execAsync('docker-compose ps', { cwd: workDir });
    return stdout;
  }
}

// ============================================
// Free Agent Sandbox Container
// ============================================

const FREE_AGENT_CONTAINER_NAME = 'grump-freeagent-sandbox';
const FREE_AGENT_IMAGE = 'grump/freeagent-sandbox:latest';

interface FreeAgentConfig {
  workspaceRoot: string;
  capabilities?: string[];
  resourceLimits?: {
    cpus?: string;
    memory?: string;
  };
}

interface FreeAgentStatus {
  running: boolean;
  containerId?: string;
  health?: 'healthy' | 'unhealthy' | 'starting';
  uptime?: number;
  workspaceRoot?: string;
}

let freeAgentStartTime: Date | null = null;

/**
 * Start Free Agent sandbox container
 */
async function startFreeAgentSandbox(config: FreeAgentConfig): Promise<{ containerId: string }> {
  const client = getDockerClient();
  
  // Check if already running
  const existing = await getFreeAgentContainer();
  if (existing && existing.running) {
    return { containerId: existing.containerId! };
  }
  
  // Remove existing stopped container
  if (existing) {
    try {
      const container = client.getContainer(existing.containerId!);
      await container.remove({ force: true });
    } catch {
      // Ignore removal errors
    }
  }
  
  // Create container with workspace mount
  const container = await client.createContainer({
    name: FREE_AGENT_CONTAINER_NAME,
    Image: FREE_AGENT_IMAGE,
    Env: [
      `WORKSPACE_ROOT=/workspace`,
      `CAPABILITIES=${(config.capabilities || []).join(',')}`,
    ],
    HostConfig: {
      Binds: [`${config.workspaceRoot}:/workspace:rw`],
      RestartPolicy: { Name: 'unless-stopped' },
      Resources: {
        CpuQuota: config.resourceLimits?.cpus ? parseFloat(config.resourceLimits.cpus) * 100000 : 200000, // 2 CPUs default
        Memory: config.resourceLimits?.memory ? parseMemory(config.resourceLimits.memory) : 2 * 1024 * 1024 * 1024, // 2GB default
      },
      SecurityOpt: ['no-new-privileges'],
      // Limit capabilities
      CapDrop: ['ALL'],
      CapAdd: ['CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'SETGID', 'SETUID'],
    },
    NetworkingConfig: {
      EndpointsConfig: {
        'grump-network': {},
      },
    },
    ExposedPorts: {
      '8080/tcp': {},
    },
  });
  
  await container.start();
  freeAgentStartTime = new Date();
  
  return { containerId: container.id };
}

/**
 * Stop Free Agent sandbox container
 */
async function stopFreeAgentSandbox(): Promise<void> {
  const client = getDockerClient();
  
  try {
    const containers = await client.listContainers({ all: true });
    const freeAgent = containers.find(c => c.Names.some(n => n.includes(FREE_AGENT_CONTAINER_NAME)));
    
    if (freeAgent) {
      const container = client.getContainer(freeAgent.Id);
      if (freeAgent.State === 'running') {
        await container.stop();
      }
    }
    
    freeAgentStartTime = null;
  } catch (err) {
    throw new Error(`Failed to stop Free Agent: ${(err as Error).message}`);
  }
}

/**
 * Get Free Agent container status
 */
async function getFreeAgentContainer(): Promise<FreeAgentStatus> {
  const client = getDockerClient();
  
  try {
    const containers = await client.listContainers({ all: true });
    const freeAgent = containers.find(c => c.Names.some(n => n.includes(FREE_AGENT_CONTAINER_NAME)));
    
    if (!freeAgent) {
      return { running: false };
    }
    
    // Get health status
    let health: 'healthy' | 'unhealthy' | 'starting' | undefined;
    if (freeAgent.Status?.includes('healthy')) {
      health = freeAgent.Status.includes('unhealthy') ? 'unhealthy' : 'healthy';
    } else if (freeAgent.Status?.includes('starting')) {
      health = 'starting';
    }
    
    // Calculate uptime
    let uptime: number | undefined;
    if (freeAgentStartTime && freeAgent.State === 'running') {
      uptime = Date.now() - freeAgentStartTime.getTime();
    }
    
    return {
      running: freeAgent.State === 'running',
      containerId: freeAgent.Id,
      health,
      uptime,
    };
  } catch {
    return { running: false };
  }
}

/**
 * Execute a command in the Free Agent sandbox
 */
async function execInFreeAgent(
  command: string[],
  options?: { timeout?: number; workDir?: string }
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const client = getDockerClient();
  
  const status = await getFreeAgentContainer();
  if (!status.running || !status.containerId) {
    throw new Error('Free Agent sandbox is not running');
  }
  
  const container = client.getContainer(status.containerId);
  
  const exec = await container.exec({
    Cmd: command,
    WorkingDir: options?.workDir || '/workspace',
    AttachStdout: true,
    AttachStderr: true,
  });
  
  return new Promise((resolve, reject) => {
    exec.start({ hijack: true, stdin: false }, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) {
        reject(err);
        return;
      }
      
      let stdout = '';
      let stderr = '';
      
      // Parse multiplexed output
      stream.on('data', (chunk: Buffer) => {
        // Docker exec stream format: first 8 bytes are header
        // Byte 0: stream type (1=stdout, 2=stderr)
        // Bytes 4-7: length
        let pos = 0;
        while (pos < chunk.length) {
          if (pos + 8 > chunk.length) break;
          const streamType = chunk[pos];
          const len = chunk.readUInt32BE(pos + 4);
          pos += 8;
          const data = chunk.slice(pos, pos + len).toString('utf-8');
          pos += len;
          
          if (streamType === 1) {
            stdout += data;
          } else if (streamType === 2) {
            stderr += data;
          }
        }
      });
      
      stream.on('end', async () => {
        try {
          const inspectData = await exec.inspect();
          resolve({
            exitCode: inspectData.ExitCode || 0,
            stdout,
            stderr,
          });
        } catch {
          resolve({ exitCode: 0, stdout, stderr });
        }
      });
      
      stream.on('error', reject);
      
      // Timeout
      if (options?.timeout) {
        setTimeout(() => {
          reject(new Error('Execution timeout'));
        }, options.timeout);
      }
    });
  });
}

/**
 * Restart Free Agent sandbox
 */
async function restartFreeAgentSandbox(): Promise<void> {
  const status = await getFreeAgentContainer();
  if (status.containerId) {
    const client = getDockerClient();
    const container = client.getContainer(status.containerId);
    await container.restart();
    freeAgentStartTime = new Date();
  }
}

/**
 * Get Free Agent sandbox logs
 */
async function getFreeAgentLogs(tail = 100): Promise<string> {
  const status = await getFreeAgentContainer();
  if (!status.containerId) {
    return '';
  }
  
  return containerLogs(status.containerId, tail);
}

// Helper to parse memory strings like "2g" or "512m"
function parseMemory(memStr: string): number {
  const match = memStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(k|m|g|t)?b?$/);
  if (!match) return 2 * 1024 * 1024 * 1024; // Default 2GB
  
  const value = parseFloat(match[1]);
  const unit = match[2] || '';
  
  const multipliers: Record<string, number> = {
    '': 1,
    'k': 1024,
    'm': 1024 * 1024,
    'g': 1024 * 1024 * 1024,
    't': 1024 * 1024 * 1024 * 1024,
  };
  
  return value * (multipliers[unit] || 1);
}

// ============================================
// IPC Handler Registration
// ============================================

interface DockerArgs {
  id?: string;
  name?: string;
  tail?: number;
  force?: boolean;
  cwd?: string;
}

interface FreeAgentArgs {
  config?: FreeAgentConfig;
  command?: string[];
  timeout?: number;
  workDir?: string;
}

/**
 * Register all Docker IPC handlers
 */
export function registerDockerHandlers(): void {
  // Main docker handler
  ipcMain.handle('docker', async (_event: IpcMainInvokeEvent, method: string, args: DockerArgs = {}) => {
    // Check if Docker is running
    const dockerRunning = await isDockerRunning();
    if (!dockerRunning && method !== 'isRunning') {
      throw new Error('Docker daemon is not running. Please start Docker Desktop or the Docker service.');
    }
    
    switch (method) {
      // Status
      case 'isRunning':
        return dockerRunning;
      
      // Containers
      case 'listContainers':
        return listContainers();
      case 'startContainer':
        if (!args.id) throw new Error('Container ID required');
        return startContainer(args.id);
      case 'stopContainer':
        if (!args.id) throw new Error('Container ID required');
        return stopContainer(args.id);
      case 'restartContainer':
        if (!args.id) throw new Error('Container ID required');
        return restartContainer(args.id);
      case 'removeContainer':
        if (!args.id) throw new Error('Container ID required');
        return removeContainer(args.id, args.force);
      case 'containerLogs':
        if (!args.id) throw new Error('Container ID required');
        return containerLogs(args.id, args.tail);
      case 'containerStats':
        if (!args.id) throw new Error('Container ID required');
        return containerStats(args.id);
      
      // Images
      case 'listImages':
        return listImages();
      case 'pullImage':
        if (!args.name) throw new Error('Image name required');
        return pullImage(args.name);
      case 'removeImage':
        if (!args.id) throw new Error('Image ID required');
        return removeImage(args.id, args.force);
      
      // Volumes
      case 'listVolumes':
        return listVolumes();
      case 'removeVolume':
        if (!args.name) throw new Error('Volume name required');
        return removeVolume(args.name);
      
      // Networks
      case 'listNetworks':
        return listNetworks();
      
      // Compose
      case 'composeUp':
        return composeUp(args.cwd);
      case 'composeDown':
        return composeDown(args.cwd);
      case 'composeLogs':
        return composeLogs(args.cwd, args.tail);
      case 'composePs':
        return composePs(args.cwd);
      
      default:
        throw new Error(`Unknown Docker method: ${method}`);
    }
  });
  
  // Free Agent sandbox handlers
  ipcMain.handle('freeagent:start', async (_event: IpcMainInvokeEvent, config: FreeAgentConfig) => {
    return startFreeAgentSandbox(config);
  });
  
  ipcMain.handle('freeagent:stop', async () => {
    return stopFreeAgentSandbox();
  });
  
  ipcMain.handle('freeagent:status', async () => {
    return getFreeAgentContainer();
  });
  
  ipcMain.handle('freeagent:restart', async () => {
    return restartFreeAgentSandbox();
  });
  
  ipcMain.handle('freeagent:logs', async (_event: IpcMainInvokeEvent, tail?: number) => {
    return getFreeAgentLogs(tail);
  });
  
  ipcMain.handle('freeagent:exec', async (_event: IpcMainInvokeEvent, args: FreeAgentArgs) => {
    if (!args.command) throw new Error('Command required');
    return execInFreeAgent(args.command, { timeout: args.timeout, workDir: args.workDir });
  });
}

/**
 * Unregister Docker IPC handlers
 */
export function unregisterDockerHandlers(): void {
  ipcMain.removeHandler('docker');
}

// Export types for use in preload
export type { ContainerInfo, ImageInfo, VolumeInfo, NetworkInfo, DockerArgs };
