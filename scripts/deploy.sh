#!/bin/bash
# =============================================================================
# G-Rump Deployment Script
# Supports: Railway, Fly.io, DigitalOcean, Local Docker
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Configuration
DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io}"
DOCKER_REPO="${DOCKER_REPO:-grump}"
BACKEND_IMAGE="$DOCKER_REGISTRY/$DOCKER_REPO/backend"
FRONTEND_IMAGE="$DOCKER_REGISTRY/$DOCKER_REPO/frontend"
VERSION="${VERSION:-latest}"

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# Health Check Functions
# =============================================================================

health_check() {
    local url=$1
    local max_attempts=${2:-30}
    local wait_time=${3:-2}
    
    log_info "Health checking: $url"
    
    for i in $(seq 1 $max_attempts); do
        if curl -sf "$url" > /dev/null 2>&1; then
            log_success "Health check passed!"
            return 0
        fi
        log_info "Attempt $i/$max_attempts... waiting ${wait_time}s"
        sleep $wait_time
    done
    
    log_error "Health check failed after $max_attempts attempts"
    return 1
}

# =============================================================================
# Build Functions
# =============================================================================

build_images() {
    log_info "Building Docker images..."
    
    cd "$PROJECT_DIR"
    
    # Build backend
    log_info "Building backend image..."
    docker build -f Dockerfile.backend -t "$BACKEND_IMAGE:$VERSION" -t "$BACKEND_IMAGE:latest" . \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --cache-from "$BACKEND_IMAGE:latest"
    
    # Build frontend
    log_info "Building frontend image..."
    docker build -t "$FRONTEND_IMAGE:$VERSION" -t "$FRONTEND_IMAGE:latest" ./frontend \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --cache-from "$FRONTEND_IMAGE:latest"
    
    log_success "Images built successfully!"
}

push_images() {
    log_info "Pushing images to registry..."
    
    docker push "$BACKEND_IMAGE:$VERSION"
    docker push "$BACKEND_IMAGE:latest"
    docker push "$FRONTEND_IMAGE:$VERSION"
    docker push "$FRONTEND_IMAGE:latest"
    
    log_success "Images pushed successfully!"
}

# =============================================================================
# Local Deployment
# =============================================================================

deploy_local() {
    log_info "Deploying locally with Docker Compose..."
    
    cd "$PROJECT_DIR"
    
    # Check if .env exists
    if [[ ! -f .env ]]; then
        log_warn ".env file not found. Copying from .env.example..."
        cp .env.example .env
        log_warn "Please edit .env with your API keys before deploying!"
        exit 1
    fi
    
    # Stop existing containers
    log_info "Stopping existing containers..."
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # Build and start
    log_info "Building and starting services..."
    docker-compose up --build -d
    
    # Wait for services to be ready
    log_info "Waiting for services to start..."
    sleep 5
    
    # Health checks
    health_check "http://localhost:3000/health/live"
    health_check "http://localhost:5173"
    
    log_success "Local deployment complete!"
    log_info "Backend: http://localhost:3000"
    log_info "Frontend: http://localhost:5173"
}

deploy_local_production() {
    log_info "Deploying locally in production mode..."
    
    cd "$PROJECT_DIR"
    
    if [[ ! -f .env ]]; then
        log_error ".env file not found. Please create one from .env.example"
        exit 1
    fi
    
    # Use PostgreSQL instead of SQLite
    export DB_TYPE=postgres
    
    docker-compose -f docker-compose.yml up --build -d
    
    sleep 10
    
    health_check "http://localhost:3000/health/live"
    health_check "http://localhost:5173"
    
    log_success "Production deployment complete!"
}

# =============================================================================
# Railway Deployment
# =============================================================================

deploy_railway() {
    log_info "Deploying to Railway..."
    
    # Check if Railway CLI is installed
    if ! command -v railway &> /dev/null; then
        log_info "Installing Railway CLI..."
        npm install -g @railway/cli
    fi
    
    # Check if logged in
    if ! railway whoami &> /dev/null; then
        log_info "Please login to Railway..."
        railway login
    fi
    
    cd "$PROJECT_DIR"
    
    # Link to project if not already linked
    if [[ ! -f .railway/config.json ]]; then
        log_info "Linking to Railway project..."
        railway link
    fi
    
    # Deploy
    log_info "Deploying to Railway..."
    railway up --detach
    
    # Get deployment URL
    local url=$(railway domain)
    log_success "Railway deployment complete!"
    log_info "Application URL: https://$url"
}

# =============================================================================
# Fly.io Deployment
# =============================================================================

deploy_fly() {
    log_info "Deploying to Fly.io..."
    
    # Check if Fly CLI is installed
    if ! command -v flyctl &> /dev/null; then
        log_info "Installing Fly CLI..."
        curl -L https://fly.io/install.sh | sh
        export PATH="$HOME/.fly/bin:$PATH"
    fi
    
    cd "$PROJECT_DIR"
    
    # Create fly.toml if it doesn't exist
    if [[ ! -f fly.toml ]]; then
        create_fly_toml
    fi
    
    # Check if app is created
    if ! flyctl apps list | grep -q "grump-backend"; then
        log_info "Creating Fly.io app..."
        flyctl apps create grump-backend
    fi
    
    # Deploy
    log_info "Deploying to Fly.io..."
    flyctl deploy --ha=false
    
    # Get app URL
    local url=$(flyctl status --json | grep -o '"Hostname": "[^"]*"' | cut -d'"' -f4)
    log_success "Fly.io deployment complete!"
    log_info "Application URL: https://$url"
}

create_fly_toml() {
    cat > "$PROJECT_DIR/fly.toml" << 'EOF'
app = 'grump-backend'
primary_region = 'iad'

[build]
  dockerfile = "Dockerfile.backend"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0
  processes = ['app']

[mounts]
  source = "grump_data"
  destination = "/app/data"

[[vm]]
  memory = '2gb'
  cpu_kind = 'shared'
  cpus = 2
EOF
}

# =============================================================================
# DigitalOcean Deployment
# =============================================================================

deploy_digitalocean() {
    log_info "Deploying to DigitalOcean..."
    
    # Check if doctl is installed
    if ! command -v doctl &> /dev/null; then
        log_error "doctl CLI not found. Please install it:"
        log_error "  https://docs.digitalocean.com/reference/doctl/how-to/install/"
        exit 1
    fi
    
    # Check if logged in
    if ! doctl account get &> /dev/null; then
        log_error "Not authenticated with DigitalOcean. Run: doctl auth init"
        exit 1
    fi
    
    cd "$PROJECT_DIR"
    
    # Create app spec if it doesn't exist
    if [[ ! -f .do/app.yaml ]]; then
        create_do_app_spec
    fi
    
    # Deploy
    log_info "Creating/updating DigitalOcean App Platform deployment..."
    doctl apps create --spec .do/app.yaml 2>/dev/null || \
        doctl apps update $(doctl apps list --format ID,Spec.Name --no-header | grep grump | awk '{print $1}') --spec .do/app.yaml
    
    log_success "DigitalOcean deployment initiated!"
    log_info "Check the DigitalOcean dashboard for deployment status."
}

create_do_app_spec() {
    mkdir -p "$PROJECT_DIR/.do"
    cat > "$PROJECT_DIR/.do/app.yaml" << EOF
name: grump
region: nyc
services:
  - name: backend
    source_dir: /
    dockerfile_path: Dockerfile.backend
    http_port: 3000
    instance_count: 1
    instance_size_slug: basic-xs
    health_check:
      http_path: /health/live
      port: 3000
    envs:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "3000"
      - key: DB_TYPE
        value: sqlite
      - key: DB_PATH
        value: /app/data/grump.db
      - key: NVIDIA_NIM_API_KEY
        value: \${NVIDIA_NIM_API_KEY}
        type: SECRET
      - key: ANTHROPIC_API_KEY
        value: \${ANTHROPIC_API_KEY}
        type: SECRET
    volumes:
      - name: grump-data
        mount_path: /app/data
EOF
}

# =============================================================================
# Cleanup
# =============================================================================

cleanup() {
    log_info "Cleaning up Docker resources..."
    
    docker-compose down --remove-orphans 2>/dev/null || true
    docker system prune -f --volumes 2>/dev/null || true
    
    log_success "Cleanup complete!"
}

# =============================================================================
# Main
# =============================================================================

show_help() {
    cat << EOF
G-Rump Deployment Script

Usage: $0 <command> [options]

Commands:
    local           Deploy locally with Docker Compose
    local-prod      Deploy locally in production mode (with PostgreSQL)
    railway         Deploy to Railway.app
    fly             Deploy to Fly.io
    digitalocean    Deploy to DigitalOcean App Platform
    build           Build Docker images only
    push            Build and push images to registry
    cleanup         Stop and clean up local deployment
    health          Check health of local deployment
    help            Show this help message

Environment Variables:
    DOCKER_REGISTRY Docker registry URL (default: ghcr.io)
    DOCKER_REPO     Docker repository name (default: grump)
    VERSION         Image version tag (default: latest)

Examples:
    $0 local                    # Deploy locally
    $0 build                    # Build images
    $0 push                     # Build and push to registry
    $0 railway                  # Deploy to Railway
    VERSION=2.0.0 $0 push       # Build and push with specific version

EOF
}

main() {
    case "${1:-help}" in
        local)
            deploy_local
            ;;
        local-prod)
            deploy_local_production
            ;;
        railway)
            deploy_railway
            ;;
        fly)
            deploy_fly
            ;;
        digitalocean)
            deploy_digitalocean
            ;;
        build)
            build_images
            ;;
        push)
            build_images
            push_images
            ;;
        cleanup)
            cleanup
            ;;
        health)
            health_check "http://localhost:3000/health/live" 10 1
            health_check "http://localhost:5173" 10 1
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
