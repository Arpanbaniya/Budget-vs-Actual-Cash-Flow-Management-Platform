from datetime import date
from decimal import Decimal

import pytest
from test_imports import COMPANY_A, COMPANY_B, USER_A, auth

from app.forecast import calculate_forecast
from app.scenarios import apply_scenario

SCENARIO = {
    "name": "Downside",
    "inflow_adjustment_pct": "-50",
    "outflow_adjustment_pct": "100",
    "collection_delay_days": 7,
}


def test_planned_adjustments_delays_and_unchanged_statuses_without_mutation():
    items = [
        {"expected_date": "2026-10-01", "direction": direction, "amount": "100", "status": status}
        for direction in ("inflow", "outflow")
        for status in ("planned", "confirmed", "actual")
    ]
    result = apply_scenario(items, SCENARIO)
    assert result[0]["amount"] == Decimal(50) and result[0]["expected_date"] == "2026-10-08"
    assert result[3]["amount"] == Decimal(200) and result[3]["expected_date"] == "2026-10-01"
    for index in (1, 2, 4, 5):
        assert result[index] == items[index]
    assert items[0]["amount"] == "100" and items[0]["expected_date"] == "2026-10-01"
    forecast = calculate_forecast(
        {"amount": "100", "balance_date": "2026-10-01"}, result, date(2026, 10, 1), 2, Decimal(0)
    )
    assert forecast["weekly"][0]["closing_cash"] == Decimal(-100)
    assert forecast["weekly"][1]["closing_cash"] == Decimal(-50)


def test_scenario_crud_owner_company_and_shifted_prior_collection(imports_api):
    env = imports_api
    client = env["client"]
    base = f"/api/v1/companies/{COMPANY_A}"
    response = client.post(base + "/scenarios", headers=auth(), json=SCENARIO)
    assert response.status_code == 201
    id = response.json()["id"]
    path = f"/api/v1/scenarios/{id}"
    assert client.get(path, headers=auth("user-b")).status_code == 404
    assert client.get(path, headers=auth()).json()["inflow_adjustment_pct"] == "-50"
    assert len(client.get(base + "/scenarios", headers=auth()).json()) == 1
    client.post(
        base + "/cash-balances",
        headers=auth(),
        json={"balance_date": "2026-10-01", "amount": "100"},
    )
    client.post(
        base + "/cash-items",
        headers=auth(),
        json={
            "expected_date": "2026-09-28",
            "description": "Late receipt",
            "category": "Sales",
            "direction": "inflow",
            "amount": "100",
            "status": "planned",
        },
    )
    forecast = client.get(
        base + f"/cash-forecast?start_date=2026-10-01&weeks=1&scenario_id={id}", headers=auth()
    ).json()
    assert forecast["weekly"][0]["closing_cash"] == "150.0"
    env["companies"][COMPANY_B]["user_id"] = USER_A
    other = client.post(
        f"/api/v1/companies/{COMPANY_B}/scenarios", headers=auth(), json=SCENARIO
    ).json()["id"]
    assert (
        client.get(
            base + f"/cash-forecast?start_date=2026-10-01&scenario_id={other}", headers=auth()
        ).status_code
        == 404
    )
    assert client.patch(path, headers=auth(), json={"name": "Revised"}).status_code == 200
    assert client.delete(path, headers=auth("user-b")).status_code == 404
    assert client.delete(path, headers=auth()).status_code == 204


@pytest.mark.parametrize(
    "changes",
    [
        {"inflow_adjustment_pct": -101},
        {"outflow_adjustment_pct": 501},
        {"inflow_adjustment_pct": "NaN"},
        {"collection_delay_days": 366},
        {"collection_delay_days": True},
        {"name": " "},
        {"user_id": "other"},
    ],
)
def test_invalid_scenario_values(imports_api, changes):
    response = imports_api["client"].post(
        f"/api/v1/companies/{COMPANY_A}/scenarios", headers=auth(), json={**SCENARIO, **changes}
    )
    assert response.status_code == 422
