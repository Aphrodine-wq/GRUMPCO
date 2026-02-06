/**
 * G-Rump Desktop App - Lightning Fast Edition
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * 1. Parallel initialization (splash + main window + backend simultaneously)
 * 2. Pre-warmed window creation
 * 3. Deferred backend startup (non-blocking)
 * 4. Aggressive caching and preloading
 * 5. Reduced splash timeout (2s vs 5s)
 * 6. Memory-optimized window creation
 */

console.log('[G-Rump] ===== ELECTRON MAIN PROCESS STARTING =====');

const { app, BrowserWindow, shell, ipcMain, nativeImage, nativeTheme, Tray, Menu, Notification, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Docker IPC handlers (container management, Free Agent sandbox)
const { registerDockerHandlers } = require('./docker-handlers.cjs');

// Enable hardware acceleration and V8 optimizations
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// CRITICAL: Disable ALL Chrome extensions to prevent webcomponents conflicts (Video Highlight extension)
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-component-extensions-with-background-pages');
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('no-default-browser-check');
// Force a completely isolated user data dir to avoid any extension interference
const isolatedUserDataPath = path.join(app.getPath('temp'), 'grump-electron-isolated');
app.setPath('userData', isolatedUserDataPath);

let mainWindow = null;
let splashWindow = null;
let tray = null;
let backendProcess = null;
let backendReady = false;
let isQuitting = false;

// 16x16 tray icon fallback (when no icon file exists)
const TRAY_ICON_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKElEQVQ4T2NkYGD4z0ABYBwNAAAhKAX6R8jMogAAAABJRU5ErkJggg==';

// Pre-cache commonly used paths
const projectRoot = path.resolve(__dirname, '..', '..');
const backendDir = path.join(projectRoot, 'backend');
const backendScript = path.join(backendDir, 'dist', 'index.js');
const distPath = path.join(__dirname, '../dist/index.html');
const iconPath = path.join(__dirname, '../public/favicon.ico');
function getBoundsFile() {
  try { return path.join(app.getPath('userData'), 'window-bounds.json'); } catch (e) { return null; }
}
function getAlwaysOnTopFile() {
  try { return path.join(app.getPath('userData'), 'always-on-top.json'); } catch (e) { return null; }
}
function loadAlwaysOnTop() {
  const f = getAlwaysOnTopFile();
  if (!f || !fs.existsSync(f)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
    return !!data.alwaysOnTop;
  } catch (e) { }
  return false;
}
function saveAlwaysOnTop(flag) {
  const f = getAlwaysOnTopFile();
  if (!f) return;
  try {
    fs.writeFileSync(f, JSON.stringify({ alwaysOnTop: !!flag }), 'utf-8');
  } catch (e) { }
}

// Cached env vars
let cachedEnvVars = null;

// Fast .env loader with caching
function loadEnvFile(envPath) {
  if (cachedEnvVars) return cachedEnvVars;

  const envVars = {};
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line[0] === '#') continue;
        const eqIndex = line.indexOf('=');
        if (eqIndex > 0) {
          const key = line.slice(0, eqIndex).trim();
          let value = line.slice(eqIndex + 1).trim();
          if ((value[0] === '"' && value[value.length - 1] === '"') ||
            (value[0] === "'" && value[value.length - 1] === "'")) {
            value = value.slice(1, -1);
          }
          envVars[key] = value;
        }
      }
    }
  } catch (err) {
    // Silent fail - backend may work without .env
  }
  cachedEnvVars = envVars;
  return envVars;
}

// Non-blocking backend startup
function startBackendAsync() {
  // Don't await - let it start in background
  setImmediate(() => {
    if (fs.existsSync(backendScript)) {
      console.log('[G-Rump] Starting backend...');

      const envVars = loadEnvFile(path.join(backendDir, '.env'));

      backendProcess = spawn('node', [backendScript], {
        cwd: backendDir,
        env: {
          ...process.env,
          ...envVars,
          NODE_ENV: envVars.NODE_ENV || 'development'
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
        windowsHide: true
      });

      backendProcess.stdout.on('data', (data) => {
        const msg = data.toString().trim();
        console.log('[Backend]', msg);
        // Detect when backend is ready
        if (msg.includes('listening') || msg.includes('started') || msg.includes('ready')) {
          backendReady = true;
        }
      });

      backendProcess.stderr.on('data', (data) => {
        console.error('[Backend]', data.toString().trim());
      });

      backendProcess.on('error', (err) => {
        console.error('[G-Rump] Backend error:', err.message);
      });

      backendProcess.on('exit', (code) => {
        console.log('[G-Rump] Backend exited:', code);
        backendProcess = null;
        backendReady = false;
      });
    } else if (app.isPackaged) {
      // Production: look for bundled backend
      const bundledBackend = path.join(app.getAppPath(), 'grump-backend.exe');
      if (fs.existsSync(bundledBackend)) {
        backendProcess = spawn(bundledBackend, [], {
          cwd: path.dirname(bundledBackend),
          env: { ...process.env, NODE_ENV: 'production' },
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: false,
          windowsHide: true
        });
      }
    }
  });
}

function stopBackend() {
  if (backendProcess) {
    try {
      backendProcess.kill('SIGTERM');
    } catch (e) {
      // Force kill if SIGTERM fails
      try { backendProcess.kill('SIGKILL'); } catch (e2) { }
    }
    backendProcess = null;
    backendReady = false;
  }
}

// Minimal splash window - tiny logo + Loading... only, very short
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 320,
    height: 180,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    backgroundColor: '#1a1a1a',
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webgl: false,
      enableWebSQL: false
    }
  });

  const splashHTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#1a1a1a !important;min-height:100vh}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#A855F7;font-size:14px;overflow:hidden}
.logo{width:48px;height:48px;margin-bottom:12px}
</style></head><body>
<svg class="logo" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="45" stroke="#7C3AED" stroke-width="5" opacity="0.9"/><circle cx="35" cy="40" r="6" fill="#7C3AED"/><circle cx="65" cy="40" r="6" fill="#7C3AED"/><path d="M 28 68 Q 50 55 72 68" stroke="#7C3AED" stroke-width="5" stroke-linecap="round" fill="none"/></svg>
<p>Loading...</p>
</body></html>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
  splashWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show();
    }
  });
}

// Optimized main window creation
function createMainWindow() {
  // Pre-load icon
  let icon = null;
  try {
    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath);
    }
  } catch (e) { }

  // Load app
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const saved = loadWindowBounds();
  const width = saved && saved.width ? Math.max(800, saved.width) : 1400;
  const height = saved && saved.height ? Math.max(600, saved.height) : 900;
  const x = saved && typeof saved.x === 'number' ? saved.x : undefined;
  const y = saved && typeof saved.y === 'number' ? saved.y : undefined;

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 800,
    minHeight: 600,
    title: 'G-Rump',
    icon: icon,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      backgroundThrottling: false,
      enableWebSQL: false,
      webSecurity: !isDev,  // Disable webSecurity in dev to allow scripts to load
      // Prevent browser extensions from injecting scripts
      sandbox: true,
      allowRunningInsecureContent: false,
    },
    backgroundColor: '#0f0a1e',
    show: false,
    autoHideMenuBar: true
  });

  const aot = loadAlwaysOnTop();
  mainWindow.setAlwaysOnTop(aot);

  if (isDev) {
    // Retry loading the dev server URL until it's available
    const devURL = 'http://localhost:5173';
    const maxRetries = 30;
    let retries = 0;

    function loadDevURL() {
      mainWindow.loadURL(devURL).catch(() => {
        retries++;
        if (retries < maxRetries) {
          console.log(`[G-Rump] Vite dev server not ready, retrying (${retries}/${maxRetries})...`);
          setTimeout(loadDevURL, 1000);
        } else {
          console.error('[G-Rump] Could not connect to Vite dev server at', devURL);
          showMainWindow();
          mainWindow?.webContents?.openDevTools({ mode: 'detach' });
        }
      });
    }
    loadDevURL();
  } else {
    mainWindow.loadFile(distPath);
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Log renderer console messages to main process console for debugging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] ${message}`);
  });

  // Window is shown when renderer sends IPC 'close-splash-show-main', or on
  // did-fail-load / final dev failure / fallback. In dev only: also show after
  // 2s on did-finish-load so user can see the page and Console if IPC never comes.

  // DEBUG: Track page load events
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('[G-Rump] DEBUG: Page started loading');
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('[G-Rump] DEBUG: DOM ready');
  });

  // FORCE DevTools open immediately in dev mode
  if (!app.isPackaged) {
    console.log('[G-Rump] DEBUG: Opening DevTools immediately');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.show(); // Force show window too
  }

  if (isDev) {
    mainWindow.webContents.once('did-finish-load', () => {
      console.log('[G-Rump] DEBUG: Page finished loading');
      // Force show window and devtools immediately in dev
      showMainWindow();
      if (!app.isPackaged && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    });
  }

  // Handle load failures: show window and DevTools so user can see errors
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[G-Rump] Page load failed: ${errorDescription} (${errorCode})`);
    showMainWindow();
    mainWindow?.webContents?.openDevTools({ mode: 'detach' });
  });

  mainWindow.on('close', (e) => {
    saveWindowBounds();
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (tray) { try { tray.destroy(); tray = null; } catch (e) { } }
    stopBackend();
  });

  // Notify renderer when maximized state changes (for custom title bar)
  mainWindow.on('maximize', () => {
    mainWindow?.webContents?.send('window:maximized-change', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents?.send('window:maximized-change', false);
  });
}

function showMainWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    const saved = loadWindowBounds();
    if (saved && saved.maximized) mainWindow.maximize();
    mainWindow.show();
    mainWindow.focus();
  }
  createTray();
}

function createTray() {
  if (tray) return;
  try {
    let trayIcon = null;
    if (fs.existsSync(iconPath)) {
      trayIcon = nativeImage.createFromPath(iconPath);
      if (!trayIcon.isEmpty()) trayIcon = trayIcon.resize({ width: 16, height: 16 });
    }
    if (!trayIcon || trayIcon.isEmpty()) trayIcon = nativeImage.createFromDataURL(TRAY_ICON_DATA);
    tray = new Tray(trayIcon);
    tray.setToolTip('G-Rump');
    tray.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show G-Rump', click: () => { if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); } } },
      { label: 'New chat', click: () => { if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('app:focus-chat'); } } },
      { label: 'Settings', click: () => { if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('app:focus-settings'); } } },
      { label: 'Open workspace folder', click: () => { if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('app:open-workspace'); } } },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
  } catch (e) {
    console.log('[G-Rump] Tray creation skipped:', e.message);
  }
}

function loadWindowBounds() {
  const f = getBoundsFile();
  if (!f) return null;
  try {
    if (fs.existsSync(f)) {
      const data = fs.readFileSync(f, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) { }
  return null;
}

function saveWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const f = getBoundsFile();
  if (!f) return;
  try {
    const bounds = mainWindow.getBounds();
    const maximized = mainWindow.isMaximized();
    fs.writeFileSync(f, JSON.stringify({ ...bounds, maximized }), 'utf-8');
  } catch (e) { }
}

// IPC handler for manual splash close (called when Svelte app has mounted)
ipcMain.handle('close-splash-show-main', () => {
  showMainWindow();
  if (!app.isPackaged) {
    mainWindow?.webContents?.openDevTools({ mode: 'detach' });
  }
});

// Frameless window controls for custom title bar
ipcMain.handle('window:minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});
ipcMain.handle('window:maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.maximize();
});
ipcMain.handle('window:unmaximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.unmaximize();
});
ipcMain.handle('window:close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});
ipcMain.handle('window:isMaximized', () => {
  return mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized();
});
ipcMain.handle('window:setAlwaysOnTop', (_event, flag) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(!!flag);
    saveAlwaysOnTop(!!flag);
  }
});
ipcMain.handle('window:isAlwaysOnTop', () => {
  return mainWindow && !mainWindow.isDestroyed() && mainWindow.isAlwaysOnTop();
});

ipcMain.handle('theme:set', (_event, theme) => {
  nativeTheme.themeSource = theme;
});

// Open path in Explorer (Windows) / Finder (macOS) / file manager
ipcMain.handle('shell:open-path', (_event, pathToOpen) => {
  if (!pathToOpen || typeof pathToOpen !== 'string') return Promise.resolve({ error: 'Invalid path' });
  return shell.openPath(pathToOpen.trim()).then((err) => (err ? { error: err } : {}));
});
ipcMain.handle('shell:show-item-in-folder', (_event, pathToOpen) => {
  if (!pathToOpen || typeof pathToOpen !== 'string') return;
  try {
    shell.showItemInFolder(pathToOpen.trim());
  } catch (e) {
    console.warn('[G-Rump] showItemInFolder failed:', e?.message);
  }
});

// Folder picker for Settings > Security > Allowed directories
ipcMain.handle('dialog:select-directory', async () => {
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Select allowed directory',
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { canceled: true };
  }
  return { canceled: false, path: result.filePaths[0] };
});

// OS notification (ship/codegen complete, errors)
ipcMain.handle('notify', (_event, { title, body, tag }) => {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title: title || 'G-Rump',
    body: body || '',
    tag: tag || undefined,
  });
  n.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  n.show();
});

// --- Google OAuth window ---
let oauthWindow = null;

ipcMain.handle('auth:open-oauth-window', () => {
  if (oauthWindow && !oauthWindow.isDestroyed()) {
    oauthWindow.focus();
    return;
  }
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const oauthUrl = isDev
    ? 'http://localhost:5173/auth/google/start'
    : `file://${path.join(__dirname, '../dist/index.html')}?route=auth-google-start`;

  oauthWindow = new BrowserWindow({
    width: 450,
    height: 600,
    center: true,
    title: 'Sign in with Google',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
    },
  });

  oauthWindow.loadURL(oauthUrl);

  oauthWindow.on('closed', () => {
    oauthWindow = null;
  });
});

ipcMain.on('auth:complete', () => {
  if (oauthWindow && !oauthWindow.isDestroyed()) {
    oauthWindow.close();
    oauthWindow = null;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auth:complete');
  }
});

// --- Docker detection (vendor-agnostic) ---
async function getDockerVersion() {
  try {
    const { stdout } = await execAsync('docker --version', { timeout: 5000 });
    return { installed: true, version: stdout.trim() };
  } catch (e) {
    return { installed: false, error: e.message };
  }
}

async function getDockerInfo() {
  try {
    const { stdout } = await execAsync('docker info', { timeout: 10000 });
    const running = !stdout.includes('Cannot connect');
    return { running, raw: stdout };
  } catch (e) {
    return { running: false, error: e.message };
  }
}

async function getNvidiaToolkitVersion() {
  try {
    const { stdout } = await execAsync('nvidia-ctk --version', { timeout: 5000 });
    return { installed: true, version: stdout.trim() };
  } catch (e) {
    return { installed: false, error: e.message };
  }
}

// --- GPU detection: NVIDIA ---
async function tryNvidiaDetection() {
  try {
    const { stdout } = await execAsync('nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader', { timeout: 5000 });
    const lines = stdout.trim().split('\n').filter(Boolean);
    const gpus = lines.map((line) => {
      const [name = '', memoryTotal = '', driverVersion = ''] = line.split(',').map((s) => s.trim());
      return { name, memoryTotal, driverVersion };
    });
    if (gpus.length === 0) return null;
    return { vendor: 'nvidia', gpus };
  } catch (e) {
    return null;
  }
}

// --- GPU detection: AMD (Linux: rocm-smi; Windows: WMI) ---
async function tryAmdDetection() {
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execAsync('powershell -NoProfile -Command "Get-WmiObject Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json"', { timeout: 5000 });
      const data = JSON.parse(stdout);
      const adapters = Array.isArray(data) ? data : [data];
      const amdGpus = adapters.filter((a) => a && a.Name && String(a.Name).toLowerCase().includes('amd'));
      if (amdGpus.length === 0) return null;
      const gpus = amdGpus.map((a) => ({
        name: a.Name || 'AMD GPU',
        memoryTotal: a.AdapterRAM != null ? `${Math.round(Number(a.AdapterRAM) / 1024 / 1024)} MB` : '',
        driverVersion: ''
      }));
      return { vendor: 'amd', gpus };
    } catch (e) {
      return null;
    }
  }
  try {
    const { stdout } = await execAsync('rocm-smi --showproductname --showmeminfo vram_total 2>/dev/null || true', { timeout: 5000 });
    if (!stdout || !stdout.includes('GPU')) return null;
    const nameMatch = stdout.match(/Card[\s\S]*?(\S.*)/);
    const vramMatch = stdout.match(/vram_total\s*:\s*(\d+)/);
    const name = nameMatch ? nameMatch[1].trim() : 'AMD GPU';
    const vramMb = vramMatch ? Math.round(Number(vramMatch[1]) / 1024) : 0;
    const gpus = [{ name, memoryTotal: vramMb ? `${vramMb} MB` : '', driverVersion: '' }];
    return { vendor: 'amd', gpus };
  } catch (e) {
    return null;
  }
}

ipcMain.handle('docker:version', () => getDockerVersion());
ipcMain.handle('docker:info', () => getDockerInfo());
ipcMain.handle('docker:nvidia-toolkit', () => getNvidiaToolkitVersion());

ipcMain.handle('gpu:detect', async () => {
  const nvidia = await tryNvidiaDetection();
  if (nvidia) return nvidia;
  const amd = await tryAmdDetection();
  if (amd) return amd;
  return { vendor: 'none', gpus: [] };
});

ipcMain.handle('gpu:list', async () => {
  const result = await tryNvidiaDetection() || await tryAmdDetection();
  if (result && result.gpus && result.gpus.length) return result.gpus;
  return [];
});

// Wake word detection (scaffold for future Porcupine/picovoice integration)
let wakeWordActive = false;
ipcMain.handle('wake-word:start', async (_event, _accessKey) => {
  if (wakeWordActive) return { ok: true };
  wakeWordActive = true;
  console.log('[G-Rump] Wake word listener started (scaffold - add Picovoice for detection)');
  return { ok: true };
});
ipcMain.handle('wake-word:stop', async () => {
  wakeWordActive = false;
  return { ok: true };
});

// Protocol handler: grump:// (open in app)
function sendProtocolUrlToRenderer(url) {
  if (!url || !url.startsWith('grump://')) return;
  // grump://auth/done from OAuth redirect: close OAuth window, then notify main window
  if (url.startsWith('grump://auth/done')) {
    if (oauthWindow && !oauthWindow.isDestroyed()) {
      oauthWindow.close();
      oauthWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('app:protocol-url', url);
      mainWindow.webContents.send('auth:complete');
    }
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('app:protocol-url', url);
  }
}

// App ready - parallel initialization
app.whenReady().then(() => {
  // Register Docker IPC handlers (containers, images, volumes, Free Agent)
  registerDockerHandlers();

  // Single instance lock (Windows): second launch forwards URL to first instance
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }
  app.on('second-instance', (_event, argv) => {
    const url = argv && argv.find((a) => typeof a === 'string' && a.startsWith('grump://'));
    if (url) sendProtocolUrlToRenderer(url);
    else if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); }
  });

  // Register as default handler for grump:// (only when packaged to avoid stealing in dev)
  if (app.isPackaged) {
    try {
      app.setAsDefaultProtocolClient('grump');
    } catch (e) {
      console.warn('[G-Rump] setAsDefaultProtocolClient failed:', e?.message);
    }
  }

  // First launch: check argv for grump:// URL (Windows)
  const argvUrl = process.argv && process.argv.find((a) => typeof a === 'string' && a.startsWith('grump://'));
  if (argvUrl) setImmediate(() => sendProtocolUrlToRenderer(argvUrl));

  // Start everything in parallel
  Promise.all([
    // 1. Create splash immediately
    new Promise(resolve => {
      createSplashWindow();
      resolve();
    }),
    // 2. Start backend (non-blocking)
    new Promise(resolve => {
      startBackendAsync();
      resolve();
    }),
    // 3. Create main window
    new Promise(resolve => {
      createMainWindow();
      resolve();
    })
  ]);

  // Global shortcut: Ctrl+Shift+G to show G-Rump from anywhere
  globalShortcut.register('CommandOrControl+Shift+G', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Fallback timeout - show main window after 2s so splash never lingers
  setTimeout(() => {
    showMainWindow();
    if (!app.isPackaged && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  }, 2000);
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// macOS: open-url when user clicks grump:// link
app.on('open-url', (event, url) => {
  event.preventDefault();
  sendProtocolUrlToRenderer(url);
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  stopBackend();
});
app.on('quit', stopBackend);

// Handle crashes gracefully
process.on('uncaughtException', (error) => {
  console.error('[G-Rump] Uncaught exception:', error);
  stopBackend();
});
