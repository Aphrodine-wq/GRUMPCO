# Electron Setup

G-Rump's desktop application is built with Electron, providing a native experience on Windows, macOS, and Linux.

## Overview

The Electron app provides:

- Native desktop experience
- Offline capability (with local models)
- System integration (notifications, file access)
- Automatic updates
- Secure local storage

## Installation

### Pre-built Binaries

Download from [GitHub Releases](https://github.com/Aphrodine-wq/G-rump.com/releases):

| Platform | File | Notes |
|----------|------|-------|
| Windows | `G-Rump-Setup-x.x.x.exe` | Installer |
| Windows | `G-Rump-x.x.x-portable.exe` | Portable |
| macOS Intel | `G-Rump-x.x.x.dmg` | DMG installer |
| macOS ARM | `G-Rump-x.x.x-arm64.dmg` | M1/M2/M3 |
| Linux | `G-Rump-x.x.x.AppImage` | Universal |
| Linux | `g-rump_x.x.x_amd64.deb` | Debian/Ubuntu |
| Linux | `g-rump-x.x.x.x86_64.rpm` | Fedora/RHEL |

### Building from Source

```bash
# Clone the repository
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com/frontend

# Install dependencies
npm install

# Development mode
npm run electron:dev

# Build for production
npm run electron:build
```

## Architecture

```
frontend/
├── electron/
│   ├── main.cjs          # Main process
│   └── preload.cjs       # Preload script (context bridge)
├── src/                  # Svelte frontend
├── splashscreen.html     # Loading screen
└── package.json          # Electron config
```

### Main Process (`main.cjs`)

The main process handles:

- Window management
- Backend server lifecycle
- System tray integration
- Auto-updates
- IPC communication

```javascript
// Key features in main.cjs

// Create main window with security settings
const mainWindow = new BrowserWindow({
  width: 1400,
  height: 900,
  webPreferences: {
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false
  }
});

// Auto-start backend server
const backendProcess = spawn('node', ['../backend/dist/index.js']);

// Handle app lifecycle
app.on('window-all-closed', () => {
  backendProcess.kill();
  app.quit();
});
```

### Preload Script (`preload.cjs`)

Securely exposes APIs to the renderer:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content) => ipcRenderer.invoke('dialog:saveFile', content),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  
  // Updates
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  
  // Platform info
  platform: process.platform
});
```

### Splash Screen

Shows while the app loads:

```html
<!-- splashscreen.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .loader {
      color: #7C3AED;
      font-family: system-ui;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="loader">
    <svg><!-- G-Rump logo --></svg>
    <p>Loading G-Rump...</p>
  </div>
</body>
</html>
```

## Configuration

### App Settings

Settings are stored in the user data directory:

- **Windows**: `%APPDATA%/g-rump/config.json`
- **macOS**: `~/Library/Application Support/g-rump/config.json`
- **Linux**: `~/.config/g-rump/config.json`

```json
{
  "api": {
    "provider": "openai",
    "apiKey": "encrypted:...",
    "model": "gpt-4"
  },
  "appearance": {
    "theme": "dark",
    "fontSize": 14,
    "fontFamily": "JetBrains Mono"
  },
  "backend": {
    "autoStart": true,
    "port": 3000
  },
  "updates": {
    "autoCheck": true,
    "autoDownload": false
  }
}
```

### Environment Variables

```bash
# API configuration
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Backend configuration
GRUMP_BACKEND_PORT=3000
GRUMP_BACKEND_HOST=localhost

# Development
ELECTRON_IS_DEV=1
```

## Development

### Development Mode

```bash
cd frontend

# Start with hot reload
npm run electron:dev
```

This runs:
1. Vite dev server for the Svelte frontend
2. Electron in development mode
3. Backend server (if configured)

### Debugging

**Main Process:**
```bash
# Start with debugging
npm run electron:dev -- --inspect
```

Then open `chrome://inspect` in Chrome.

**Renderer Process:**
Press `Cmd/Ctrl + Shift + I` to open DevTools.

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Building

### Build for Current Platform

```bash
npm run electron:build
```

### Build for Specific Platforms

```bash
# Windows
npm run electron:build -- --win

# macOS
npm run electron:build -- --mac

# Linux
npm run electron:build -- --linux

# All platforms (requires all platform tools)
npm run electron:build -- -mwl
```

### Build Configuration

```json
// package.json
{
  "build": {
    "appId": "com.grump.app",
    "productName": "G-Rump",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "electron/**/*",
      "splashscreen.html"
    ],
    "win": {
      "target": ["nsis", "portable"],
      "icon": "build/icon.ico"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "icon": "build/icon.icns",
      "category": "public.app-category.developer-tools"
    },
    "linux": {
      "target": ["AppImage", "deb", "rpm"],
      "icon": "build/icons",
      "category": "Development"
    }
  }
}
```

## Auto Updates

G-Rump uses `electron-updater` for automatic updates:

```javascript
// In main.cjs
const { autoUpdater } = require('electron-updater');

autoUpdater.checkForUpdatesAndNotify();

autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update-downloaded');
});
```

## Security

### Best Practices Implemented

1. **Context Isolation**: Renderer has no direct Node.js access
2. **Preload Scripts**: Controlled API exposure via contextBridge
3. **No Remote Module**: Disabled for security
4. **Secure Defaults**: WebSecurity enabled, nodeIntegration disabled

```javascript
// Secure window creation
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    enableRemoteModule: false,
    webSecurity: true,
    preload: path.join(__dirname, 'preload.cjs')
  }
});
```

## Troubleshooting

### App won't start

1. Check logs: `~/.config/g-rump/logs/`
2. Try running from terminal to see errors
3. Reset settings: Delete config directory

### Backend connection failed

1. Check if port 3000 is available
2. Verify backend is built: `cd backend && npm run build`
3. Check firewall settings

### White screen on startup

1. Clear cache: Delete `~/.config/g-rump/Cache`
2. Rebuild: `npm run electron:build`

## Next Steps

- [Configuration](/guide/configuration) - Detailed settings
- [Building from Source](/guide/building) - Development setup
- [Security](/guide/security) - Security best practices
