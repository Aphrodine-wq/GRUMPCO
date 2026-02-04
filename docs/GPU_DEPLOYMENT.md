# G-Rump GPU Deployment Guide

Deploy G-Rump on a GPU VM for maximum performance with local LLM inference.

**NVIDIA Golden Developer** — For NGC-certified cloud deployment (GCP/AWS), use [deploy/ngc/](../deploy/ngc/). The main app uses NVIDIA NIM cloud API by default; GPU VMs are optional for NeMo Curator and NeMo Framework fine-tuning.

## Quick Comparison: GPU Hosting Options

| Provider | GPU | VRAM | Price/mo | Best For |
|----------|-----|------|----------|----------|
| **Vast.ai** | RTX 4090 | 24GB | $150-300 | Cheapest, spot instances |
| **RunPod** | RTX 4090 | 24GB | $300-400 | Easy setup, good UI |
| **Lambda Labs** | A10G | 24GB | $400-500 | Reliable, good support |
| **Paperspace** | RTX 4000 | 16GB | $200-300 | Simple, Gradient notebooks |
| **NVIDIA DGX Cloud** | A100/H100 | 40-80GB | $1000+ | Enterprise, max performance |
| **AWS g5.xlarge** | A10G | 24GB | $800+ | Enterprise, AWS ecosystem |
| **GCP a2-highgpu** | A100 | 40GB | $1200+ | Enterprise, GCP ecosystem |

---

## Option 1: Cheap GPU VM (Vast.ai / RunPod)

### Step 1: Rent a GPU VM

**Vast.ai (Cheapest)**
```bash
# Install vast CLI
pip install vastai

# Set API key
vastai set api-key YOUR_API_KEY

# Search for RTX 4090 with 24GB, 32GB RAM, 100GB disk
vastai search offers 'gpu_name=RTX_4090 num_gpus=1 disk_space>=100 cpu_ram>=32'

# Rent the cheapest one (note the instance ID)
vastai create instance INSTANCE_ID --image nvidia/cuda:12.2-devel-ubuntu22.04 --disk 100
```

**RunPod (Easier)**
1. Go to [runpod.io](https://runpod.io)
2. Select "Deploy" → "GPU Pods"
3. Choose RTX 4090 (24GB) or A100 (40GB)
4. Select template: `runpod/pytorch:2.1.0-py3.10-cuda12.1`
5. Set disk to 100GB+
6. Deploy and get SSH access

### Step 2: Initial Server Setup

SSH into your VM and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-container-toolkit/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/nvidia-container-toolkit/$distribution/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt update
sudo apt install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# Verify GPU is visible to Docker
docker run --rm --gpus all nvidia/cuda:12.2-base-ubuntu22.04 nvidia-smi
```

### Step 3: Clone and Configure G-Rump

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/g-rump.git
cd g-rump

# Create environment file
cat > .env << 'EOF'
# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# NVIDIA NIM API (for cloud models - optional if running local)
NVIDIA_NIM_API_KEY=nvapi-xxxx

# NGC API Key (for pulling NIM containers)
NGC_API_KEY=your-ngc-api-key

# Local NIM endpoint (when running local inference)
NVIDIA_NIM_URL=http://nim:8000/v1

# Database
DB_TYPE=sqlite
DB_PATH=/app/data/grump.db

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# GPU Settings
GPU_ENABLED=true
NVIDIA_NIM_ENABLED=true
NIM_EMBED_BATCH_SIZE=256
EOF
```

### Step 4: Deploy with GPU Support

```bash
# Start with GPU-enabled compose
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.gpu.yml up -d

# Watch logs
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.gpu.yml logs -f
```

### Step 5: Verify GPU Usage

```bash
# Check GPU utilization
nvidia-smi -l 1

# Check NIM is running
curl http://localhost:8000/v1/health

# Test inference
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta/llama-3.1-8b-instruct",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'
```

---

## Option 2: NVIDIA DGX Cloud / BCP

For enterprise-grade deployment with maximum performance.

### Step 1: Get NVIDIA API Access

1. Go to [build.nvidia.com](https://build.nvidia.com)
2. Create account and get API key
3. Apply for DGX Cloud access if needed

### Step 2: Use Cloud-Hosted NIM (Simplest)

No GPU needed on your server - NVIDIA hosts the models:

```bash
# .env file for cloud-hosted NIM
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000

# NVIDIA NIM Cloud API
NVIDIA_NIM_API_KEY=nvapi-xxxx
NVIDIA_NIM_URL=https://integrate.api.nvidia.com/v1

# Use cloud models (no local GPU required)
NIM_MODEL_DEFAULT=meta/llama-3.1-70b-instruct
NIM_MODEL_FAST=meta/llama-3.1-8b-instruct
NIM_MODEL_QUALITY=meta/llama-3.1-405b-instruct

# Database
DB_TYPE=sqlite
DB_PATH=/app/data/grump.db

# Redis (optional but recommended)
REDIS_HOST=redis
REDIS_PORT=6379
EOF

# Deploy without GPU compose overlay
docker compose -f deploy/docker-compose.yml up -d
```

### Step 3: Self-Hosted NIM on DGX

For maximum performance and data privacy:

```bash
# Pull NIM container (requires NGC login)
docker login nvcr.io
# Username: $oauthtoken
# Password: <your NGC API key>

# Pull Llama 3.1 70B NIM
docker pull nvcr.io/nim/meta/llama-3.1-70b-instruct:latest

# Create docker-compose.dgx.yml
cat > deploy/docker-compose.dgx.yml << 'EOF'
version: '3.8'

services:
  nim-70b:
    image: nvcr.io/nim/meta/llama-3.1-70b-instruct:latest
    container_name: grump-nim-70b
    ports:
      - "8000:8000"
    environment:
      - NGC_API_KEY=${NGC_API_KEY}
      - NIM_MAX_BATCH_SIZE=32
      - NIM_MAX_CONCURRENT_REQUESTS=16
    volumes:
      - nim-cache:/opt/nim/.cache
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all  # Use all GPUs
              capabilities: [gpu]
        limits:
          memory: 80G
    shm_size: '16gb'
    ulimits:
      memlock: -1
      stack: 67108864
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/v1/health/ready"]
      interval: 30s
      timeout: 10s
      retries: 10
      start_period: 300s  # 5 min startup for large model
    networks:
      - grump-network
    restart: unless-stopped

volumes:
  nim-cache:
    driver: local
EOF

# Deploy
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.dgx.yml up -d
```

---

## Option 3: Single GPU Optimized (Budget)

For RTX 3090/4090 (24GB VRAM) - run smaller models locally.

### Recommended Model Sizing

| GPU VRAM | Model | Performance |
|----------|-------|-------------|
| 8GB | Llama 3.1 8B (Q4) | Basic, slower |
| 16GB | Llama 3.1 8B (FP16) | Good |
| 24GB | Llama 3.1 8B + embeddings | Great |
| 48GB | Llama 3.1 70B (Q4) | Excellent |
| 80GB | Llama 3.1 70B (FP16) | Maximum |

### Single 24GB GPU Setup

```bash
# Create optimized compose for single GPU
cat > deploy/docker-compose.single-gpu.yml << 'EOF'
version: '3.8'

services:
  backend:
    environment:
      - NVIDIA_NIM_URL=http://nim:8000/v1
      - NIM_EMBED_URL=http://embeddings:80
      - GPU_ENABLED=true
    depends_on:
      nim:
        condition: service_healthy

  # Llama 3.1 8B - fits in 16GB, leaves room for embeddings
  nim:
    image: nvcr.io/nim/meta/llama-3.1-8b-instruct:latest
    container_name: grump-nim
    ports:
      - "8000:8000"
    environment:
      - NGC_API_KEY=${NGC_API_KEY}
      - NIM_MAX_BATCH_SIZE=64
      - NIM_MAX_CONCURRENT_REQUESTS=32
      # Limit GPU memory to 16GB (leaves 8GB for embeddings)
      - CUDA_VISIBLE_DEVICES=0
    volumes:
      - nim-cache:/opt/nim/.cache
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['0']
              capabilities: [gpu]
        limits:
          memory: 20G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/v1/health/ready"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 120s
    networks:
      - grump-network

  # GPU embeddings - uses remaining VRAM
  embeddings:
    image: ghcr.io/huggingface/text-embeddings-inference:turing-1.2
    container_name: grump-embeddings
    ports:
      - "8001:80"
    environment:
      - MODEL_ID=BAAI/bge-base-en-v1.5
      - MAX_BATCH_SIZE=128
      - CUDA_VISIBLE_DEVICES=0
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['0']
              capabilities: [gpu]
        limits:
          memory: 6G
    networks:
      - grump-network

volumes:
  nim-cache:
EOF

# Deploy
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.single-gpu.yml up -d
```

---

## Option 4: Hybrid (Local + Cloud Fallback)

Best of both worlds - local for fast/cheap, cloud for quality.

```bash
# .env for hybrid setup
cat > .env << 'EOF'
NODE_ENV=production

# Local NIM (8B for fast responses)
NVIDIA_NIM_URL_LOCAL=http://nim:8000/v1
NIM_MODEL_LOCAL=meta/llama-3.1-8b-instruct

# Cloud NIM (70B/405B for quality)
NVIDIA_NIM_URL_CLOUD=https://integrate.api.nvidia.com/v1
NVIDIA_NIM_API_KEY=nvapi-xxxx
NIM_MODEL_CLOUD=meta/llama-3.1-70b-instruct
NIM_MODEL_QUALITY=meta/llama-3.1-405b-instruct

# Routing rules
NIM_USE_LOCAL_FOR=chat,quick_questions
NIM_USE_CLOUD_FOR=codegen,architecture,ship

# Cost controls
NIM_CLOUD_DAILY_BUDGET_USD=10
NIM_PREFER_LOCAL=true
EOF
```

---

## Performance Tuning

### Backend Environment Variables

```bash
# Add to .env for GPU optimization
# Worker pool sizing
WORKER_POOL_MIN=4
WORKER_POOL_MAX=16

# Larger batches with GPU
NIM_EMBED_BATCH_SIZE=256
NIM_EMBED_MAX_WAIT_MS=25

# Tiered cache (leverage more memory)
TIERED_CACHE_L1_MAX=2000
TIERED_CACHE_L1_TTL_MS=600000
TIERED_CACHE_L2_TTL_MS=3600000

# Connection pooling
HTTP_POOL_MAX_SOCKETS=100
HTTP_POOL_MAX_FREE_SOCKETS=20

# Node.js optimization
NODE_OPTIONS="--max-old-space-size=4096 --enable-source-maps"
UV_THREADPOOL_SIZE=32
```

### NVIDIA NIM Tuning

```bash
# NIM environment for maximum throughput
NIM_MAX_BATCH_SIZE=64          # Higher = more throughput
NIM_MAX_CONCURRENT_REQUESTS=32 # Based on VRAM
NIM_TENSOR_PARALLEL_SIZE=1     # GPUs to use for model
NIM_PIPELINE_PARALLEL_SIZE=1   # For multi-node

# For RTX 4090 (24GB) with 8B model:
NIM_MAX_BATCH_SIZE=128
NIM_MAX_CONCURRENT_REQUESTS=64

# For A100 (80GB) with 70B model:
NIM_MAX_BATCH_SIZE=32
NIM_MAX_CONCURRENT_REQUESTS=16
```

---

## Cost Optimization Tips

### 1. Use Spot/Preemptible Instances

```bash
# Vast.ai - enable interruptible
vastai create instance ID --image ... --interruptible

# Savings: 50-70% off on-demand
```

### 2. Scale Down When Idle

```bash
# Create idle detection script
cat > scripts/auto-scale.sh << 'EOF'
#!/bin/bash
# Check if any requests in last 30 minutes
IDLE_THRESHOLD=1800

LAST_REQUEST=$(redis-cli GET grump:last_request_ts)
NOW=$(date +%s)
IDLE_TIME=$((NOW - LAST_REQUEST))

if [ $IDLE_TIME -gt $IDLE_THRESHOLD ]; then
  echo "Idle for ${IDLE_TIME}s, scaling down NIM..."
  docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.gpu.yml stop nim
fi
EOF

# Add to crontab
echo "*/5 * * * * /path/to/scripts/auto-scale.sh" | crontab -
```

### 3. Model Quantization

```bash
# Use quantized models for 2x memory savings
# Instead of: meta/llama-3.1-70b-instruct
# Use: meta/llama-3.1-70b-instruct:int8  (if available)
```

---

## Monitoring GPU Usage

### Add to Observability Stack

```yaml
# Add to observability/docker-compose.yml
services:
  dcgm-exporter:
    image: nvidia/dcgm-exporter:3.3.0-3.2.0-ubuntu22.04
    container_name: dcgm-exporter
    ports:
      - "9400:9400"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    networks:
      - monitoring
```

### Grafana Dashboard

Import NVIDIA DCGM dashboard ID: `12239`

Metrics available:
- GPU utilization %
- VRAM usage
- Power consumption
- Temperature
- Inference throughput

---

## Quick Start Commands

```bash
# 1. Cheap GPU (Vast.ai RTX 4090)
# Cost: ~$0.20/hr = ~$150/month
# Models: Llama 8B local + cloud fallback for 70B

# 2. Mid-tier (RunPod A10G)
# Cost: ~$0.50/hr = ~$360/month
# Models: Llama 8B local, 70B quantized

# 3. Enterprise (DGX Cloud / A100)
# Cost: ~$2/hr = ~$1500/month
# Models: Llama 70B full precision, 405B cloud

# Deploy command (same for all)
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.gpu.yml up -d

# Check status
docker compose ps
nvidia-smi
curl localhost:8000/v1/health
curl localhost:3000/health
```

---

## Troubleshooting

### GPU Not Detected

```bash
# Check NVIDIA driver
nvidia-smi

# Check container toolkit
docker run --rm --gpus all nvidia/cuda:12.2-base nvidia-smi

# If fails, reinstall toolkit
sudo apt remove nvidia-container-toolkit
sudo apt install nvidia-container-toolkit
sudo systemctl restart docker
```

### Out of Memory (OOM)

```bash
# Reduce batch size
NIM_MAX_BATCH_SIZE=16

# Use quantized model
# Or use smaller model (8B instead of 70B)

# Check actual usage
nvidia-smi --query-gpu=memory.used,memory.total --format=csv -l 1
```

### Slow Inference

```bash
# Enable tensor cores
export NVIDIA_TF32_OVERRIDE=1

# Check GPU clock speed
nvidia-smi -q -d CLOCK

# Increase batch size (if VRAM allows)
NIM_MAX_BATCH_SIZE=128
```

---

## Summary: Recommended Setups

| Budget | Provider | GPU | Monthly Cost | Models |
|--------|----------|-----|--------------|--------|
| **Cheap** | Vast.ai | RTX 4090 | $150-200 | 8B local + cloud |
| **Balanced** | RunPod | A10G | $300-400 | 8B + 70B quantized |
| **Performance** | Lambda | A100 40GB | $500-700 | 70B local |
| **Enterprise** | DGX Cloud | H100 | $1500+ | 70B + 405B |

**My Recommendation for G-Rump:**
- Start with **Vast.ai RTX 4090** ($150/mo)
- Run Llama 3.1 8B locally for chat/quick tasks
- Use NVIDIA NIM cloud API for 70B/405B quality tasks
- Upgrade to A100 when you outgrow it
