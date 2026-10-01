import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import {
  DashboardView,
  type DashboardResult,
} from "../components/dashboard-workspace";

afterEach(cleanup);
test("dashboard keeps financial summary visible when cash balance is missing", () => {
  const data: DashboardResult = {
    currency: "NPR",
    period: { from: "2026-01-01", to: "2026-10-01" },
    cash_start_date: "2026-10-01",
    cash_forecast: null,
    latest_cash: null,
    variance: {
      currency: "NPR",
      has_data: false,
      budget_row_count: 0,
      actual_row_count: 0,
      rows: [],
      monthly_series: [],
      top_unfavorable: [],
      summary: {
        actual_revenue: "90",
        budget_revenue: "100",
        revenue_variance: "-10",
        actual_expenses: "40",
        budget_expenses: "40",
        expenses_variance: "0",
        actual_operating_profit: "50",
        budget_operating_profit: "60",
        operating_profit_variance: "-10",
      },
    },
  };
  render(<DashboardView data={data} />);
  expect(screen.getByText("NPR 90.00")).toBeTruthy();
  expect(
    screen.getByRole("heading", {
      name: "Cash forecast needs an opening balance",
    }),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Manage cash balances" })
      .getAttribute("href"),
  ).toBe("/cash");
});
