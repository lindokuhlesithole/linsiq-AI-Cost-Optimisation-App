def test_create_optimization(client):
    """Test creating an optimization request."""
    payload = {
        "resource_id": "i-1234567890abcdef0",
        "resource_type": "EC2",
        "current_config": "t3.xlarge",
        "recommended_config": "t3.large",
        "reason": "Underutilized CPU",
        "potential_savings": 75.00,
    }

    response = client.post("/api/v1/optimizations/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["resource_id"] == payload["resource_id"]
    assert data["status"] == "pending"


def test_list_optimizations(client):
    """Test listing optimizations."""
    response = client.get("/api/v1/optimizations/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_approve_optimization(client):
    """Test approving an optimization."""
    # Create one first
    payload = {
        "resource_id": "i-test",
        "resource_type": "EC2",
        "current_config": "t3.xlarge",
        "recommended_config": "t3.large",
        "reason": "Test",
        "potential_savings": 50.00,
    }
    create_resp = client.post("/api/v1/optimizations/", json=payload)
    opt_id = create_resp.json()["id"]

    # Approve it
    response = client.post(f"/api/v1/optimizations/{opt_id}/approve")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "approved"


def test_get_optimization_detail(client):
    """Test getting optimization detail."""
    # Create one first
    payload = {
        "resource_id": "i-detail-test",
        "resource_type": "EC2",
        "current_config": "m5.large",
        "recommended_config": "t3.medium",
        "reason": "Test detail",
        "potential_savings": 100.00,
    }
    create_resp = client.post("/api/v1/optimizations/", json=payload)
    opt_id = create_resp.json()["id"]

    response = client.get(f"/api/v1/optimizations/{opt_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == opt_id
