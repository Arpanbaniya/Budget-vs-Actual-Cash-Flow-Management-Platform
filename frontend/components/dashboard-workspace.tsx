"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest, type Company } from "../lib/api";
import {
  BudgetChart,
  CompanyScope,
  buttonClass,
  inputClass,
  money,
  panelClass,
} from "./finance-shared";
import {
  CashChart,
  ForecastTable,
  type ForecastResult,
} from "./forecast-workspace";
import {
  VarianceSummary,
  VarianceTable,
  type MonthlyVariance,
  type VarianceResult,
} from "./variance-workspace";
import type { Scenario } from "./scenario-workspace";

export type DashboardResult = {
  currency: string;
  period: { from: string; to: string };
  cash_start_date: string;
  variance: VarianceResult;
  cash_forecast: ForecastResult | null;
  latest_cash: { amount: string; balance_date: string } | null;
};

export function MonthlyTrendChart({
  rows,
  currency,
}: {
  rows: MonthlyVariance[];
  currency: string;
}) {
  const visible = rows.slice(0, 24);
  const max = Math.max(
    1,
    ...visible.flatMap((row) => [
      Math.abs(Number(row.actual_revenue)),
      Math.abs(Number(row.actual_expenses)),
      Math.abs(Number(row.actual_profit)),
    ]),
  );
  return (
    <section className={panelClass}>
      <h2 className="text-xl font-semibold">Monthly revenue, expenses, and profit</h2>
      <p className="mt-2 text-xs">Actual values are shown first; budget values follow each value.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>{["Month", "Revenue", "Expenses", "Operating profit"].map((label) => <th key={label} className="border-b p-3">{label}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.month}>
                <th scope="row" className="border-b p-3">{row.month}</th>
                <td className="border-b p-3">{money(row.actual_revenue, currency)} / {money(row.budget_revenue, currency)}</td>
                <td className="border-b p-3">{money(row.actual_expenses, currency)} / {money(row.budget_expenses, currency)}</td>
                <td className="border-b p-3">{money(row.actual_profit, currency)} / {money(row.budget_profit, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <svg className="mt-5 w-full" role="img" aria-label="Monthly actual revenue, expenses, and operating profit" viewBox={`0 0 800 ${Math.max(70, visible.length * 30)}`}>
        {visible.map((row, index) => (
          <g key={`chart-${row.month}`}>
            <text x="0" y={index * 30 + 18} fontSize="12">{row.month}</text>
            {[row.actual_revenue, row.actual_expenses, row.actual_profit].map((value, item) => (
              <rect key={item} x="120" y={index * 30 + item * 8} width={(Math.abs(Number(value)) / max) * 620} height="6" fill={["#164d3b", "#bb963f", "#6a9e78"][item]} />
            ))}
          </g>
        ))}
      </svg>
      {rows.length > 24 && <p className="text-xs">Showing the first 24 months.</p>}
    </section>
  );
}

export function DashboardWorkspace({ userId }: { userId: string }) {
  return (
    <CompanyScope userId={userId} title="Financial dashboard">
      {(company) => <DashboardPanel company={company} />}
    </CompanyScope>
  );
}

export function DashboardPanel({ company }: { company: Company }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [cashStart, setCashStart] = useState(today);
  const [scenarioId, setScenarioId] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioError, setScenarioError] = useState("");
  const [query, setQuery] = useState(
    new URLSearchParams({ from, to, cash_start_date: today }).toString(),
  );
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    data?: DashboardResult;
    error?: string;
    loading: boolean;
  }>({ loading: true });
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
          setScenarioError(
            "Scenarios could not be loaded. Retry the dashboard to reload them.",
          );
      });
    return () => controller.abort();
  }, [company.id, version]);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<DashboardResult>(`/companies/${company.id}/dashboard?${query}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Dashboard could not be loaded.",
          });
      });
    return () => controller.abort();
  }, [company.id, query, version]);
  function update(event: FormEvent) {
    event.preventDefault();
    setState({ loading: true });
    setQuery(
      new URLSearchParams({
        from,
        to,
        cash_start_date: cashStart,
        ...(scenarioId ? { scenario_id: scenarioId } : {}),
      }).toString(),
    );
    setVersion((n) => n + 1);
  }
  return (
    <div className="space-y-6">
      <form
        onSubmit={update}
        className={`${panelClass} flex flex-wrap gap-4 items-end`}
      >
        <label className="grid gap-2">
          From
          <input
            className={inputClass}
            required
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
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
          />
        </label>
        <label className="grid gap-2">
          Scenario
          <select
            className={inputClass}
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
          >
            <option value="">Base forecast</option>
            {scenarios.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <button className={buttonClass} disabled={state.loading}>
          Update dashboard
        </button>
      </form>
      {scenarioError && <p role="alert">{scenarioError}</p>}
      {state.loading ? (
        <p role="status">Loading dashboard…</p>
      ) : state.error ? (
        <div role="alert">
          {state.error}
          <button
            className={`${buttonClass} ml-4`}
            onClick={() => {
              setState({ loading: true });
              setVersion((n) => n + 1);
            }}
          >
            Retry
          </button>
        </div>
      ) : state.data ? (
        <DashboardView data={state.data} />
      ) : null}
    </div>
  );
}

export function DashboardView({ data }: { data: DashboardResult }) {
  const variance = { ...data.variance, currency: data.currency };
  const cash = data.cash_forecast
    ? { ...data.cash_forecast, currency: data.currency }
    : null;
  return (
    <div className="space-y-6">
      <p className="text-sm">
        Financial period: {data.period.from} – {data.period.to}. Cash forecast
        starts {data.cash_start_date}
        {cash?.scenario
          ? ` · Scenario: ${cash.scenario.name}`
          : " · Base forecast"}
        .
      </p>
      {(!variance.budget_row_count || !variance.actual_row_count) && (
        <p className={`${panelClass} bg-[#fff5e8]`}>
          Budget or actual data is missing. Missing amounts are shown as zero.{" "}
          <Link className="underline" href="/imports">
            Upload and process imports
          </Link>
          .
        </p>
      )}
      <VarianceSummary data={variance} />
      {variance.has_data && <BudgetChart rows={variance.rows} />}
      {variance.monthly_series.length > 0 && <MonthlyTrendChart rows={variance.monthly_series} currency={data.currency} />}
      <section className={panelClass}>
        <h2 className="text-xl font-semibold">Top unfavorable variances</h2>
        {variance.top_unfavorable.length ? (
          <VarianceTable
            rows={variance.top_unfavorable}
            currency={data.currency}
          />
        ) : (
          <p className="mt-3">
            No unfavorable variances in the selected period.
          </p>
        )}
      </section>
      {cash ? (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <section className={panelClass}>
              <h2>Latest cash as of forecast start</h2>
              <p className="text-2xl mt-3">
                {money(
                  data.latest_cash?.amount ?? cash.opening_cash,
                  data.currency,
                )}
              </p>
              <p>Balance date: {cash.balance_date}</p>
            </section>
            <section className={panelClass}>
              <h2>Minimum 13-week cash</h2>
              <p className="text-2xl mt-3">
                {money(cash.minimum_projected_cash, data.currency)}
              </p>
              <p>Lowest closing balance: week {cash.lowest_cash_week}</p>
            </section>
            <section className={panelClass}>
              <h2>First threshold breach</h2>
              <p className="text-2xl mt-3">
                {cash.first_threshold_breach_week === null
                  ? "None"
                  : `Week ${cash.first_threshold_breach_week}`}
              </p>
              <p>
                Threshold: {money(cash.minimum_cash_threshold, data.currency)}
              </p>
            </section>
          </div>
          {cash.balance_date !== cash.start_date && (
            <p className="text-sm">
              Opening cash uses the saved balance directly. Earlier cash items
              are not rolled forward; update the snapshot if needed.
            </p>
          )}
          <CashChart data={cash} />
          <ForecastTable data={cash} />
        </>
      ) : (
        <section className={panelClass}>
          <h2 className="text-xl font-semibold">
            Cash forecast needs an opening balance
          </h2>
          <p className="mt-3">
            Add a cash balance dated on or before {data.cash_start_date}.{" "}
            <Link href="/cash" className="underline">
              Manage cash balances
            </Link>
            .
          </p>
        </section>
      )}
    </div>
  );
}
