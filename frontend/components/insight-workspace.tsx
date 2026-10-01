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

export type InsightResult = {
  provider: "groq" | "deterministic";
  fallback_used: boolean;
  cached: boolean;
  text: string;
};

export function InsightWorkspace({ userId }: { userId: string }) {
  return (
    <CompanyScope userId={userId} title="Management insights">
      {(company, busy, setBusy) => (
        <InsightPanel company={company} busy={busy} setBusy={setBusy} />
      )}
    </CompanyScope>
  );
}

export function InsightPanel({
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
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<InsightResult>();
  const [error, setError] = useState("");
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
  async function explain(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      setResult(
        await apiRequest<InsightResult>(`/companies/${company.id}/insights`, {
          method: "POST",
          body: JSON.stringify({
            from,
            to,
            cash_start_date: cashStart,
            scenario_id: scenarioId || null,
          }),
        }),
      );
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Insights could not be generated.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <p>
        Explain the selected financial period and 13-week cash outlook using
        calculated facts. Groq, when configured, prioritizes facts and review
        actions. Every displayed figure comes from the finance services.
      </p>
      <form
        className={`${panelClass} flex flex-wrap gap-4 items-end`}
        onSubmit={explain}
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
          {busy ? "Explaining…" : "Explain"}
        </button>
      </form>
      {scenarioError && (
        <p role="alert">
          {scenarioError}{" "}
          <button
            className="underline"
            disabled={busy}
            onClick={() => setVersion((n) => n + 1)}
          >
            Retry scenarios
          </button>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {result && <InsightView result={result} />}
    </div>
  );
}

export function InsightView({ result }: { result: InsightResult }) {
  return (
    <section className={panelClass}>
      <div className="flex gap-3 items-center">
        <h2 className="text-xl font-semibold">Commentary</h2>
        <span className="rounded-lg bg-[#eef4ec] px-3 py-1 text-sm">
          {result.provider === "groq" ? "Groq AI" : "Deterministic fallback"}
        </span>
        {result.cached && (
          <span className="text-sm">Cached · unchanged facts</span>
        )}
      </div>
      <p className="mt-4 whitespace-pre-wrap">{result.text}</p>
    </section>
  );
}
