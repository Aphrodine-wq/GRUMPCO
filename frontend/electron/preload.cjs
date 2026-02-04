/**
 * G-Rump Preload Script - Lightning Fast Edition
 * 
 * Optimizations:
 * - Cached version lookup
 * - Immediate splash close on load
 * - Minimal API surface
 */

const { contextBridge, ipcRenderer } = require('electron');


// Cache version to avoid repeated file reads
let cachedVersion = '1.0.0';
function getVersion() {
  return cachedVersion;
}

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld('grump', {
  platform: process.platform,
  isElectron: true,
  version: getVersion(),

  // Signal that the app is ready, close splash and show main window
  closeSplashShowMain: () => ipcRenderer.invoke('close-splash-show-main'),

  // Fast ready signal - call this ASAP in your app
  ready: () => {
    ipcRenderer.invoke('close-splash-show-main');
  },

  // Theme: sync with native OS theme
  setTheme: (theme) => ipcRenderer.invoke('theme:set', theme),

  // OS notification (title, body, optional tag)
  notify: (title, body, tag) => ipcRenderer.invoke('notify', { title: title || 'G-Rump', body: body || '', tag: tag || '' }),

  // App commands from tray (focus chat, settings, open workspace)
  onAppCommand: (event, callback) => {
    const fn = () => callback();
    ipcRenderer.on(event, fn);
    return () => ipcRenderer.removeListener(event, fn);
  },

  // Protocol URL (grump://) opened by OS
  onProtocolUrl: (callback) => {
    const fn = (_event, url) => callback(url);
    ipcRenderer.on('app:protocol-url', fn);
    return () => ipcRenderer.removeListener('app:protocol-url', fn);
  },

  // Open path in Explorer / Finder (returns Promise<{ error?: string }>)
  openPath: (pathToOpen) => ipcRenderer.invoke('shell:open-path', pathToOpen),
  // Reveal file/folder in system file manager
  showItemInFolder: (pathToOpen) => ipcRenderer.invoke('shell:show-item-in-folder', pathToOpen),
  // Folder picker for Settings > Security (returns Promise<{ path?: string; canceled?: boolean }>)
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),

  // Frameless window controls for custom title bar
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    unmaximize: () => ipcRenderer.invoke('window:unmaximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    setAlwaysOnTop: (flag) => ipcRenderer.invoke('window:setAlwaysOnTop', flag),
    isAlwaysOnTop: () => ipcRenderer.invoke('window:isAlwaysOnTop'),
    onMaximizedChange: (callback) => {
      const fn = (_event, isMaximized) => callback(isMaximized);
      ipcRenderer.on('window:maximized-change', fn);
      return () => ipcRenderer.removeListener('window:maximized-change', fn);
    },
  },

  // Docker detection (vendor-agnostic)
  docker: {
    getVersion: () => ipcRenderer.invoke('docker:version'),
    getInfo: () => ipcRenderer.invoke('docker:info'),
    getNvidiaToolkitVersion: () => ipcRenderer.invoke('docker:nvidia-toolkit'),
  },

  // GPU detection (NVIDIA + AMD)
  gpu: {
    detect: () => ipcRenderer.invoke('gpu:detect'),
    list: () => ipcRenderer.invoke('gpu:list'),
  },

  // Wake word detection (macOS/Electron) - activates Talk Mode when phrase detected
  wakeWord: {
    start: (accessKey) => ipcRenderer.invoke('wake-word:start', accessKey),
    stop: () => ipcRenderer.invoke('wake-word:stop'),
    onDetected: (callback) => {
      const fn = () => callback();
      ipcRenderer.on('wake-word:detected', fn);
      return () => ipcRenderer.removeListener('wake-word:detected', fn);
    },
    isSupported: () => process.platform === 'darwin' || process.platform === 'win32',
  },

  // Auth (Google OAuth for Electron)
  auth: {
    openGoogleSignIn: () => ipcRenderer.invoke('auth:open-oauth-window'),
    notifyComplete: () => ipcRenderer.send('auth:complete'),
    onComplete: (callback) => {
      const fn = () => callback();
      ipcRenderer.on('auth:complete', fn);
      return () => ipcRenderer.removeListener('auth:complete', fn);
    },
  },
  
  // Free Agent Sandbox (Docker-based isolation)
  freeAgent: {
    /**
     * Start the Free Agent sandbox container
     * @param {Object} config - Configuration for the sandbox
     * @param {string} config.workspaceRoot - Path to workspace to mount
     * @param {string[]} [config.capabilities] - Enabled capabilities
     * @param {Object} [config.resourceLimits] - CPU/memory limits
     */
    start: (config) => ipcRenderer.invoke('freeagent:start', config),
    
    /**
     * Stop the Free Agent sandbox container
     */
    stop: () => ipcRenderer.invoke('freeagent:stop'),
    
    /**
     * Get Free Agent sandbox status
     * @returns {Promise<{running: boolean, containerId?: string, health?: string, uptime?: number}>}
     */
    status: () => ipcRenderer.invoke('freeagent:status'),
    
    /**
     * Restart the Free Agent sandbox
     */
    restart: () => ipcRenderer.invoke('freeagent:restart'),
    
    /**
     * Get Free Agent container logs
     * @param {number} [tail=100] - Number of log lines to return
     */
    logs: (tail = 100) => ipcRenderer.invoke('freeagent:logs', tail),
    
    /**
     * Execute a command in the Free Agent sandbox
     * @param {string[]} command - Command and arguments
     * @param {Object} [options] - Execution options
     * @param {number} [options.timeout] - Timeout in ms
     * @param {string} [options.workDir] - Working directory
     * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
     */
    exec: (command, options = {}) => ipcRenderer.invoke('freeagent:exec', { command, ...options }),
  },
});

// Alias for components that expect electronAPI (e.g. DockerPanel)
contextBridge.exposeInMainWorld('electronAPI', {
  docker: (method, args) => {
    if (method === 'getVersion') return ipcRenderer.invoke('docker:version');
    if (method === 'getInfo') return ipcRenderer.invoke('docker:info');
    if (method === 'getNvidiaToolkit') return ipcRenderer.invoke('docker:nvidia-toolkit');
    return Promise.reject(new Error('Use backend API for container operations'));
  },
  gpu: {
    detect: () => ipcRenderer.invoke('gpu:detect'),
    list: () => ipcRenderer.invoke('gpu:list'),
  },
  freeAgent: {
    start: (config) => ipcRenderer.invoke('freeagent:start', config),
    stop: () => ipcRenderer.invoke('freeagent:stop'),
    status: () => ipcRenderer.invoke('freeagent:status'),
    restart: () => ipcRenderer.invoke('freeagent:restart'),
    logs: (tail = 100) => ipcRenderer.invoke('freeagent:logs', tail),
    exec: (command, options = {}) => ipcRenderer.invoke('freeagent:exec', { command, ...options }),
  },
});

// Auto-signal ready after DOM is loaded (fallback)
// DISABLED: Causing white screen issues by showing window before app is ready
/*
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure first paint
    setTimeout(() => {
      ipcRenderer.invoke('close-splash-show-main');
    }, 50);
  });
}
*/
