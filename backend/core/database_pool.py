"""
Linsiq Database Connection Pooling
Handles 1000 concurrent users with connection reuse.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool


def create_pooled_engine(database_url: str):
    """Create a connection-pooled engine for production load."""
    
    # Parse pool settings from environment (with safe defaults)
    pool_size = int(os.getenv("POOL_SIZE", "20"))
    max_overflow = int(os.getenv("POOL_MAX_OVERFLOW", "30"))
    pool_timeout = int(os.getenv("POOL_TIMEOUT", "30"))
    pool_recycle = int(os.getenv("POOL_RECYCLE", "1800"))  # Recycle after 30min
    
    if database_url.startswith("sqlite"):
        # SQLite doesn't need pooling for read-heavy workloads
        return create_engine(
            database_url,
            connect_args={"check_same_thread": False},
        )
    
    # PostgreSQL with connection pooling
    # pool_size=20: Keep 20 connections always open
    # max_overflow=30: Allow 30 extra connections during spikes
    # Total: 50 connections per VM × 3 VMs = 150 connections to PostgreSQL
    return create_engine(
        database_url,
        poolclass=QueuePool,
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_timeout=pool_timeout,
        pool_recycle=pool_recycle,
        pool_pre_ping=True,  # Verify connections before use
        echo=False,
    )
