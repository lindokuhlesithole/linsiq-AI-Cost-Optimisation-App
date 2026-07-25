"""
Linsiq Celery Configuration
Works with Redis (production) or in-memory (free tier / local dev).
"""
import os
from celery import Celery

broker_url = os.getenv("CELERY_BROKER_URL", "memory://")
result_backend = os.getenv("CELERY_RESULT_BACKEND", "memory://")

# Use in-memory broker for free tier (no Redis required)
if broker_url == "memory://":
    app = Celery(
        "linsiq",
        broker="memory://",
        backend="cache+memory://",
        task_always_eager=True,  # Run tasks synchronously in-process
    )
else:
    app = Celery(
        "linsiq",
        broker=broker_url,
        backend=result_backend,
    )

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    result_expires=3600,
    broker_connection_retry_on_startup=True,
)

# Import tasks so Celery can discover them
app.autodiscover_tasks(["core"])
