"""
Scheduled background tasks for Linsiq.
Runs waste scans and cost snapshots on a regular schedule via Celery Beat.
"""
from celery import shared_task
from celery.schedules import crontab
from core.celery import app
from core.waste_detector import WasteDetector
from core.aws_client import AWSCostClient
from db.database import SessionLocal
from db.models import CostSnapshot
import logging

logger = logging.getLogger(__name__)

# Celery Beat schedule configuration
app.conf.beat_schedule = {
    "daily-waste-scan": {
        "task": "core.scheduler.daily_waste_scan",
        "schedule": crontab(hour=2, minute=0),  # 2 AM daily
    },
    "hourly-cost-snapshot": {
        "task": "core.scheduler.hourly_cost_snapshot",
        "schedule": crontab(minute=0),  # Every hour
    },
    "weekly-optimization-report": {
        "task": "core.scheduler.weekly_report",
        "schedule": crontab(hour=9, minute=0, day_of_week=1),  # Monday 9 AM
    },
}
app.conf.timezone = "UTC"


@shared_task(bind=True, max_retries=3)
def daily_waste_scan(self):
    """Run a full waste scan and save findings."""
    logger.info("Starting daily waste scan")
    try:
        detector = WasteDetector()
        result = detector.run_full_scan()
        logger.info(f"Waste scan complete: {len(result.get('findings', []))} findings")
        return result
    except Exception as exc:
        logger.error(f"Waste scan failed: {exc}")
        raise self.retry(exc=exc, countdown=300)


@shared_task(bind=True, max_retries=3)
def hourly_cost_snapshot(self):
    """Take a cost snapshot for trend analysis."""
    logger.info("Taking hourly cost snapshot")
    try:
        aws = AWSCostClient()
        costs = aws.get_ai_specific_costs()
        db = SessionLocal()
        snapshot = CostSnapshot(
            total_cost=costs.get("total_monthly_cost", 0),
            ai_services_cost=costs.get("ai_services_cost", 0),
            service_breakdown=costs.get("by_service", {}),
        )
        db.add(snapshot)
        db.commit()
        db.close()
        logger.info("Cost snapshot saved")
        return {"status": "saved", "total": snapshot.total_cost}
    except Exception as exc:
        logger.error(f"Cost snapshot failed: {exc}")
        raise self.retry(exc=exc, countdown=60)


@shared_task
def weekly_report():
    """Generate weekly optimization report."""
    logger.info("Generating weekly report")
    # Placeholder for report generation logic
    return {"status": "generated"}
