# Linsiq — Scale to 1000 Concurrent Users

## Architecture Overview

```
                    +------------------+
                    |   Surge.sh / CDN  |  (Frontend — static, fast)
                    |   linsiq.surge.sh |
                    +--------+---------+
                             |
                    +--------v---------+
                    |   Fly.io Load    |  (3 VMs, auto-balanced)
                    |   Balancer       |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
    +---------v--+  +-------v---+  +------v---+
    |  VM #1     |  |  VM #2    |  |  VM #3   |  256MB RAM each
    |  256MB     |  |  256MB    |  |  256MB   |  ~350 users each
    |  Uvicorn   |  |  Uvicorn  |  |  Uvicorn |
    +-----+------+  +-----+-----+  +----+-----+
          |              |              |
          +--------------+--------------+
                         |
              +----------v-----------+
              |   PostgreSQL         |  3GB storage (Fly.io free)
              |   Connection Pool    |  50 connections per VM
              +----------------------+
                         |
              +----------v-----------+
              |   Redis (Upstash)    |  Caching + sessions
              |   Free tier          |  10K requests/day
              +----------------------+
```

## What You Get (Free Tier)

| Resource | Spec | Cost |
|----------|------|------|
| 3 VMs | 256MB RAM, shared CPU | $0 |
| PostgreSQL | 3GB storage | $0 |
| Redis (Upstash) | 10K req/day | $0 |
| Load Balancer | Built-in | $0 |
| SSL/HTTPS | Auto | $0 |
| Frontend (Surge) | Unlimited bandwidth | $0 |
| **TOTAL** | **1000 concurrent users** | **$0/month** |

---

## Deployment Steps

### Step 1: Create Fly.io Account & Install CLI

```powershell
# Install Fly CLI
iwr https://fly.io/install.ps1 -useb | iex

# Sign up (free, needs credit card for verification only — no charges)
fly auth signup

# Or login
fly auth login
```

### Step 2: Create PostgreSQL Database

```powershell
fly postgres create --name linsiq-db --region jnb --vm-size shared-cpu-1x
```

### Step 3: Create Redis (Upstash)

```powershell
fly redis create --name linsiq-cache --region jnb --plan free
```

### Step 4: Set Secrets

```powershell
# Attach PostgreSQL (sets DATABASE_URL automatically)
fly postgres attach --app linsiq --postgres-cluster linsiq-db

# Set Redis URL (from the output of Step 3)
fly secrets set REDIS_URL="redis://default:...@...upstash.io:6379"

# Set other secrets
fly secrets set AWS_ACCESS_KEY_ID=your_key
fly secrets set AWS_SECRET_ACCESS_KEY=your_secret
fly secrets set SECRET_KEY="$(openssl rand -hex 32)"
fly secrets set CACHE_ENABLED=true
fly secrets set POOL_SIZE=20
fly secrets set POOL_MAX_OVERFLOW=30
fly secrets set RATE_LIMIT=100/minute
fly secrets set CORS_ORIGINS="https://linsiq.surge.sh,https://linsiq.fly.dev"
```

### Step 5: Deploy with Production Config

```powershell
# Deploy with the production config (3 VMs)
fly deploy --config fly.production.toml

# Check status
fly status

# View logs
fly logs
```

### Step 6: Verify Scaling

```powershell
# Check all 3 VMs are running
fly status

# You should see:
# VM 1: shared-cpu-1x, 256mb, jnb, running
# VM 2: shared-cpu-1x, 256mb, jnb, running
# VM 3: shared-cpu-1x, 256mb, jnb, running
# Worker: shared-cpu-1x, 256mb, jnb, running
```

### Step 7: Update Frontend API URL

In your Surge.sh frontend (or local build), set:
```
VITE_API_URL=https://linsiq.fly.dev
```

Then rebuild and redeploy to Surge.

---

## Load Testing (Verify 1000 Users)

Install `locust` to test:

```bash
pip install locust
```

Create `locustfile.py`:
```python
from locust import HttpUser, task, between

class LinsiqUser(HttpUser):
    wait_time = between(1, 3)
    
    @task(3)
    def health_check(self):
        self.client.get("/health")
    
    @task(2)
    def dashboard(self):
        self.client.get("/api/v1/dashboard/summary")
    
    @task(2)
    def waste_findings(self):
        self.client.get("/api/v1/waste/findings")
    
    @task(1)
    def optimizations(self):
        self.client.get("/api/v1/optimizations/")
```

Run the test:
```bash
locust -f locustfile.py --host https://linsiq.fly.dev -u 1000 -r 50
```

Open http://localhost:8089 and watch your API handle 1000 users!

---

## Monitoring

### Fly.io Dashboard
https://fly.io/dashboard → Select `linsiq` app

### Key Metrics to Watch
| Metric | Target | Action if Exceeded |
|--------|--------|-------------------|
| Response time | < 200ms | Increase VM count |
| Error rate | < 1% | Check logs |
| CPU usage | < 80% | Scale VMs |
| Memory usage | < 80% | Increase VM size |
| DB connections | < 100 | Increase pool size |

---

## Scaling Beyond 1000 Users

When you need more:

```powershell
# Increase to 5 VMs (handles ~1700 users)
fly scale count 5 --process-group app

# Upgrade to 512MB RAM per VM
fly scale memory 512

# Or upgrade VM size
fly scale vm performance-1x
```

### Paid Upgrade Path

| Users | Config | Monthly Cost |
|-------|--------|-------------|
| 1000 | 3× shared-cpu-1x (free) | $0 |
| 2000 | 5× shared-cpu-1x | $0 |
| 5000 | 3× performance-1x ($29/mo) | $29 |
| 10000 | 5× performance-2x ($61/mo) | $61 |
| 50000+ | Auto-scaling + dedicated DB | $200+ |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| 502 Bad Gateway | VMs starting — wait 30s |
| High response time | Check Redis cache is connected |
| DB connection errors | Increase POOL_SIZE |
| 429 Too Many Requests | Normal — rate limiter working |
| Out of memory | Reduce POOL_SIZE or scale memory |
