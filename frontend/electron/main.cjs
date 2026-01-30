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

const { app, BrowserWindow, shell, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Enable hardware acceleration and V8 optimizations
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

let mainWindow = null;
let splashWindow = null;
let backendProcess = null;
let backendReady = false;

// Pre-cache commonly used paths
const projectRoot = path.resolve(__dirname, '..', '..');
const backendDir = path.join(projectRoot, 'backend');
const backendScript = path.join(backendDir, 'dist', 'index.js');
const distPath = path.join(__dirname, '../dist/index.html');
const iconPath = path.join(__dirname, '../public/favicon.ico');

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

// Minimal splash window - super fast
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 260,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    backgroundColor: '#1a1a1a',
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Disable features for faster load
      webgl: false,
      enableWebSQL: false
    }
  });

  // Inline HTML for maximum speed (no file load)
  const splashHTML = `<!DOCTYPE html>
<html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a1a;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#fff;overflow:hidden}
.logo{font-size:48px;margin-bottom:16px}
h1{font-size:28px;background:linear-gradient(135deg,#8B5CF6,#6B46C1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px}
p{color:#A855F7;font-size:14px;margin-bottom:24px}
.loader{width:120px;height:4px;background:#333;border-radius:2px;overflow:hidden}
.loader::after{content:'';display:block;width:40%;height:100%;background:linear-gradient(90deg,#8B5CF6,#A855F7);border-radius:2px;animation:load 1s ease-in-out infinite}
@keyframes load{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}
</style></head><body>
<div class="logo">☹️</div>
<h1>G-Rump</h1>
<p>Loading...</p>
<div class="loader"></div>
</body></html>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
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

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'G-Rump',
    icon: icon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      backgroundThrottling: false,
      enableWebSQL: false
    },
    backgroundColor: '#0f0a1e',
    show: false,
    autoHideMenuBar: true
  });

  // Load app
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

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
        }
      });
    }
    loadDevURL();
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(distPath);
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Show window only after the page has actually rendered content
  mainWindow.webContents.once('did-finish-load', () => {
    showMainWindow();
  });

  // Handle load failures so the window doesn't stay hidden forever
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[G-Rump] Page load failed: ${errorDescription} (${errorCode})`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopBackend();
  });
}

function showMainWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.focus();
  }
}

// IPC handler for manual splash close
ipcMain.handle('close-splash-show-main', showMainWindow);

// App ready - parallel initialization
app.whenReady().then(() => {
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

  // Fallback timeout - show main window after 10 seconds max to avoid infinite splash
  setTimeout(() => {
    showMainWindow();
  }, 10000);
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

app.on('before-quit', stopBackend);
app.on('quit', stopBackend);

// Handle crashes gracefully
process.on('uncaughtException', (error) => {
  console.error('[G-Rump] Uncaught exception:', error);
  stopBackend();
});
