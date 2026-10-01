import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { CashWorkspace } from "../components/cash-workspace";

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

test("cash forms edit imported items, keep drafts in the other form, and confirm deletion", async () => {
  let balances: Record<string, unknown>[] = [];
  let items = [
    {
      id: "item",
      expected_date: "2026-10-05",
      description: "Customer receipt",
      category: "Receipts",
      direction: "inflow",
      amount: "100",
      status: "planned",
      import_id: "import",
    },
  ];
  const mutations: { url: string; body: Record<string, string> | undefined }[] =
    [];
  vi.stubGlobal("fetch", async (url: string, options: RequestInit) => {
    const method = options.method ?? "GET";
    const response = (body: unknown) => new Response(JSON.stringify(body));
    if (url.endsWith("/companies"))
      return response([{ id: "company", name: "Demo", currency: "NPR" }]);
    if (method === "GET")
      return response({
        items: url.includes("cash-balances") ? balances : items,
        total: url.includes("cash-balances") ? balances.length : items.length,
        page: 1,
        page_size: 50,
      });
    const body = options.body ? JSON.parse(String(options.body)) : undefined;
    mutations.push({ url, body });
    if (method === "POST") {
      balances = [{ id: "balance", ...body }];
      return response(balances[0]);
    }
    if (method === "PATCH") {
      items = items.map((item) => ({ ...item, ...body }));
      return response(items[0]);
    }
    items = [];
    return new Response(null, { status: 204 });
  });
  render(<CashWorkspace userId="test" />);
  await screen.findByText("Imported");
  fireEvent.change(screen.getByLabelText("Item description"), {
    target: { value: "Unsaved draft" },
  });
  fireEvent.change(screen.getByLabelText("Balance date"), {
    target: { value: "2026-10-01" },
  });
  fireEvent.change(screen.getByLabelText("Balance amount"), {
    target: { value: "-10" },
  });
  fireEvent.submit(
    screen.getByRole("form", { name: "Cash balance" }),
  );
  await screen.findByRole("button", { name: "Edit balance 2026-10-01" });
  expect(
    (screen.getByLabelText("Item description") as HTMLInputElement).value,
  ).toBe("Unsaved draft");
  fireEvent.click(
    screen.getByRole("button", { name: "Edit item Customer receipt" }),
  );
  fireEvent.change(screen.getByLabelText("Item amount"), {
    target: { value: "150" },
  });
  fireEvent.submit(
    screen.getByRole("form", { name: "Cash item" }),
  );
  await screen.findByText("NPR 150.00");
  expect(mutations.at(-1)?.body).not.toHaveProperty("import_id");
  fireEvent.click(
    screen.getByRole("button", { name: "Delete item Customer receipt" }),
  );
  expect(mutations).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" }));
  await screen.findByText("No cash items match these filters.");
  expect(
    within(
      screen.getByRole("form", { name: "Cash balance" }),
    ).getByRole("button", { name: "Save balance" }),
  ).toBeTruthy();
});

