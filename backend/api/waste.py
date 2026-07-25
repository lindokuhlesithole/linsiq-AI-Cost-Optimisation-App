"""Waste detection API endpoints."""
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db
from core.waste_detector import WasteDetector
from db.models import WasteFinding

router = APIRouter()


@router.post("/scan")
async def trigger_scan(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Trigger a waste scan."""
    detector = WasteDetector()
    findings = detector.scan_all()

    # Save to database
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

    return {
        "scan_id": datetime.utcnow().isoformat(),
        "findings_found": len(findings),
        "new_findings": saved,
        "total_estimated_monthly_savings": round(sum(f["estimated_monthly_savings"] for f in findings), 2),
    }


@router.get("/findings")
async def get_findings(
    severity: str = None,
    status: str = "active",
    db: Session = Depends(get_db),
):
    """Get waste findings with optional filters."""
    query = db.query(WasteFinding)

    if severity:
        query = query.filter(WasteFinding.severity == severity)
    if status:
        query = query.filter(WasteFinding.status == status)

    findings = query.order_by(WasteFinding.severity, WasteFinding.estimated_monthly_savings.desc()).all()

    return {
        "findings": [
            {
                "id": f.id,
                "resource_type": f.resource_type,
                "resource_id": f.resource_id,
                "region": f.region,
                "finding_type": f.finding_type,
                "severity": f.severity,
                "description": f.description,
                "estimated_monthly_savings": f.estimated_monthly_savings,
                "current_cost": f.current_cost,
                "recommendation": f.recommendation,
                "confidence_score": f.confidence_score,
                "status": f.status,
                "detected_at": f.detected_at.isoformat() if f.detected_at else None,
            }
            for f in findings
        ],
        "total": len(findings),
        "total_monthly_savings": round(sum(f.estimated_monthly_savings for f in findings), 2),
    }


@router.post("/findings/{finding_id}/dismiss")
async def dismiss_finding(finding_id: int, db: Session = Depends(get_db)):
    """Dismiss a waste finding."""
    finding = db.query(WasteFinding).filter(WasteFinding.id == finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    finding.status = "dismissed"
    finding.resolved_at = datetime.utcnow()
    db.commit()

    return {"status": "dismissed", "id": finding_id}


from datetime import datetime
from fastapi import HTTPException
