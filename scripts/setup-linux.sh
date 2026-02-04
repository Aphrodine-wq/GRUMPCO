#!/bin/bash
# G-Rump Linux Setup Script
# Supports Ubuntu, Debian, Fedora, Arch, and other distributions

set -e

echo "========================================"
echo "G-Rump Linux Setup"
echo "========================================"
echo ""

# Detect Linux distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO=$ID
    VERSION=$VERSION_ID
else
    echo "ERROR: Cannot detect Linux distribution"
    exit 1
fi

echo "Detected: $PRETTY_NAME"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "WARNING: Running as root is not recommended"
    echo "Please run as a normal user with sudo privileges"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Function to install Node.js based on distribution
install_nodejs() {
    echo "[1/6] Installing Node.js 20.x..."
    
    case $DISTRO in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        fedora|rhel|centos)
            sudo dnf module install -y nodejs:20
            ;;
        arch|manjaro)
            sudo pacman -S --noconfirm nodejs npm
            ;;
        *)
            echo "WARNING: Unsupported distribution for automatic Node.js installation"
            echo "Please install Node.js 20.x manually from https://nodejs.org/"
            read -p "Press Enter to continue if Node.js is already installed..."
            ;;
    esac
}

# Function to install build tools
install_build_tools() {
    echo "[2/6] Installing build tools..."
    
    case $DISTRO in
        ubuntu|debian)
            sudo apt-get update
            sudo apt-get install -y build-essential git python3
            ;;
        fedora|rhel|centos)
            sudo dnf groupinstall -y "Development Tools"
            sudo dnf install -y git python3
            ;;
        arch|manjaro)
            sudo pacman -S --noconfirm base-devel git python
            ;;
        *)
            echo "WARNING: Please install build tools manually"
            ;;
    esac
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    install_nodejs
else
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo "WARNING: Node.js version is too old ($(node --version))"
        echo "Node.js 18.x or higher is required"
        read -p "Install Node.js 20.x? (Y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            install_nodejs
        fi
    else
        echo "[1/6] Node.js $(node --version) is already installed"
    fi
fi

# Check if build tools are installed
if ! command -v gcc &> /dev/null || ! command -v make &> /dev/null; then
    install_build_tools
else
    echo "[2/6] Build tools are already installed"
fi

# Install dependencies
echo "[3/6] Installing npm dependencies..."
npm install

# Build packages
echo "[4/6] Building packages..."
npm run build:packages

# Set up environment
echo "[5/6] Setting up environment..."
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo "Created backend/.env from example"
    echo "Please edit backend/.env and add your API keys"
fi

# Set executable permissions
echo "[6/6] Setting executable permissions..."
chmod +x scripts/*.sh
chmod +x intent-compiler/build-*.sh 2>/dev/null || true

echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "To start G-Rump:"
echo "  1. Backend:  cd backend && npm run dev"
echo "  2. Frontend: cd frontend && npm run dev"
echo "  3. CLI:      npm install -g @g-rump/cli"
echo ""
echo "For Docker deployment:"
echo "  docker-compose -f deploy/docker-compose.yml up -d"
echo ""
echo "For systemd service:"
echo "  See deploy/systemd/README.md"
echo ""

# Optional: Offer to install as systemd service
read -p "Install as systemd service? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Installing systemd service..."
    sudo cp deploy/systemd/grump-backend.service /etc/systemd/system/
    sudo systemctl daemon-reload
    echo "Service installed. Enable with: sudo systemctl enable grump-backend"
    echo "Start with: sudo systemctl start grump-backend"
fi

echo ""
echo "Setup complete! Happy coding with G-Rump! 🚀"
