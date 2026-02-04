#!/bin/bash
# =============================================================================
# Auto-Deploy User-Generated Apps to Docker
# =============================================================================
#
# This script automatically deploys user-generated applications to Docker
# containers. It handles the full lifecycle: build, containerize, and run.
#
# Usage:
#   ./scripts/auto-deploy-user-app.sh <app_directory> [app_name] [port]
#
# Example:
#   ./scripts/auto-deploy-user-app.sh ./generated-apps/my-react-app my-app 8080
#
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    log_error "Docker daemon is not running. Please start Docker."
    exit 1
fi

# Parse arguments
APP_DIR="${1:-.}"
APP_NAME="${2:-user-app-$(date +%s)}"
APP_PORT="${3:-8080}"

# Validate app directory
if [ ! -d "$APP_DIR" ]; then
    log_error "App directory not found: $APP_DIR"
    exit 1
fi

log_info "Auto-deploying app from: $APP_DIR"
log_info "App name: $APP_NAME"
log_info "Port: $APP_PORT"

# Detect app type
APP_TYPE="unknown"
if [ -f "$APP_DIR/package.json" ]; then
    if grep -q "\"react\"" "$APP_DIR/package.json"; then
        APP_TYPE="react"
    elif grep -q "\"next\"" "$APP_DIR/package.json"; then
        APP_TYPE="nextjs"
    elif grep -q "\"vue\"" "$APP_DIR/package.json"; then
        APP_TYPE="vue"
    elif grep -q "\"svelte\"" "$APP_DIR/package.json"; then
        APP_TYPE="svelte"
    else
        APP_TYPE="nodejs"
    fi
elif [ -f "$APP_DIR/requirements.txt" ]; then
    APP_TYPE="python"
elif [ -f "$APP_DIR/go.mod" ]; then
    APP_TYPE="go"
fi

log_info "Detected app type: $APP_TYPE"

# Generate Dockerfile if it doesn't exist
if [ ! -f "$APP_DIR/Dockerfile" ]; then
    log_info "Generating Dockerfile for $APP_TYPE app..."
    
    case $APP_TYPE in
        react|vue|svelte)
            cat > "$APP_DIR/Dockerfile" <<'EOF'
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF
            ;;
            
        nextjs)
            cat > "$APP_DIR/Dockerfile" <<'EOF'
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
EOF
            ;;
            
        nodejs)
            cat > "$APP_DIR/Dockerfile" <<'EOF'
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
EOF
            ;;
            
        python)
            cat > "$APP_DIR/Dockerfile" <<'EOF'
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]
EOF
            ;;
            
        go)
            cat > "$APP_DIR/Dockerfile" <<'EOF'
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN go build -o main .

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]
EOF
            ;;
            
        *)
            log_error "Unknown app type. Please create a Dockerfile manually."
            exit 1
            ;;
    esac
    
    log_success "Dockerfile generated"
fi

# Generate .dockerignore if it doesn't exist
if [ ! -f "$APP_DIR/.dockerignore" ]; then
    cat > "$APP_DIR/.dockerignore" <<'EOF'
node_modules
npm-debug.log
.git
.gitignore
.env
.env.local
.DS_Store
*.log
dist
build
.next
__pycache__
*.pyc
.pytest_cache
.venv
venv
EOF
    log_success ".dockerignore generated"
fi

# Stop and remove existing container if it exists
if docker ps -a --format '{{.Names}}' | grep -q "^${APP_NAME}$"; then
    log_info "Stopping existing container: $APP_NAME"
    docker stop "$APP_NAME" &> /dev/null || true
    docker rm "$APP_NAME" &> /dev/null || true
fi

# Build Docker image
log_info "Building Docker image: $APP_NAME:latest"
docker build -t "$APP_NAME:latest" "$APP_DIR"

if [ $? -ne 0 ]; then
    log_error "Docker build failed"
    exit 1
fi

log_success "Docker image built successfully"

# Run container
log_info "Starting container on port $APP_PORT..."
docker run -d \
    --name "$APP_NAME" \
    -p "$APP_PORT:80" \
    -p "$APP_PORT:3000" \
    -p "$APP_PORT:8000" \
    -p "$APP_PORT:8080" \
    --restart unless-stopped \
    "$APP_NAME:latest"

if [ $? -ne 0 ]; then
    log_error "Failed to start container"
    exit 1
fi

# Wait for container to be healthy
log_info "Waiting for container to be healthy..."
sleep 3

# Check container status
if docker ps --format '{{.Names}}' | grep -q "^${APP_NAME}$"; then
    log_success "Container is running!"
    echo ""
    echo "=========================================="
    echo "  🚀 Deployment Successful!"
    echo "=========================================="
    echo "  App Name: $APP_NAME"
    echo "  Port: $APP_PORT"
    echo "  URL: http://localhost:$APP_PORT"
    echo ""
    echo "  Container ID: $(docker ps -q -f name=$APP_NAME)"
    echo ""
    echo "  View logs: docker logs $APP_NAME"
    echo "  Stop app: docker stop $APP_NAME"
    echo "  Remove app: docker rm $APP_NAME"
    echo "=========================================="
else
    log_error "Container failed to start"
    log_info "Checking logs..."
    docker logs "$APP_NAME"
    exit 1
fi
EOF
