#!/bin/bash
# Provision GCP VM for G-Rump on NGC-ready infrastructure
# Uses NVIDIA GPU-optimized VM image (optional GPU) or standard e2-medium for CPU-only
#
# Prerequisites: gcloud CLI, authenticated to GCP
# Usage: ./provision.sh [--gpu] [--project PROJECT] [--zone ZONE]

set -e

GPU=false
PROJECT="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
ZONE="${GCP_ZONE:-us-central1-a}"
INSTANCE_NAME="${GCP_INSTANCE:-grump-ngc}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --gpu) GPU=true; shift ;;
    --project) PROJECT="$2"; shift 2 ;;
    --zone) ZONE="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$PROJECT" ]]; then
  echo "Error: Set GCP_PROJECT or run: gcloud config set project YOUR_PROJECT"
  exit 1
fi

echo "Provisioning G-Rump NGC VM..."
echo "  Project: $PROJECT"
echo "  Zone: $ZONE"
echo "  Instance: $INSTANCE_NAME"
echo "  GPU: $GPU"

if [[ "$GPU" == "true" ]]; then
  # NVIDIA T4 GPU (cost-effective for NeMo Curator / training)
  # See: https://cloud.google.com/compute/docs/gpus
  # Uses Ubuntu with automatic NVIDIA driver install on first boot
  gcloud compute instances create "$INSTANCE_NAME" \
    --project="$PROJECT" \
    --zone="$ZONE" \
    --machine-type=n1-standard-4 \
    --accelerator=type=nvidia-tesla-t4,count=1 \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --maintenance-policy=TERMINATE \
    --boot-disk-size=50GB \
    --boot-disk-type=pd-standard \
    --metadata=install-nvidia-driver=True \
    --tags=http-server,https-server \
    --scopes=cloud-platform
else
  # CPU-only (for G-Rump app; uses NIM cloud API)
  gcloud compute instances create "$INSTANCE_NAME" \
    --project="$PROJECT" \
    --zone="$ZONE" \
    --machine-type=e2-medium \
    --image-family=debian-12 \
    --image-project=debian-cloud \
    --boot-disk-size=30GB \
    --boot-disk-type=pd-standard \
    --tags=http-server,https-server \
    --scopes=cloud-platform
fi

echo ""
echo "VM created. Next steps:"
echo "  1. gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
echo "  2. Install Docker: https://docs.docker.com/engine/install/debian/"
echo "  3. Run: cd /path/to/milesproject && docker compose -f deploy/docker-compose.yml up -d"
echo ""
echo "Or use deploy.sh after cloning the repo on the VM."
