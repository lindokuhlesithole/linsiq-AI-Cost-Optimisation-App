# Linsiq — Complete Setup Guide
# (AWS Keys + Frontend + UptimeRobot)

---

## PART 1: Add AWS Keys (Real Cost Data)

### Step 1: Get Your AWS Keys

1. Go to https://console.aws.amazon.com/iam/
2. Click **Users** → **Create User**
3. User name: `linsiq-api`
4. Click **Next** → **Attach policies directly**
5. Search and select:
   - `AWSBillingReadOnlyAccess`
   - `AmazonEC2ReadOnlyAccess`
   - `AmazonSageMakerReadOnlyAccess`
   - `CloudWatchReadOnlyAccess`
6. Click **Next** → **Create User**
7. Click on the new user → **Security credentials** tab
8. Click **Create access key** → **Third-party service** → **Next**
9. Click **Create access key**
10. **COPY BOTH KEYS NOW** (you won't see the secret again!)

### Step 2: Add Keys to Render

1. Go to https://dashboard.render.com
2. Click **linsiq-api** service
3. Click **Environment** tab (left sidebar)
4. Click **Add Environment Variable**
   - Key: `AWS_ACCESS_KEY_ID` | Value: your copied access key
5. Click **Add Environment Variable** again
   - Key: `AWS_SECRET_ACCESS_KEY` | Value: your copied secret key
6. Click **Save Changes**
7. The service will auto-restart with the new keys!

### Step 3: Test Real Cost Data

Open in browser:
```
https://linsiq-api.onrender.com/api/v1/costs/summary
```

You should now see your **actual AWS spending data**!

---

## PART 2: Deploy Frontend to Vercel

### Step 1: Connect to Vercel

1. Go to https://vercel.com
2. Sign up with your **GitHub** account
3. Click **"Add New..."** → **"Project"**
4. Find and select your repo: `linsiq-AI-Cost-Optimisation-App`
5. Click **Import**

### Step 2: Configure Build

Fill in these settings:

| Field | Value |
|-------|-------|
| **Framework Preset** | `Vite` |
| **Root Directory** | `.` (leave as is) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

### Step 3: Add Environment Variable

Before clicking Deploy, add this:

Click **"Environment Variables"** and add:
- Key: `VITE_API_URL`
- Value: `https://linsiq-api.onrender.com`

### Step 4: Deploy!

Click **Deploy**

Wait 1-2 minutes... Your frontend will be live at:
```
https://linsiq.vercel.app
```

### Step 5: Connect Frontend to Backend

Your frontend should now automatically talk to your backend API!

---

## PART 3: UptimeRobot (Keep Free Tier Awake)

### The Problem

Render's free tier **sleeps after 15 minutes** of inactivity. First request after sleep takes ~30 seconds.

### The Solution

UptimeRobot pings your API every 5 minutes to keep it awake. Completely free.

### Steps

1. Go to https://uptimerobot.com
2. Click **"Sign Up"** (free, no credit card)
3. Verify your email
4. Click **"Add New Monitor"**
5. Fill in:

| Field | Value |
|-------|-------|
| **Monitor Type** | HTTP(s) |
| **Friendly Name** | Linsiq API |
| **URL** | `https://linsiq-api.onrender.com/health` |
| **Monitoring Interval** | 5 minutes |

6. Click **"Create Monitor"**

### Done! 

Your API will now stay awake 24/7. You'll also get an email if your API ever goes down.

---

## Summary: What You Get After All 3

| Component | URL | Status |
|-----------|-----|--------|
| Backend API | https://linsiq-api.onrender.com | LIVE |
| Frontend | https://linsiq.vercel.app | LIVE |
| API Docs | https://linsiq-api.onrender.com/docs | LIVE |
| Database | PostgreSQL (Render) | CONNECTED |
| AWS Cost Data | Real-time | WITH KEYS |
| Always On | UptimeRobot pinging | 24/7 |

**Your billion-dollar platform is fully operational!** 
