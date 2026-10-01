import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ReportWorkspace } from "../components/report-workspace";
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
test("report generation, refreshed signed download, and confirmed deletion", async () => {
  let rows: Record<string, unknown>[] = [];
  const methods: string[] = [];
  vi.stubGlobal("fetch", async (url: string, options: RequestInit) => {
    const method = options.method ?? "GET";
    methods.push(method);
    if (url.endsWith("/companies"))
      return new Response(
        JSON.stringify([{ id: "company", name: "Demo", currency: "NPR" }]),
      );
    if (url.endsWith("/scenarios")) return new Response("[]");
    if (method === "DELETE") {
      rows = [];
      return new Response(null, { status: 204 });
    }
    if (method === "POST") {
      rows = [
        {
          id: "report",
          status: "ready",
          created_at: "2026-10-01T00:00:00Z",
          parameters: JSON.parse(String(options.body)),
        },
      ];
      return new Response(JSON.stringify(rows[0]));
    }
    if (url.endsWith("/reports/report"))
      return new Response(
        JSON.stringify({
          ...rows[0],
          download_url:
            "https://example.supabase.co/storage/v1/object/sign/fpna-reports/report?token=test",
          expires_in_seconds: 300,
        }),
      );
    return new Response(JSON.stringify({ items: rows }));
  });
  render(<ReportWorkspace userId="test" />);
  await screen.findByText("No reports on this page.");
  fireEvent.submit(screen.getByRole("form", { name: "Report settings" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Get download link" }),
  );
  const link = await screen.findByRole("link", { name: "Download Excel" });
  expect(link.getAttribute("referrerpolicy")).toBe("no-referrer");
  expect(screen.getByText(/expires five minutes/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(methods).not.toContain("DELETE");
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
  await screen.findByText("Report deleted.");
});
