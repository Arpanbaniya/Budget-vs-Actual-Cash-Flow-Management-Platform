import pytest
from pydantic import ValidationError
from test_imports import COMPANY_A, auth

from app.cash import BalanceCreate, CashCreate
from app.companies import CompanyCreate
from app.config import Settings
from app.insights import AnalysisRequest


@pytest.mark.parametrize(
    "value", [1790812800, True, "2026-10-01T00:00:00", "2026-10", "2026-02-30"]
)
def test_financial_dates_reject_coercion(value):
    with pytest.raises(ValidationError):
        BalanceCreate(balance_date=value, amount="0")
    with pytest.raises(ValidationError):
        CashCreate(
            expected_date=value, description="Demo", category="Demo", direction="inflow", amount="0"
        )
    with pytest.raises(ValidationError):
        AnalysisRequest.model_validate(
            {"from": "2026-01-01", "to": "2026-10-01", "cash_start_date": value}
        )


@pytest.mark.parametrize("value", ["1e21", "0.00000000001", "Infinity", "NaN"])
def test_cash_threshold_has_consistent_bounds(value):
    with pytest.raises(ValidationError):
        CompanyCreate(name="Demo", minimum_cash_threshold=value)


def test_secrets_hidden_and_timeout_bounded():
    settings = Settings(
        frontend_origins=("https://flow-forecast.vercel.app",), groq_api_key="private-key"
    )
    assert "private-key" not in repr(settings)
    assert "private-key" not in settings.model_dump_json()
    with pytest.raises(ValidationError):
        Settings(frontend_origins=("https://flow-forecast.vercel.app",), ai_timeout_seconds=100)


def test_private_auth_and_error_responses_are_not_cached(imports_api):
    client = imports_api["client"]
    for path in ("/api/v1/me", f"/api/v1/companies/{COMPANY_A}/scenarios"):
        for headers in ({}, auth()):
            response = client.get(path, headers=headers)
            assert response.headers["cache-control"] == "private, no-store"
            assert response.headers["x-content-type-options"] == "nosniff"


def test_report_path_tampering_and_storage_delete_failure(imports_api):
    from test_reports import create_report

    env = imports_api
    row = create_report(env).json()
    path = "/api/v1/reports/" + row["id"]
    env["reports"][0]["storage_path"] = "other-user/other-company/report.xlsx"
    assert env["client"].get(path, headers=auth()).status_code == 409
    assert env["client"].delete(path, headers=auth()).status_code == 409
    env["reports"][0]["storage_path"] = row["storage_path"]
    env["failures"]["DELETE /storage/v1/object/fpna-reports"] = 503
    assert env["client"].delete(path, headers=auth()).status_code == 503
    assert env["reports"] and row["storage_path"] in env["objects"]
