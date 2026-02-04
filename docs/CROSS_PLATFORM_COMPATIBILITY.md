# Cross-Platform Compatibility Guide

**Version:** 2.1.0  
**Last Updated:** February 2026

## Overview

G-Rump is designed to work seamlessly across multiple operating systems, including **Windows 7, Windows 10, Windows 11, and various Linux distributions**. This document outlines the compatibility requirements, platform-specific considerations, and troubleshooting steps to ensure a smooth experience on all supported platforms.

## Supported Platforms

### Windows

| Version | Support Status | Notes |
|---------|---------------|-------|
| **Windows 11** | ✅ Fully Supported | Recommended platform for optimal performance |
| **Windows 10** | ✅ Fully Supported | All features available |
| **Windows 7** | ⚠️ Limited Support | Requires additional configuration (see below) |

### Linux

| Distribution | Support Status | Notes |
|--------------|---------------|-------|
| **Ubuntu 20.04+** | ✅ Fully Supported | Recommended Linux distribution |
| **Debian 11+** | ✅ Fully Supported | Stable and well-tested |
| **Fedora 36+** | ✅ Fully Supported | Modern packages available |
| **Arch Linux** | ✅ Fully Supported | Rolling release, latest packages |
| **CentOS/RHEL 8+** | ✅ Supported | Enterprise environments |
| **Other distributions** | ⚠️ Community Support | May require manual dependency installation |

### macOS

| Version | Support Status | Notes |
|---------|---------------|-------|
| **macOS 12+** | ✅ Fully Supported | Intel and Apple Silicon |

## System Requirements

### Minimum Requirements

- **CPU**: Dual-core processor (2 GHz or higher)
- **RAM**: 4 GB (8 GB recommended)
- **Disk Space**: 2 GB free space
- **Node.js**: 18.x or higher (20.x recommended)
- **npm**: 9.x or higher
- **Internet**: Required for AI provider API access

### Recommended Requirements

- **CPU**: Quad-core processor (3 GHz or higher)
- **RAM**: 16 GB or more
- **Disk Space**: 10 GB free space (for caching and workspaces)
- **GPU**: NVIDIA GPU with CUDA support (optional, for local inference)

## Platform-Specific Setup

### Windows 7 Setup

Windows 7 requires additional steps due to its age and lack of modern TLS support. Follow these instructions carefully:

#### Prerequisites

1. **Install Windows 7 Service Pack 1** (if not already installed)
   - Download from [Microsoft Update Catalog](https://www.catalog.update.microsoft.com/)

2. **Enable TLS 1.2 Support**
   - Download and install the [Easy Fix tool](https://support.microsoft.com/en-us/topic/update-to-enable-tls-1-1-and-tls-1-2-as-default-secure-protocols-in-winhttp-in-windows-c4bd73d2-31d7-761e-0178-11268bb10392)
   - Or manually enable via registry:
     ```reg
     [HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.2\Client]
     "DisabledByDefault"=dword:00000000
     "Enabled"=dword:00000001
     ```

3. **Install Visual C++ Redistributables**
   - Download and install [Visual C++ 2015-2022 Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe)

4. **Install Node.js 18.x** (Latest compatible with Windows 7)
   - Download Node.js 18.x from [nodejs.org](https://nodejs.org/en/download/)
   - **Note**: Node.js 20+ does not officially support Windows 7

5. **Update npm**
   ```cmd
   npm install -g npm@latest
   ```

#### Known Limitations on Windows 7

- **Electron Desktop App**: Limited support due to Chromium compatibility issues
  - Electron 22 is the last version with Windows 7 support
  - Consider using the CLI or web interface instead
- **Native Modules**: Some native Node.js modules may require manual compilation
- **Security Updates**: Windows 7 is no longer receiving security updates from Microsoft

#### Alternative: Use Docker on Windows 7

For the best experience on Windows 7, we recommend using Docker:

1. Install [Docker Toolbox](https://github.com/docker/toolbox/releases) (for Windows 7)
2. Run G-Rump in a container:
   ```bash
   docker-compose -f deploy/docker-compose.yml up -d
   ```

### Windows 10/11 Setup

Windows 10 and 11 provide the best experience with full feature support.

#### Installation Steps

1. **Install Node.js 20.x**
   ```powershell
   # Using winget (Windows 10 1809+)
   winget install OpenJS.NodeJS.LTS
   
   # Or download from https://nodejs.org/
   ```

2. **Install Build Tools** (for native modules)
   ```powershell
   npm install -g windows-build-tools
   ```

3. **Clone and Install G-Rump**
   ```powershell
   git clone https://github.com/Aphrodine-wq/GRUMPCO.git
   cd GRUMPCO
   npm install
   npm run build:packages
   ```

4. **Configure Environment**
   ```powershell
   cp backend/.env.example backend/.env
   # Edit backend/.env with your API keys
   ```

5. **Run G-Rump**
   ```powershell
   # Backend
   cd backend
   npm run dev
   
   # Frontend (in a new terminal)
   cd frontend
   npm run electron:dev
   ```

#### Windows-Specific Features

- **System Tray Integration**: Available on Windows 10/11
- **Global Shortcuts**: `Ctrl+Shift+G` to show G-Rump
- **OS Notifications**: Native Windows notifications for ship/codegen completion
- **Protocol Handler**: `grump://` URLs for deep linking

### Linux Setup

Linux provides excellent performance and is the recommended platform for server deployments.

#### Ubuntu/Debian Installation

```bash
# Update package list
sudo apt update

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install build essentials
sudo apt install -y build-essential git

# Clone and install G-Rump
git clone https://github.com/Aphrodine-wq/GRUMPCO.git
cd GRUMPCO
npm install
npm run build:packages

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# Run G-Rump
cd backend && npm run dev &
cd ../frontend && npm run dev
```

#### Fedora/RHEL/CentOS Installation

```bash
# Install Node.js 20.x
sudo dnf module install nodejs:20

# Install development tools
sudo dnf groupinstall "Development Tools"
sudo dnf install git

# Clone and install G-Rump
git clone https://github.com/Aphrodine-wq/GRUMPCO.git
cd GRUMPCO
npm install
npm run build:packages

# Configure and run (same as Ubuntu)
```

#### Arch Linux Installation

```bash
# Install Node.js
sudo pacman -S nodejs npm git base-devel

# Clone and install G-Rump
git clone https://github.com/Aphrodine-wq/GRUMPCO.git
cd GRUMPCO
npm install
npm run build:packages

# Configure and run (same as Ubuntu)
```

#### Linux-Specific Considerations

- **Desktop App**: Requires X11 or Wayland display server
- **GPU Support**: NVIDIA GPUs require CUDA drivers for local inference
- **Permissions**: Some operations may require `sudo` privileges
- **Systemd Service**: See [deploy/systemd/](../deploy/systemd/) for service configuration

## Cross-Platform Development

### Path Handling

G-Rump uses `path.join()` and `path.resolve()` to ensure cross-platform path compatibility:

```typescript
import path from 'path';

// ✅ Correct - works on all platforms
const filePath = path.join(__dirname, 'data', 'file.txt');

// ❌ Incorrect - hardcoded separators
const filePath = __dirname + '/data/file.txt'; // Fails on Windows
```

### Line Endings

- **Windows**: CRLF (`\r\n`)
- **Linux/macOS**: LF (`\n`)

Git is configured to handle line endings automatically via `.gitattributes`:

```
* text=auto
*.js text eol=lf
*.ts text eol=lf
*.sh text eol=lf
*.bat text eol=crlf
*.cmd text eol=crlf
```

### Environment Variables

Use `cross-env` for setting environment variables in npm scripts:

```json
{
  "scripts": {
    "dev": "cross-env NODE_ENV=development tsx watch src/index.ts"
  }
}
```

### Shell Scripts

- **Linux/macOS**: Use `.sh` scripts with `#!/bin/bash` shebang
- **Windows**: Provide `.bat` or `.cmd` equivalents
- **Cross-platform**: Use Node.js scripts (`.js` or `.ts`) when possible

## Troubleshooting

### Common Issues

#### Issue: "Cannot find module" errors

**Solution**: Rebuild native modules for your platform

```bash
npm rebuild
```

#### Issue: Permission denied on Linux

**Solution**: Fix file permissions

```bash
chmod +x scripts/*.sh
chmod +x intent-compiler/build-*.sh
```

#### Issue: Electron fails to start on Windows 7

**Solution**: Use Electron 22 or earlier

```bash
cd frontend
npm install electron@22.3.27 --save-dev
```

#### Issue: EACCES errors on Linux

**Solution**: Fix npm global directory permissions

```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

#### Issue: Build fails on Windows with "gyp ERR!"

**Solution**: Install Windows Build Tools

```powershell
npm install -g windows-build-tools
```

### Platform-Specific Logs

- **Windows**: `%APPDATA%\g-rump\logs\`
- **Linux**: `~/.config/g-rump/logs/`
- **macOS**: `~/Library/Application Support/g-rump/logs/`

## Testing Cross-Platform Compatibility

### Manual Testing Checklist

- [ ] Install on Windows 7, 10, and 11
- [ ] Install on Ubuntu, Fedora, and Arch Linux
- [ ] Test CLI on all platforms
- [ ] Test Desktop app on all platforms (except Windows 7)
- [ ] Verify path handling in workspaces
- [ ] Test file operations (create, read, write, delete)
- [ ] Verify environment variable loading
- [ ] Test shell script execution

### Automated Testing

Our CI/CD pipeline tests on multiple platforms:

- **GitHub Actions**: Ubuntu, Windows, macOS
- **Docker**: Linux containers
- **Local VMs**: Windows 7, Windows 10, Windows 11

See [.github/workflows/ci.yml](../.github/workflows/ci.yml) for details.

## Best Practices

1. **Always use `path` module** for file paths
2. **Use `os` module** for platform detection
3. **Test on all target platforms** before releasing
4. **Provide platform-specific documentation** when needed
5. **Use `cross-env`** for environment variables in scripts
6. **Handle line endings** properly in Git
7. **Provide both `.sh` and `.bat` scripts** for convenience

## Support

For platform-specific issues:

1. Check [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Search [GitHub Issues](https://github.com/Aphrodine-wq/GRUMPCO/issues)
3. Join our [Discord Community](https://discord.gg/grump)
4. Email: support@g-rump.com

## Contributing

When contributing cross-platform code:

1. Test on at least two platforms (Windows + Linux)
2. Use platform-agnostic APIs
3. Document platform-specific behavior
4. Update this guide if adding platform-specific features

See [CONTRIBUTING.md](./legal/CONTRIBUTING.md) for more details.
