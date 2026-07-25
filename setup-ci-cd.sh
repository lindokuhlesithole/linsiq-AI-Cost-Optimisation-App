#!/bin/bash
# ============================================================
# Linsiq CI/CD Setup Script
# Run this to properly set up the GitHub Actions workflow.
# Requires: git, gh CLI (GitHub CLI) authenticated with workflow scope
# ============================================================

set -e

echo "=== Linsiq CI/CD Setup ==="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found. Install it first:"
    echo "   https://cli.github.com/manual/installation"
    exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
    echo "🔐 Authenticating with GitHub (requires workflow scope)..."
    gh auth login --scopes repo,workflow
fi

# Create workflow directory
mkdir -p .github/workflows

# Extract the CI/CD content (skip the comment header)
sed '/^# ===.*===/d; /^# /d; /^$/d' CI-CD-SETUP.yml > .github/workflows/ci-cd.yml

echo "✅ Created .github/workflows/ci-cd.yml"

# Commit and push
git add .github/workflows/ci-cd.yml
git commit -m "Add GitHub Actions CI/CD pipeline

- Automated testing with pytest
- Linting with black, isort, flake8
- Docker build and push to Amazon ECR
- Auto-deploy to ECS Fargate on main branch"

git push origin main

echo ""
echo "🚀 CI/CD pipeline pushed! Next steps:"
echo "   1. Go to: https://github.com/lindokuhlesithole/linsiq-AI-Cost-Optimisation-App/settings/secrets/actions"
echo "   2. Add secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
echo "   3. Trigger a manual run from the Actions tab"
