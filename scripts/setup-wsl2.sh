#!/bin/bash
# WSL2 Development Environment Setup Script

set -e

echo "==================================="
echo "G-Rump WSL2 Setup Script"
echo "==================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running in WSL
if ! grep -qi microsoft /proc/version; then
    echo -e "${YELLOW}Warning: This script is designed for WSL2${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}Step 1: Updating system packages${NC}"
sudo apt update
sudo apt upgrade -y

echo -e "${GREEN}Step 2: Installing build essentials${NC}"
sudo apt install -y \
    build-essential \
    curl \
    git \
    wget \
    ca-certificates \
    gnupg \
    lsb-release \
    python3 \
    python3-pip \
    pkg-config \
    libssl-dev

echo -e "${GREEN}Step 3: Installing Node.js via nvm${NC}"
if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
    nvm alias default 20
else
    echo "nvm already installed"
fi

echo -e "${GREEN}Step 4: Installing Rust${NC}"
if ! command -v rustc &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    rustup component add clippy rustfmt
else
    echo "Rust already installed"
    rustup update
fi

echo -e "${GREEN}Step 5: Installing Docker${NC}"
if ! command -v docker &> /dev/null; then
    # Add Docker's official GPG key
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Set up the repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    
    echo -e "${YELLOW}Note: You may need to log out and back in for docker group changes to take effect${NC}"
else
    echo "Docker already installed"
fi

echo -e "${GREEN}Step 6: Installing Redis${NC}"
if ! command -v redis-server &> /dev/null; then
    sudo apt install -y redis-server
    sudo systemctl enable redis-server
    sudo systemctl start redis-server
else
    echo "Redis already installed"
fi

echo -e "${GREEN}Step 7: Installing development tools${NC}"
sudo apt install -y \
    htop \
    iotop \
    iftop \
    sysstat \
    net-tools \
    jq \
    ripgrep \
    fd-find \
    bat

# Install hyperfine for benchmarking
if ! command -v hyperfine &> /dev/null; then
    wget https://github.com/sharkdp/hyperfine/releases/download/v1.18.0/hyperfine_1.18.0_amd64.deb
    sudo dpkg -i hyperfine_1.18.0_amd64.deb
    rm hyperfine_1.18.0_amd64.deb
fi

echo -e "${GREEN}Step 8: Optimizing system settings${NC}"

# Increase file descriptors
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Optimize TCP settings
sudo tee -a /etc/sysctl.conf > /dev/null <<EOF

# G-Rump optimizations
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 10000 65535
net.core.netdev_max_backlog = 5000
EOF

sudo sysctl -p

echo -e "${GREEN}Step 9: Setting up project${NC}"

# Install project dependencies
if [ -f "package.json" ]; then
    echo "Installing project dependencies..."
    npm install
fi

# Build Rust intent compiler
if [ -d "intent-compiler" ]; then
    echo "Building intent compiler..."
    cd intent-compiler
    cargo build --release
    cd ..
fi

echo ""
echo -e "${GREEN}==================================="
echo "Setup Complete!"
echo "===================================${NC}"
echo ""
echo "Next steps:"
echo "1. Log out and back in for docker group changes to take effect"
echo "2. Run 'source ~/.bashrc' to load nvm and cargo"
echo "3. Run 'cd backend && npm install && npm run build' to build the backend"
echo "4. Run 'npm test' to verify everything works"
echo ""
echo "Performance tips:"
echo "- Work in ~/projects instead of /mnt/c for better performance"
echo "- Use 'npm run build' (SWC) instead of 'npm run build:tsc' for faster builds"
echo "- Run 'cargo bench' in intent-compiler to see performance improvements"
echo ""
echo -e "${YELLOW}Benchmark your setup:${NC}"
echo "  cd intent-compiler && cargo bench"
echo "  cd backend && time npm run build"
echo ""
