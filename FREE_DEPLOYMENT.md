# Linsiq — FREE Deployment Guide

Deploy the entire Linsiq platform for **$0/month**. No AWS. No credit card required.

---

## Option 1: Render.com ⭐ EASIEST

**Best for:** Quick demo, zero config, sleeps when inactive

### Steps

```bash
# 1. Fork/clone this repo to your GitHub account

# 2. Create a Render account (free)
#    https://dashboard.render.com/register

# 3. Click "New +" → "Blueprint"
#    Paste your repo URL

# 4. Render reads render.yaml and deploys everything automatically
```

### What You Get (FREE)

| Resource | Spec | Limit |
|----------|------|-------|
| Web Service | 512MB RAM | Sleeps after 15min idle |
| PostgreSQL | 1GB storage | 90-day free trial |
| Bandwidth | 100GB/month | — |

### Custom Domain (FREE)

Your app gets a free URL: `https://linsiq-api.onrender.com`

### Keep It Awake (Optional)

Free tier sleeps after 15 min. Use UptimeRobot (free) to ping `/health` every 14 minutes:

1. Go to https://uptimerobot.com
2. Add monitor → HTTP(s) → `https://linsiq-api.onrender.com/health`
3. Set interval to 5 minutes

---

## Option 2: Fly.io ⭐ BEST

**Best for:** Always-on, fastest (Johannesburg region!), real free PostgreSQL

### Steps

```bash
# 1. Install Fly CLI
curl -L https://fly.io/install.sh | sh

# 2. Sign up (free)
fly auth signup

# 3. Launch the app
fly launch --name linsiq-api --region jnb

# 4. Create PostgreSQL (FREE 3GB forever)
fly postgres create --name linsiq-db --region jnb --vm-size shared-cpu-1x

# 5. Attach DB to app
fly postgres attach --app linsiq-api --postgres-cluster linsiq-db

# 6. Set secrets
fly secrets set AWS_ACCESS_KEY_ID=your_key
fly secrets set AWS_SECRET_ACCESS_KEY=your_secret

# 7. Deploy
fly deploy
```

### What You Get (FREE)

| Resource | Spec | Notes |
|----------|------|-------|
| VM | 256MB RAM, shared CPU | Always on, never sleeps |
| PostgreSQL | 3GB storage | Free forever |
| Bandwidth | 160GB/month | — |
| Region | Johannesburg (jnb) | **Lowest latency for SA!** |

### Custom Domain

```bash
fly certs add yourdomain.com
# Add CNAME record pointing to linsiq-api.fly.dev
```

---

## Option 3: Railway.app

**Best for:** Generous resources, GitHub integration, easiest database

### Steps

```bash
# 1. Sign up with GitHub (free $5 credit/month)
#    https://railway.app

# 2. Click "New Project" → "Deploy from GitHub repo"
#    Select your linsiq repo

# 3. Railway auto-detects Dockerfile and deploys

# 4. Add PostgreSQL: New → Database → Add PostgreSQL

# 5. Add environment variables in Settings
```

### What You Get (FREE)

| Resource | Spec |
|----------|------|
| $5 credit/month | Enough for 512MB RAM service + small DB |
| PostgreSQL | Included |
| Always on | Yes |
| Bandwidth | 100GB |

---

## Option 4: Supabase + Vercel (Serverless)

**Best for:** Serverless, edge deployment, separate frontend/backend

### Backend (Supabase Edge Functions)

```bash
# Deploy backend as Supabase Edge Functions
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase functions deploy
```

### Frontend (Vercel)

```bash
# 1. Push frontend to GitHub
# 2. Import to Vercel
# 3. Set environment variable: VITE_API_URL=<your-supabase-url>
```

### What You Get (FREE)

| Resource | Spec |
|----------|------|
| Supabase DB | 500MB, 500K requests/month |
| Edge Functions | 500K invocations/month |
| Vercel Hosting | 100GB bandwidth |

---

## Option 5: Oracle Cloud FREE TIER (Always Free)

**Best for:** Most powerful free VMs, never expires

### What You Get (ALWAYS FREE — FOREVER)

| Resource | Spec |
|----------|------|
| AMD VM | 2 instances, 1/8 OCPU + 1GB RAM each |
| ARM VM | 1 instance, 4 OCPU + 24GB RAM |
| Storage | 200GB boot volumes |
| Bandwidth | 10TB/month |
| Database | 2 free Autonomous DBs |

### Steps

```bash
# 1. Sign up: https://www.oracle.com/cloud/free/
# 2. Create ARM VM (4 OCPU, 24GB RAM — VERY powerful!)
# 3. SSH into VM
# 4. Install Docker
sudo apt update && sudo apt install docker.io docker-compose -y

# 5. Clone and run
git clone https://github.com/lindokuhlesithole/linsiq-AI-Cost-Optimisation-App.git
cd linsiq-AI-Cost-Optimisation-App
docker-compose up -d

# 6. Open firewall port 8000 in Oracle console
# 7. Access: http://<vm-public-ip>:8000
```

---

## Feature Comparison

| Feature | Render | Fly.io | Railway | Supabase+Vercel | Oracle |
|---------|--------|--------|---------|-----------------|--------|
| **Always On** | ❌ (sleeps) | ✅ | ✅ | ✅ | ✅ |
| **PostgreSQL** | ✅ (90 days) | ✅ (3GB) | ✅ | ✅ (500MB) | ✅ |
| **RAM** | 512MB | 256MB | 512MB | 256MB | 24GB (ARM) |
| **Region: SA** | ❌ | ✅ JNB | ❌ | ❌ | ✅ JNB |
| **Custom Domain** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **SSL/HTTPS** | ✅ | ✅ | ✅ | ✅ | Manual |
| **Easiest Setup** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| **Never Expires** | ❌ | ✅ | ❌ | ✅ | ✅ |

---

## Recommended: Fly.io (Best Free Option)

For a South African user building a billion-dollar platform:

1. **Johannesburg region** — lowest latency for SA users
2. **Always on** — no cold starts, professional feel
3. **Free forever** — 3GB PostgreSQL never expires
4. **Easy scaling** — `fly scale` when you need more power
5. **Custom domain + SSL** — `fly certs add`

### Deploy Now

```bash
# One-time setup
curl -L https://fly.io/install.sh | sh
fly auth signup  # or fly auth login

# Deploy everything
fly launch --name linsiq --region jnb --no-deploy
fly postgres create --name linsiq-db --region jnb
fly postgres attach --app linsiq --postgres-cluster linsiq-db
fly secrets set AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx
fly deploy

# Check
fly status
fly logs
```

Your API will be live at: **`https://linsiq.fly.dev`**
