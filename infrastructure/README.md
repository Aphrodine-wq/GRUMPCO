# Infrastructure as Code

This directory contains Terraform configurations for deploying G-Rump to AWS.

## Prerequisites

1. **AWS CLI** installed and configured
2. **Terraform** >= 1.0 installed
3. **AWS credentials** configured (via `aws configure` or environment variables)
4. **S3 bucket** for Terraform state (create manually or update backend configuration)

## Quick Start

### 1. Initialize Terraform

```bash
cd infrastructure/terraform
terraform init
```

### 2. Create terraform.tfvars

Create a `terraform.tfvars` file with your configuration:

```hcl
aws_region = "us-east-1"
environment = "staging"
project_name = "grump"

# Database
db_password = "your-secure-password"
db_instance_class = "db.t3.micro"

# Redis
redis_auth_token = "your-redis-auth-token"

# ECS
backend_desired_count = 2
ecr_repository_url = "123456789012.dkr.ecr.us-east-1.amazonaws.com/grump"
```

### 3. Plan Infrastructure

```bash
terraform plan
```

### 4. Apply Infrastructure

```bash
terraform apply
```

## Environment-Specific Configurations

### Staging

```bash
terraform workspace new staging
terraform workspace select staging
terraform apply -var-file=staging.tfvars
```

### Production

```bash
terraform workspace new production
terraform workspace select production
terraform apply -var-file=production.tfvars
```

## Infrastructure Components

### Networking
- VPC with public and private subnets
- Internet Gateway and NAT Gateway
- Route tables and associations
- Security groups for ALB, backend, RDS, and Redis

### Compute
- ECS Fargate cluster
- ECS service for backend
- Application Load Balancer

### Data Storage
- RDS PostgreSQL instance
- ElastiCache Redis cluster

### Monitoring
- CloudWatch log groups
- Container Insights enabled

### Security
- Secrets Manager for API keys and database credentials
- Encrypted storage (RDS and ElastiCache)
- Security groups with least-privilege access

## State Management

Terraform state is stored in S3. Update the backend configuration in `main.tf`:

```hcl
backend "s3" {
  bucket = "your-terraform-state-bucket"
  key    = "grump/terraform.tfstate"
  region = "us-east-1"
}
```

## Secrets Management

### Setting Secrets

```bash
# API Key
aws secretsmanager put-secret-value \
  --secret-id grump/anthropic-api-key \
  --secret-string "your-api-key"

# Database Credentials
aws secretsmanager put-secret-value \
  --secret-id grump/db-credentials \
  --secret-string '{"host":"rds-endpoint","username":"grump_admin","password":"your-password"}'
```

## Updating Infrastructure

```bash
# Review changes
terraform plan

# Apply changes
terraform apply

# Destroy infrastructure (use with caution!)
terraform destroy
```

## Outputs

After applying, get important values:

```bash
terraform output alb_dns_name
terraform output rds_endpoint
terraform output redis_endpoint
```

## Troubleshooting

### State Lock Issues

If Terraform state is locked:

```bash
# Check for locks
aws dynamodb scan --table-name terraform-state-lock

# Force unlock (use with caution)
terraform force-unlock <LOCK_ID>
```

### Connection Issues

- Verify security groups allow traffic
- Check route tables and NAT gateway
- Verify VPC endpoints if using private subnets

### Resource Limits

- Check AWS account limits for ECS tasks, RDS instances, etc.
- Request limit increases if needed

## Cost Optimization

- Use `db.t3.micro` for staging
- Use `cache.t3.micro` for Redis in staging
- Enable auto-scaling for ECS services
- Use spot instances for non-critical workloads (if using EC2)

## Security Best Practices

1. **Never commit secrets** - Use Secrets Manager or environment variables
2. **Enable encryption** - All storage is encrypted at rest
3. **Use least privilege** - Security groups restrict access
4. **Enable CloudTrail** - Monitor infrastructure changes
5. **Regular updates** - Keep Terraform and providers updated

## Additional Resources

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Terraform Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices/index.html)
