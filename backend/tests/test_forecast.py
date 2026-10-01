from datetime import date
from decimal import Decimal

import pytest
from test_imports import COMPANY_A, auth

from app.errors import ApiError
from app.forecast import calculate_forecast


def item(day, amount, direction="inflow", status="planned"):
    return {"expected_date": day, "amount": amount, "direction": direction, "status": status}


def test_hand_calculated_weeks_boundaries_and_threshold():
    result = calculate_forecast(
        {"amount": "100", "balance_date": "2026-09-30"},
        [
            item("2026-10-01", "50"),
            item("2026-10-07", "120", "outflow"),
            item("2026-10-08", "10", "inflow", "confirmed"),
            item("2026-10-14", "50", "outflow", "actual"),
            item("2026-09-30", "999"),
            item("2026-10-15", "999"),
        ],
        date(2026, 10, 1),
        2,
        Decimal(30),
    )
    first, second = result["weekly"]
    assert first["closing_cash"] == Decimal(30) and first["threshold_breached"] is False
    assert second["opening_cash"] == Decimal(30) and second["closing_cash"] == Decimal(-10)
    assert result["minimum_projected_cash"] == Decimal(-10)
    assert result["lowest_cash_week"] == result["first_threshold_breach_week"] == 2


def test_empty_weeks_roll_forward_without_losing_precision():
    result = calculate_forecast(
        {"amount": "0.1234567891", "balance_date": "2026-10-01"},
        [],
        date(2026, 10, 1),
        13,
        Decimal(0),
    )
    assert len(result["weekly"]) == 13
    assert all(week["closing_cash"] == Decimal("0.1234567891") for week in result["weekly"])
    assert result["first_threshold_breach_week"] is None
    assert result["lowest_cash_week"] == 1


def test_extreme_date_returns_clear_error():
    with pytest.raises(ApiError):
        calculate_forecast(
            {"amount": "0", "balance_date": "9999-12-31"}, [], date.max, 26, Decimal(0)
        )


def test_forecast_api_latest_balance_and_ownership(imports_api):
    client = imports_api["client"]
    base = f"/api/v1/companies/{COMPANY_A}"
    path = base + "/cash-forecast?start_date=2026-10-01&weeks=2"
    assert client.get(path, headers=auth()).json()["error"]["code"] == "CASH_BALANCE_REQUIRED"
    for day, amount in [("2026-09-01", "100"), ("2026-09-30", "200"), ("2026-10-02", "999")]:
        client.post(
            base + "/cash-balances", headers=auth(), json={"balance_date": day, "amount": amount}
        )
    response = client.get(path, headers=auth())
    assert response.status_code == 200 and response.json()["opening_cash"] == "200"
    assert response.json()["balance_date"] == "2026-09-30"
    assert client.get(path, headers=auth("user-b")).status_code == 404
    assert (
        client.get(
            base + "/cash-forecast?start_date=2026-10-01&weeks=27", headers=auth()
        ).status_code
        == 422
    )
