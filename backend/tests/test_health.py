from fastapi.testclient import TestClient

from api.index import app


def test_health_endpoint_is_public() -> None:
    response = TestClient(app).get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
