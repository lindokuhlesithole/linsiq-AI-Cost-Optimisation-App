import json


def test_get_costs_summary(client, monkeypatch):
    """Test costs summary endpoint."""
    # Mock AWS cost data
    def mock_get_summary(*args, **kwargs):
        return {
            "total_monthly_cost": 1250.00,
            "ai_services_cost": 875.50,
            "trend": "increasing",
            "change_percent": 12.5,
        }

    monkeypatch.setattr(
        "core.aws_client.AWSCostClient.get_ai_specific_costs", mock_get_summary
    )

    response = client.get("/api/v1/costs/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_monthly_cost" in data


def test_get_costs_by_service(client, monkeypatch):
    """Test costs by service endpoint."""

    def mock_by_service(*args, **kwargs):
        return [
            {"service": "SageMaker", "cost": 500.00},
            {"service": "Bedrock", "cost": 250.50},
            {"service": "EC2", "cost": 125.00},
        ]

    monkeypatch.setattr(
        "core.aws_client.AWSCostClient.get_costs_by_service", mock_by_service
    )

    response = client.get("/api/v1/costs/by-service")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 3


def test_get_costs_by_resource(client, monkeypatch):
    """Test costs by resource endpoint."""

    def mock_by_resource(*args, **kwargs):
        return [
            {
                "resource_id": "i-1234567890abcdef0",
                "resource_type": "EC2",
                "cost": 50.00,
                "region": "us-east-1",
            }
        ]

    monkeypatch.setattr(
        "core.aws_client.AWSCostClient.get_costs_by_resource", mock_by_resource
    )

    response = client.get("/api/v1/costs/by-resource")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
