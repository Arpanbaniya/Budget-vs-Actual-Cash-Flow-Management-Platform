import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { CompanyWorkspace } from "../components/company-workspace";
import { type Company } from "../lib/api";

vi.mock("../lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "user-token" } },
        error: null,
      }),
    },
  }),
}));

let companies: Company[];
let calls: { method: string; path: string; body?: Record<string, unknown> }[];
let failList: boolean;
let failCreate: boolean;
let counter: number;

beforeEach(() => {
  localStorage.clear();
  companies = [];
  calls = [];
  failList = false;
  failCreate = false;
  counter = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: RequestInit) => {
      expect(new Headers(options.headers).get("Authorization")).toBe(
        "Bearer user-token",
      );
      const method = options.method ?? "GET";
      const body = options.body ? JSON.parse(String(options.body)) : undefined;
      calls.push({ method, path: url, body });
      if (method === "GET")
        return new Response(
          JSON.stringify(
            failList
              ? { error: { message: "Temporarily unavailable." } }
              : companies,
          ),
          { status: failList ? 503 : 200 },
        );
      if (method === "POST") {
        if (failCreate)
          return new Response(
            JSON.stringify({ error: { code: "REQUEST_INVALID" } }),
            { status: 422 },
          );
        const record = {
          id: `company-${++counter}`,
          user_id: "user-a",
          created_at: "2026-10-01T00:00:00Z",
          updated_at: `2026-10-01T00:00:0${counter}Z`,
          ...body,
        } as Company;
        companies = [...companies, record];
        return new Response(JSON.stringify(record), { status: 201 });
      }
      const id = url.split("/").at(-1);
      if (method === "PATCH") {
        const record = {
          ...companies.find((company) => company.id === id),
          ...body,
          updated_at: "2026-10-01T01:00:00Z",
        } as Company;
        companies = companies.map((company) =>
          company.id === id ? record : company,
        );
        return new Response(JSON.stringify(record));
      }
      companies = companies.filter((company) => company.id !== id);
      return new Response(null, { status: 204 });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function createCompany(name: string) {
  const form = within(screen.getByRole("form", { name: "Create company" }));
  fireEvent.change(form.getByLabelText("Company name"), {
    target: { value: name },
  });
  fireEvent.submit(screen.getByRole("form", { name: "Create company" }));
  await screen.findByRole("heading", { name: `Settings for ${name}` });
}

test("create, select, edit, and confirm deletion through the authenticated API", async () => {
  const view = render(<CompanyWorkspace mode="manage" userId="user-a" />);
  await screen.findByText("No companies yet. Create your first company below.");
  await createCompany("Acme Nepal");
  await createCompany("Second Company");
  fireEvent.change(screen.getByLabelText("Selected company"), {
    target: { value: "company-1" },
  });
  const settings = within(
    screen.getByRole("form", { name: "Company settings" }),
  );
  fireEvent.change(settings.getByLabelText("Currency code"), {
    target: { value: "npr" },
  });
  fireEvent.change(settings.getByLabelText("Fiscal year starts"), {
    target: { value: "7" },
  });
  fireEvent.change(settings.getByLabelText("Minimum cash threshold"), {
    target: { value: "500000.25" },
  });
  fireEvent.submit(screen.getByRole("form", { name: "Company settings" }));
  await screen.findByText("Company settings saved.");
  expect(calls.find((call) => call.method === "PATCH")?.body).toEqual({
    name: "Acme Nepal",
    currency: "NPR",
    fiscal_year_start_month: 7,
    minimum_cash_threshold: "500000.25",
  });
  expect(localStorage.getItem("flow-forecast:company:user-a")).toBe(
    "company-1",
  );
  fireEvent.click(screen.getByRole("button", { name: "Delete company" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Delete company" }));
  fireEvent.click(screen.getByRole("button", { name: "Permanently delete" }));
  await screen.findByText(
    "Company and its associated records and files deleted.",
  );
  expect(companies.map((company) => company.name)).toEqual(["Second Company"]);
  expect(
    (screen.getByLabelText("Selected company") as HTMLSelectElement).value,
  ).toBe("company-2");
  view.unmount();
  render(<CompanyWorkspace mode="dashboard" userId="user-a" />);
  await screen.findByRole("heading", { name: "Second Company" });
  expect(screen.getByText("USD 0")).toBeTruthy();
});

test("loading can be retried and rejected creation preserves form input", async () => {
  failList = true;
  render(<CompanyWorkspace mode="manage" userId="user-a" />);
  await screen.findByText("Temporarily unavailable.");
  failList = false;
  fireEvent.click(
    screen.getByRole("button", { name: "Retry loading companies" }),
  );
  await screen.findByText("No companies yet. Create your first company below.");
  failCreate = true;
  const form = screen.getByRole("form", { name: "Create company" });
  fireEvent.change(within(form).getByLabelText("Company name"), {
    target: { value: "Keep this name" },
  });
  fireEvent.submit(form);
  await screen.findByRole("alert");
  await waitFor(() =>
    expect(
      (within(form).getByLabelText("Company name") as HTMLInputElement).value,
    ).toBe("Keep this name"),
  );
  expect(screen.getByRole("form", { name: "Create company" })).toBeTruthy();
});
