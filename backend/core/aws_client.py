"""AWS SDK client wrapper for cost data and resource metrics."""
import boto3
from botocore.exceptions import ClientError
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging

from core.config import settings

logger = logging.getLogger(__name__)


class AWSClient:
    """Unified AWS client for Linsiq cost optimization."""

    def __init__(self, access_key: str = None, secret_key: str = None, region: str = None):
        self.session = boto3.Session(
            aws_access_key_id=access_key or settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=secret_key or settings.AWS_SECRET_ACCESS_KEY,
            region_name=region or settings.AWS_DEFAULT_REGION,
        )
        self.ce = self.session.client("ce")  # Cost Explorer
        self.sm = self.session.client("sagemaker")  # SageMaker
        self.ec2 = self.session.client("ec2")  # EC2
        self.cw = self.session.client("cloudwatch")  # CloudWatch
        self.bedrock = self.session.client("bedrock")  # Bedrock

    # ── Cost Explorer ──────────────────────────────────────────

    def get_monthly_costs_by_service(self, days: int = 30) -> List[Dict]:
        """Get cost breakdown by AWS service."""
        end = datetime.utcnow().date()
        start = end - timedelta(days=days)

        try:
            resp = self.ce.get_cost_and_usage(
                TimePeriod={"Start": str(start), "End": str(end)},
                Granularity="DAILY",
                Metrics=["UnblendedCost", "UsageQuantity"],
                GroupBy=[
                    {"Type": "DIMENSION", "Key": "SERVICE"},
                ],
            )

            results = []
            for day in resp.get("ResultsByTime", []):
                date = day["TimePeriod"]["Start"]
                for group in day.get("Groups", []):
                    service = group["Keys"][0]
                    cost = float(group["Metrics"]["UnblendedCost"]["Amount"])
                    results.append({
                        "date": date,
                        "service": service,
                        "cost_usd": round(cost, 2),
                    })
            return results
        except ClientError as e:
            logger.error(f"Cost Explorer error: {e}")
            return []

    def get_ai_specific_costs(self, days: int = 30) -> Dict:
        """Get costs specifically for AI services."""
        ai_services = [
            "Amazon SageMaker",
            "Amazon Bedrock",
            "Amazon EC2",  # GPU instances
            "AWS Lambda",
        ]

        end = datetime.utcnow().date()
        start = end - timedelta(days=days)

        results = {svc: 0.0 for svc in ai_services}
        results["total"] = 0.0

        try:
            resp = self.ce.get_cost_and_usage(
                TimePeriod={"Start": str(start), "End": str(end)},
                Granularity="MONTHLY",
                Metrics=["UnblendedCost"],
                GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
                Filter={
                    "Dimensions": {
                        "Key": "SERVICE",
                        "Values": ai_services,
                    }
                },
            )

            for period in resp.get("ResultsByTime", []):
                for group in period.get("Groups", []):
                    service = group["Keys"][0]
                    cost = float(group["Metrics"]["UnblendedCost"]["Amount"])
                    results[service] = round(cost, 2)
                    results["total"] += cost

            results["total"] = round(results["total"], 2)
            return results
        except ClientError as e:
            logger.error(f"AI cost fetch error: {e}")
            return results

    # ── SageMaker ──────────────────────────────────────────────

    def list_sagemaker_endpoints(self) -> List[Dict]:
        """List all SageMaker endpoints with status."""
        try:
            resp = self.sm.list_endpoints()
            endpoints = []
            for ep in resp.get("Endpoints", []):
                endpoints.append({
                    "name": ep["EndpointName"],
                    "arn": ep["EndpointArn"],
                    "status": ep["EndpointStatus"],
                    "created": ep["CreationTime"].isoformat(),
                })
            return endpoints
        except ClientError as e:
            logger.error(f"SageMaker error: {e}")
            return []

    def get_endpoint_utilization(self, endpoint_name: str, hours: int = 24) -> Dict:
        """Get CloudWatch metrics for endpoint utilization."""
        end = datetime.utcnow()
        start = end - timedelta(hours=hours)

        metrics = {}

        # Invocations
        try:
            resp = self.cw.get_metric_statistics(
                Namespace="AWS/SageMaker",
                MetricName="Invocations",
                Dimensions=[{"Name": "EndpointName", "Value": endpoint_name}],
                StartTime=start,
                EndTime=end,
                Period=3600,
                Statistics=["Sum"],
            )
            total_invocations = sum(dp["Sum"] for dp in resp.get("Datapoints", []))
            metrics["invocations"] = total_invocations
            metrics["avg_per_hour"] = round(total_invocations / hours, 2) if hours > 0 else 0
        except ClientError:
            metrics["invocations"] = 0
            metrics["avg_per_hour"] = 0

        # ModelLatency
        try:
            resp = self.cw.get_metric_statistics(
                Namespace="AWS/SageMaker",
                MetricName="ModelLatency",
                Dimensions=[{"Name": "EndpointName", "Value": endpoint_name}],
                StartTime=start,
                EndTime=end,
                Period=3600,
                Statistics=["Average"],
            )
            if resp.get("Datapoints"):
                avg_lat = sum(dp["Average"] for dp in resp["Datapoints"]) / len(resp["Datapoints"])
                metrics["avg_latency_ms"] = round(avg_lat / 1000, 2)
            else:
                metrics["avg_latency_ms"] = 0
        except ClientError:
            metrics["avg_latency_ms"] = 0

        return metrics

    # ── EC2 ────────────────────────────────────────────────────

    def list_gpu_instances(self) -> List[Dict]:
        """List EC2 GPU instances (g4, g5, p3, p4, p5 families)."""
        gpu_families = ["g4dn", "g5", "p3", "p3dn", "p4d", "p4de", "p5"]
        instances = []

        try:
            for family in gpu_families:
                resp = self.ec2.describe_instances(
                    Filters=[
                        {"Name": "instance-type", "Values": [f"{family}.*"]},
                        {"Name": "instance-state-name", "Values": ["running", "stopped"]},
                    ]
                )
                for reservation in resp.get("Reservations", []):
                    for inst in reservation["Instances"]:
                        instances.append({
                            "instance_id": inst["InstanceId"],
                            "type": inst["InstanceType"],
                            "state": inst["State"]["Name"],
                            "launch_time": inst["LaunchTime"].isoformat(),
                            "region": inst["Placement"]["AvailabilityZone"],
                        })
        except ClientError as e:
            logger.error(f"EC2 error: {e}")

        return instances

    def get_instance_cpu_utilization(self, instance_id: str, hours: int = 168) -> float:
        """Get average CPU utilization over specified hours (default 7 days)."""
        end = datetime.utcnow()
        start = end - timedelta(hours=hours)

        try:
            resp = self.cw.get_metric_statistics(
                Namespace="AWS/EC2",
                MetricName="CPUUtilization",
                Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
                StartTime=start,
                EndTime=end,
                Period=3600,
                Statistics=["Average"],
            )
            datapoints = resp.get("Datapoints", [])
            if datapoints:
                return round(sum(dp["Average"] for dp in datapoints) / len(datapoints), 2)
            return 0.0
        except ClientError:
            return 0.0


# Singleton
_aws_client = None

def get_aws_client() -> AWSClient:
    global _aws_client
    if _aws_client is None:
        _aws_client = AWSClient()
    return _aws_client
