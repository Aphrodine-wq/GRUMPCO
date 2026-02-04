# AWS NGC Deployment

Deploy G-Rump on Amazon Web Services using NGC-certified infrastructure.

## Prerequisites

- AWS account with appropriate permissions
- AWS CLI configured (`aws configure`)

## Option 1: Provision EC2 + Deploy

### CPU-only (recommended for app; uses NIM cloud API)

```bash
./provision.sh
# Wait for instance, get public IP, then:
ssh -i grump-ngc-key.pem ubuntu@<PUBLIC_IP>
# On instance: install Docker, clone repo, run deploy.sh
```

### With GPU (for NeMo Curator / NeMo Framework)

```bash
./provision.sh --gpu
```

## Option 2: Use Existing NGC AMI

NVIDIA provides GPU-optimized AMIs. See [NVIDIA NGC on AWS](https://docs.nvidia.com/ngc/ngc-deploy-public-cloud/ngc-aws/index.html) for:

- P3 (V100)
- G4 (T4)
- P4d (A100)

## Environment Variables

On the instance, set in `backend/.env`:

- `NVIDIA_NIM_API_KEY` – Required for AI features (get at https://build.nvidia.com)
- `NODE_ENV=production`
- `CORS_ORIGINS` – Your frontend domain(s)

## Security Group

Allow inbound:

- 22 (SSH)
- 80 (HTTP)
- 443 (HTTPS)
- 3000 (backend – if not behind ALB)

## Reference

- [NVIDIA NGC on AWS](https://docs.nvidia.com/ngc/ngc-deploy-public-cloud/ngc-aws/index.html)
- [AWS Deep Learning AMIs](https://docs.aws.amazon.com/dlami/latest/devguide/compare-options.html)
