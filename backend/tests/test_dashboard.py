from test_imports import COMPANY_A, auth, reserve
from test_variance import line


def test_dashboard_partial_data_cash_and_owner(imports_api):
    env = imports_api
    client = env["client"]
    base = f"/api/v1/companies/{COMPANY_A}"
    query = "?from=2026-10-01&to=2026-10-31&cash_start_date=2026-10-01"
    path = base + "/dashboard" + query
    empty = client.get(path, headers=auth())
    assert empty.status_code == 200
    assert empty.json()["cash_forecast"] is None
    assert empty.json()["variance"]["has_data"] is False
    id = reserve(env).json()["import_id"]
    env["records"][id]["status"] = "processed"
    env["derived"]["financial_lines"] = [
        {
            **line(kind, amount),
            "id": kind,
            "import_id": id,
            "company_id": COMPANY_A,
            "user_id": env["records"][id]["user_id"],
        }
        for kind, amount in [("budget", "100"), ("actual", "90")]
    ]
    client.post(
        base + "/cash-balances",
        headers=auth(),
        json={"balance_date": "2026-09-30", "amount": "200"},
    )
    client.post(
        base + "/cash-items",
        headers=auth(),
        json={
            "expected_date": "2026-10-01",
            "description": "Payroll",
            "category": "People",
            "direction": "outflow",
            "amount": "250",
            "status": "planned",
        },
    )
    result = client.get(path, headers=auth()).json()
    assert result["variance"]["summary"]["revenue_variance"] == "-10"
    assert result["cash_forecast"]["minimum_projected_cash"] == "-50"
    assert len(result["cash_forecast"]["weekly"]) == 13
    assert result["latest_cash"]["amount"] == "200"
    assert client.get(path, headers=auth("user-b")).status_code == 404
    assert (
        client.get(base + "/dashboard?from=2026-12-01&to=2026-01-01", headers=auth()).status_code
        == 422
    )


def test_dashboard_does_not_hide_invalid_scenario_when_cash_is_missing(imports_api):
    path = f"/api/v1/companies/{COMPANY_A}/dashboard?from=2026-01-01&to=2026-12-31&scenario_id=11111111-1111-1111-1111-111111111111"
    assert imports_api["client"].get(path, headers=auth()).status_code == 404
