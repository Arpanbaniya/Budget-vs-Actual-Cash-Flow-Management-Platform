import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { VarianceWorkspace } from "../components/variance-workspace";

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

test("variance displays backend money, zero-budget label, and changes filters", async () => {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url);
    const body = url.endsWith("/companies")
      ? [{ id: "company", name: "Demo", currency: "NPR" }]
      : {
          currency: "NPR",
          has_data: true,
          budget_row_count: 1,
          actual_row_count: 1,
          summary: {
            actual_revenue: "90",
            budget_revenue: "100",
            revenue_variance: "-10",
            actual_expenses: "5",
            budget_expenses: "0",
            expenses_variance: "5",
            actual_operating_profit: "85",
            budget_operating_profit: "100",
            operating_profit_variance: "-15",
          },
          rows: [
            {
              label: "Sales",
              account_name: "Sales",
              account_type: "revenue",
              budget_amount: "100",
              actual_amount: "90",
              variance_amount: "-10",
              variance_percent: "-10",
              variance_label: "budgeted",
              favorability: "unfavorable",
            },
            {
              label: "New expense",
              account_name: "New expense",
              account_type: "cogs",
              budget_amount: "0",
              actual_amount: "5",
              variance_amount: "5",
              variance_percent: null,
              variance_label: "unbudgeted",
              favorability: "unfavorable",
            },
          ],
          top_unfavorable: [],
        };
    return new Response(JSON.stringify(body));
  });
  render(<VarianceWorkspace userId="test-user" />);
  await screen.findByText("Unbudgeted");
  expect(screen.getByText("-10.00%")).toBeTruthy();
  expect(
    screen.getByRole("img", { name: /Budget versus actual/ }),
  ).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Department"), {
    target: { value: "Sales & Marketing" },
  });
  fireEvent.change(screen.getByLabelText("Group by"), {
    target: { value: "department" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  await screen.findByText("Unbudgeted");
  expect(calls.at(-1)).toContain("department=Sales+%26+Marketing");
  expect(calls.at(-1)).toContain("group_by=department");
});
