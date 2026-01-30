# Windows Build Guide

This guide explains how to build G-Rump for Windows production distribution.

## Prerequisites

1. **Rust Toolchain**
   - Install from https://rustup.rs/
   - Ensure `rustc` and `cargo` are in PATH
   - Add Windows MSVC target: `rustup target add x86_64-pc-windows-msvc`

2. **Node.js 20+**
   - Install from https://nodejs.org/
   - Ensure `node` and `npm` are in PATH

3. **Visual Studio Build Tools** (for MSVC target)
   - Install "Desktop development with C++" workload
   - Or install Visual Studio Community with C++ support

## Build Process

### Automated Build

Run the build script:
```bash
build-windows.bat
```

This script automates all build steps.

### Manual Build Steps

#### 1. Build Intent Compiler

```bash
cd intent-compiler
cargo build --release --target x86_64-pc-windows-msvc
```

Output: `intent-compiler/target/x86_64-pc-windows-msvc/release/grump-intent.exe`

#### 2. Bundle Backend

```bash
cd backend
npm install
npm run bundle
```

Output: `backend/dist-bundle/grump-backend.exe`

This creates a standalone executable with embedded Node.js runtime.

#### 3. Build Frontend

```bash
cd frontend
npm install
npm run build
```

Output: `frontend/dist/` (static files)

#### 4. Build Tauri App

```bash
cd frontend
npm run tauri:build
```

Output: `frontend/src-tauri/target/release/bundle/`

Installers:
- MSI: `bundle/msi/G-Rump_0.1.0_x64_en-US.msi`
- NSIS: `bundle/nsis/G-Rump_0.1.0_x64-setup.exe`

## Resource Bundling

The Tauri build automatically includes:
- `grump-backend.exe` - Bundled backend executable
- `grump-intent.exe` - Intent compiler binary

These are extracted to the app data directory on first run.

## Environment Configuration

For production builds, create a `.env` file in the app data directory:
- Windows: `%APPDATA%\com.grump.app\.env`

Example:
```
NVIDIA_NIM_API_KEY=your-key-here
# Or use OPENROUTER_API_KEY=your-key-here
NODE_ENV=production
PORT=3000
CORS_ORIGINS=tauri://localhost,http://tauri.localhost,http://127.0.0.1:3000
```

Secrets are not bundled: the frontend and Tauri app do not include `.env` or API keys. The bundled backend reads env at runtime from the app data directory or from a `.env` file placed there by the user or installer.

## Code Signing (Windows)

For distribution trust and fewer SmartScreen warnings, sign the Windows installers:

1. Obtain a Windows code-signing certificate (e.g. from DigiCert, Sectigo, or your CA).
2. In `frontend/src-tauri/tauri.conf.json`, under `bundle.windows`:
   - Set `certificateThumbprint` to the thumbprint of your certificate.
   - Set `timestampUrl` to a trusted timestamp server, e.g. `http://timestamp.digicert.com` or `http://timestamp.sectigo.com`.
3. Rebuild the app; the generated MSI/NSIS installers will be signed.

If these values are left `null`/empty, installers are built but unsigned; users may see SmartScreen warnings.

## Security (production)

- **CORS**: In production, set `CORS_ORIGINS` to the exact origins the Tauri app uses (e.g. `tauri://localhost`, `http://127.0.0.1:3000`). The backend defaults to a minimal list when `NODE_ENV=production` and `CORS_ORIGINS` is unset.
- **Binding**: The backend listens on `127.0.0.1` when `NODE_ENV=production` (or when `HOST=127.0.0.1` is set), so it is not exposed on the network. Set `HOST` explicitly if you need to override.
- **Metrics**: Protect the `/metrics` endpoint in production by setting `METRICS_AUTH` (basic auth). The backend enforces this when `NODE_ENV=production`.
- **Tauri**: CSP and capabilities are configured in `frontend/src-tauri/tauri.conf.json` and `frontend/src-tauri/capabilities/default.json`. Only the `main` and `splashscreen` windows use the default capability set.

## Troubleshooting

### Build Fails with "Cannot find module"

- Ensure all dependencies are installed: `npm install` in both backend and frontend
- Clear node_modules and reinstall if needed

### Rust Build Fails

- Ensure MSVC target is installed: `rustup target add x86_64-pc-windows-msvc`
- Check Visual Studio Build Tools are installed

### Backend Bundle Too Large

- The bundled executable includes Node.js runtime (~50-100MB)
- This is expected for standalone distribution

### Tauri Build Fails

- Check `frontend/src-tauri/tauri.conf.json` has correct resource paths
- Ensure all resources exist before building

## Testing the Build

1. Install the generated MSI or NSIS installer
2. Launch G-Rump
3. Check that backend starts automatically
4. Verify API connectivity

## Distribution

The installers can be distributed directly. Users do not need:
- Node.js installed
- Rust toolchain
- Any development dependencies

All required components are bundled in the installer.
