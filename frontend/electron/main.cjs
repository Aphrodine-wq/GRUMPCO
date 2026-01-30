const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let splashWindow;
let backendProcess = null;

// Load environment variables from .env file
function loadEnvFile(envPath) {
  const envVars = {};
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex).trim();
          let value = trimmed.slice(eqIndex + 1).trim();
          // Remove surrounding quotes
          value = value.replace(/^["']|["']$/g, '');
          envVars[key] = value;
        }
      }
      console.log('[G-Rump] Loaded .env file from:', envPath);
    }
  } catch (err) {
    console.warn('[G-Rump] Failed to load .env:', err.message);
  }
  return envVars;
}

// Find and start the backend server
function startBackend() {
  // Development mode: look for backend in project structure
  const projectRoot = path.resolve(__dirname, '..', '..');
  const backendDir = path.join(projectRoot, 'backend');
  const backendScript = path.join(backendDir, 'dist', 'index.js');

  if (fs.existsSync(backendScript)) {
    console.log('[G-Rump] Starting backend from:', backendScript);
    
    // Load .env from backend directory
    const envVars = loadEnvFile(path.join(backendDir, '.env'));
    
    backendProcess = spawn('node', [backendScript], {
      cwd: backendDir,
      env: {
        ...process.env,
        ...envVars,
        NODE_ENV: envVars.NODE_ENV || 'development'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    backendProcess.stdout.on('data', (data) => {
      console.log('[Backend]', data.toString().trim());
    });

    backendProcess.stderr.on('data', (data) => {
      console.error('[Backend Error]', data.toString().trim());
    });

    backendProcess.on('error', (err) => {
      console.error('[G-Rump] Failed to start backend:', err.message);
    });

    backendProcess.on('exit', (code) => {
      console.log('[G-Rump] Backend exited with code:', code);
      backendProcess = null;
    });

    return true;
  } else {
    // Production mode: look for bundled executable
    const appPath = app.getAppPath();
    const bundledBackend = path.join(appPath, 'grump-backend.exe');
    
    if (fs.existsSync(bundledBackend)) {
      console.log('[G-Rump] Starting bundled backend:', bundledBackend);
      
      backendProcess = spawn(bundledBackend, [], {
        cwd: path.dirname(bundledBackend),
        env: { ...process.env, NODE_ENV: 'production' },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      backendProcess.stdout.on('data', (data) => {
        console.log('[Backend]', data.toString().trim());
      });

      backendProcess.stderr.on('data', (data) => {
        console.error('[Backend Error]', data.toString().trim());
      });

      return true;
    }
  }

  console.warn('[G-Rump] Backend not found, running frontend only');
  return false;
}

// Stop the backend server
function stopBackend() {
  if (backendProcess) {
    console.log('[G-Rump] Stopping backend process');
    backendProcess.kill();
    backendProcess = null;
  }
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, '../splashscreen.html'));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'G-Rump',
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    backgroundColor: '#0f0a1e',
    show: false,
    autoHideMenuBar: true
  });

  // Load the app
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopBackend();
  });
}

// IPC handler to close splash and show main window
ipcMain.handle('close-splash-show-main', () => {
  if (splashWindow) {
    splashWindow.close();
    splashWindow = null;
  }
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  // Start backend first
  startBackend();
  
  // Create splash screen
  createSplashWindow();
  
  // Create main window (hidden initially)
  createMainWindow();
  
  // Auto-show main window after timeout if frontend doesn't signal readiness
  setTimeout(() => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 5000);
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

app.on('before-quit', () => {
  stopBackend();
});
