import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ScenarioWorkspace } from "../components/scenario-workspace";
import { ForecastWorkspace } from "../components/forecast-workspace";
vi.mock("../lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "test" } },
        error: null,
      }),
    },
  }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});
const company = { id: "company", name: "Demo", currency: "NPR" };
const scenario = {
  id: "scenario",
  name: "Downside",
  inflow_adjustment_pct: "-10",
  outflow_adjustment_pct: "5",
  collection_delay_days: 7,
};
test("scenario form sends settings and deletion needs confirmation", async () => {
  let rows: Record<string, unknown>[] = [];
  const methods: string[] = [];
  vi.stubGlobal("fetch", async (url: string, options: RequestInit) => {
    const method = options.method ?? "GET";
    methods.push(method);
    if (method === "DELETE") {
      rows = [];
      return new Response(null, { status: 204 });
    }
    if (method === "POST")
      rows = [{ id: "scenario", ...JSON.parse(String(options.body)) }];
    return new Response(
      JSON.stringify(
        url.endsWith("/companies")
          ? [company]
          : method === "POST"
            ? rows[0]
            : rows,
      ),
    );
  });
  render(<ScenarioWorkspace userId="test" />);
  await screen.findByText("No scenarios yet. Create one above.");
  fireEvent.change(screen.getByLabelText("Scenario name"), {
    target: { value: "Downside" },
  });
  fireEvent.change(screen.getByLabelText("Collection delay (days)"), {
    target: { value: "7" },
  });
  fireEvent.submit(screen.getByRole("form", { name: "Scenario settings" }));
  await screen.findByRole("button", { name: "Delete scenario Downside" });
  expect(rows[0].collection_delay_days).toBe(7);
  fireEvent.click(
    screen.getByRole("button", { name: "Delete scenario Downside" }),
  );
  expect(methods).not.toContain("DELETE");
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm scenario deletion" }),
  );
  await screen.findByText("No scenarios yet. Create one above.");
});
test("forecast selector requests base and scenario and shows comparison", async () => {
  const urls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    urls.push(url);
    const selected = url.includes("scenario_id=scenario");
    const closing = selected ? "50" : "100";
    const data = url.endsWith("/companies")
      ? [company]
      : url.endsWith("/scenarios")
        ? [scenario]
        : {
            currency: "NPR",
            start_date: "2026-10-01",
            weeks: 1,
            opening_cash: "100",
            balance_date: "2026-10-01",
            minimum_projected_cash: closing,
            lowest_cash_week: 1,
            minimum_cash_threshold: "60",
            first_threshold_breach_week: selected ? 1 : null,
            scenario: selected ? scenario : null,
            weekly: [
              {
                week_number: 1,
                week_start: "2026-10-01",
                week_end: "2026-10-07",
                opening_cash: "100",
                inflows: "0",
                outflows: selected ? "50" : "0",
                closing_cash: closing,
                threshold_breached: selected,
              },
            ],
          };
    return new Response(JSON.stringify(data));
  });
  render(<ForecastWorkspace userId="test" />);
  await screen.findByRole("heading", { name: "Weekly forecast" });
  await screen.findByRole("option", { name: "Downside" });
  fireEvent.change(screen.getByLabelText("Scenario"), {
    target: { value: "scenario" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Update forecast" }));
  await screen.findByRole("heading", { name: "Base vs scenario" });
  expect(urls.at(-1)).toContain("scenario_id=scenario");
  expect(screen.getByText("Scenario: Downside")).toBeTruthy();
  expect(
    screen.getByRole("columnheader", { name: "Base closing cash" }),
  ).toBeTruthy();
});
