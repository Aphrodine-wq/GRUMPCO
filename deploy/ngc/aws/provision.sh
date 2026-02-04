#!/bin/bash
# Provision AWS EC2 instance for G-Rump on NGC-ready infrastructure
# Uses NVIDIA GPU-optimized AMI (optional GPU) or standard Amazon Linux for CPU-only
#
# Prerequisites: AWS CLI, credentials configured
# Usage: ./provision.sh [--gpu] [--region REGION]

set -e

GPU=false
REGION="${AWS_REGION:-us-east-1}"
INSTANCE_NAME="${AWS_INSTANCE:-grump-ngc}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --gpu) GPU=true; shift ;;
    --region) REGION="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "Provisioning G-Rump NGC instance on AWS..."
echo "  Region: $REGION"
echo "  Instance: $INSTANCE_NAME"
echo "  GPU: $GPU"

# Get latest NVIDIA Deep Learning AMI (Ubuntu 22.04)
# https://docs.aws.amazon.com/dlami/latest/devguide/compare-options.html
if [[ "$GPU" == "true" ]]; then
  # g4dn.xlarge: 1x T4 GPU
  AMI_ID=$(aws ec2 describe-images \
    --region "$REGION" \
    --owners amazon \
    --filters "Name=name,Values=Deep Learning OSS Nvidia Driver AMI GPU PyTorch*" "Name=state,Values=available" \
    --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
    --output text 2>/dev/null || echo "")
  if [[ -z "$AMI_ID" ]]; then
    # Fallback: use generic Ubuntu with GPU
    AMI_ID=$(aws ec2 describe-images \
      --region "$REGION" \
      --owners 099720109477 \
      --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" "Name=state,Values=available" \
      --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
      --output text)
  fi
  INSTANCE_TYPE="g4dn.xlarge"
else
  # CPU-only
  AMI_ID=$(aws ec2 describe-images \
    --region "$REGION" \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" "Name=state,Values=available" \
    --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
    --output text)
  INSTANCE_TYPE="t3.medium"
fi

# Create key pair if not exists
KEY_NAME="grump-ngc-key"
if ! aws ec2 describe-key-pairs --region "$REGION" --key-names "$KEY_NAME" 2>/dev/null; then
  aws ec2 create-key-pair --region "$REGION" --key-name "$KEY_NAME" \
    --query 'KeyMaterial' --output text > "${KEY_NAME}.pem"
  chmod 600 "${KEY_NAME}.pem"
  echo "Created key pair: ${KEY_NAME}.pem"
fi

# Default VPC and subnet
SUBNET_ID=$(aws ec2 describe-subnets --region "$REGION" \
  --filters "Name=default-for-az,Values=true" \
  --query 'Subnets[0].SubnetId' --output text 2>/dev/null || echo "")
SG_ID=$(aws ec2 describe-security-groups --region "$REGION" \
  --filters "Name=group-name,Values=default" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "")

if [[ -z "$SUBNET_ID" || "$SUBNET_ID" == "None" ]]; then
  echo "Error: No default subnet found. Create a VPC first."
  exit 1
fi

INSTANCE_ID=$(aws ec2 run-instances \
  --region "$REGION" \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --key-name "$KEY_NAME" \
  --subnet-id "$SUBNET_ID" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]" \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
  --query 'Instances[0].InstanceId' --output text)

echo "Instance launched: $INSTANCE_ID"
echo ""
echo "Wait for instance to be running, then:"
echo "  aws ec2 describe-instances --region $REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].PublicIpAddress' --output text"
echo ""
echo "SSH: ssh -i ${KEY_NAME}.pem ubuntu@<PUBLIC_IP>"
echo "Then install Docker and run deploy.sh"
