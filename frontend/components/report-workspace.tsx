"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiRequest, type Company } from "../lib/api";
import {
  CompanyScope,
  buttonClass,
  inputClass,
  panelClass,
} from "./finance-shared";
import type { Scenario } from "./scenario-workspace";

export type ReportRecord = {
  id: string;
  status: "generating" | "ready" | "failed";
  created_at: string;
  parameters: {
    from: string;
    to: string;
    cash_start_date: string;
    scenario_id?: string;
  };
  error_message?: string;
  download_url?: string;
  expires_in_seconds?: number;
};

export function ReportWorkspace({ userId }: { userId: string }) {
  return (
    <CompanyScope userId={userId} title="Excel reports">
      {(company, busy, setBusy) => (
        <ReportPanel company={company} busy={busy} setBusy={setBusy} />
      )}
    </CompanyScope>
  );
}

export function ReportPanel({
  company,
  busy,
  setBusy,
}: {
  company: Company;
  busy: boolean;
  setBusy: (value: boolean) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [cashStart, setCashStart] = useState(today);
  const [scenarioId, setScenarioId] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioError, setScenarioError] = useState("");
  const [rows, setRows] = useState<ReportRecord[]>([]);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [remove, setRemove] = useState<ReportRecord | null>(null);
  const [download, setDownload] = useState<ReportRecord>();
  const path = `/companies/${company.id}/reports`;
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<Scenario[]>(`/companies/${company.id}/scenarios`, {
      signal: controller.signal,
    })
      .then((rows) => {
        if (!controller.signal.aborted) {
          setScenarios(rows);
          setScenarioError("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setScenarioError("Scenarios could not be loaded.");
      });
    return () => controller.abort();
  }, [company.id, version]);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ items: ReportRecord[] }>(`${path}?page=${page}&page_size=20`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setRows(data.items);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : "Reports could not be loaded.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [path, page, version]);
  function refresh() {
    setLoading(true);
    setVersion((n) => n + 1);
  }
  async function generate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setDownload(undefined);
    try {
      await apiRequest<ReportRecord>(`${path}/excel`, {
        method: "POST",
        body: JSON.stringify({
          from,
          to,
          cash_start_date: cashStart,
          scenario_id: scenarioId || null,
        }),
      });
      setNotice("Report generated. Get a download link below.");
      setPage(1);
      refresh();
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Report generation failed.",
      );
      refresh();
    } finally {
      setBusy(false);
    }
  }
  async function getLink(row: ReportRecord) {
    setBusy(true);
    setError("");
    setDownload(undefined);
    try {
      setDownload(await apiRequest<ReportRecord>(`/reports/${row.id}`));
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "A download link could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirmDelete() {
    if (!remove) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/reports/${remove.id}`, { method: "DELETE" });
      setRemove(null);
      setDownload(undefined);
      setNotice("Report deleted.");
      refresh();
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Report could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <p>
        Generate eight sheets covering executive summaries, variance,
        departments, cash, scenarios, and source data. Reports are private. Add
        an opening cash balance before generating.
      </p>
      <form
        aria-label="Report settings"
        className={`${panelClass} flex flex-wrap gap-4 items-end`}
        onSubmit={generate}
      >
        <label className="grid gap-2">
          From
          <input
            className={inputClass}
            required
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="grid gap-2">
          To
          <input
            className={inputClass}
            required
            type="date"
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="grid gap-2">
          Cash forecast start
          <input
            className={inputClass}
            required
            type="date"
            value={cashStart}
            onChange={(e) => setCashStart(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="grid gap-2">
          Scenario
          <select
            className={inputClass}
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            disabled={busy}
          >
            <option value="">Base forecast</option>
            {scenarios.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <button className={buttonClass} disabled={busy}>
          {busy ? "Working…" : "Generate Excel report"}
        </button>
      </form>
      {scenarioError && (
        <p role="alert">
          {scenarioError}{" "}
          <button className="underline" disabled={busy} onClick={refresh}>
            Retry
          </button>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {download?.download_url && (
        <section className={panelClass}>
          <a
            className={`${buttonClass} inline-block`}
            href={download.download_url}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            Download Excel
          </a>
          <p className="mt-3 text-sm">
            This private link expires five minutes after creation. Select Get
            download link again when it expires.
          </p>
        </section>
      )}
      {remove && (
        <section
          role="alertdialog"
          aria-label="Delete report"
          className={panelClass}
        >
          <p>Permanently delete this report and its Excel file?</p>
          <button
            className={`${buttonClass} mt-3 mr-3`}
            disabled={busy}
            onClick={confirmDelete}
          >
            Confirm delete
          </button>
          <button
            className="underline"
            disabled={busy}
            onClick={() => setRemove(null)}
          >
            Cancel
          </button>
        </section>
      )}
      <section className={panelClass}>
        <div className="flex justify-between">
          <h2 className="text-xl font-semibold">Saved reports</h2>
          <button
            className="underline"
            disabled={busy || loading}
            onClick={() => {
              setError("");
              refresh();
            }}
          >
            Refresh reports
          </button>
        </div>
        {loading ? (
          <p role="status">Loading reports…</p>
        ) : rows.length ? (
          <ul className="mt-4 space-y-4">
            {rows.map((row) => (
              <li key={row.id} className="border-t pt-4">
                <p>
                  {row.parameters.from} – {row.parameters.to} · {row.status}
                </p>
                <p className="text-sm">
                  Created {new Date(row.created_at).toLocaleString()}
                </p>
                {row.error_message && <p>{row.error_message}</p>}
                <div className="flex gap-4 mt-2">
                  {row.status === "ready" && (
                    <button
                      className="underline"
                      disabled={busy}
                      onClick={() => getLink(row)}
                    >
                      Get download link
                    </button>
                  )}
                  <button
                    className="underline"
                    disabled={busy}
                    onClick={() => setRemove(row)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4">No reports on this page.</p>
        )}
        <div className="flex gap-4 mt-4">
          <button
            className="underline disabled:opacity-50"
            disabled={busy || loading || page === 1}
            onClick={() => {
              setPage((n) => n - 1);
              setLoading(true);
            }}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            className="underline disabled:opacity-50"
            disabled={busy || loading || rows.length < 20}
            onClick={() => {
              setPage((n) => n + 1);
              setLoading(true);
            }}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
