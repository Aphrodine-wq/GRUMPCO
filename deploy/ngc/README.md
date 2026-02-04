# NGC-Ready Cloud Deployment

Deploy G-Rump on NVIDIA NGC-certified clouds (GCP, AWS, Azure, Oracle) for NVIDIA Golden Developer Award compliance.

## Overview

| Cloud | NGC Support | Folder | Docs |
|-------|-------------|--------|------|
| GCP | NGC GPU VMIs | [gcp/](gcp/) | [NVIDIA NGC on GCP](https://docs.nvidia.com/ngc/ngc-deploy-public-cloud/ngc-gcp/index.html) |
| AWS | NGC GPU AMIs | [aws/](aws/) | [NVIDIA NGC on AWS](https://docs.nvidia.com/ngc/ngc-deploy-public-cloud/ngc-aws/index.html) |

## Prerequisites

- Cloud account (GCP or AWS)
- Docker and Docker Compose installed (or use cloud shell)
- NGC API key (optional for pulling NGC containers; G-Rump uses NIM cloud API)

## Quick Start

### GCP

```bash
cd deploy/ngc/gcp
./provision.sh          # Create NGC GPU VM (optional GPU for local NIM)
./deploy.sh             # Deploy G-Rump via Docker Compose
```

### AWS

```bash
cd deploy/ngc/aws
./provision.sh          # Create EC2 instance with NGC AMI
./deploy.sh             # Deploy G-Rump via Docker Compose
```

## Production Notes

- G-Rump uses **NVIDIA NIM cloud API** by default; no local GPU required for inference
- NGC VMs with GPUs are optional for:
  - NeMo Curator / NeMo Framework (synthetic data, fine-tuning)
  - Self-hosted NIM (if you prefer local inference)
- For cost savings, use a **CPU-only** NGC VM for the main app and reserve GPU VMs for data/training workloads

## See Also

- [PRODUCTION.md](../../docs/PRODUCTION.md) – Full deployment guide
- [NVIDIA NGC Certified Clouds](https://docs.nvidia.com/ngc/ngc-deploy-public-cloud/index.html)
