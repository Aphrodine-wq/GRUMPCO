/**
 * Docker Route Tests
 * Tests for browser-based Docker operations API.
 * 
 * Tests all endpoints in docker.ts including:
 * - GET /status - Check Docker availability
 * - GET /containers - List containers
 * - GET /images - List images
 * - GET /volumes - List volumes
 * - GET /networks - List networks
 * - POST /containers/:id/start - Start container
 * - POST /containers/:id/stop - Stop container
 * - POST /containers/:id/restart - Restart container
 * - DELETE /containers/:id - Remove container
 * - DELETE /images/:id - Remove image
 * - DELETE /volumes/:name - Remove volume
 * - GET /containers/:id/logs - Get container logs
 * - POST /compose/up - Start Docker Compose
 * - POST /compose/down - Stop Docker Compose
 * - GET /compose/status - Get Compose status
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';

// Hoist mock to avoid "Cannot access before initialization" error
const { mockExecAsync } = vi.hoisted(() => ({
  mockExecAsync: vi.fn(),
}));

// Mock child_process module - must be before importing the router
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

// Mock util.promisify to return our mock function
vi.mock('util', () => ({
  promisify: () => mockExecAsync,
}));

// Import the actual router AFTER mocks are set up
import dockerRouter from '../../src/routes/docker.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/docker', dockerRouter);

  // Error handler middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: err.message });
  });

  return app;
}

describe('Docker Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/docker/status', () => {
    it('should return available: false when Docker is not available', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Docker not found'));

      const response = await request(app).get('/api/docker/status');

      expect(response.status).toBe(200);
      expect(response.body.available).toBe(false);
      expect(response.body.message).toBe('Docker is not available on the server');
    });

    it('should return Docker version info when available', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' }); // version check
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          Server: { Version: '24.0.0', ApiVersion: '1.43' },
          Client: { Version: '24.0.0' },
        }),
      });

      const response = await request(app).get('/api/docker/status');

      expect(response.status).toBe(200);
      expect(response.body.available).toBe(true);
      expect(response.body.version).toBe('24.0.0');
      expect(response.body.apiVersion).toBe('1.43');
    });

    it('should use Client version if Server version not available', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          Client: { Version: '23.0.0' },
        }),
      });

      const response = await request(app).get('/api/docker/status');

      expect(response.status).toBe(200);
      expect(response.body.version).toBe('23.0.0');
    });

    it('should handle version check success but version command failure', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' }); // version check passes
      mockExecAsync.mockRejectedValueOnce(new Error('Failed to get version details'));

      const response = await request(app).get('/api/docker/status');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get version details');
    });

    it('should handle malformed JSON in version response', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({ stdout: 'not valid json' });

      const response = await request(app).get('/api/docker/status');

      expect(response.status).toBe(500);
    });

    it('should handle empty version response (JSON parse error)', async () => {
      // First call for isDockerAvailable succeeds (returns version string)
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      // Second call for detailed version returns empty/invalid JSON
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).get('/api/docker/status');

      // Empty string causes JSON.parse to throw, resulting in 500
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/docker/containers', () => {
    it('should return 503 when Docker is not available', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Docker not found'));

      const response = await request(app).get('/api/docker/containers');

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('Docker not available');
    });

    it('should return list of containers', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' }); // version check
      mockExecAsync.mockResolvedValueOnce({
        stdout: `${JSON.stringify({
          ID: 'abc123',
          Names: 'my-container',
          Image: 'nginx:latest',
          State: 'running',
          Ports: '0.0.0.0:8080->80/tcp',
          CreatedAt: '2024-01-01 00:00:00',
        })}\n${JSON.stringify({
          ID: 'def456',
          Names: 'redis',
          Image: 'redis:7',
          State: 'exited',
          Ports: '',
          CreatedAt: '2024-01-02 00:00:00',
        })}`,
      });

      const response = await request(app).get('/api/docker/containers');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        id: 'abc123',
        name: 'my-container',
        image: 'nginx:latest',
        status: 'running',
        state: { running: true, paused: false, restarting: false },
      });
      expect(response.body[0].ports).toEqual([{ host: 8080, container: 80, protocol: 'tcp' }]);
      expect(response.body[1].id).toBe('def456');
    });

    it('should handle empty container list', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).get('/api/docker/containers');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should handle containers with paused state', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          ID: 'paused123',
          Names: 'paused-container',
          Image: 'nginx',
          State: 'paused',
          Ports: '',
          CreatedAt: '2024-01-01',
        }),
      });

      const response = await request(app).get('/api/docker/containers');

      expect(response.status).toBe(200);
      expect(response.body[0].state.paused).toBe(true);
      expect(response.body[0].state.running).toBe(false);
    });

    it('should handle containers with restarting state', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          ID: 'restarting123',
          Names: 'restarting-container',
          Image: 'nginx',
          State: 'restarting',
          Ports: '',
          CreatedAt: '2024-01-01',
        }),
      });

      const response = await request(app).get('/api/docker/containers');

      expect(response.status).toBe(200);
      expect(response.body[0].state.restarting).toBe(true);
    });

    it('should parse multiple port mappings', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          ID: 'multi123',
          Names: 'multi-port',
          Image: 'app',
          State: 'running',
          Ports: '0.0.0.0:8080->80/tcp, 0.0.0.0:443->443/tcp',
          CreatedAt: '2024-01-01',
        }),
      });

      const response = await request(app).get('/api/docker/containers');

      expect(response.status).toBe(200);
      expect(response.body[0].ports).toHaveLength(2);
      expect(response.body[0].ports[0]).toEqual({ host: 8080, container: 80, protocol: 'tcp' });
      expect(response.body[0].ports[1]).toEqual({ host: 443, container: 443, protocol: 'tcp' });
    });

    it('should handle UDP ports', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          ID: 'udp123',
          Names: 'udp-container',
          Image: 'dns',
          State: 'running',
          Ports: '0.0.0.0:53->53/udp',
          CreatedAt: '2024-01-01',
        }),
      });

      const response = await request(app).get('/api/docker/containers');

      expect(response.status).toBe(200);
      expect(response.body[0].ports[0].protocol).toBe('udp');
    });

    it('should handle command execution failure', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockRejectedValueOnce(new Error('Docker ps failed'));

      const response = await request(app).get('/api/docker/containers');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Docker ps failed');
    });
  });

  describe('GET /api/docker/images', () => {
    it('should return 503 when Docker is not available', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Docker not found'));

      const response = await request(app).get('/api/docker/images');

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('Docker not available');
    });

    it('should return list of images', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({
        stdout: `${JSON.stringify({
          ID: 'sha256:abc123',
          Repository: 'nginx',
          Tag: 'latest',
          Size: '150MB',
          CreatedAt: '2024-01-01',
        })}`,
      });

      const response = await request(app).get('/api/docker/images');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: 'sha256:abc123',
        tags: ['nginx:latest'],
        size: 150 * 1024 * 1024,
      });
    });

    it('should filter out <none> tags', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          ID: 'sha256:abc123',
          Repository: '<none>',
          Tag: '<none>',
          Size: '100MB',
          CreatedAt: '2024-01-01',
        }),
      });

      const response = await request(app).get('/api/docker/images');

      expect(response.status).toBe(200);
      expect(response.body[0].tags).toEqual([]);
    });

    it('should parse various size formats', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({
        stdout: [
          JSON.stringify({ ID: 'img1', Repository: 'tiny', Tag: 'v1', Size: '500B', CreatedAt: '' }),
          JSON.stringify({ ID: 'img2', Repository: 'small', Tag: 'v1', Size: '2KB', CreatedAt: '' }),
          JSON.stringify({ ID: 'img3', Repository: 'medium', Tag: 'v1', Size: '1.5GB', CreatedAt: '' }),
          JSON.stringify({ ID: 'img4', Repository: 'large', Tag: 'v1', Size: '2TB', CreatedAt: '' }),
        ].join('\n'),
      });

      const response = await request(app).get('/api/docker/images');

      expect(response.status).toBe(200);
      expect(response.body[0].size).toBe(500);
      expect(response.body[1].size).toBe(2 * 1024);
      expect(response.body[2].size).toBe(1.5 * 1024 * 1024 * 1024);
      expect(response.body[3].size).toBe(2 * 1024 * 1024 * 1024 * 1024);
    });

    it('should handle invalid size format', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          ID: 'sha256:abc123',
          Repository: 'test',
          Tag: 'v1',
          Size: 'unknown',
          CreatedAt: '2024-01-01',
        }),
      });

      const response = await request(app).get('/api/docker/images');

      expect(response.status).toBe(200);
      expect(response.body[0].size).toBe(0);
    });

    it('should handle empty images list', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).get('/api/docker/images');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/docker/volumes', () => {
    it('should return 503 when Docker is not available', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Docker not found'));

      const response = await request(app).get('/api/docker/volumes');

      expect(response.status).toBe(503);
    });

    it('should return list of volumes', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          Name: 'my-volume',
          Driver: 'local',
          Mountpoint: '/var/lib/docker/volumes/my-volume',
        }),
      });

      const response = await request(app).get('/api/docker/volumes');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        name: 'my-volume',
        driver: 'local',
        mountpoint: '/var/lib/docker/volumes/my-volume',
      });
    });

    it('should handle empty volumes list', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).get('/api/docker/volumes');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should handle volumes with no mountpoint', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          Name: 'external-volume',
          Driver: 'nfs',
        }),
      });

      const response = await request(app).get('/api/docker/volumes');

      expect(response.status).toBe(200);
      expect(response.body[0].mountpoint).toBe('');
    });

    it('should handle multiple volumes', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({
        stdout: [
          JSON.stringify({ Name: 'vol1', Driver: 'local', Mountpoint: '/mnt/vol1' }),
          JSON.stringify({ Name: 'vol2', Driver: 'local', Mountpoint: '/mnt/vol2' }),
        ].join('\n'),
      });

      const response = await request(app).get('/api/docker/volumes');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /api/docker/networks', () => {
    it('should return 503 when Docker is not available', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Docker not found'));

      const response = await request(app).get('/api/docker/networks');

      expect(response.status).toBe(503);
    });

    it('should return list of networks', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          ID: 'net123',
          Name: 'bridge',
          Driver: 'bridge',
          Scope: 'local',
        }),
      });

      const response = await request(app).get('/api/docker/networks');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: 'net123',
        name: 'bridge',
        driver: 'bridge',
        scope: 'local',
        containers: [],
      });
    });

    it('should handle multiple networks', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({
        stdout: [
          JSON.stringify({ ID: 'net1', Name: 'bridge', Driver: 'bridge', Scope: 'local' }),
          JSON.stringify({ ID: 'net2', Name: 'host', Driver: 'host', Scope: 'local' }),
          JSON.stringify({ ID: 'net3', Name: 'overlay-net', Driver: 'overlay', Scope: 'swarm' }),
        ].join('\n'),
      });

      const response = await request(app).get('/api/docker/networks');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      expect(response.body[2].scope).toBe('swarm');
    });

    it('should handle empty networks list', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).get('/api/docker/networks');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('POST /api/docker/containers/:id/start', () => {
    it('should start a container successfully', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).post('/api/docker/containers/abc123/start');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Container abc123 started',
      });
      expect(mockExecAsync).toHaveBeenCalledWith('docker start abc123');
    });

    it('should handle start failure', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Container not found'));

      const response = await request(app).post('/api/docker/containers/invalid/start');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Container not found');
    });

    it('should handle container already running', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Container already running'));

      const response = await request(app).post('/api/docker/containers/running123/start');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Container already running');
    });

    it('should handle special characters in container ID', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).post('/api/docker/containers/my-container_123/start');

      expect(response.status).toBe(200);
      expect(mockExecAsync).toHaveBeenCalledWith('docker start my-container_123');
    });
  });

  describe('POST /api/docker/containers/:id/stop', () => {
    it('should stop a container successfully', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).post('/api/docker/containers/abc123/stop');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Container abc123 stopped',
      });
      expect(mockExecAsync).toHaveBeenCalledWith('docker stop abc123');
    });

    it('should handle stop failure', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Container not found'));

      const response = await request(app).post('/api/docker/containers/invalid/stop');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Container not found');
    });

    it('should handle container already stopped', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Container is not running'));

      const response = await request(app).post('/api/docker/containers/stopped123/stop');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Container is not running');
    });
  });

  describe('POST /api/docker/containers/:id/restart', () => {
    it('should restart a container successfully', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).post('/api/docker/containers/abc123/restart');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Container abc123 restarted',
      });
      expect(mockExecAsync).toHaveBeenCalledWith('docker restart abc123');
    });

    it('should handle restart failure', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Restart failed'));

      const response = await request(app).post('/api/docker/containers/broken123/restart');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Restart failed');
    });
  });

  describe('DELETE /api/docker/containers/:id', () => {
    it('should remove a container successfully', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).delete('/api/docker/containers/abc123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Container abc123 removed',
      });
      expect(mockExecAsync).toHaveBeenCalledWith('docker rm  abc123');
    });

    it('should force remove a container when force=true', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).delete('/api/docker/containers/abc123?force=true');

      expect(response.status).toBe(200);
      expect(mockExecAsync).toHaveBeenCalledWith('docker rm -f abc123');
    });

    it('should not force remove when force is not true', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).delete('/api/docker/containers/abc123?force=false');

      expect(response.status).toBe(200);
      expect(mockExecAsync).toHaveBeenCalledWith('docker rm  abc123');
    });

    it('should handle removal failure', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Container is running'));

      const response = await request(app).delete('/api/docker/containers/running123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Container is running');
    });
  });

  describe('DELETE /api/docker/images/:id', () => {
    it('should remove an image successfully', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).delete('/api/docker/images/nginx:latest');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should force remove an image when force=true', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).delete('/api/docker/images/nginx:latest?force=true');

      expect(response.status).toBe(200);
      expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('-f'));
    });

    it('should handle image removal failure', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Image is in use'));

      const response = await request(app).delete('/api/docker/images/used-image:v1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Image is in use');
    });

    it('should handle image ID format', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).delete('/api/docker/images/sha256:abc123def456');

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/docker/volumes/:name', () => {
    it('should remove a volume successfully', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).delete('/api/docker/volumes/my-volume');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Volume my-volume removed',
      });
    });

    it('should handle volume removal failure', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Volume is in use'));

      const response = await request(app).delete('/api/docker/volumes/used-volume');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Volume is in use');
    });

    it('should handle volume with special characters', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).delete('/api/docker/volumes/my_volume-123');

      expect(response.status).toBe(200);
      expect(mockExecAsync).toHaveBeenCalledWith('docker volume rm my_volume-123');
    });
  });

  describe('GET /api/docker/containers/:id/logs', () => {
    it('should return container logs', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'log line 1\nlog line 2',
        stderr: '',
      });

      const response = await request(app).get('/api/docker/containers/abc123/logs');

      expect(response.status).toBe(200);
      expect(response.body.logs).toEqual(['log line 1', 'log line 2']);
      expect(mockExecAsync).toHaveBeenCalledWith('docker logs --tail 100 abc123');
    });

    it('should respect tail parameter', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: 'line', stderr: '' });

      await request(app).get('/api/docker/containers/abc123/logs?tail=50');

      expect(mockExecAsync).toHaveBeenCalledWith('docker logs --tail 50 abc123');
    });

    it('should include stderr in logs', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'stdout log',
        stderr: '\nstderr log',
      });

      const response = await request(app).get('/api/docker/containers/abc123/logs');

      expect(response.body.logs).toContain('stdout log');
      expect(response.body.logs).toContain('stderr log');
    });

    it('should handle container with no logs', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const response = await request(app).get('/api/docker/containers/new-container/logs');

      expect(response.status).toBe(200);
      expect(response.body.logs).toEqual(['']);
    });

    it('should handle logs retrieval failure', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Container not found'));

      const response = await request(app).get('/api/docker/containers/invalid/logs');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Container not found');
    });

    it('should handle large tail value', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: 'logs', stderr: '' });

      await request(app).get('/api/docker/containers/abc123/logs?tail=10000');

      expect(mockExecAsync).toHaveBeenCalledWith('docker logs --tail 10000 abc123');
    });
  });

  describe('POST /api/docker/compose/up', () => {
    it('should start Docker Compose successfully', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Creating network...\nStarting services...',
        stderr: '',
      });

      const response = await request(app).post('/api/docker/compose/up').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Docker Compose started');
      expect(response.body.overlay).toBe('none');
      expect(response.body.profiles).toEqual([]);
    });

    it('should apply GPU overlay when specified', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const response = await request(app).post('/api/docker/compose/up').send({ overlay: 'gpu' });

      expect(response.status).toBe(200);
      expect(response.body.overlay).toBe('gpu');
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('docker-compose.gpu.yml'),
        expect.any(Object)
      );
    });

    it('should apply ROCm overlay when specified', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await request(app).post('/api/docker/compose/up').send({ overlay: 'rocm' });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('docker-compose.rocm.yml'),
        expect.any(Object)
      );
    });

    it('should apply profiles when specified', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await request(app).post('/api/docker/compose/up').send({ profiles: ['dev', 'debug'] });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('--profile dev'),
        expect.any(Object)
      );
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('--profile debug'),
        expect.any(Object)
      );
    });

    it('should pull images when pull=true', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await request(app).post('/api/docker/compose/up').send({ pull: true });

      expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('pull'), expect.any(Object));
    });

    it('should return 500 on compose failure', async () => {
      const error = new Error('Compose failed') as Error & { stdout: string; stderr: string };
      error.stdout = 'some output';
      error.stderr = 'error output';
      mockExecAsync.mockRejectedValueOnce(error);

      const response = await request(app).post('/api/docker/compose/up').send({});

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Compose failed');
      expect(response.body.logs.join('\n')).toContain('some output');
    });

    it('should use custom path when specified', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await request(app).post('/api/docker/compose/up').send({ path: '/custom/path' });

      expect(mockExecAsync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/custom/path' }));
    });

    it('should set 5 minute timeout', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await request(app).post('/api/docker/compose/up').send({});

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 300000 })
      );
    });

    it('should handle empty profiles array', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const response = await request(app).post('/api/docker/compose/up').send({ profiles: [] });

      expect(response.status).toBe(200);
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.not.stringContaining('--profile'),
        expect.any(Object)
      );
    });

    it('should combine overlay and profiles', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await request(app).post('/api/docker/compose/up').send({
        overlay: 'gpu',
        profiles: ['dev'],
      });

      const call = mockExecAsync.mock.calls[0][0] as string;
      expect(call).toContain('docker-compose.gpu.yml');
      expect(call).toContain('--profile dev');
    });

    it('should handle error without stdout/stderr properties', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Simple error'));

      const response = await request(app).post('/api/docker/compose/up').send({});

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Simple error');
      expect(response.body.logs).toEqual([]);
    });
  });

  describe('POST /api/docker/compose/down', () => {
    it('should stop Docker Compose successfully', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Stopping services...',
        stderr: '',
      });

      const response = await request(app).post('/api/docker/compose/down').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Docker Compose stopped');
    });

    it('should remove volumes when removeVolumes=true', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await request(app).post('/api/docker/compose/down').send({ removeVolumes: true });

      expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('-v'), expect.any(Object));
    });

    it('should apply overlay and profiles', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await request(app).post('/api/docker/compose/down').send({
        overlay: 'gpu',
        profiles: ['dev'],
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('docker-compose.gpu.yml'),
        expect.any(Object)
      );
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('--profile dev'),
        expect.any(Object)
      );
    });

    it('should apply ROCm overlay', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await request(app).post('/api/docker/compose/down').send({ overlay: 'rocm' });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('docker-compose.rocm.yml'),
        expect.any(Object)
      );
    });

    it('should use custom path when specified', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await request(app).post('/api/docker/compose/down').send({ path: '/custom/path' });

      expect(mockExecAsync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/custom/path' }));
    });

    it('should handle down failure', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Down failed'));

      const response = await request(app).post('/api/docker/compose/down').send({});

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Down failed');
    });

    it('should handle empty profiles array', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await request(app).post('/api/docker/compose/down').send({ profiles: [] });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.not.stringContaining('--profile'),
        expect.any(Object)
      );
    });
  });

  describe('GET /api/docker/compose/status', () => {
    it('should return running status with services', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: `${JSON.stringify({ Name: 'api', State: 'running' })}\n${JSON.stringify({
          Name: 'db',
          State: 'running',
        })}`,
      });

      const response = await request(app).get('/api/docker/compose/status');

      expect(response.status).toBe(200);
      expect(response.body.running).toBe(true);
      expect(response.body.services).toHaveLength(2);
    });

    it('should return not running when compose fails', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('No containers'));

      const response = await request(app).get('/api/docker/compose/status');

      expect(response.status).toBe(200);
      expect(response.body.running).toBe(false);
      expect(response.body.services).toEqual([]);
    });

    it('should handle empty compose status', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const response = await request(app).get('/api/docker/compose/status');

      expect(response.status).toBe(200);
      expect(response.body.running).toBe(false);
      expect(response.body.services).toEqual([]);
    });

    it('should handle malformed JSON lines', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: `${JSON.stringify({ Name: 'valid', State: 'running' })}\nnot valid json\n${JSON.stringify({ Name: 'also-valid', State: 'running' })}`,
      });

      const response = await request(app).get('/api/docker/compose/status');

      expect(response.status).toBe(200);
      expect(response.body.running).toBe(true);
      expect(response.body.services).toHaveLength(2);
    });

    it('should handle single service', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({ Name: 'single-service', State: 'running', Health: 'healthy' }),
      });

      const response = await request(app).get('/api/docker/compose/status');

      expect(response.status).toBe(200);
      expect(response.body.running).toBe(true);
      expect(response.body.services).toHaveLength(1);
      expect(response.body.services[0].Name).toBe('single-service');
    });
  });

  describe('Helper function edge cases', () => {
    describe('parsePorts', () => {
      it('should handle ports without host binding', async () => {
        mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
        mockExecAsync.mockResolvedValueOnce({
          stdout: JSON.stringify({
            ID: 'test',
            Names: 'test',
            Image: 'test',
            State: 'running',
            Ports: '3000/tcp',
            CreatedAt: '',
          }),
        });

        const response = await request(app).get('/api/docker/containers');

        expect(response.status).toBe(200);
        // Ports without proper mapping should not be parsed
        expect(response.body[0].ports).toEqual([]);
      });

      it('should handle IPv6 port bindings', async () => {
        mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
        mockExecAsync.mockResolvedValueOnce({
          stdout: JSON.stringify({
            ID: 'test',
            Names: 'test',
            Image: 'test',
            State: 'running',
            Ports: ':::8080->80/tcp',
            CreatedAt: '',
          }),
        });

        const response = await request(app).get('/api/docker/containers');

        expect(response.status).toBe(200);
        // The regex should handle this, but may not match IPv6 format
      });
    });

    describe('parseSize', () => {
      it('should handle lowercase units', async () => {
        mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
        mockExecAsync.mockResolvedValueOnce({
          stdout: JSON.stringify({
            ID: 'test',
            Repository: 'test',
            Tag: 'v1',
            Size: '100mb',
            CreatedAt: '',
          }),
        });

        const response = await request(app).get('/api/docker/images');

        expect(response.status).toBe(200);
        expect(response.body[0].size).toBe(100 * 1024 * 1024);
      });

      it('should handle decimal sizes', async () => {
        mockExecAsync.mockResolvedValueOnce({ stdout: '24.0.0' });
        mockExecAsync.mockResolvedValueOnce({
          stdout: JSON.stringify({
            ID: 'test',
            Repository: 'test',
            Tag: 'v1',
            Size: '1.5GB',
            CreatedAt: '',
          }),
        });

        const response = await request(app).get('/api/docker/images');

        expect(response.status).toBe(200);
        expect(response.body[0].size).toBe(1.5 * 1024 * 1024 * 1024);
      });
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle Docker daemon timeout', async () => {
      const timeoutError = new Error('ETIMEDOUT') as Error & { code: string };
      timeoutError.code = 'ETIMEDOUT';
      mockExecAsync.mockRejectedValueOnce(timeoutError);

      const response = await request(app).get('/api/docker/status');

      expect(response.status).toBe(200);
      expect(response.body.available).toBe(false);
    });

    it('should handle permission denied errors', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('permission denied'));

      const response = await request(app).get('/api/docker/containers');

      expect(response.status).toBe(503);
    });
  });
});
