/**
 * Electron Main Process
 * Entry point for the G-Rump desktop application
 */

import { app, BrowserWindow, ipcMain, shell, nativeTheme } from 'electron';
import * as path from 'path';
import { registerDockerHandlers, unregisterDockerHandlers } from './docker';

// Keep a global reference to prevent garbage collection
let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

// Environment detection
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

/**
 * Create the splash screen window
 */
function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load splash HTML
  const splashPath = isDev
    ? path.join(__dirname, '../../public/splash.html')
    : path.join(__dirname, '../public/splash.html');
  
  splashWindow.loadFile(splashPath).catch(() => {
    // If splash doesn't exist, just skip it
    splashWindow?.close();
    splashWindow = null;
  });

  splashWindow.center();
}

/**
 * Create the main application window
 */
function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false, // Don't show until ready
    frame: !isMac, // Use native frame on Windows/Linux
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the app
  if (isDev) {
    // Development: load from Vite dev server
    mainWindow.loadURL('http://localhost:5173').catch((err) => {
      console.error('Failed to load dev server:', err);
      // Fallback to file
      const indexPath = path.join(__dirname, '../../frontend/dist/index.html');
      mainWindow?.loadFile(indexPath);
    });
    
    // Open DevTools in development
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: load from built files
    const indexPath = path.join(__dirname, '../frontend/dist/index.html');
    mainWindow.loadFile(indexPath);
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    // Close splash if it exists
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Cleanup on close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Register all IPC handlers
 */
function registerIpcHandlers(): void {
  // Docker handlers
  registerDockerHandlers();

  // Window control handlers
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() ?? false;
  });

  // Theme handlers
  ipcMain.handle('theme:get', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  ipcMain.handle('theme:set', (_event, theme: 'dark' | 'light' | 'system') => {
    nativeTheme.themeSource = theme;
  });

  // Shell handlers
  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    return shell.openExternal(url);
  });

  ipcMain.handle('shell:openPath', (_event, path: string) => {
    return shell.openPath(path);
  });

  // App info handlers
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getName', () => {
    return app.getName();
  });

  ipcMain.handle('app:getPath', (_event, name: string) => {
    return app.getPath(name as 'home' | 'appData' | 'userData' | 'temp' | 'desktop' | 'documents' | 'downloads');
  });

  // Splash control
  ipcMain.handle('splash:close', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow?.show();
    mainWindow?.focus();
  });
}

/**
 * Cleanup IPC handlers
 */
function unregisterIpcHandlers(): void {
  unregisterDockerHandlers();
  ipcMain.removeHandler('window:minimize');
  ipcMain.removeHandler('window:maximize');
  ipcMain.removeHandler('window:close');
  ipcMain.removeHandler('window:isMaximized');
  ipcMain.removeHandler('theme:get');
  ipcMain.removeHandler('theme:set');
  ipcMain.removeHandler('shell:openExternal');
  ipcMain.removeHandler('shell:openPath');
  ipcMain.removeHandler('app:getVersion');
  ipcMain.removeHandler('app:getName');
  ipcMain.removeHandler('app:getPath');
  ipcMain.removeHandler('splash:close');
}

// ============================================
// App Lifecycle
// ============================================

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // App ready
  app.whenReady().then(() => {
    createSplashWindow();
    registerIpcHandlers();
    createMainWindow();

    // macOS: Re-create window when dock icon clicked
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  // Quit when all windows closed (except macOS)
  app.on('window-all-closed', () => {
    if (!isMac) {
      app.quit();
    }
  });

  // Cleanup before quit
  app.on('will-quit', () => {
    unregisterIpcHandlers();
  });
}

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
