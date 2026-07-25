"""Application configuration."""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Linsiq"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"

    # Database
    DATABASE_URL: str = "postgresql+psycopg2://user:pass@localhost/linsiq"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # AWS
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_DEFAULT_REGION: str = "us-east-1"

    # Auth
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # Feature flags
    ENABLE_WASTE_SCAN: bool = True
    ENABLE_AUTO_OPTIMIZE: bool = False  # Manual approval by default
    WASTE_SCAN_INTERVAL_HOURS: int = 6

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
