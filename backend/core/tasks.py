"""Background Celery tasks."""
from celery import shared_task
import logging

from core.celery import celery_app
from core.waste_detector import WasteDetector
from core.aws_client import get_aws_client
from db.database import SessionLocal
from db.models import CostSnapshot

logger = logging.getLogger(__name__)


@celery_app.task
def run_waste_scan():
    """Run automated waste scan."""
    logger.info("Starting automated waste scan")
    detector = WasteDetector()
    findings = detector.scan_all()

    db = SessionLocal()
    try:
        from db.models import WasteFinding
        saved = 0
        for f in findings:
            existing = db.query(WasteFinding).filter(
                WasteFinding.resource_id == f["resource_id"],
                WasteFinding.status == "active",
            ).first()
            if not existing:
                finding = WasteFinding(**f)
                db.add(finding)
                saved += 1
        db.commit()
        logger.info(f"Waste scan complete: {len(findings)} findings, {saved} new")
        return {"findings": len(findings), "new": saved}
    finally:
        db.close()


@celery_app.task
def take_cost_snapshot():
    """Take daily cost snapshot."""
    logger.info("Taking cost snapshot")
    aws = get_aws_client()
    costs = aws.get_monthly_costs_by_service(days=1)

    db = SessionLocal()
    try:
        for c in costs:
            snapshot = CostSnapshot(
                account_id="default",
                service=c["service"],
                resource_type="unknown",
                resource_id="aggregate",
                region="global",
                cost_usd=c["cost_usd"],
                usage_hours=0,
            )
            db.add(snapshot)
        db.commit()
        logger.info(f"Cost snapshot complete: {len(costs)} services recorded")
        return {"services": len(costs)}
    finally:
        db.close()
