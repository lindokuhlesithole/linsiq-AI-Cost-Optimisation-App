"""AI waste detection engine.
Identifies idle, over-provisioned, and unnecessarily expensive resources.
"""
from datetime import datetime, timedelta
from typing import List, Dict
import logging

from core.aws_client import get_aws_client

logger = logging.getLogger(__name__)


class WasteDetector:
    """Scans AWS AI resources for waste and generates findings."""

    # Cost estimates per hour (on-demand, us-east-1)
    INSTANCE_COSTS = {
        "ml.t2.medium": 0.065,
        "ml.t2.large": 0.13,
        "ml.t3.medium": 0.065,
        "ml.t3.large": 0.13,
        "ml.m5.large": 0.134,
        "ml.m5.xlarge": 0.269,
        "ml.m5.2xlarge": 0.538,
        "ml.c5.large": 0.119,
        "ml.c5.xlarge": 0.238,
        "ml.c5.2xlarge": 0.476,
        "ml.g4dn.xlarge": 0.736,
        "ml.g4dn.2xlarge": 1.053,
        "ml.g4dn.4xlarge": 1.686,
        "ml.g5.xlarge": 1.006,
        "ml.g5.2xlarge": 1.515,
        "ml.p3.2xlarge": 3.825,
        "ml.p3.8xlarge": 15.30,
        "ml.p4d.24xlarge": 32.77,
    }

    def __init__(self):
        self.aws = get_aws_client()

    def scan_all(self, account_id: str = "default") -> List[Dict]:
        """Run complete waste scan across all AI resources."""
        findings = []
        findings.extend(self._scan_sagemaker_endpoints(account_id))
        findings.extend(self._scan_gpu_instances(account_id))
        findings.extend(self._scan_stopped_endpoints(account_id))
        return findings

    def _scan_sagemaker_endpoints(self, account_id: str) -> List[Dict]:
        """Find idle SageMaker endpoints."""
        findings = []
        endpoints = self.aws.list_sagemaker_endpoints()

        for ep in endpoints:
            if ep["status"] != "InService":
                continue

            metrics = self.aws.get_endpoint_utilization(ep["name"], hours=168)  # 7 days

            # Idle endpoint: < 10 invocations in 7 days
            if metrics["invocations"] < 10:
                instance_cost = self._estimate_endpoint_cost(ep["name"])
                findings.append({
                    "account_id": account_id,
                    "resource_type": "sagemaker_endpoint",
                    "resource_id": ep["name"],
                    "region": settings.AWS_DEFAULT_REGION,
                    "finding_type": "idle_endpoint",
                    "severity": "high",
                    "description": f"Endpoint {ep['name']} received only {int(metrics['invocations'])} invocations in 7 days. Consider stopping it.",
                    "estimated_monthly_savings": round(instance_cost * 24 * 30, 2),
                    "current_cost": round(instance_cost * 24 * 30, 2),
                    "recommendation": "Stop endpoint. Can be restarted in < 5 min when needed.",
                    "confidence_score": 0.95,
                })
            # Low utilization: < 100 invocations/day
            elif metrics["avg_per_hour"] < 4:  # < 100/day
                instance_cost = self._estimate_endpoint_cost(ep["name"])
                findings.append({
                    "account_id": account_id,
                    "resource_type": "sagemaker_endpoint",
                    "resource_id": ep["name"],
                    "region": settings.AWS_DEFAULT_REGION,
                    "finding_type": "low_utilization",
                    "severity": "medium",
                    "description": f"Endpoint {ep['name']} averaging {metrics['avg_per_hour']:.1f} invocations/hour. Consider downscaling.",
                    "estimated_monthly_savings": round(instance_cost * 24 * 30 * 0.5, 2),
                    "current_cost": round(instance_cost * 24 * 30, 2),
                    "recommendation": "Downscale to smaller instance type or enable auto-scaling.",
                    "confidence_score": 0.85,
                })

        return findings

    def _scan_gpu_instances(self, account_id: str) -> List[Dict]:
        """Find underutilized GPU instances."""
        findings = []
        instances = self.aws.list_gpu_instances()

        for inst in instances:
            cpu_util = self.aws.get_instance_cpu_utilization(inst["instance_id"], hours=168)

            # Low CPU on GPU = waste
            if cpu_util < 5.0:
                hourly_cost = self._get_ec2_hourly_cost(inst["type"])
                findings.append({
                    "account_id": account_id,
                    "resource_type": "ec2_instance",
                    "resource_id": inst["instance_id"],
                    "region": inst["region"],
                    "finding_type": "idle_gpu",
                    "severity": "critical",
                    "description": f"GPU instance {inst['instance_id']} ({inst['type']}) has {cpu_util:.1f}% avg CPU over 7 days. GPU is likely idle.",
                    "estimated_monthly_savings": round(hourly_cost * 24 * 30, 2),
                    "current_cost": round(hourly_cost * 24 * 30, 2),
                    "recommendation": "Stop instance immediately or convert to Spot. GPU instances are expensive.",
                    "confidence_score": 0.92,
                })
            elif cpu_util < 20.0:
                hourly_cost = self._get_ec2_hourly_cost(inst["type"])
                findings.append({
                    "account_id": account_id,
                    "resource_type": "ec2_instance",
                    "resource_id": inst["instance_id"],
                    "region": inst["region"],
                    "finding_type": "underutilized_gpu",
                    "severity": "high",
                    "description": f"GPU instance {inst['instance_id']} ({inst['type']}) has {cpu_util:.1f}% avg CPU. Consider smaller instance.",
                    "estimated_monthly_savings": round(hourly_cost * 24 * 30 * 0.4, 2),
                    "current_cost": round(hourly_cost * 24 * 30, 2),
                    "recommendation": "Downscale to smaller GPU or use SageMaker Serverless Inference.",
                    "confidence_score": 0.80,
                })

        return findings

    def _scan_stopped_endpoints(self, account_id: str) -> List[Dict]:
        """Note: stopped endpoints don't cost, but flag for cleanup."""
        findings = []
        endpoints = self.aws.list_sagemaker_endpoints()

        for ep in endpoints:
            if ep["status"] == "Failed":
                findings.append({
                    "account_id": account_id,
                    "resource_type": "sagemaker_endpoint",
                    "resource_id": ep["name"],
                    "region": settings.AWS_DEFAULT_REGION,
                    "finding_type": "failed_endpoint",
                    "severity": "low",
                    "description": f"Endpoint {ep['name']} is in Failed state. Should be deleted.",
                    "estimated_monthly_savings": 0,
                    "current_cost": 0,
                    "recommendation": "Delete failed endpoint to clean up resources.",
                    "confidence_score": 0.99,
                })

        return findings

    def _estimate_endpoint_cost(self, endpoint_name: str) -> float:
        """Estimate hourly cost of a SageMaker endpoint."""
        try:
            resp = self.aws.sm.describe_endpoint(EndpointName=endpoint_name)
            instance_type = resp["ProductionVariants"][0].get("InstanceType", "ml.t2.medium")
            return self.INSTANCE_COSTS.get(instance_type, 0.13)
        except Exception:
            return 0.13  # default

    def _get_ec2_hourly_cost(self, instance_type: str) -> float:
        """Get estimated hourly cost for EC2 GPU instances."""
        ec2_costs = {
            "g4dn.xlarge": 0.526,
            "g4dn.2xlarge": 0.752,
            "g4dn.4xlarge": 1.204,
            "g5.xlarge": 1.006,
            "g5.2xlarge": 1.515,
            "p3.2xlarge": 3.06,
            "p3.8xlarge": 12.24,
            "p4d.24xlarge": 32.77,
        }
        return ec2_costs.get(instance_type, 1.0)


from core.config import settings
