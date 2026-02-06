/**
 * G-Rump Auto-Updater Module
 * 
 * Integrates with electron-updater to automatically check for updates
 * from GitHub Releases and install them seamlessly.
 */

const { app, ipcMain, BrowserWindow, dialog } = require('electron');

// Try to load electron-updater and electron-log (may not be available in dev)
let autoUpdater = null;
let log = console;

try {
  autoUpdater = require('electron-updater').autoUpdater;
  log = require('electron-log');

  // Configure logging
  log.transports.file.level = 'info';
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';

  // Auto-updater configuration
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
} catch (err) {
  console.log('[Updater] electron-updater not available (dev mode):', err.message);
}

// Track update state
let updateState = {
  checking: false,
  available: false,
  downloaded: false,
  downloading: false,
  progress: 0,
  version: null,
  error: null
};

// Get main window for sending update events
function getMainWindow() {
  const windows = BrowserWindow.getAllWindows();
  return windows.length > 0 ? windows[0] : null;
}

// Send update status to renderer
function sendUpdateStatus(status, data = {}) {
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:status', { status, ...data });
  }
}

// Initialize auto-updater
function initAutoUpdater() {
  // Don't run updater if not available or in development
  if (!autoUpdater) {
    console.log('[Updater] Auto-updater not available');
    return;
  }

  if (!app.isPackaged) {
    log.info('[Updater] Skipping auto-update in development mode');
    return;
  }

  log.info('[Updater] Initializing auto-updater...');
  log.info(`[Updater] App version: ${app.getVersion()}`);

  // Event: Checking for updates
  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater] Checking for updates...');
    updateState.checking = true;
    updateState.error = null;
    sendUpdateStatus('checking');
  });

  // Event: Update available
  autoUpdater.on('update-available', (info) => {
    log.info(`[Updater] Update available: v${info.version}`);
    updateState.checking = false;
    updateState.available = true;
    updateState.version = info.version;
    sendUpdateStatus('available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    });
  });

  // Event: No update available
  autoUpdater.on('update-not-available', (info) => {
    log.info('[Updater] No updates available (current version is latest)');
    updateState.checking = false;
    updateState.available = false;
    sendUpdateStatus('not-available', {
      currentVersion: app.getVersion()
    });
  });

  // Event: Download progress
  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    log.info(`[Updater] Download progress: ${percent}%`);
    updateState.downloading = true;
    updateState.progress = percent;
    sendUpdateStatus('downloading', {
      percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    });
  });

  // Event: Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    log.info(`[Updater] Update downloaded: v${info.version}`);
    updateState.downloading = false;
    updateState.downloaded = true;
    updateState.version = info.version;
    sendUpdateStatus('downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes
    });

    // Show notification to user
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `G-Rump v${info.version} has been downloaded.`,
        detail: 'The update will be installed when you restart the app.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1
      }).then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
    }
  });

  // Event: Error
  autoUpdater.on('error', (error) => {
    log.error('[Updater] Error:', error);
    updateState.checking = false;
    updateState.downloading = false;
    updateState.error = error.message;
    sendUpdateStatus('error', {
      error: error.message
    });
  });

  // Check for updates after app is ready (with delay to not slow down startup)
  setTimeout(() => {
    checkForUpdates();
  }, 10000); // Check 10 seconds after startup

  // Also check periodically (every 4 hours)
  setInterval(() => {
    checkForUpdates();
  }, 4 * 60 * 60 * 1000);
}

// Manual check for updates
function checkForUpdates() {
  if (!autoUpdater) {
    return Promise.resolve({ updateAvailable: false, notSupported: true });
  }

  if (!app.isPackaged) {
    log.info('[Updater] Skipping update check in development');
    return Promise.resolve({ updateAvailable: false, isDev: true });
  }

  if (updateState.checking || updateState.downloading) {
    log.info('[Updater] Update check already in progress');
    return Promise.resolve({ updateAvailable: updateState.available, inProgress: true });
  }

  return autoUpdater.checkForUpdatesAndNotify()
    .then(result => {
      return {
        updateAvailable: result?.updateInfo ? true : false,
        version: result?.updateInfo?.version
      };
    })
    .catch(error => {
      log.error('[Updater] Check failed:', error);
      return { updateAvailable: false, error: error.message };
    });
}

// Download update manually
function downloadUpdate() {
  if (!autoUpdater) {
    return Promise.resolve({ success: false, error: 'Updater not available' });
  }
  if (!updateState.available) {
    return Promise.resolve({ success: false, error: 'No update available' });
  }
  return autoUpdater.downloadUpdate()
    .then(() => ({ success: true }))
    .catch(error => ({ success: false, error: error.message }));
}

// Install update and restart
function installUpdate() {
  if (!autoUpdater) {
    return { success: false, error: 'Updater not available' };
  }
  if (!updateState.downloaded) {
    return { success: false, error: 'No update downloaded' };
  }
  autoUpdater.quitAndInstall(false, true);
  return { success: true };
}

// Get current update state
function getUpdateState() {
  return {
    ...updateState,
    currentVersion: app.getVersion(),
    isPackaged: app.isPackaged
  };
}

// Register IPC handlers
function registerUpdateHandlers() {
  // Check for updates
  ipcMain.handle('update:check', async () => {
    return checkForUpdates();
  });

  // Get update state
  ipcMain.handle('update:state', () => {
    return getUpdateState();
  });

  // Download update
  ipcMain.handle('update:download', async () => {
    return downloadUpdate();
  });

  // Install update
  ipcMain.handle('update:install', () => {
    return installUpdate();
  });

  // Get app version
  ipcMain.handle('app:version', () => {
    return {
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      platform: process.platform,
      arch: process.arch
    };
  });
}

module.exports = {
  initAutoUpdater,
  registerUpdateHandlers,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  getUpdateState
};
