"""Optimization API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from db.database import get_db
from db.models import Optimization, OptimizationStatus, AuditLog

router = APIRouter()


@router.get("/")
async def list_optimizations(
    status: str = None,
    db: Session = Depends(get_db),
):
    """List all optimizations."""
    query = db.query(Optimization)
    if status:
        query = query.filter(Optimization.status == status)

    opts = query.order_by(Optimization.created_at.desc()).all()
    return {
        "optimizations": [
            {
                "id": o.id,
                "resource_type": o.resource_type,
                "resource_id": o.resource_id,
                "region": o.region,
                "action_type": o.action_type,
                "status": o.status,
                "requested_by": o.requested_by,
                "approved_by": o.approved_by,
                "applied_at": o.applied_at.isoformat() if o.applied_at else None,
                "actual_savings": o.actual_savings,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in opts
        ],
        "total": len(opts),
    }


@router.post("/")
async def create_optimization(
    resource_type: str,
    resource_id: str,
    region: str,
    action_type: str,
    action_details: dict,
    requested_by: str = "system",
    db: Session = Depends(get_db),
):
    """Create a new optimization request."""
    opt = Optimization(
        account_id="default",
        resource_type=resource_type,
        resource_id=resource_id,
        region=region,
        action_type=action_type,
        action_details=action_details,
        requested_by=requested_by,
        status=OptimizationStatus.PENDING,
    )
    db.add(opt)
    db.commit()
    db.refresh(opt)

    # Log
    audit = AuditLog(
        account_id="default",
        action="optimization_requested",
        resource_type=resource_type,
        resource_id=resource_id,
        user_id=requested_by,
        details={"optimization_id": opt.id, "action_type": action_type},
    )
    db.add(audit)
    db.commit()

    return {"id": opt.id, "status": "pending"}


@router.post("/{opt_id}/approve")
async def approve_optimization(opt_id: int, approved_by: str, db: Session = Depends(get_db)):
    """Approve a pending optimization."""
    opt = db.query(Optimization).filter(Optimization.id == opt_id).first()
    if not opt:
        raise HTTPException(status_code=404, detail="Optimization not found")
    if opt.status != OptimizationStatus.PENDING.value:
        raise HTTPException(status_code=400, detail=f"Cannot approve optimization with status: {opt.status}")

    opt.status = OptimizationStatus.APPROVED.value
    opt.approved_by = approved_by
    db.commit()

    return {"id": opt.id, "status": "approved"}


@router.post("/{opt_id}/apply")
async def apply_optimization(opt_id: int, db: Session = Depends(get_db)):
    """Apply an approved optimization."""
    opt = db.query(Optimization).filter(Optimization.id == opt_id).first()
    if not opt:
        raise HTTPException(status_code=404, detail="Optimization not found")
    if opt.status != OptimizationStatus.APPROVED.value:
        raise HTTPException(status_code=400, detail="Optimization must be approved before applying")

    # TODO: Implement actual AWS API calls here
    # For now, mark as applied
    opt.status = OptimizationStatus.APPLIED.value
    opt.applied_at = datetime.utcnow()
    db.commit()

    return {"id": opt.id, "status": "applied"}


@router.post("/{opt_id}/rollback")
async def rollback_optimization(opt_id: int, db: Session = Depends(get_db)):
    """Rollback an applied optimization."""
    opt = db.query(Optimization).filter(Optimization.id == opt_id).first()
    if not opt:
        raise HTTPException(status_code=404, detail="Optimization not found")

    opt.status = OptimizationStatus.ROLLED_BACK.value
    db.commit()

    return {"id": opt.id, "status": "rolled_back"}
