# Linsiq Deployment — Windows Guide

## Option 1: Render.com (EASIEST — No CLI, No Install)

This is the **simplest way** to deploy on Windows. Everything is done in the browser.

### Steps

1. **Sign up at Render.com**
   - Go to https://dashboard.render.com/register
   - Sign up with your GitHub account

2. **Deploy via Blueprint (one-click)**
   - In Render dashboard, click **"New +"** then **"Blueprint"**
   - Paste your GitHub repo URL:
     ```
     https://github.com/lindokuhlesithole/linsiq-AI-Cost-Optimisation-App
     ```
   - Render automatically reads `render.yaml` and deploys everything

3. **Add environment variables** (in Render dashboard)
   - Click your **linsiq-api** service
   - Go to **Environment** tab
   - Add:
     - `AWS_ACCESS_KEY_ID` = your AWS key
     - `AWS_SECRET_ACCESS_KEY` = your AWS secret

4. **Done!** Your API will be live at:
   ```
   https://linsiq-api.onrender.com
   ```

---

## Option 2: Fly.io on Windows

### Step 1: Install Fly CLI (PowerShell as Administrator)

```powershell
# Open PowerShell as Administrator, then run:
iwr https://fly.io/install.ps1 -useb | iex

# Close and reopen PowerShell, then verify:
fly version
```

### Step 2: Sign Up / Log In

```powershell
fly auth signup    # or fly auth login if you already have an account
```

### Step 3: Clone Your Repo & Deploy

```powershell
# Navigate to where you want the project
# Example: cd C:\Users\YourName\Projects
cd C:\Users\Lindokuhle\Documents

# Clone the repo
git clone https://github.com/lindokuhlesithole/linsiq-AI-Cost-Optimisation-App.git
cd linsiq-AI-Cost-Optimisation-App

# Launch the app on Fly.io
fly launch --name linsiq --region jnb --no-deploy

# Create free PostgreSQL database
fly postgres create --name linsiq-db --region jnb

# Attach database to your app
fly postgres attach --app linsiq --postgres-cluster linsiq-db

# Set your AWS credentials (replace with real values)
fly secrets set AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
fly secrets set AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# DEPLOY!
fly deploy

# Check status
fly status

# View logs
fly logs
```

### Your app will be live at: `https://linsiq.fly.dev`

---

## Option 3: Docker Desktop (Run Locally)

### Prerequisites
- Install Docker Desktop: https://www.docker.com/products/docker-desktop
- Install Git: https://git-scm.com/download/win

### Commands (PowerShell or CMD)

```powershell
# Clone the repo
git clone https://github.com/lindokuhlesithole/linsiq-AI-Cost-Optimisation-App.git
cd linsiq-AI-Cost-Optimisation-App

# Create .env file
notepad .env
```

In Notepad, paste this and save:

```
DATABASE_URL=sqlite:///./linsiq.db
REDIS_URL=memory://
CELERY_BROKER_URL=memory://
CELERY_RESULT_BACKEND=memory://
SECRET_KEY=local-dev-secret
AWS_ACCESS_KEY_ID=your_aws_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_here
AWS_DEFAULT_REGION=us-east-1
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
```

```powershell
# Start the platform
docker-compose up -d

# Check it's running
docker-compose ps

# View logs
docker-compose logs -f api

# Check health
curl http://localhost:8000/health

# Open API docs in browser
start http://localhost:8000/docs
```

---

## Option 4: Railway.app (Easier than Fly.io)

1. Go to https://railway.app
2. Sign up with GitHub
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Select your linsiq repo
5. Railway auto-detects the Dockerfile and deploys
6. Add a PostgreSQL database: **New** → **Database** → **Add PostgreSQL**
7. Add environment variables in **Settings**
8. Done!

---

## Quick Comparison

| Platform | Setup Time | Needs CLI | Always On | Best For |
|----------|-----------|-----------|-----------|----------|
| **Render.com** | 2 minutes | ❌ No | ❌ Sleeps | Quickest deploy |
| **Fly.io** | 10 minutes | ✅ Yes | ✅ Yes | Best free option |
| **Docker** | 15 minutes | ❌ No | Your PC | Local testing |
| **Railway** | 5 minutes | ❌ No | ✅ Yes | Easy always-on |

---

## Recommended for You (Windows)

### For a quick live demo → **Render.com** (Option 1)
- Takes 2 minutes
- No software to install
- Everything in the browser

### For a real always-on app → **Railway** (Option 4)
- Takes 5 minutes
- No CLI needed
- Never sleeps
- Easier than Fly on Windows

### For local development → **Docker Desktop** (Option 3)
- Run everything on your machine
- Best for testing and development
