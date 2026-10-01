"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest, type Company } from "../lib/api";
import {
  CompanyScope,
  buttonClass,
  inputClass,
  panelClass,
} from "./finance-shared";

export type Scenario = {
  id: string;
  name: string;
  inflow_adjustment_pct: string;
  outflow_adjustment_pct: string;
  collection_delay_days: number;
};
export function ScenarioWorkspace({ userId }: { userId: string }) {
  return (
    <CompanyScope userId={userId} title="Scenarios">
      {(company, busy, setBusy) => (
        <ScenarioPanel company={company} busy={busy} setBusy={setBusy} />
      )}
    </CompanyScope>
  );
}

function ScenarioPanel({
  company,
  busy,
  setBusy,
}: {
  company: Company;
  busy: boolean;
  setBusy: (busy: boolean) => void;
}) {
  const [rows, setRows] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [edit, setEdit] = useState<Scenario | null>(null);
  const [remove, setRemove] = useState<Scenario | null>(null);
  const [version, setVersion] = useState(0);
  const [formVersion, setFormVersion] = useState(0);
  const path = `/companies/${company.id}/scenarios`;
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<Scenario[]>(path, { signal: controller.signal })
      .then((rows) => {
        if (!controller.signal.aborted) {
          setRows(rows);
          setLoading(false);
          setError("");
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setError(
            error instanceof Error
              ? error.message
              : "Scenarios could not be loaded.",
          );
        }
      });
    return () => controller.abort();
  }, [path, version]);
  function refresh() {
    setLoading(true);
    setVersion((value) => value + 1);
  }
  async function save(body: Record<string, string | number>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(edit ? `/scenarios/${edit.id}` : path, {
        method: edit ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setEdit(null);
      setFormVersion((value) => value + 1);
      setNotice("Scenario saved.");
      refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Saving failed.");
    } finally {
      setBusy(false);
    }
  }
  async function deleteScenario() {
    if (!remove) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/scenarios/${remove.id}`, { method: "DELETE" });
      if (edit?.id === remove.id) setEdit(null);
      setRemove(null);
      setNotice("Scenario deleted.");
      refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Deletion failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <p className="max-w-3xl leading-7 text-[#53675d]">
        Scenarios adjust planned amounts and delay planned collections.
        Confirmed and actual items retain their amounts and dates. Source cash
        records remain unchanged.
      </p>
      {error && (
        <p role="alert" className={panelClass}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={panelClass}>
          {notice}
        </p>
      )}
      {remove && (
        <div className={panelClass}>
          <p>Permanently delete scenario “{remove.name}”?</p>
          <div className="mt-3 flex gap-4">
            <button
              disabled={busy}
              className={buttonClass}
              onClick={() => void deleteScenario()}
            >
              Confirm scenario deletion
            </button>
            <button
              disabled={busy}
              className="underline"
              onClick={() => setRemove(null)}
            >
              Cancel deletion
            </button>
          </div>
        </div>
      )}
      <ScenarioForm
        key={`${edit?.id ?? "new"}-${formVersion}`}
        initial={edit}
        disabled={busy || loading}
        onSave={(body) => void save(body)}
        onCancel={() => setEdit(null)}
      />
      <section className={panelClass}>
        <div className="flex flex-wrap justify-between gap-4">
          <h2 className="text-xl font-semibold">Saved scenarios</h2>
          <button
            disabled={busy || loading}
            className="underline"
            onClick={refresh}
          >
            Refresh scenarios
          </button>
        </div>
        {loading ? (
          <p role="status" className="mt-4">
            Loading scenarios…
          </p>
        ) : rows.length ? (
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-[#d8e1d7] p-5"
              >
                <h3 className="font-semibold">{row.name}</h3>
                <p className="mt-3 text-sm">
                  Planned inflows: {row.inflow_adjustment_pct}%<br />
                  Planned outflows: {row.outflow_adjustment_pct}%<br />
                  Collection delay: {row.collection_delay_days} days
                </p>
                <div className="mt-4 flex gap-4">
                  <button
                    disabled={busy}
                    className="underline"
                    aria-label={`Edit scenario ${row.name}`}
                    onClick={() => setEdit(row)}
                  >
                    Edit
                  </button>
                  <button
                    disabled={busy}
                    className="underline text-[#8b372c]"
                    aria-label={`Delete scenario ${row.name}`}
                    onClick={() => setRemove(row)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4">No scenarios yet. Create one above.</p>
        )}
        <Link
          href="/cash-forecast"
          className="mt-5 inline-block font-medium underline"
        >
          Compare a scenario with the base forecast
        </Link>
      </section>
    </div>
  );
}

function ScenarioForm({
  initial,
  disabled,
  onSave,
  onCancel,
}: {
  initial: Scenario | null;
  disabled: boolean;
  onSave: (body: Record<string, string | number>) => void;
  onCancel: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    onSave({
      name: String(body.name).trim(),
      inflow_adjustment_pct: String(body.inflow_adjustment_pct),
      outflow_adjustment_pct: String(body.outflow_adjustment_pct),
      collection_delay_days: Number(body.collection_delay_days),
    });
  }
  return (
    <form
      className={panelClass}
      aria-label="Scenario settings"
      onSubmit={submit}
    >
      <h2 className="text-xl font-semibold">
        {initial ? "Edit scenario" : "Create scenario"}
      </h2>
      <fieldset disabled={disabled} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm">
          Scenario name
          <input
            className={inputClass}
            required
            maxLength={200}
            name="name"
            defaultValue={initial?.name}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Planned inflow adjustment (%)
          <input
            className={inputClass}
            type="number"
            required
            min="-100"
            max="500"
            step="any"
            name="inflow_adjustment_pct"
            defaultValue={initial?.inflow_adjustment_pct ?? "0"}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Planned outflow adjustment (%)
          <input
            className={inputClass}
            type="number"
            required
            min="-100"
            max="500"
            step="any"
            name="outflow_adjustment_pct"
            defaultValue={initial?.outflow_adjustment_pct ?? "0"}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Collection delay (days)
          <input
            className={inputClass}
            type="number"
            required
            min="0"
            max="365"
            step="1"
            name="collection_delay_days"
            defaultValue={initial?.collection_delay_days ?? 0}
          />
        </label>
        <button className={buttonClass}>Save scenario</button>
        {initial && (
          <button type="button" onClick={onCancel} className="underline">
            Cancel scenario edit
          </button>
        )}
      </fieldset>
    </form>
  );
}
