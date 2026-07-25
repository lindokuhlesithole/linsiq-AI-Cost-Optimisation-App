"""
Linsiq Application Settings
Loads from environment variables with sensible defaults for free-tier deployment.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Linsiq API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"

    # Database (defaults to SQLite for zero-config deployment)
    DATABASE_URL: str = "sqlite:///./linsiq.db"

    # Redis (uses memory fallback if not configured)
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

    # CORS (comma-separated list, or "*" for all)
    CORS_ORIGINS: str = "*"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
