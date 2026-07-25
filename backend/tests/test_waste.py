def test_trigger_waste_scan(client, monkeypatch):
    """Test triggering a waste scan."""

    def mock_scan(*args, **kwargs):
        return {
            "scan_id": "test-scan-001",
            "findings": [
                {
                    "id": "finding-1",
                    "resource_id": "endpoint-1",
                    "resource_type": "SageMaker Endpoint",
                    "severity": "critical",
                    "description": "Idle endpoint detected",
                    "potential_savings": 450.00,
                }
            ],
            "total_potential_savings": 450.00,
        }

    monkeypatch.setattr(
        "core.waste_detector.WasteDetector.run_full_scan", mock_scan
    )

    response = client.post("/api/v1/waste/scan")
    assert response.status_code == 200
    data = response.json()
    assert "scan_id" in data
    assert "findings" in data


def test_list_waste_findings(client):
    """Test listing waste findings."""
    response = client.get("/api/v1/waste/findings")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_dismiss_waste_finding(client):
    """Test dismissing a waste finding."""
    # First create a finding
    response = client.post("/api/v1/waste/findings/test-id/dismiss")
    # Should return 404 for non-existent finding
    assert response.status_code in [200, 404]
