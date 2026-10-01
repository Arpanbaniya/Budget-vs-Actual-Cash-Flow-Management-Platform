from decimal import Decimal

import pytest
from test_imports import COMPANY_A, auth, reserve

from app.variance import calculate_variance, favorability


def line(kind, amount, type="revenue", code="001", dept="Sales", month="2026-10-01"):
    return {
        "kind": kind,
        "amount": amount,
        "account_type": type,
        "account_code": code,
        "account_name": code,
        "department": dept,
        "period": month,
    }


def test_hand_calculated_summary_and_unbudgeted():
    result = calculate_variance(
        [
            line("budget", "100"),
            line("actual", "80"),
            line("budget", "40", "cogs", "002"),
            line("actual", "30", "cogs", "002"),
            line("actual", "5", "operating_expense", "003"),
        ]
    )
    summary = result["summary"]
    assert summary["budget_operating_profit"] == Decimal(60)
    assert summary["actual_operating_profit"] == Decimal(45)
    assert summary["operating_profit_variance"] == Decimal(-15)
    rows = result["rows"]
    assert rows[0]["variance_percent"] == Decimal(-20)
    assert rows[1]["favorability"] == "favorable"
    assert rows[2]["variance_percent"] is None
    assert rows[2]["variance_label"] == "unbudgeted"
    assert [row["label"] for row in result["top_unfavorable"]] == ["001", "003"]


def test_monthly_series_contains_revenue_expenses_and_profit():
    result = calculate_variance(
        [
            line("budget", "100", month="2026-09-01"),
            line("actual", "90", month="2026-09-01"),
            line("budget", "40", "cogs", month="2026-09-01"),
            line("actual", "45", "cogs", month="2026-09-01"),
        ]
    )
    assert result["monthly_series"] == [
        {
            "month": "2026-09",
            "budget_revenue": Decimal(100),
            "actual_revenue": Decimal(90),
            "budget_expenses": Decimal(40),
            "actual_expenses": Decimal(45),
            "budget_profit": Decimal(60),
            "actual_profit": Decimal(45),
        }
    ]


def test_negative_budget_uses_absolute_denominator_and_decimal_precision():
    row = calculate_variance([line("budget", "-0.3"), line("actual", "-0.2")])["rows"][0]
    assert row["variance_amount"] == Decimal("0.1")
    assert row["variance_percent"] > 0


@pytest.mark.parametrize(
    "income,variance,expected",
    [
        (True, 1, "favorable"),
        (True, -1, "unfavorable"),
        (False, 1, "unfavorable"),
        (False, -1, "favorable"),
        (True, 0, "neutral"),
        (False, 0, "neutral"),
    ],
)
def test_favorability(income, variance, expected):
    assert favorability(Decimal(variance), income) == expected


@pytest.mark.parametrize("group", ["account", "department", "month"])
def test_groups_preserve_account_type_to_avoid_mixed_favorability(group):
    result = calculate_variance(
        [line("budget", "10"), line("actual", "11"), line("actual", "2", "cogs")], group
    )
    assert len(result["rows"]) == 2
    assert result["summary"]["actual_operating_profit"] == Decimal(9)


def test_empty_variance_is_explicit():
    assert calculate_variance([])["has_data"] is False


def test_variance_api_ownership_filters_pagination_and_processed_only(imports_api):
    env = imports_api
    id = reserve(env).json()["import_id"]
    env["records"][id]["status"] = "processed"
    env["derived"]["financial_lines"] = [
        {
            **line("budget", "100"),
            "id": "line-a",
            "import_id": id,
            "company_id": COMPANY_A,
            "user_id": env["records"][id]["user_id"],
        },
        {
            **line("actual", "90"),
            "id": "line-b",
            "import_id": id,
            "company_id": COMPANY_A,
            "user_id": env["records"][id]["user_id"],
        },
    ]
    path = f"/api/v1/companies/{COMPANY_A}"
    query = "?from=2026-10-01&to=2026-10-31"
    response = env["client"].get(path + "/variance" + query, headers=auth())
    assert response.status_code == 200
    assert response.json()["summary"]["revenue_variance"] == "-10"
    assert env["client"].get(path + "/variance" + query, headers=auth("user-b")).status_code == 404
    result = (
        env["client"]
        .get(path + "/financial-lines" + query + "&page_size=1&page=2", headers=auth())
        .json()
    )
    assert result["total"] == 2 and result["items"][0]["kind"] == "actual"
    assert (
        env["client"]
        .get(path + "/variance" + query + "&department=Other", headers=auth())
        .json()["has_data"]
        is False
    )
    env["records"][id]["status"] = "failed"
    assert env["client"].get(path + "/variance" + query, headers=auth()).json()["has_data"] is False
    assert (
        env["client"]
        .get(path + "/variance?from=2026-12-01&to=2026-01-01", headers=auth())
        .status_code
        == 422
    )
