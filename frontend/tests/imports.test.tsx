import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ImportWorkspace } from "../components/import-workspace";
import { type Company } from "../lib/api";
import {
  MAX_FILE_BYTES,
  uploadReservedFile,
  type ImportRecord,
  type UploadReservation,
} from "../lib/imports";

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

const COMPANY_A = "a17448cd-47b5-4baa-8780-5e2af9eb538a";
const COMPANY_B = "6f57a54d-4121-4967-8ab4-63d511b7f1ea";
const companies: Company[] = [COMPANY_A, COMPANY_B].map((id, index) => ({
  id,
  user_id: "user-a",
  name: `Company ${index + 1}`,
  currency: "NPR",
  fiscal_year_start_month: 7,
  minimum_cash_threshold: "0",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
}));
let records: ImportRecord[];
let calls: { method: string; url: string; body?: unknown }[];
let uploaded: Set<string>;
let failUpload: boolean;
let failComplete: boolean;
let failDelete: boolean;
let failList: boolean;
let counter: number;

beforeEach(() => {
  localStorage.clear();
  records = [];
  calls = [];
  uploaded = new Set();
  failUpload = false;
  failComplete = false;
  failDelete = false;
  failList = false;
  counter = 0;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: RequestInit) => {
      const method = options.method ?? "GET";
      const isStorage = url.startsWith("https://example.supabase.co/");
      const body = isStorage
        ? options.body
        : options.body
          ? JSON.parse(String(options.body))
          : undefined;
      calls.push({ method, url, body });
      const headers = new Headers(options.headers);
      if (isStorage) {
        expect(method).toBe("PUT");
        expect(body).toBeInstanceOf(File);
        expect(headers.has("Authorization")).toBe(false);
        expect(options.credentials).toBe("omit");
        expect(headers.get("Content-Type")).toBe("text/csv");
        expect(headers.get("x-upsert")).toBe("false");
        if (failUpload) return new Response("Unavailable", { status: 503 });
        const record = records.find((item) => url.includes(item.storage_path))!;
        uploaded.add(record.id);
        return new Response("{}", { status: 200 });
      }
      expect(headers.get("Authorization")).toBe("Bearer user-token");
      const respond = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), { status });
      if (url === "/api/v1/companies") return respond(companies);
      if (method === "POST" && url.endsWith("/reserve")) {
        const id = `import-${++counter}`;
        const companyId = url.split("/")[4];
        const record: ImportRecord = {
          id,
          user_id: "user-a",
          company_id: companyId,
          kind: body.kind,
          filename: body.filename,
          storage_path: `user-a/${companyId}/${id}/${body.filename}`,
          mime_type: body.mime_type,
          size_bytes: body.size_bytes,
          status: "reserved",
          row_count: null,
          error_message: null,
          processed_at: null,
          created_at: "2026-10-01T00:00:00Z",
          updated_at: "2026-10-01T00:00:00Z",
        };
        records.push(record);
        return respond(
          {
            import_id: id,
            status: "reserved",
            storage_path: record.storage_path,
            upload: {
              signed_url: `https://example.supabase.co/storage/v1/object/upload/sign/fpna-imports/${record.storage_path}?token=upload-token`,
              expires_in_seconds: 7200,
            },
          },
          201,
        );
      }
      if (method === "GET" && url.endsWith("/imports")) {
        if (failList)
          return respond(
            { error: { message: "History temporarily unavailable." } },
            503,
          );
        return respond(
          records.filter((item) => item.company_id === url.split("/")[4]),
        );
      }
      const id = url.split("/")[4];
      const record = records.find((item) => item.id === id)!;
      if (method === "GET" && record) return respond(record);
      if (method === "POST" && url.endsWith("/process")) {
        record.status = "processed";
        record.row_count = 3;
        record.warnings = [{ row: 2, field: "amount", message: "Signed financial amount retained." }];
        return respond({ row_count: 3 });
      }
      if (method === "POST" && url.endsWith("/complete")) {
        if (failComplete)
          return respond(
            { error: { message: "Confirmation temporarily unavailable." } },
            503,
          );
        if (!uploaded.has(id))
          return respond(
            { error: { code: "UPLOAD_MISSING", message: "Upload it first." } },
            409,
          );
        record.status = "uploaded";
        return respond(record);
      }
      if (method === "DELETE") {
        if (failDelete)
          return respond({ error: { message: "File cleanup failed." } }, 503);
        records = records.filter((item) => item.id !== id);
        uploaded.delete(id);
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request ${method} ${url}`);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function openWorkspace() {
  render(<ImportWorkspace userId="user-a" />);
  await screen.findByRole("heading", { name: "Upload to Company 1" });
  await screen.findByText("No imports yet. Upload your first file above.");
}

function chooseFile(
  name = "budget.csv",
  contents = "period,amount\n2026-10,10",
) {
  const file = new File([contents], name, { type: "text/csv" });
  fireEvent.change(screen.getByLabelText("File", { exact: true }), {
    target: { files: [file] },
  });
  return file;
}

async function upload() {
  fireEvent.submit(screen.getByRole("form", { name: "Upload import" }));
  await screen.findByText(/Choose Process file to validate its rows/);
}

test("reserve → direct file upload → complete; templates, filters, company selection, and delete confirmation", async () => {
  await openWorkspace();
  for (const kind of ["Budget", "Actual", "Cash"])
    expect(
      screen
        .getByRole("link", { name: `${kind} template (.csv)` })
        .getAttribute("href"),
    ).toBe(`/templates/${kind.toLowerCase()}_template.csv`);
  fireEvent.change(screen.getByLabelText("Import kind"), {
    target: { value: "actual" },
  });
  const file = chooseFile("actual.csv");
  await upload();
  const reserveCall = calls.find((call) => call.url.endsWith("/reserve"))!;
  expect(reserveCall.body).toEqual({
    kind: "actual",
    filename: "actual.csv",
    mime_type: "text/csv",
    size_bytes: file.size,
  });
  const flow = calls.filter((call) => call.method !== "GET");
  expect(flow.map((call) => call.method)).toEqual(["POST", "PUT", "POST"]);
  expect(flow[1].body).toBe(file);
  expect(
    await screen.findByText("uploaded", { selector: "span" }),
  ).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Filter by kind"), {
    target: { value: "budget" },
  });
  expect(screen.getByText("No imports match these filters.")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Filter by kind"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Delete import" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Delete import" }));
  fireEvent.click(
    screen.getByRole("button", {
      name: "Permanently delete import",
    }),
  );
  await screen.findByText("Import, stored file, and any derived rows deleted.");
  expect(
    screen.getByText("No imports yet. Upload your first file above."),
  ).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Selected company"), {
    target: { value: COMPANY_B },
  });
  await screen.findByRole("heading", { name: "Upload to Company 2" });
  await screen.findByText("No imports yet. Upload your first file above.");
  expect(localStorage.getItem("flow-forecast:company:user-a")).toBe(COMPANY_B);
});

test("invalid extension, empty file, and oversize are rejected before reservation", async () => {
  await openWorkspace();
  chooseFile("budget.pdf");
  fireEvent.submit(screen.getByRole("form", { name: "Upload import" }));
  expect(screen.getByRole("alert").textContent).toContain(".csv or .xlsx");
  chooseFile("empty.csv", "");
  fireEvent.submit(screen.getByRole("form", { name: "Upload import" }));
  expect(screen.getByRole("alert").textContent).toContain("not empty");
  const large = new File(["large"], "large.csv");
  Object.defineProperty(large, "size", { value: MAX_FILE_BYTES + 1 });
  fireEvent.change(screen.getByLabelText("File", { exact: true }), {
    target: { files: [large] },
  });
  fireEvent.submit(screen.getByRole("form", { name: "Upload import" }));
  expect(screen.getByRole("alert").textContent).toContain("5 MB");
  expect(calls.some((call) => call.method === "POST")).toBe(false);
});

test("failed file transfer remains reserved; retry uses the same reservation", async () => {
  await openWorkspace();
  failUpload = true;
  chooseFile();
  fireEvent.submit(screen.getByRole("form", { name: "Upload import" }));
  await screen.findByRole("button", { name: "Retry file upload" });
  expect(records[0].status).toBe("reserved");
  expect(calls.some((call) => call.url.endsWith("/complete"))).toBe(false);
  failUpload = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry file upload" }));
  await screen.findByText(/Choose Process file to validate its rows/);
  expect(calls.filter((call) => call.url.endsWith("/reserve"))).toHaveLength(1);
  expect(records[0].status).toBe("uploaded");
});

test("completion failure can be retried without transferring the file again", async () => {
  await openWorkspace();
  failComplete = true;
  chooseFile();
  fireEvent.submit(screen.getByRole("form", { name: "Upload import" }));
  await screen.findByRole("button", { name: "Confirm stored upload" });
  expect(records[0].status).toBe("reserved");
  failComplete = false;
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm stored upload" }),
  );
  await screen.findByText(/Choose Process file to validate its rows/);
  expect(calls.filter((call) => call.method === "PUT")).toHaveLength(1);
  expect(
    screen.queryByRole("button", { name: "Retry file upload" }),
  ).toBeNull();
});

test("delete failure preserves the import for retry", async () => {
  await openWorkspace();
  chooseFile();
  await upload();
  failDelete = true;
  fireEvent.click(screen.getByRole("button", { name: "Delete import" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Permanently delete import" }),
  );
  await screen.findByText("File cleanup failed.");
  expect(records).toHaveLength(1);
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Permanently delete import",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  failDelete = false;
  fireEvent.click(
    screen.getByRole("button", { name: "Permanently delete import" }),
  );
  await screen.findByText("No imports yet. Upload your first file above.");
});

test("history load failure has a working refresh control", async () => {
  failList = true;
  render(<ImportWorkspace userId="user-a" />);
  await screen.findByText("History temporarily unavailable.");
  failList = false;
  fireEvent.click(screen.getByRole("button", { name: "Refresh imports" }));
  await screen.findByText("No imports yet. Upload your first file above.");
});

test("existing company selection is shared with the dashboard", async () => {
  localStorage.setItem("flow-forecast:company:user-a", COMPANY_B);
  render(<ImportWorkspace userId="user-a" />);
  await screen.findByRole("heading", { name: "Upload to Company 2" });
  const form = await screen.findByRole("form", { name: "Upload import" });
  expect(within(form).getByLabelText("Import kind")).toBeTruthy();
  expect(
    calls.some((call) => call.url === `/api/v1/companies/${COMPANY_A}/imports`),
  ).toBe(false);
});

test("signed upload destination must match the configured project and reserved object", async () => {
  const reservation: UploadReservation = {
    import_id: "id",
    status: "reserved",
    storage_path: "user/company/id/data.csv",
    upload: {
      signed_url: "https://other.example/file?token=token",
      expires_in_seconds: 7200,
    },
  };
  await expect(
    uploadReservedFile(reservation, new File(["data"], "data.csv")),
  ).rejects.toThrow("upload link is invalid");
  expect(calls).toHaveLength(0);
});

test("processing shows row count and warnings after refreshing metadata", async () => {
  await openWorkspace();
  chooseFile();
  fireEvent.submit(screen.getByRole("form", { name: "Upload import" }));
  await screen.findByRole("button", { name: "Process file" });
  fireEvent.click(screen.getByRole("button", { name: "Process file" }));
  await screen.findByText("Rows: 3");
  await screen.findByText("Row 2 · amount: Signed financial amount retained.");
  expect(screen.queryByRole("button", { name: "Process file" })).toBeNull();
});

