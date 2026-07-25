"""Dashboard API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict

from db.database import get_db
from core.aws_client import get_aws_client

router = APIRouter()


@router.get("/summary")
async def dashboard_summary(db: Session = Depends(get_db)):
    """Get dashboard summary with key metrics."""
    aws = get_aws_client()

    # AI costs
    ai_costs = aws.get_ai_specific_costs(days=30)

    # Total AI spend
    total_ai_spend = ai_costs.get("total", 0)

    # Service breakdown
    services = []
    for svc, cost in ai_costs.items():
        if svc != "total" and cost > 0:
            pct = round((cost / total_ai_spend * 100), 1) if total_ai_spend > 0 else 0
            services.append({
                "name": svc,
                "cost": cost,
                "percentage": pct,
            })

    services.sort(key=lambda x: x["cost"], reverse=True)

    return {
        "total_ai_spend_30d": total_ai_spend,
        "service_breakdown": services,
        "active_endpoints": len(aws.list_sagemaker_endpoints()),
        "gpu_instances": len(aws.list_gpu_instances()),
        "currency": "USD",
    }


@router.get("/trends")
async def cost_trends(days: int = 30):
    """Get daily cost trends."""
    aws = get_aws_client()
    costs = aws.get_monthly_costs_by_service(days=days)

    # Aggregate by date
    daily = {}
    for c in costs:
        date = c["date"]
        if date not in daily:
            daily[date] = 0
        daily[date] += c["cost_usd"]

    trends = [
        {"date": d, "cost": round(v, 2)}
        for d, v in sorted(daily.items())
    ]

    return {"trends": trends, "days": days}
