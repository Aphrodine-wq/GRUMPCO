# Building the Windows Installer (Setup.exe)

This guide describes how to build the G-Rump Windows installer (Setup.exe) using NSIS (Nullsoft Scriptable Install System).

## Prerequisites

- **Node.js** 18+ and **pnpm** (or npm) – for building backend and frontend
- **NSIS** – [download](https://nsis.sourceforge.io/Download) and install; ensure `makensis` is on your PATH (e.g. `C:\Program Files (x86)\NSIS\makensis.exe`)
- **Rust** (optional) – only if you want the intent-compiler binaries in the installer; install from [rustup.rs](https://rustup.rs)

## Steps

1. **Stage installer contents** (builds backend Windows bundle, frontend, and optionally intent-compiler, then copies to `installer/stage/`):

   ```bash
   npm run installer:stage
   ```

   Or from repo root with pnpm:

   ```bash
   pnpm run installer:stage
   ```

   This will:
   - Build the backend Windows bundle (`backend/dist-bundle/`) and copy it to `installer/stage/backend/`
   - Build the frontend (Vite) and copy it to `installer/stage/frontend/`
   - If Rust is installed, build the intent-compiler release binaries and copy to `installer/stage/intent-compiler/`
   - Create the `Start G-Rump.bat` launcher in the staged backend folder

2. **Build the Setup.exe** (requires NSIS installed):

   ```bash
   makensis installer/Setup.nsi
   ```

   Or stage and build the exe in one go:

   ```bash
   npm run installer:exe
   ```

3. **Output**

   The resulting `Setup.exe` is written to:

   ```
   installer/Output/Setup.exe
   ```

   The file is named `Setup.exe`.

## What the installer does

- Installs G-Rump to a folder of your choice (default: `%LOCALAPPDATA%\Programs\G-Rump`).
- Adds Start Menu shortcuts:
  - **Start G-Rump Backend** – runs the launcher that starts the backend server and opens http://localhost:3000 in the browser (Node.js 18+ required; on first run, `npm install` runs in the backend folder).
  - **Uninstall G-Rump**
- Registers an entry in **Add or Remove Programs** for clean uninstall.

## End-user requirement

**Node.js 18 or higher** must be installed and on PATH. The launcher will prompt if Node is missing. On first run, the launcher runs `npm install` in the installed backend folder to install native dependencies (e.g. better-sqlite3).

## CI (optional)

To produce the installer in CI, install Node, pnpm, NSIS (e.g. via Chocolatey: `choco install nsis`), and optionally Rust, then run:

```bash
pnpm run installer:exe
```

and publish the artifact `installer/Output/Setup.exe`.
