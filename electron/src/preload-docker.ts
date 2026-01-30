/**
 * Docker Preload Script
 * Exposes Docker IPC methods to the renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { ContainerInfo, ImageInfo, VolumeInfo, NetworkInfo, DockerArgs } from './docker';

interface DockerAPI {
  // Status
  isRunning(): Promise<boolean>;
  
  // Containers
  listContainers(): Promise<ContainerInfo[]>;
  startContainer(id: string): Promise<void>;
  stopContainer(id: string): Promise<void>;
  restartContainer(id: string): Promise<void>;
  removeContainer(id: string, force?: boolean): Promise<void>;
  containerLogs(id: string, tail?: number): Promise<string>;
  containerStats(id: string): Promise<ContainerInfo['stats']>;
  
  // Images
  listImages(): Promise<ImageInfo[]>;
  pullImage(name: string): Promise<void>;
  removeImage(id: string, force?: boolean): Promise<void>;
  
  // Volumes
  listVolumes(): Promise<VolumeInfo[]>;
  removeVolume(name: string): Promise<void>;
  
  // Networks
  listNetworks(): Promise<NetworkInfo[]>;
  
  // Compose
  composeUp(cwd?: string): Promise<{ stdout: string; stderr: string }>;
  composeDown(cwd?: string): Promise<{ stdout: string; stderr: string }>;
  composeLogs(cwd?: string, tail?: number): Promise<string>;
  composePs(cwd?: string): Promise<string>;
  
  // Generic invoke
  invoke(method: string, args?: DockerArgs): Promise<unknown>;
}

/**
 * Docker API exposed to renderer via contextBridge
 */
const dockerAPI: DockerAPI = {
  // Status
  isRunning: () => ipcRenderer.invoke('docker', 'isRunning'),
  
  // Containers
  listContainers: () => ipcRenderer.invoke('docker', 'listContainers'),
  startContainer: (id: string) => ipcRenderer.invoke('docker', 'startContainer', { id }),
  stopContainer: (id: string) => ipcRenderer.invoke('docker', 'stopContainer', { id }),
  restartContainer: (id: string) => ipcRenderer.invoke('docker', 'restartContainer', { id }),
  removeContainer: (id: string, force?: boolean) => 
    ipcRenderer.invoke('docker', 'removeContainer', { id, force }),
  containerLogs: (id: string, tail?: number) => 
    ipcRenderer.invoke('docker', 'containerLogs', { id, tail }),
  containerStats: (id: string) => 
    ipcRenderer.invoke('docker', 'containerStats', { id }),
  
  // Images
  listImages: () => ipcRenderer.invoke('docker', 'listImages'),
  pullImage: (name: string) => ipcRenderer.invoke('docker', 'pullImage', { name }),
  removeImage: (id: string, force?: boolean) => 
    ipcRenderer.invoke('docker', 'removeImage', { id, force }),
  
  // Volumes
  listVolumes: () => ipcRenderer.invoke('docker', 'listVolumes'),
  removeVolume: (name: string) => ipcRenderer.invoke('docker', 'removeVolume', { name }),
  
  // Networks
  listNetworks: () => ipcRenderer.invoke('docker', 'listNetworks'),
  
  // Compose
  composeUp: (cwd?: string) => ipcRenderer.invoke('docker', 'composeUp', { cwd }),
  composeDown: (cwd?: string) => ipcRenderer.invoke('docker', 'composeDown', { cwd }),
  composeLogs: (cwd?: string, tail?: number) => 
    ipcRenderer.invoke('docker', 'composeLogs', { cwd, tail }),
  composePs: (cwd?: string) => ipcRenderer.invoke('docker', 'composePs', { cwd }),
  
  // Generic invoke
  invoke: (method: string, args?: DockerArgs) => 
    ipcRenderer.invoke('docker', method, args),
};

// Expose docker API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  docker: (method: string, args?: DockerArgs) => ipcRenderer.invoke('docker', method, args),
});

// Also expose as structured API
contextBridge.exposeInMainWorld('dockerAPI', dockerAPI);

export type { DockerAPI };
