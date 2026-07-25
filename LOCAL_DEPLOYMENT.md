# Local Deployment Guide

Deploy the entire Linsiq platform locally using Docker Compose.

## Quick Start

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with your AWS credentials

# 2. Start everything
docker-compose up -d

# 3. Check health
curl http://localhost:8000/health

# 4. Open API docs
open http://localhost:8000/docs
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| API | 8000 | FastAPI backend |
| Worker | — | Celery background worker |
| Scheduler | — | Celery Beat cron scheduler |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache + message broker |

## Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f worker
docker-compose logs -f scheduler
docker-compose logs -f postgres
```

## Running Tests

```bash
# In the running API container
docker-compose exec api pytest -v

# With coverage
docker-compose exec api pytest -v --cov=. --cov-report=term
```

## Stopping

```bash
# Stop but keep data
docker-compose down

# Stop and remove all data
docker-compose down -v
```
