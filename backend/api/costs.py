"""Cost data API endpoints."""
from fastapi import APIRouter, Depends
from typing import List, Optional

from core.aws_client import get_aws_client

router = APIRouter()


@router.get("/by-service")
async def costs_by_service(days: int = 30):
    """Get costs grouped by AWS service."""
    aws = get_aws_client()
    costs = aws.get_monthly_costs_by_service(days=days)

    # Aggregate by service
    by_service = {}
    for c in costs:
        svc = c["service"]
        if svc not in by_service:
            by_service[svc] = 0
        by_service[svc] += c["cost_usd"]

    return {
        "services": [
            {"name": k, "cost": round(v, 2)}
            for k, v in sorted(by_service.items(), key=lambda x: -x[1])
        ],
        "days": days,
    }


@router.get("/ai-services")
async def ai_service_costs(days: int = 30):
    """Get costs for AI-specific services."""
    aws = get_aws_client()
    return aws.get_ai_specific_costs(days=days)
