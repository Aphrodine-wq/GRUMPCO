# G-Rump Auto-Update Setup Guide

This guide explains how to build and release auto-updating installers for G-Rump.

## Overview

The auto-update system uses:
- **electron-builder** - Creates NSIS installers (Setup.exe)
- **electron-updater** - Handles automatic updates from GitHub Releases
- **GitHub Actions** - Automates builds when you push version tags

## How It Works

1. **User installs** `G-Rump-Setup-x.x.x.exe`
2. **App checks for updates** automatically on startup (and every 4 hours)
3. **Updates download** in the background when available
4. **User is prompted** to restart to apply the update
5. **Seamless upgrade** - settings and data preserved

## Releasing a New Version

### Option 1: Automatic (Recommended)

1. **Update the version** in `frontend/package.json`:
   ```json
   {
     "version": "2.1.0"
   }
   ```

2. **Commit and tag**:
   ```bash
   git add .
   git commit -m "chore: release v2.1.0"
   git tag v2.1.0
   git push origin main --tags
   ```

3. **GitHub Actions will automatically**:
   - Build the app
   - Create `G-Rump-Setup-2.1.0.exe`
   - Upload to GitHub Releases
   - Generate `latest.yml` for auto-updater

### Option 2: Manual Build

1. **Set your GitHub token** (one-time setup):
   ```bash
   # Windows PowerShell
   $env:GH_TOKEN="your_github_personal_access_token"
   
   # Or in .env file
   GH_TOKEN=your_github_personal_access_token
   ```

2. **Build and publish**:
   ```bash
   cd frontend
   pnpm run electron:publish
   ```

   This builds the app and uploads to GitHub Releases.

## GitHub Token Setup

For publishing to work, you need a GitHub Personal Access Token:

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope
3. Use this token as `GH_TOKEN` environment variable

For GitHub Actions, the `GITHUB_TOKEN` is automatically provided.

## Files Created

After building, you'll find in `frontend/electron-dist/`:

| File | Purpose |
|------|---------|
| `G-Rump-Setup-x.x.x.exe` | Installer for users |
| `latest.yml` | Update manifest (electron-updater uses this) |
| `G-Rump-Setup-x.x.x.exe.blockmap` | Delta updates (faster updates) |

## Auto-Update Behavior

### In Development
- Auto-updater is **disabled** to avoid conflicts
- Use `grump.updater.getState()` to check status

### In Production
- Checks for updates **10 seconds after startup**
- Re-checks **every 4 hours**
- Downloads updates **automatically** in background
- Prompts user to **restart** when ready

### User Controls

The app exposes these APIs for UI integration:

```javascript
// Check for updates manually
await window.grump.updater.check();

// Get current state
const state = await window.grump.updater.getState();
// { checking, available, downloaded, downloading, progress, version, error }

// Listen for status changes
const unsubscribe = window.grump.updater.onStatus((status) => {
  console.log('Update status:', status);
  // status.status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
});

// Install downloaded update (restarts app)
await window.grump.updater.install();
```

## Installer Options

The NSIS installer includes:
- ✅ Desktop shortcut
- ✅ Start menu shortcut
- ✅ Custom install location option
- ✅ Uninstaller
- ✅ Auto-update support

## Troubleshooting

### Updates not working?

1. **Check logs**: In production, logs are at:
   - Windows: `%USERPROFILE%\AppData\Roaming\g-rump\logs\main.log`

2. **Verify release format**: Releases must include:
   - `G-Rump-Setup-x.x.x.exe`
   - `latest.yml`

3. **Check version**: New version must be higher than current

### Build failures?

1. **Icon missing**: Ensure `build/icon.ico` exists
2. **Dependencies**: Run `pnpm install` first
3. **Token expired**: Regenerate GitHub token

## Version Numbering

Use semantic versioning: `MAJOR.MINOR.PATCH`
- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes

The auto-updater compares versions to determine if an update is available.

## Security

- All releases are from your GitHub repository
- Users can verify the source
- Code signing (optional) adds additional trust - see electron-builder docs for Windows code signing setup
