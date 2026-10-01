import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import {
  ForecastView,
  type ForecastResult,
} from "../components/forecast-workspace";
afterEach(cleanup);
test("forecast shows backend threshold flags, negative money, and balance-date warning", () => {
  const data: ForecastResult = {
    currency: "NPR",
    start_date: "2026-10-01",
    weeks: 1,
    opening_cash: "100",
    balance_date: "2026-09-30",
    minimum_projected_cash: "-10",
    lowest_cash_week: 1,
    minimum_cash_threshold: "30",
    first_threshold_breach_week: 1,
    scenario: null,
    weekly: [
      {
        week_number: 1,
        week_start: "2026-10-01",
        week_end: "2026-10-07",
        opening_cash: "100",
        inflows: "10",
        outflows: "120",
        closing_cash: "-10",
        threshold_breached: true,
      },
    ],
  };
  render(<ForecastView data={data} />);
  expect(screen.getByText("Below minimum")).toBeTruthy();
  expect(
    screen.getByText(/Earlier cash items are not rolled forward/),
  ).toBeTruthy();
  expect(screen.getAllByText("-NPR 10.00")).toHaveLength(2);
  expect(
    screen.getByRole("img", { name: /Weekly projected closing cash/ }),
  ).toBeTruthy();
});
