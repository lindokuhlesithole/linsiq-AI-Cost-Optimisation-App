# Linsiq Deployment Guide

## Architecture Overview

```
                    +------------------+
                    |   CloudFront     |
                    |   (CDN/HTTPS)    |
                    +--------+---------+
                             |
                    +--------v---------+
                    |      ALB         |
                    |  (HTTP/HTTPS)    |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
    +---------v----------+      +----------v---------+
    |   ECS Fargate      |      |  ECS Fargate       |
    |   (Frontend)       |      |  (Backend API)     |
    |   React + Nginx    |      |  FastAPI + Uvicorn |
    +---------+----------+      +----------+---------+
              |                             |
              |              +--------------+--------------+
              |              |                             |
              |    +---------v---------+      +-----------v---------+
              |    |    PostgreSQL     |      |       Redis         |
              |    |   (RDS Aurora)    |      |   (ElastiCache)     |
              |    +-------------------+      +---------------------+
              |
    +---------v---------+
    |   Celery Worker   |
    |  (Background Jobs)|
    +-------------------+
```

## Prerequisites

- AWS Account with appropriate limits
- AWS CLI configured locally
- Terraform >= 1.5
- Docker + docker-compose (local dev)
- GitHub account with this repository

## Quick Start (Local Development)

```bash
# 1. Clone the repository
git clone https://github.com/lindokuhlesithole/linsiq-AI-Cost-Optimisation-App.git
cd linsiq-AI-Cost-Optimisation-App

# 2. Copy environment variables
cp .env.example .env
# Edit .env with your credentials

# 3. Start all services locally
docker-compose up -d

# 4. Run migrations (auto on startup)
# 5. Access the app
#    - Frontend: http://localhost:5173
#    - API docs: http://localhost:8000/docs
#    - Health:   http://localhost:8000/health
```

## CI/CD Setup

### Option 1: GitHub UI (Recommended)

1. Go to **Actions** tab in your GitHub repository
2. Click **"New workflow"** -> **"set up a workflow yourself"**
3. Copy the contents of `CI-CD-SETUP.yml` into the editor
4. Save as `.github/workflows/ci-cd.yml`

### Option 2: GitHub CLI (requires `gh`)

```bash
# Authenticate with workflow scope
gh auth login --scopes repo,workflow

# Create the workflow directory and file
mkdir -p .github/workflows
cp CI-CD-SETUP.yml .github/workflows/ci-cd.yml
rm .github/workflows/ci-cd.yml  # remove comments at top

# Commit and push
git add .github/workflows/ci-cd.yml
git commit -m "Add CI/CD pipeline"
git push
```

### Required GitHub Secrets

Navigate to **Settings > Secrets and variables > Actions** and add:

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key with ECR/ECS permissions |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |

### Required IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:DescribeServices",
        "ecs:UpdateService"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::*:role/ecsTaskExecutionRole"
    }
  ]
}
```

## Infrastructure Deployment (Terraform)

```bash
cd terraform

# Initialize
terraform init

# Plan
terraform plan -var="aws_region=us-east-1" -var="project_name=linsiq"

# Apply
terraform apply -var="aws_region=us-east-1" -var="project_name=linsiq"
```

## Environment Variables

### Production (.env)

```env
# Database
DATABASE_URL=postgresql://linsiq:secure_password@linsiq-db.cluster-xxx.us-east-1.rds.amazonaws.com:5432/linsiq

# Redis
REDIS_URL=redis://linsiq-redis.xxx.cache.amazonaws.com:6379/0

# Security
SECRET_KEY=<random-64-char-string>

# AWS
AWS_DEFAULT_REGION=us-east-1

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `AccountLimitExceededException` | Request ECS service limit increase in AWS Support |
| CI/CD 403 error | Verify GitHub secrets are set correctly |
| Database connection refused | Check security group allows traffic from ECS tasks |
| Frontend can't reach API | Verify `VITE_API_URL` points to correct ALB endpoint |
