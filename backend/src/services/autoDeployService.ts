/**
 * Auto-Deploy Service for User-Generated Apps
 * Automatically deploys user-generated applications to Docker containers
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import logger from '../middleware/logger.js';

const execAsync = promisify(exec);

export interface DeploymentConfig {
  appDirectory: string;
  appName?: string;
  port?: number;
  envVars?: Record<string, string>;
}

export interface DeploymentResult {
  success: boolean;
  appName: string;
  port: number;
  url: string;
  containerId?: string;
  logs?: string;
  error?: string;
}

export class AutoDeployService {
  private readonly scriptsDir: string;
  private readonly generatedAppsDir: string;

  constructor() {
    this.scriptsDir = path.join(process.cwd(), '..', 'scripts');
    this.generatedAppsDir = path.join(process.cwd(), '..', 'generated-apps');
  }

  /**
   * Check if Docker is available
   */
  async isDockerAvailable(): Promise<boolean> {
    try {
      await execAsync('docker --version');
      await execAsync('docker info');
      return true;
    } catch (error) {
      logger.error('Docker is not available', { error });
      return false;
    }
  }

  /**
   * Auto-deploy a user-generated app to Docker
   */
  async deployApp(config: DeploymentConfig): Promise<DeploymentResult> {
    try {
      // Validate Docker availability
      if (!(await this.isDockerAvailable())) {
        return {
          success: false,
          appName: config.appName || 'unknown',
          port: config.port || 8080,
          url: '',
          error: 'Docker is not available on this system',
        };
      }

      // Validate app directory
      const appDir = path.resolve(config.appDirectory);
      try {
        await fs.access(appDir);
      } catch {
        return {
          success: false,
          appName: config.appName || 'unknown',
          port: config.port || 8080,
          url: '',
          error: `App directory not found: ${appDir}`,
        };
      }

      // Generate app name if not provided
      const appName = config.appName || `user-app-${Date.now()}`;
      const port = config.port || 8080;

      logger.info('Starting auto-deployment', { appName, appDir, port });

      // Run the auto-deploy script
      const scriptPath = path.join(this.scriptsDir, 'auto-deploy-user-app.sh');
      const command = `bash "${scriptPath}" "${appDir}" "${appName}" ${port}`;

      const { stdout, stderr } = await execAsync(command, {
        timeout: 300000, // 5 minutes timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      logger.info('Deployment completed', { appName, stdout, stderr });

      // Get container ID
      const { stdout: containerId } = await execAsync(`docker ps -q -f name=${appName}`);

      return {
        success: true,
        appName,
        port,
        url: `http://localhost:${port}`,
        containerId: containerId.trim(),
        logs: stdout,
      };
    } catch (error: any) {
      logger.error('Deployment failed', { error, config });

      return {
        success: false,
        appName: config.appName || 'unknown',
        port: config.port || 8080,
        url: '',
        error: error.message || 'Unknown deployment error',
        logs: error.stdout || error.stderr,
      };
    }
  }

  /**
   * Stop a deployed app
   */
  async stopApp(appName: string): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync(`docker stop ${appName}`);
      logger.info('App stopped', { appName });
      return { success: true };
    } catch (error: any) {
      logger.error('Failed to stop app', { appName, error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove a deployed app
   */
  async removeApp(appName: string): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync(`docker stop ${appName}`);
      await execAsync(`docker rm ${appName}`);
      logger.info('App removed', { appName });
      return { success: true };
    } catch (error: any) {
      logger.error('Failed to remove app', { appName, error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get logs from a deployed app
   */
  async getAppLogs(appName: string, lines: number = 100): Promise<string> {
    try {
      const { stdout } = await execAsync(`docker logs --tail ${lines} ${appName}`);
      return stdout;
    } catch (error: any) {
      logger.error('Failed to get app logs', { appName, error });
      return `Error getting logs: ${error.message}`;
    }
  }

  /**
   * List all deployed apps
   */
  async listDeployedApps(): Promise<Array<{
    name: string;
    status: string;
    port: string;
    image: string;
  }>> {
    try {
      const { stdout } = await execAsync(
        'docker ps -a --filter "name=user-app" --format "{{.Names}}|{{.Status}}|{{.Ports}}|{{.Image}}"'
      );

      return stdout
        .trim()
        .split('\n')
        .filter(line => line)
        .map(line => {
          const [name, status, ports, image] = line.split('|');
          return { name, status, port: ports, image };
        });
    } catch (error: any) {
      logger.error('Failed to list deployed apps', { error });
      return [];
    }
  }

  /**
   * Get app status
   */
  async getAppStatus(appName: string): Promise<{
    running: boolean;
    status?: string;
    containerId?: string;
  }> {
    try {
      const { stdout } = await execAsync(`docker ps -a -f name=${appName} --format "{{.Status}}|{{.ID}}"`);
      
      if (!stdout.trim()) {
        return { running: false };
      }

      const [status, containerId] = stdout.trim().split('|');
      const running = status.toLowerCase().includes('up');

      return { running, status, containerId };
    } catch (error: any) {
      logger.error('Failed to get app status', { appName, error });
      return { running: false };
    }
  }
}

// Export singleton instance
export const autoDeployService = new AutoDeployService();
