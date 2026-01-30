# Windows Build Guide

This guide explains how to build G-Rump for Windows production distribution.

## Desktop App

G-Rump uses Electron as the desktop runtime:

- **Electron**: Cross-platform, easy setup, single portable executable

## Electron Build

### Prerequisites

1. **Node.js 20+**
   - Install from https://nodejs.org/
   - Ensure `node` and `npm` are in PATH

### Build Process

```bash
cd frontend
npm install
npm run build
npm run electron:build
```

Output: `frontend/electron-dist/G-Rump.exe` (portable executable)

The Electron build:
- Creates a single portable `.exe` file
- Bundles the Svelte frontend
- Includes splash screen
- Auto-starts the backend (if found in `../backend/dist/`)

### Electron Configuration

The Electron build configuration is in `frontend/package.json` under the `build` key:
- `appId`: `com.grump.app`
- `productName`: `G-Rump`
- `win.target`: `portable` (single `.exe`)
- `win.icon`: `public/favicon.ico`

## Environment Configuration

For production builds, create a `.env` file in the backend directory:
- `backend/.env`

Example:
```
NVIDIA_NIM_API_KEY=your-key-here
# Or use OPENROUTER_API_KEY=your-key-here
NODE_ENV=production
PORT=3000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:3000
```

Secrets are not bundled: the frontend and Electron app do not include `.env` or API keys. The backend reads env at runtime from the backend directory.

## Code Signing (Windows)

For distribution trust and fewer SmartScreen warnings, sign the Windows executable:

1. Obtain a Windows code-signing certificate (e.g. from DigiCert, Sectigo, or your CA).
2. Configure electron-builder in `frontend/package.json` for signing.
3. Rebuild the app; the generated executable will be signed.

If signing is not configured, the executable is built but unsigned; users may see SmartScreen warnings.

## Security (production)

- **CORS**: In production, set `CORS_ORIGINS` to the exact origins the Electron app uses (e.g. `http://localhost:5173`, `http://127.0.0.1:3000`). The backend defaults to a minimal list when `NODE_ENV=production` and `CORS_ORIGINS` is unset.
- **Binding**: The backend listens on `127.0.0.1` when `NODE_ENV=production` (or when `HOST=127.0.0.1` is set), so it is not exposed on the network. Set `HOST` explicitly if you need to override.
- **Metrics**: Protect the `/metrics` endpoint in production by setting `METRICS_AUTH` (basic auth). The backend enforces this when `NODE_ENV=production`.
- **Electron**: The preload script uses `contextIsolation: true` and exposes minimal APIs via `contextBridge`. External links open in the default browser.

## Troubleshooting

### Build Fails with "Cannot find module"

- Ensure all dependencies are installed: `npm install` in both backend and frontend
- Clear node_modules and reinstall if needed

### Backend Bundle Too Large

- The bundled executable includes Node.js runtime (~50-100MB)
- This is expected for standalone distribution

## Testing the Build

### Electron

1. Run `frontend/electron-dist/G-Rump.exe`
2. The splash screen should appear briefly
3. Main window loads with the app
4. Backend starts automatically (check console for "[Backend]" logs)

## Distribution

### Electron

The portable `G-Rump.exe` can be distributed directly. Users need:
- The backend built and available (or bundled separately)
- API key configured in `backend/.env`
