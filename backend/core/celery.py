"""Celery configuration for background tasks."""
from celery import Celery
from core.config import settings

celery_app = Celery(
    "linsiq",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["core.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "waste-scan-every-6h": {
            "task": "core.tasks.run_waste_scan",
            "schedule": 21600.0,  # 6 hours
        },
        "cost-snapshot-daily": {
            "task": "core.tasks.take_cost_snapshot",
            "schedule": 86400.0,  # 24 hours
        },
    },
)
