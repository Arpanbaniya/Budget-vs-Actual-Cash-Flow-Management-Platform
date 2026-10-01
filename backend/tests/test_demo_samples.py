from datetime import date
from decimal import Decimal
from pathlib import Path

from app.forecast import calculate_forecast
from app.import_parser import parse_import
from app.scenarios import apply_scenario
from app.variance import calculate_variance


def test_documented_demo_matches_hand_calculated_results():
    root = Path(__file__).resolve().parents[2] / "docs" / "samples"
    lines = []
    for kind in ("budget", "actual"):
        parsed = parse_import((root / f"{kind}.csv").read_bytes(), f"{kind}.csv", kind)
        lines.extend({**row, "kind": kind} for row in parsed.rows)
    summary = calculate_variance(lines)["summary"]
    assert summary["revenue_variance"] == Decimal(-10000)
    assert summary["expenses_variance"] == Decimal(3000)
    assert summary["operating_profit_variance"] == Decimal(-13000)
    items = parse_import((root / "cash.csv").read_bytes(), "cash.csv", "cash").rows
    balance = {"amount": "100000", "balance_date": "2026-10-01"}
    base = calculate_forecast(balance, items, date(2026, 10, 1), 13, Decimal(90000))
    scenario = {
        "inflow_adjustment_pct": "-10",
        "outflow_adjustment_pct": "5",
        "collection_delay_days": 7,
    }
    downside = calculate_forecast(
        balance, apply_scenario(items, scenario), date(2026, 10, 1), 13, Decimal(90000)
    )
    assert base["weekly"][0]["closing_cash"] == Decimal(145000)
    assert base["minimum_projected_cash"] == Decimal(95000)
    assert base["first_threshold_breach_week"] is None
    assert downside["weekly"][0]["closing_cash"] == Decimal(93500)
    assert downside["minimum_projected_cash"] == Decimal(88500)
    assert downside["first_threshold_breach_week"] == 2
