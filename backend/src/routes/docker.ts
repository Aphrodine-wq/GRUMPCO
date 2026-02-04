/**
 * Docker API Routes
 * Provides browser-based access to Docker operations via the backend.
 * Used when running in web browser (not Electron).
 *
 * Note: Docker must be available on the server running the backend.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = Router();

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

// Check if Docker is available
async function isDockerAvailable(): Promise<boolean> {
  try {
    await execAsync('docker version --format "{{.Server.Version}}"');
    return true;
  } catch {
    return false;
  }
}

/**
 * GET /api/docker/status
 * Check if Docker is available on the server
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const available = await isDockerAvailable();

    if (!available) {
      res.json({
        available: false,
        message: 'Docker is not available on the server',
      });
      return;
    }

    const { stdout } = await execAsync('docker version --format "{{json .}}"');
    const version = JSON.parse(stdout);

    res.json({
      available: true,
      version: version.Server?.Version || version.Client?.Version,
      apiVersion: version.Server?.ApiVersion,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/docker/containers
 * List all containers
 */
router.get('/containers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const available = await isDockerAvailable();
    if (!available) {
      res.status(503).json({ error: 'Docker not available' });
      return;
    }

    const { stdout } = await execAsync('docker ps -a --format "{{json .}}"');

    const lines = stdout.trim().split('\n').filter(Boolean);
    const containers: DockerContainer[] = lines.map((line) => {
      const c = JSON.parse(line);
      const isRunning = c.State === 'running';
      const ports = parsePorts(c.Ports || '');

      return {
        id: c.ID,
        name: c.Names,
        image: c.Image,
        status: c.State as DockerContainer['status'],
        ports,
        created: c.CreatedAt,
        state: {
          running: isRunning,
          paused: c.State === 'paused',
          restarting: c.State === 'restarting',
          health: undefined, // Would need docker inspect for this
        },
      };
    });

    res.json(containers);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/docker/images
 * List all images
 */
router.get('/images', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const available = await isDockerAvailable();
    if (!available) {
      res.status(503).json({ error: 'Docker not available' });
      return;
    }

    const { stdout } = await execAsync('docker images --format "{{json .}}"');

    const lines = stdout.trim().split('\n').filter(Boolean);
    const images: DockerImage[] = lines.map((line) => {
      const img = JSON.parse(line);
      return {
        id: img.ID,
        tags: [`${img.Repository}:${img.Tag}`].filter((t) => !t.includes('<none>')),
        size: parseSize(img.Size),
        created: img.CreatedAt,
      };
    });

    res.json(images);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/docker/volumes
 * List all volumes
 */
router.get('/volumes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const available = await isDockerAvailable();
    if (!available) {
      res.status(503).json({ error: 'Docker not available' });
      return;
    }

    const { stdout } = await execAsync('docker volume ls --format "{{json .}}"');

    const lines = stdout.trim().split('\n').filter(Boolean);
    const volumes: DockerVolume[] = lines.map((line) => {
      const vol = JSON.parse(line);
      return {
        name: vol.Name,
        driver: vol.Driver,
        mountpoint: vol.Mountpoint || '',
        created: '',
      };
    });

    res.json(volumes);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/docker/networks
 * List all networks
 */
router.get('/networks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const available = await isDockerAvailable();
    if (!available) {
      res.status(503).json({ error: 'Docker not available' });
      return;
    }

    const { stdout } = await execAsync('docker network ls --format "{{json .}}"');

    const lines = stdout.trim().split('\n').filter(Boolean);
    const networks: DockerNetwork[] = lines.map((line) => {
      const net = JSON.parse(line);
      return {
        id: net.ID,
        name: net.Name,
        driver: net.Driver,
        scope: net.Scope,
        containers: [],
      };
    });

    res.json(networks);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/docker/containers/:id/start
 * Start a container
 */
router.post('/containers/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await execAsync(`docker start ${id}`);
    res.json({ success: true, message: `Container ${id} started` });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/docker/containers/:id/stop
 * Stop a container
 */
router.post('/containers/:id/stop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await execAsync(`docker stop ${id}`);
    res.json({ success: true, message: `Container ${id} stopped` });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/docker/containers/:id/restart
 * Restart a container
 */
router.post('/containers/:id/restart', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await execAsync(`docker restart ${id}`);
    res.json({ success: true, message: `Container ${id} restarted` });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/docker/containers/:id
 * Remove a container
 */
router.delete('/containers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const force = req.query.force === 'true';
    await execAsync(`docker rm ${force ? '-f' : ''} ${id}`);
    res.json({ success: true, message: `Container ${id} removed` });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/docker/images/:id
 * Remove an image
 */
router.delete('/images/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const force = req.query.force === 'true';
    await execAsync(`docker rmi ${force ? '-f' : ''} ${id}`);
    res.json({ success: true, message: `Image ${id} removed` });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/docker/volumes/:name
 * Remove a volume
 */
router.delete('/volumes/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    await execAsync(`docker volume rm ${name}`);
    res.json({ success: true, message: `Volume ${name} removed` });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/docker/containers/:id/logs
 * Get container logs
 */
router.get('/containers/:id/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tail = req.query.tail || '100';
    const { stdout, stderr } = await execAsync(`docker logs --tail ${tail} ${id}`);
    res.json({ logs: (stdout + stderr).split('\n') });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/docker/compose/up
 * Run docker-compose up with overlay and profiles support
 *
 * Body:
 * - overlay?: 'gpu' | 'rocm' - GPU overlay to use
 * - profiles?: string[] - Docker Compose profiles to enable
 * - pull?: boolean - Whether to pull images before starting
 * - path?: string - Path to docker-compose files (defaults to deploy/)
 */
router.post('/compose/up', async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const { overlay, profiles, pull, path: customPath } = req.body;

    // Use deploy/ directory by default
    const cwd = customPath || `${process.cwd()}/deploy`;

    // Build compose command
    const composeFiles: string[] = ['docker-compose.yml'];

    // Add overlay if specified
    if (overlay === 'gpu') {
      composeFiles.push('docker-compose.gpu.yml');
    } else if (overlay === 'rocm') {
      composeFiles.push('docker-compose.rocm.yml');
    }

    // Build file arguments
    const fileArgs = composeFiles.map((f) => `-f ${f}`).join(' ');

    // Build profile arguments
    let profileArgs = '';
    if (profiles && Array.isArray(profiles) && profiles.length > 0) {
      profileArgs = profiles.map((p) => `--profile ${p}`).join(' ');
    }

    // Build command
    let command = `docker compose ${fileArgs}`;
    if (profileArgs) command += ` ${profileArgs}`;
    if (pull) command += ' pull &&';
    command += ` docker compose ${fileArgs}`;
    if (profileArgs) command += ` ${profileArgs}`;
    command += ' up -d';

    // Execute
    const { stdout, stderr } = await execAsync(command, { cwd, timeout: 300000 }); // 5 min timeout

    res.json({
      success: true,
      message: 'Docker Compose started',
      overlay: overlay || 'none',
      profiles: profiles || [],
      logs: (stdout + stderr).split('\n').filter(Boolean),
    });
  } catch (err) {
    const error = err as Error & { stdout?: string; stderr?: string };
    res.status(500).json({
      success: false,
      error: error.message,
      logs: ((error.stdout || '') + (error.stderr || '')).split('\n').filter(Boolean),
    });
  }
});

/**
 * POST /api/docker/compose/down
 * Run docker-compose down with overlay support
 */
router.post('/compose/down', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { overlay, profiles, removeVolumes, path: customPath } = req.body;
    const cwd = customPath || `${process.cwd()}/deploy`;

    // Build compose command with same files used for up
    const composeFiles: string[] = ['docker-compose.yml'];
    if (overlay === 'gpu') composeFiles.push('docker-compose.gpu.yml');
    else if (overlay === 'rocm') composeFiles.push('docker-compose.rocm.yml');

    const fileArgs = composeFiles.map((f) => `-f ${f}`).join(' ');
    let profileArgs = '';
    if (profiles && Array.isArray(profiles) && profiles.length > 0) {
      profileArgs = profiles.map((p) => `--profile ${p}`).join(' ');
    }

    let command = `docker compose ${fileArgs}`;
    if (profileArgs) command += ` ${profileArgs}`;
    command += ' down';
    if (removeVolumes) command += ' -v';

    const { stdout, stderr } = await execAsync(command, { cwd });

    res.json({
      success: true,
      message: 'Docker Compose stopped',
      logs: (stdout + stderr).split('\n').filter(Boolean),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/docker/compose/status
 * Get status of compose services
 */
router.get('/compose/status', async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const cwd = `${process.cwd()}/deploy`;

    const { stdout } = await execAsync('docker compose ps --format json', { cwd });
    const lines = stdout.trim().split('\n').filter(Boolean);
    const services = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    res.json({
      running: services.length > 0,
      services,
    });
  } catch (_err) {
    // Compose not running is not an error
    res.json({ running: false, services: [] });
  }
});

// Helper: Parse Docker port strings like "0.0.0.0:3000->3000/tcp"
function parsePorts(
  portsStr: string
): Array<{ host: number; container: number; protocol: string }> {
  if (!portsStr) return [];

  const ports: Array<{ host: number; container: number; protocol: string }> = [];
  const portMappings = portsStr.split(', ');

  for (const mapping of portMappings) {
    // Format: "0.0.0.0:3000->3000/tcp" or "3000/tcp"
    const match = mapping.match(/(?:[\d.]+:)?(\d+)->(\d+)\/(\w+)/);
    if (match) {
      ports.push({
        host: parseInt(match[1], 10),
        container: parseInt(match[2], 10),
        protocol: match[3],
      });
    }
  }

  return ports;
}

// Helper: Parse size strings like "150MB" to bytes
function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/([\d.]+)\s*(B|KB|MB|GB|TB)/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit] || 1);
}

export default router;
