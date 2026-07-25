def test_dashboard_summary(client, monkeypatch):
    """Test dashboard summary endpoint."""

    def mock_costs(*args, **kwargs):
        return {"total": 1500.00, "change": 10.5}

    def mock_waste(*args, **kwargs):
        return {"total_potential_savings": 450.00, "findings_count": 5}

    def mock_optimizations(*args, **kwargs):
        return {"applied": 3, "pending": 2, "total_savings": 200.00}

    monkeypatch.setattr(
        "core.aws_client.AWSCostClient.get_ai_specific_costs", mock_costs
    )
    monkeypatch.setattr(
        "core.waste_detector.WasteDetector.get_summary", mock_waste
    )

    response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_cost" in data or "costs" in data


def test_dashboard_trends(client, monkeypatch):
    """Test dashboard trends endpoint."""

    def mock_trends(*args, **kwargs):
        return {
            "dates": ["2024-01", "2024-02", "2024-03"],
            "costs": [1200.00, 1350.00, 1500.00],
        }

    monkeypatch.setattr(
        "core.aws_client.AWSCostClient.get_cost_trends", mock_trends
    )

    response = client.get("/api/v1/dashboard/trends")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
