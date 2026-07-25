# Linsiq

> **AI Cost Intelligence.**

Linsiq is an AI cost optimization platform that automatically detects waste in AWS AI services (SageMaker, Bedrock, EC2 GPU) and applies safe optimizations with one click.

## Features

- **Cost Dashboard** — Real-time breakdown of AI spend by service, region, team, model
- **Waste Detection** — Identifies idle endpoints, over-provisioned instances, Spot-eligible jobs
- **One-Click Apply** — Safe remediation: stop, resize, convert to Spot, set budgets
- **Audit Trail** — Every action logged for compliance (NIS2, AI Act)
- **Budget Guardrails** — Alerts and hard stops before overspend
- **Savings Report** — Monthly verified savings, ROI calculation

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Recharts
- **Backend**: Python + FastAPI
- **Database**: PostgreSQL 15 + Supabase
- **Cache & Queue**: Redis + Celery
- **AWS SDK**: boto3 (Cost Explorer, SageMaker, CloudWatch, EC2)
- **Auth**: AWS IAM role assumption (cross-account, no credentials stored)
- **Deployment**: Docker + AWS ECS Fargate

## Getting Started

```bash
git clone https://github.com/lindokuhlesithole/linsiq-AI-Cost-Optimisation-App.git
cd linsiq-AI-Cost-Optimisation-App
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and configure:
- `SUPABASE_URL` — Your Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anonymous key
- `DATABASE_URL` — PostgreSQL connection string

## Architecture

```
Frontend (React + Tailwind + Recharts)
    |
    v
FastAPI Backend
    |
    +---> AWS Cost Explorer (cost data)
    +---> SageMaker API (endpoint metrics)
    +---> CloudWatch (utilization)
    +---> PostgreSQL (cost snapshots, optimizations, audit)
    +---> Redis (cache, job queues)
```

## License

MIT — Built by Lindokuhle Sithole.
