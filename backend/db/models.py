"""SQLAlchemy database models."""
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, JSON, Text, Enum as SQLEnum
from sqlalchemy.sql import func
from db.database import Base
import enum


class OptimizationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    APPLIED = "applied"
    ROLLED_BACK = "rolled_back"
    REJECTED = "rejected"


class ResourceType(str, enum.Enum):
    SAGEMAKER_ENDPOINT = "sagemaker_endpoint"
    SAGEMAKER_NOTEBOOK = "sagemaker_notebook"
    EC2_INSTANCE = "ec2_instance"
    EC2_VOLUME = "ec2_volume"
    LAMBDA_FUNCTION = "lambda_function"
    BEDROCK_MODEL = "bedrock_model"


class CostSnapshot(Base):
    __tablename__ = "cost_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String(20), nullable=False, index=True)
    service = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(255), nullable=False)
    region = Column(String(20), nullable=False)
    cost_usd = Column(Float, nullable=False)
    usage_hours = Column(Float, default=0)
    utilization_pct = Column(Float, nullable=True)
    tags = Column(JSON, default=dict)
    snapshot_date = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WasteFinding(Base):
    __tablename__ = "waste_findings"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String(20), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(255), nullable=False)
    region = Column(String(20), nullable=False)
    finding_type = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False)  # critical, high, medium, low
    description = Column(Text, nullable=False)
    estimated_monthly_savings = Column(Float, default=0)
    current_cost = Column(Float, default=0)
    recommendation = Column(Text, nullable=False)
    confidence_score = Column(Float, default=0.0)
    status = Column(String(20), default="active")  # active, resolved, dismissed
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class Optimization(Base):
    __tablename__ = "optimizations"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String(20), nullable=False, index=True)
    waste_finding_id = Column(Integer, nullable=True)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(255), nullable=False)
    region = Column(String(20), nullable=False)
    action_type = Column(String(100), nullable=False)
    action_details = Column(JSON, default=dict)
    status = Column(String(20), default=OptimizationStatus.PENDING.value)
    requested_by = Column(String(255), nullable=False)
    approved_by = Column(String(255), nullable=True)
    applied_at = Column(DateTime(timezone=True), nullable=True)
    rollback_details = Column(JSON, nullable=True)
    actual_savings = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String(20), nullable=False, index=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(255), nullable=False)
    user_id = Column(String(255), nullable=False)
    details = Column(JSON, default=dict)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BudgetAlert(Base):
    __tablename__ = "budget_alerts"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String(20), nullable=False, index=True)
    service = Column(String(100), nullable=False)
    budget_amount = Column(Float, nullable=False)
    alert_threshold_pct = Column(Float, default=80)
    current_spend = Column(Float, default=0)
    alert_sent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
