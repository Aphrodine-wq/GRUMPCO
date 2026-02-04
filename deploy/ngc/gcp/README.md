# GCP NGC Deployment

Deploy G-Rump on Google Cloud Platform using NGC-certified infrastructure.

## Prerequisites

- GCP project with billing enabled
- `gcloud` CLI installed and authenticated

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

## Option 1: Provision VM + Deploy

### CPU-only (recommended for app; uses NIM cloud API)

```bash
./provision.sh
gcloud compute ssh grump-ngc --zone=us-central1-a
# On VM: install Docker, clone repo, run deploy.sh
```

### With GPU (for NeMo Curator / NeMo Framework)

```bash
./provision.sh --gpu
```

## Option 2: Terraform

```bash
terraform init
terraform plan -var="project_id=YOUR_PROJECT"
terraform apply -var="project_id=YOUR_PROJECT"
```

## Environment Variables

On the VM, set in `backend/.env`:

- `NVIDIA_NIM_API_KEY` – Required for AI features (get at https://build.nvidia.com)
- `NODE_ENV=production`
- `CORS_ORIGINS` – Your frontend domain(s)

## Firewall

Allow HTTP/HTTPS if exposing publicly:

```bash
gcloud compute firewall-rules create allow-http \
  --allow tcp:80,tcp:443 \
  --target-tags http-server,https-server
```

## Reference

- [NVIDIA NGC on GCP](https://docs.nvidia.com/ngc/ngc-deploy-public-cloud/ngc-gcp/index.html)
- [Deep Learning VM Images](https://cloud.google.com/compute/docs/images/premium-images/overview)
