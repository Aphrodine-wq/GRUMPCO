/**
 * Electron Preload Script
 * Exposes safe APIs to the renderer process via contextBridge
 */

import { contextBridge, ipcRenderer } from 'electron';

// ============================================
// Type Definitions
// ============================================

interface DockerArgs {
  id?: string;
  name?: string;
  tail?: number;
  force?: boolean;
  cwd?: string;
}

interface GrumpAPI {
  isElectron: boolean;
  platform: NodeJS.Platform;

  // Window controls
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;

  // Theme
  getTheme: () => Promise<'dark' | 'light'>;
  setTheme: (theme: 'dark' | 'light' | 'system') => Promise<void>;
  onThemeChange: (callback: (theme: 'dark' | 'light') => void) => () => void;

  // Shell
  openExternal: (url: string) => Promise<void>;
  openPath: (path: string) => Promise<string>;

  // App info
  getVersion: () => Promise<string>;
  getName: () => Promise<string>;
  getPath: (name: string) => Promise<string>;
}

interface ElectronAPI {
  docker: (method: string, args?: DockerArgs) => Promise<unknown>;
}

// ============================================
// API Implementations
// ============================================

const grumpAPI: GrumpAPI = {
  isElectron: true,
  platform: process.platform,

  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Theme
  getTheme: () => ipcRenderer.invoke('theme:get'),
  setTheme: (theme) => ipcRenderer.invoke('theme:set', theme),
  onThemeChange: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, theme: 'dark' | 'light') => callback(theme);
    ipcRenderer.on('theme:changed', handler);
    return () => ipcRenderer.removeListener('theme:changed', handler);
  },

  // Shell
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  openPath: (path) => ipcRenderer.invoke('shell:openPath', path),

  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getName: () => ipcRenderer.invoke('app:getName'),
  getPath: (name) => ipcRenderer.invoke('app:getPath', name),
};

const electronAPI: ElectronAPI = {
  docker: (method, args) => ipcRenderer.invoke('docker', method, args),
};

// ============================================
// Expose APIs to Renderer
// ============================================

// Main G-Rump API
contextBridge.exposeInMainWorld('grump', grumpAPI);

// Electron-specific API (Docker, etc.)
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Legacy compatibility
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, callback: (...args: unknown[]) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },
});

// ============================================
// Type Exports for TypeScript
// ============================================

export type { GrumpAPI, ElectronAPI, DockerArgs };

// Augment window type
declare global {
  interface Window {
    grump: GrumpAPI;
    electronAPI: ElectronAPI;
    electron: {
      ipcRenderer: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
        on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
      };
    };
  }
}
