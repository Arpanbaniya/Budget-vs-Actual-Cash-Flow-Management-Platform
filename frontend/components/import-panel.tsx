"use client";

import { type FormEvent, useEffect, useState } from "react";
import { apiRequest, type Company } from "../lib/api";
import {
  IMPORT_KINDS,
  IMPORT_STATUSES,
  importFileType,
  uploadReservedFile,
  type ImportKind,
  type ImportRecord,
  type ImportStatus,
  type UploadReservation,
} from "../lib/imports";

const panelClass =
  "rounded-[1.5rem] border border-[#d8e1d7] bg-white p-6 sm:p-8";
const inputClass =
  "w-full rounded-xl border border-[#cbd7cd] bg-white px-4 py-3";
const labels = { budget: "Budget", actual: "Actual", cash: "Cash" };

export function ImportPanel({
  company,
  busy,
  onBusyChange,
}: {
  company: Company;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [kind, setKind] = useState<ImportKind>("budget");
  const [file, setFile] = useState<File | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [filterKind, setFilterKind] = useState<ImportKind | "">("");
  const [filterStatus, setFilterStatus] = useState<ImportStatus | "">("");
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [step, setStep] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    reservation: UploadReservation;
    file: File;
  } | null>(null);
  const listPath = `/companies/${company.id}/imports`;

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<ImportRecord[]>(listPath, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setImports(result);
        setLoadFailed(false);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadFailed(true);
        setLoading(false);
        setError(
          error instanceof Error
            ? error.message
            : "Imports could not be loaded.",
        );
      });
    return () => controller.abort();
  }, [listPath, retry]);

  function remember(record: ImportRecord) {
    setLoadFailed(false);
    setImports((current) => [
      record,
      ...current.filter((item) => item.id !== record.id),
    ]);
  }

  async function finish(id: string) {
    setStep("Confirming the stored file…");
    const record = await apiRequest<ImportRecord>(`/imports/${id}/complete`, {
      method: "POST",
    });
    remember(record);
    setNotice(
      `${labels[record.kind]} file uploaded for ${company.name}. Choose Process file to validate its rows.`,
    );
    if (pending?.reservation.import_id === id) setPending(null);
    setFile(null);
    setFormVersion((version) => version + 1);
    return record;
  }

  async function upload(event?: FormEvent<HTMLFormElement>, resume = false) {
    event?.preventDefault();
    const chosen = resume ? pending?.file : file;
    if (!chosen) {
      setError("Choose a file to upload.");
      return;
    }
    try {
      importFileType(chosen);
    } catch (error) {
      setError(error instanceof Error ? error.message : "The file is invalid.");
      return;
    }
    onBusyChange(true);
    setError(null);
    setNotice(null);
    try {
      setStep(resume ? "Retrying file upload…" : "Reserving your upload…");
      const reservation =
        resume && pending
          ? pending.reservation
          : await apiRequest<UploadReservation>(`${listPath}/reserve`, {
              method: "POST",
              body: JSON.stringify({
                kind,
                filename: chosen.name,
                mime_type: importFileType(chosen),
                size_bytes: chosen.size,
              }),
            });
      setPending({ reservation, file: chosen });
      setStep("Uploading your file…");
      await uploadReservedFile(reservation, chosen);
      await finish(reservation.import_id);
      setPending(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The upload could not be completed.",
      );
      try {
        setImports(await apiRequest<ImportRecord[]>(listPath));
        setLoadFailed(false);
      } catch {
        /* Keep primary upload error visible. */
      }
    } finally {
      onBusyChange(false);
      setStep("");
    }
  }

  async function confirmStored(id: string) {
    onBusyChange(true);
    setError(null);
    setNotice(null);
    try {
      await finish(id);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The upload could not be confirmed.",
      );
    } finally {
      onBusyChange(false);
      setStep("");
    }
  }

  async function processFile(id: string) {
    onBusyChange(true);
    setError(null);
    setNotice(null);
    setStep("Processing and validating rows…");
    setImports((current) => current.map((item) => item.id === id ? { ...item, status: "processing" } : item));
    try {
      const result = await apiRequest<{ row_count: number }>(`/imports/${id}/process`, { method: "POST" });
      setNotice(`${result.row_count} rows processed successfully.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Processing failed.");
    } finally {
      try { remember(await apiRequest<ImportRecord>(`/imports/${id}`)); }
      catch { setRetry((value) => value + 1); }
      onBusyChange(false);
      setStep("");
    }
  }

  async function remove(id: string) {
    onBusyChange(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest<void>(`/imports/${id}`, { method: "DELETE" });
      setImports((current) => current.filter((item) => item.id !== id));
      setDeleteId(null);
      if (pending?.reservation.import_id === id) setPending(null);
      setNotice("Import, stored file, and any derived rows deleted.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The import could not be deleted.",
      );
    } finally {
      onBusyChange(false);
    }
  }

  const visible = imports.filter(
    (item) =>
      (!filterKind || item.kind === filterKind) &&
      (!filterStatus || item.status === filterStatus),
  );
  return (
    <div className="mt-8 space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-[#e6c6ae] bg-[#fff6ef] p-4 text-sm text-[#794a2c]"
        >
          {error}
        </p>
      )}
      {(step || notice) && (
        <p
          role="status"
          className="rounded-xl bg-[#eaf3e7] p-4 text-sm text-[#244a38]"
        >
          {step || notice}
        </p>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className={panelClass}>
          <h2 className="text-2xl font-semibold">Upload to {company.name}</h2>
          <p className="mt-2 text-sm leading-6 text-[#53675d]">
            CSV or XLSX, up to 5 MB. Files remain private. After uploading, choose
            Process file to validate and save rows. XLSX uses the first worksheet.
          </p>
          <form
            onSubmit={(event) => void upload(event)}
            aria-label="Upload import"
            className="mt-6"
          >
            <fieldset
              disabled={busy || loading}
              className="space-y-5 disabled:opacity-60"
            >
              <div>
                <label
                  htmlFor="import-kind"
                  className="mb-2 block text-sm font-medium"
                >
                  Import kind
                </label>
                <select
                  id="import-kind"
                  value={kind}
                  onChange={(event) =>
                    setKind(event.target.value as ImportKind)
                  }
                  className={inputClass}
                >
                  {IMPORT_KINDS.map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="import-file"
                  className="mb-2 block text-sm font-medium"
                >
                  File
                </label>
                <input
                  key={formVersion}
                  id="import-file"
                  type="file"
                  accept=".csv,.xlsx"
                  required
                  aria-describedby="file-guidance"
                  className={`${inputClass} file:mr-4 file:rounded-lg file:border-0 file:bg-[#eef5eb] file:px-3 file:py-2 file:text-[#164d3b]`}
                  onChange={(event) => {
                    const selected = event.target.files?.[0] ?? null;
                    setFile(selected);
                    setError(null);
                    if (selected)
                      try {
                        importFileType(selected);
                      } catch (error) {
                        setError(
                          error instanceof Error
                            ? error.message
                            : "The file is invalid.",
                        );
                      }
                  }}
                />
                <p id="file-guidance" className="mt-2 text-xs text-[#53675d]">
                  Use a template to start with the expected columns.
                </p>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-[#164d3b] px-5 py-3 font-medium text-white hover:bg-[#0c3829]"
              >
                {busy ? "Working…" : "Upload file"}
              </button>
            </fieldset>
          </form>
          {pending && !busy && (
            <div className="mt-5 rounded-xl border border-[#e6c6ae] bg-[#fff6ef] p-4 text-sm">
              <p>
                Unfinished upload: {pending.file.name}. You can retry the file
                transfer or confirm a file that already reached Storage.
              </p>
              <div className="mt-3 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={() => void upload(undefined, true)}
                  className="font-medium underline"
                >
                  Retry file upload
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void confirmStored(pending.reservation.import_id)
                  }
                  className="font-medium underline"
                >
                  Confirm stored upload
                </button>
              </div>
            </div>
          )}
        </section>
        <section className={panelClass}>
          <h2 className="text-xl font-semibold">Download templates</h2>
          <p className="mt-3 text-sm leading-6 text-[#53675d]">
            Blank CSV templates with the required column headings.
          </p>
          <ul className="mt-5 space-y-3">
            {IMPORT_KINDS.map((value) => (
              <li key={value}>
                <a
                  href={`/templates/${value}_template.csv`}
                  download
                  className="block rounded-xl border border-[#cbd7cd] px-4 py-3 text-sm font-medium hover:bg-[#f3f7f1]"
                >
                  {labels[value]} template (.csv)
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold">Import history</h2>
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => {
              setLoading(true);
              setError(null);
              setRetry((value) => value + 1);
            }}
            className="rounded-xl border border-[#cbd7cd] px-4 py-2 text-sm disabled:opacity-60"
          >
            Refresh imports
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-4">
          <div>
            <label htmlFor="filter-kind" className="mb-2 block text-sm">
              Filter by kind
            </label>
            <select
              id="filter-kind"
              value={filterKind}
              onChange={(event) =>
                setFilterKind(event.target.value as ImportKind | "")
              }
              className={inputClass}
            >
              <option value="">All kinds</option>
              {IMPORT_KINDS.map((value) => (
                <option key={value} value={value}>
                  {labels[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-status" className="mb-2 block text-sm">
              Filter by status
            </label>
            <select
              id="filter-status"
              value={filterStatus}
              onChange={(event) =>
                setFilterStatus(event.target.value as ImportStatus | "")
              }
              className={inputClass}
            >
              <option value="">All statuses</option>
              {IMPORT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <p role="status" className="mt-6">
            Loading imports…
          </p>
        ) : loadFailed ? (
          <p className="mt-6 text-[#53675d]">
            Import history could not be loaded. Use Refresh imports to retry.
          </p>
        ) : visible.length === 0 ? (
          <p className="mt-6 text-[#53675d]">
            {imports.length === 0
              ? "No imports yet. Upload your first file above."
              : "No imports match these filters."}
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {visible.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-[#d8e1d7] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold">
                      {item.filename}
                    </h3>
                    <p className="mt-1 text-sm text-[#53675d]">
                      {labels[item.kind]} · {item.size_bytes ?? "Unknown"} bytes
                    </p>
                    <p className="mt-2 text-sm">
                      Status: <span className="font-medium">{item.status}</span>
                    </p>
                    {item.status === "reserved" && (
                      <p className="mt-2 text-xs text-[#53675d]">
                        Awaiting a confirmed file upload.
                      </p>
                    )}
                    {item.status === "uploaded" && (
                      <p className="mt-2 text-xs text-[#53675d]">
                        Stored privately. Financial rows have not been parsed.
                      </p>
                    )}
                    {item.row_count !== null && <p className="mt-2 text-sm">Rows: {item.row_count}</p>}
                    {item.error_message && <p className="mt-2 text-sm text-[#8b372c]">{item.error_message}</p>}
                    {[...(item.validation_errors ?? []), ...(item.warnings ?? [])].map((issue, index) => (
                      <p key={index} className="mt-1 text-sm">Row {issue.row} · {issue.field}: {issue.message}</p>
                    ))}
                    {item.status === "processing" && <p className="mt-2 text-xs">Processing… Refresh to check progress. Interrupted runs can be retried after ten minutes.</p>}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {["uploaded", "failed", "processing"].includes(item.status) && (
                      <button type="button" disabled={busy || loading} onClick={() => void processFile(item.id)}
                        className="rounded-lg bg-[#164d3b] px-3 py-2 text-sm text-white disabled:opacity-60">
                        {item.status === "processing" ? "Recover processing" : "Process file"}
                      </button>
                    )}
                    {item.status === "reserved" && (
                      <button
                        type="button"
                        disabled={busy || loading}
                        onClick={() => void confirmStored(item.id)}
                        className="rounded-lg border border-[#cbd7cd] px-3 py-2 text-sm disabled:opacity-60"
                      >
                        Confirm upload
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy || item.status === "processing"}
                      onClick={() => setDeleteId(item.id)}
                      className="rounded-lg border border-[#e6c6ae] px-3 py-2 text-sm text-[#8b372c] disabled:opacity-60"
                    >
                      Delete import
                    </button>
                  </div>
                </div>
                {deleteId === item.id && (
                  <div className="mt-4 rounded-xl bg-[#fff6ef] p-4 text-sm">
                    <p>
                      Permanently delete {item.filename}, its stored file, and
                      any derived rows?
                    </p>
                    <div className="mt-3 flex gap-4">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(item.id)}
                        className="font-medium text-[#8b372c] underline"
                      >
                        Permanently delete import
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setDeleteId(null)}
                        className="underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
