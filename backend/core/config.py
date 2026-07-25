"""
Linsiq Application Settings
Loads from environment variables with sensible defaults for free-tier deployment.
"""
from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Linsiq API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"

    # Database (defaults to SQLite for zero-config deployment)
    DATABASE_URL: str = "sqlite:///./linsiq.db"

    # Redis (uses fakeredis as fallback if not configured)
    REDIS_URL: str = "memory://"
    CELERY_BROKER_URL: str = "memory://"
    CELERY_RESULT_BACKEND: str = "memory://"

    # AWS (required for cost analysis features)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_DEFAULT_REGION: str = "us-east-1"

    # Supabase (required for auth features)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # CORS
    CORS_ORIGINS: List[str] = ["*"]

    class Config:
        env_file = ".env"
        case_sensitive = False

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Parse CORS_ORIGINS from comma-separated string
        cors = os.getenv("CORS_ORIGINS", "*")
        if isinstance(cors, str):
            self.CORS_ORIGINS = [c.strip() for c in cors.split(",")]


settings = Settings()
