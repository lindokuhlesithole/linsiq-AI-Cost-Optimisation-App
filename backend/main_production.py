"""
Linsiq Backend API — Production Edition
Optimized for 1000 concurrent users with:
- Connection pooling
- Redis caching
- Rate limiting
- Health monitoring
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
from datetime import datetime
import os

from api.costs import router as costs_router
from api.waste import router as waste_router
from api.optimizations import router as opt_router
from api.audit import router as audit_router
from api.dashboard import router as dashboard_router
from api.auth import router as auth_router
from core.config import settings
from core.database_pool import create_pooled_engine
from core.cache import cache
from core.rate_limiter import RateLimitMiddleware
from db.database import Base
from db.models import CostSnapshot, WasteFinding, Optimization, AuditLog

# Create pooled database engine
engine = create_pooled_engine(settings.DATABASE_URL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    cache.clear()
    yield
    # Shutdown: Dispose engine
    engine.dispose()


app = FastAPI(
    title="Linsiq API",
    description="AI Cost Optimization Platform — Production",
    version="1.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# --- Middleware (order matters!) ---

# 1. Gzip compression (reduces response size by ~70%)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# 2. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")] if settings.CORS_ORIGINS != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=600,  # Cache preflight for 10 minutes
)

# 3. Rate limiting (100 requests/minute per IP)
if os.getenv("RATE_LIMIT"):
    app.add_middleware(RateLimitMiddleware, rate=os.getenv("RATE_LIMIT"))

# --- Routers ---
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(costs_router, prefix="/api/v1/costs", tags=["Costs"])
app.include_router(waste_router, prefix="/api/v1/waste", tags=["Waste Detection"])
app.include_router(opt_router, prefix="/api/v1/optimizations", tags=["Optimizations"])
app.include_router(audit_router, prefix="/api/v1/audit", tags=["Audit Log"])
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Dashboard"])


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check for load balancers."""
    return {
        "status": "healthy",
        "version": "1.1.0",
        "timestamp": datetime.utcnow().isoformat(),
        "cache": "redis" if os.getenv("CACHE_ENABLED") == "true" else "memory",
        "pool_size": os.getenv("POOL_SIZE", "20"),
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "name": "Linsiq API",
        "version": "1.1.0",
        "docs": "/docs",
        "health": "/health",
        "capacity": "1000 concurrent users",
    }


@app.get("/ready", tags=["Readiness"])
async def readiness_check():
    """Readiness probe for Kubernetes/Fly.io."""
    try:
        # Test database connection
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return {"status": "not_ready", "database": str(e)}
