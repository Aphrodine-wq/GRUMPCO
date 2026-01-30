# Installation

Complete installation guide for all platforms and deployment options.

## System Requirements

### Minimum Requirements

- **OS**: Windows 10+, macOS 10.15+, Ubuntu 20.04+
- **RAM**: 4 GB
- **Disk**: 500 MB free space
- **Node.js**: 18.0+ (for CLI/development)

### Recommended

- **RAM**: 8 GB+
- **Disk**: 2 GB+ (for project files)
- **Network**: Stable internet for API calls

## Desktop Application

### Windows

**Installer (Recommended)**

1. Download `G-Rump-Setup-x.x.x.exe` from [Releases](https://github.com/Aphrodine-wq/G-rump.com/releases)
2. Run the installer
3. Follow the installation wizard
4. Launch from Start Menu or Desktop shortcut

**Portable Version**

1. Download `G-Rump-x.x.x-win.zip`
2. Extract to any folder
3. Run `G-Rump.exe`

### macOS

**DMG (Recommended)**

1. Download `G-Rump-x.x.x.dmg`
2. Open the DMG file
3. Drag G-Rump to Applications folder
4. Launch from Applications or Spotlight

**Homebrew** (coming soon)

```bash
brew install --cask grump
```

::: warning Apple Silicon
For M1/M2/M3 Macs, download the `arm64` version for best performance.
:::

### Linux

**AppImage (Universal)**

```bash
# Download
wget https://github.com/Aphrodine-wq/G-rump.com/releases/download/vX.X.X/G-Rump-x.x.x.AppImage

# Make executable
chmod +x G-Rump-x.x.x.AppImage

# Run
./G-Rump-x.x.x.AppImage
```

**Debian/Ubuntu (.deb)**

```bash
# Download and install
wget https://github.com/Aphrodine-wq/G-rump.com/releases/download/vX.X.X/g-rump_x.x.x_amd64.deb
sudo dpkg -i g-rump_x.x.x_amd64.deb

# Fix dependencies if needed
sudo apt-get install -f
```

**Fedora/RHEL (.rpm)**

```bash
wget https://github.com/Aphrodine-wq/G-rump.com/releases/download/vX.X.X/g-rump-x.x.x.x86_64.rpm
sudo rpm -i g-rump-x.x.x.x86_64.rpm
```

## CLI Installation

### npm (Recommended)

```bash
npm install -g grump-cli
```

### yarn

```bash
yarn global add grump-cli
```

### pnpm

```bash
pnpm add -g grump-cli
```

### Verify Installation

```bash
grump --version
# G-Rump CLI v1.0.0
```

## Docker

### Quick Start

```bash
docker run -d \
  --name grump \
  -p 3000:3000 \
  -e OPENAI_API_KEY=your-key \
  grump/grump:latest
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  grump:
    image: grump/grump:latest
    ports:
      - "3000:3000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - DATABASE_URL=postgresql://postgres:password@db:5432/grump
    depends_on:
      - db
    volumes:
      - ./projects:/app/projects

  db:
    image: postgres:15
    environment:
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=grump
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

```bash
docker-compose up -d
```

## From Source

### Prerequisites

- Git
- Node.js 18+
- npm 9+

### Clone and Build

```bash
# Clone repository
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com

# Install all dependencies
npm install

# Build everything
npm run build
```

### Development Mode

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Desktop app (optional)
cd frontend
npm run electron:dev
```

### Build Desktop App

```bash
cd frontend

# Build for current platform
npm run electron:build

# Build for specific platform
npm run electron:build -- --win
npm run electron:build -- --mac
npm run electron:build -- --linux
```

## Updating

### Desktop App

The desktop app checks for updates automatically. When an update is available:

1. A notification appears
2. Click "Update Now" to download
3. Restart to apply the update

### CLI

```bash
npm update -g grump-cli
```

### Docker

```bash
docker pull grump/grump:latest
docker-compose up -d
```

## Uninstallation

### Windows

1. Open Settings → Apps
2. Find "G-Rump"
3. Click Uninstall

### macOS

1. Drag G-Rump from Applications to Trash
2. Empty Trash

### Linux

```bash
# AppImage - just delete the file
rm G-Rump-*.AppImage

# Debian/Ubuntu
sudo apt remove g-rump

# Fedora/RHEL
sudo rpm -e g-rump
```

### CLI

```bash
npm uninstall -g grump-cli
```

## Troubleshooting

### "Command not found" after npm install

Add npm global bin to PATH:

```bash
# Find npm global bin
npm config get prefix

# Add to ~/.bashrc or ~/.zshrc
export PATH="$PATH:$(npm config get prefix)/bin"
```

### Desktop app won't start on Linux

Install required dependencies:

```bash
sudo apt install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils
```

### API connection issues

1. Check your API key is valid
2. Verify internet connectivity
3. Check firewall settings

See [Troubleshooting](/guide/troubleshooting) for more solutions.
