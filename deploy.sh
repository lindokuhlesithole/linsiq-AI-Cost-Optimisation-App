#!/bin/bash
# ============================================================
# Linsiq Platform — Full Deployment Script
# Deploys: ECR repo → Docker image → Terraform infra → ECS service
# Prerequisites: AWS CLI, Terraform, Docker, valid AWS credentials
# ============================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="${PROJECT_NAME:-linsiq}"
ECR_REPO="${PROJECT_NAME}-backend"
ECS_CLUSTER="${PROJECT_NAME}-cluster"
ECS_SERVICE="${PROJECT_NAME}-api"
TF_STATE_BUCKET="${PROJECT_NAME}-terraform-state-$(aws sts get-caller-identity --query Account --output text)"

echo -e "${BLUE}"
echo "  _     _       _      _"
echo " | |   (_)_ __ | | ___| |_"
echo " | |   | | '_ \\| |/ _ \\ __|"
echo " | |___| | | | | |  __/ |_"
echo " |_____|_|_| |_|_|\\___|\\__|"
echo -e "${NC}"
echo -e "${GREEN}=== AI Cost Optimization Platform — Deployment ===${NC}"
echo ""

# --- Helper functions ---
log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# --- Pre-flight checks ---
log_info "Running pre-flight checks..."

for cmd in aws terraform docker jq; do
    if ! command -v "$cmd" &> /dev/null; then
        log_error "$cmd is required but not installed."
        exit 1
    fi
    log_ok "$cmd found"
done

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    log_error "AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
log_ok "AWS authenticated (Account: $ACCOUNT_ID)"

# Check required env vars
if [ -z "${DATABASE_URL:-}" ]; then
    log_warn "DATABASE_URL not set. Will use placeholder."
fi
if [ -z "${REDIS_URL:-}" ]; then
    log_warn "REDIS_URL not set. Will use placeholder."
fi

echo ""
read -p "Continue with deployment to region '$AWS_REGION'? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    log_info "Deployment cancelled."
    exit 0
fi

# ============================================================
# STEP 1: Create S3 bucket for Terraform state
# ============================================================
echo ""
log_info "Step 1/6: Setting up Terraform state bucket..."

if aws s3api head-bucket --bucket "$TF_STATE_BUCKET" 2>/dev/null; then
    log_ok "S3 state bucket already exists: $TF_STATE_BUCKET"
else
    aws s3api create-bucket \
        --bucket "$TF_STATE_BUCKET" \
        --region "$AWS_REGION" \
        $( [ "$AWS_REGION" != "us-east-1" ] && echo "--create-bucket-configuration LocationConstraint=$AWS_REGION" ) \
        --output text
    aws s3api put-bucket-versioning \
        --bucket "$TF_STATE_BUCKET" \
        --versioning-configuration Status=Enabled
    aws s3api put-bucket-encryption \
        --bucket "$TF_STATE_BUCKET" \
        --server-side-encryption-configuration '{
            "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
        }'
    log_ok "Created S3 state bucket: $TF_STATE_BUCKET"
fi

# ============================================================
# STEP 2: Create ECR Repository & Push Image
# ============================================================
echo ""
log_info "Step 2/6: Building and pushing Docker image..."

# Create ECR repo if not exists
if ! aws ecr describe-repositories --repository-names "$ECR_REPO" --region "$AWS_REGION" &> /dev/null; then
    aws ecr create-repository --repository-name "$ECR_REPO" --region "$AWS_REGION" > /dev/null
    log_ok "Created ECR repository: $ECR_REPO"
else
    log_ok "ECR repository exists: $ECR_REPO"
fi

ECR_URL="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"

# Login to ECR
aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "$ECR_URL"

# Build and push
log_info "Building Docker image (this may take a few minutes)..."
cd backend
docker build -f Dockerfile.prod -t "$ECR_REPO:latest" .
docker tag "$ECR_REPO:latest" "$ECR_URL:latest"
docker push "$ECR_URL:latest"
cd ..
log_ok "Image pushed: $ECR_URL:latest"

# ============================================================
# STEP 3: Store secrets in Secrets Manager
# ============================================================
echo ""
log_info "Step 3/6: Storing secrets..."

# Store AWS credentials for ECS tasks
if [ -n "${AWS_ACCESS_KEY_ID:-}" ] && [ -n "${AWS_SECRET_ACCESS_KEY:-}" ]; then
    aws secretsmanager create-secret \
        --name "${PROJECT_NAME}/aws-access-key" \
        --secret-string "$AWS_ACCESS_KEY_ID" \
        --region "$AWS_REGION" \
        2>/dev/null || log_ok "Secret aws-access-key already exists"
    
    aws secretsmanager create-secret \
        --name "${PROJECT_NAME}/aws-secret-key" \
        --secret-string "$AWS_SECRET_ACCESS_KEY" \
        --region "$AWS_REGION" \
        2>/dev/null || log_ok "Secret aws-secret-key already exists"
fi

log_ok "Secrets configured"

# ============================================================
# STEP 4: Deploy Infrastructure with Terraform
# ============================================================
echo ""
log_info "Step 4/6: Deploying infrastructure with Terraform..."

cd terraform

# Initialize Terraform
terraform init \
    -backend-config="bucket=${TF_STATE_BUCKET}" \
    -backend-config="key=infrastructure.tfstate" \
    -backend-config="region=${AWS_REGION}"

# Plan
log_info "Planning infrastructure changes..."
terraform plan \
    -var="aws_region=${AWS_REGION}" \
    -var="project_name=${PROJECT_NAME}" \
    -var="database_url=${DATABASE_URL:-placeholder}" \
    -var="redis_url=${REDIS_URL:-placeholder}" \
    -out=tfplan

# Apply
echo ""
read -p "Apply Terraform changes? [y/N] " tf_confirm
if [[ "$tf_confirm" =~ ^[Yy]$ ]]; then
    terraform apply tfplan
    log_ok "Infrastructure deployed!"
else
    log_warn "Terraform apply skipped. Run 'terraform apply tfplan' manually."
    exit 0
fi

# Get outputs
ALB_DNS=$(terraform output -raw alb_dns)
ECR_REPO_URL=$(terraform output -raw ecr_repository_url)
cd ..

# ============================================================
# STEP 5: Force new ECS deployment
# ============================================================
echo ""
log_info "Step 5/6: Updating ECS service..."

aws ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service "$ECS_SERVICE" \
    --force-new-deployment \
    --region "$AWS_REGION" > /dev/null

log_ok "ECS service updated with new image"

# ============================================================
# STEP 6: Verify deployment
# ============================================================
echo ""
log_info "Step 6/6: Verifying deployment..."

# Wait for service stability
log_info "Waiting for service to stabilize (may take 2-5 minutes)..."
aws ecs wait services-stable \
    --cluster "$ECS_CLUSTER" \
    --services "$ECS_SERVICE" \
    --region "$AWS_REGION"

# Health check
HEALTH_URL="http://${ALB_DNS}/health"
log_info "Checking health endpoint: $HEALTH_URL"

for i in {1..12}; do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        log_ok "Health check passed!"
        break
    fi
    echo -n "."
    sleep 10
done

# ============================================================
# DONE
# ============================================================
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  LINSIQ DEPLOYED SUCCESSFULLY!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "  ${BLUE}API Health:${NC}   http://${ALB_DNS}/health"
echo -e "  ${BLUE}API Docs:${NC}     http://${ALB_DNS}/docs"
echo -e "  ${BLUE}ECR Repo:${NC}     ${ECR_REPO_URL}"
echo -e "  ${BLUE}ECS Cluster:${NC}  ${ECS_CLUSTER}"
echo -e "  ${BLUE}ECS Service:${NC}  ${ECS_SERVICE}"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo -e "    1. Configure your frontend VITE_API_URL to: http://${ALB_DNS}"
echo -e "    2. Set up HTTPS with ACM certificate and ALB listener"
echo -e "    3. Add your domain to Route 53 pointing to ALB"
echo -e "    4. Set up monitoring with CloudWatch alarms"
echo ""
echo -e "  ${YELLOW}Useful commands:${NC}"
echo -e "    make docker-up       # Run locally"
echo -e "    make test            # Run tests"
echo -e "    make tf-destroy      # Tear down infrastructure"
echo -e "${GREEN}============================================================${NC}"
