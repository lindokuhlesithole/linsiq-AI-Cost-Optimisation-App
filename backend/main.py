"""
Linsiq Backend API
FastAPI application for AI cost optimization.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime

from api.costs import router as costs_router
from api.waste import router as waste_router
from api.optimizations import router as opt_router
from api.audit import router as audit_router
from api.dashboard import router as dashboard_router
from api.auth import router as auth_router
from db.database import engine, Base
from core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield
    engine.dispose()


app = FastAPI(
    title="Linsiq API",
    description="AI Cost Optimization Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Parse CORS origins: comma-separated string to list
cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")] if settings.CORS_ORIGINS != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(costs_router, prefix="/api/v1/costs", tags=["Costs"])
app.include_router(waste_router, prefix="/api/v1/waste", tags=["Waste Detection"])
app.include_router(opt_router, prefix="/api/v1/optimizations", tags=["Optimizations"])
app.include_router(audit_router, prefix="/api/v1/audit", tags=["Audit Log"])
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Dashboard"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "name": "Linsiq API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }
