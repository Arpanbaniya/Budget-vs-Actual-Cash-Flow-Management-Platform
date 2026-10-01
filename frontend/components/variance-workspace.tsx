"use client";

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

export type VarianceRow = {
  label: string;
  account_name: string;
  account_type: string;
  budget_amount: string;
  actual_amount: string;
  variance_amount: string;
  variance_percent: string | null;
  variance_label: string;
  favorability: string;
};
export type MonthlyVariance = {
  month: string;
  budget_revenue: string;
  actual_revenue: string;
  budget_expenses: string;
  actual_expenses: string;
  budget_profit: string;
  actual_profit: string;
};
export type VarianceResult = {
  currency: string;
  summary: Record<string, string>;
  rows: VarianceRow[];
  top_unfavorable: VarianceRow[];
  monthly_series: MonthlyVariance[];
  has_data: boolean;
  budget_row_count: number;
  actual_row_count: number;
};

export function VarianceWorkspace({ userId }: { userId: string }) {
  return (
    <CompanyScope userId={userId} title="Variance analysis">
      {(company) => <VariancePanel company={company} />}
    </CompanyScope>
  );
}

export function VarianceSummary({ data }: { data: VarianceResult }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {["revenue", "expenses", "operating_profit"].map((metric) => (
        <section key={metric} className={panelClass}>
          <h2 className="capitalize text-lg font-semibold">
            {metric.replaceAll("_", " ")}
          </h2>
          <p className="mt-3 text-2xl">
            {money(data.summary[`actual_${metric}`], data.currency)}
          </p>
          <p className="mt-2 text-sm">
            Budget: {money(data.summary[`budget_${metric}`], data.currency)}
          </p>
          <p className="mt-1 text-sm">
            Variance: {money(data.summary[`${metric}_variance`], data.currency)}
          </p>
        </section>
      ))}
    </div>
  );
}

export function VarianceTable({
  rows,
  currency,
}: {
  rows: VarianceRow[];
  currency: string;
}) {
  const [limit, setLimit] = useState(100);
  return (
    <section className={panelClass}>
      <h2 className="text-xl font-semibold">Variance detail</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "Group / account type",
                "Budget",
                "Actual",
                "Variance",
                "Variance %",
                "Result",
              ].map((label) => (
                <th key={label} scope="col" className="border-b p-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((row) => (
              <tr key={`${row.label}:${row.account_type}`}>
                <th scope="row" className="border-b p-3 font-normal">
                  {row.label} · {row.account_name}
                  <span className="block text-xs text-[#53675d]">
                    {row.account_type.replaceAll("_", " ")}
                  </span>
                </th>
                {[
                  row.budget_amount,
                  row.actual_amount,
                  row.variance_amount,
                ].map((value, index) => (
                  <td key={index} className="border-b p-3 whitespace-nowrap">
                    {money(value, currency)}
                  </td>
                ))}
                <td className="border-b p-3">
                  {row.variance_percent === null
                    ? "Unbudgeted"
                    : `${Number(row.variance_percent).toFixed(2)}%`}
                </td>
                <td className="border-b p-3">
                  <span
                    className={`rounded-lg px-2 py-1 ${row.favorability === "unfavorable" ? "bg-[#fff0e5] text-[#8b372c]" : "bg-[#edf3e9]"}`}
                  >
                    {row.favorability}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <button
          className={`${buttonClass} mt-4`}
          onClick={() => setLimit((value) => value + 100)}
        >
          Show 100 more groups
        </button>
      )}
    </section>
  );
}

function VariancePanel({ company }: { company: Company }) {
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(`${today.slice(0, 4)}-01-01`);
  const [end, setEnd] = useState(today);
  const [department, setDepartment] = useState("");
  const [group, setGroup] = useState("account");
  const [query, setQuery] = useState(
    `from=${start}&to=${end}&group_by=account`,
  );
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    data?: VarianceResult;
    error?: string;
    loading: boolean;
  }>({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<VarianceResult>(`/companies/${company.id}/variance?${query}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            error:
              error instanceof Error
                ? error.message
                : "Analysis could not be loaded.",
            loading: false,
          });
      });
    return () => controller.abort();
  }, [company.id, query, version]);
  function apply(event: FormEvent) {
    event.preventDefault();
    setState({ loading: true });
    setQuery(
      new URLSearchParams({
        from: start,
        to: end,
        group_by: group,
        ...(department.trim() ? { department: department.trim() } : {}),
      }).toString(),
    );
    setVersion((value) => value + 1);
  }
  return (
    <div className="space-y-6">
      <form
        onSubmit={apply}
        className={`${panelClass} flex flex-wrap items-end gap-4`}
      >
        <label className="grid gap-2 text-sm">
          From
          <input
            className={inputClass}
            required
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm">
          To
          <input
            className={inputClass}
            required
            type="date"
            min={start}
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Department
          <input
            className={inputClass}
            maxLength={500}
            value={department}
            placeholder="All departments"
            onChange={(event) => setDepartment(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Group by
          <select
            className={inputClass}
            value={group}
            onChange={(event) => setGroup(event.target.value)}
          >
            {["account", "department", "month"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button className={buttonClass} disabled={state.loading}>
          Apply filters
        </button>
      </form>
      {state.loading ? (
        <p role="status">Loading analysis…</p>
      ) : state.error ? (
        <p role="alert">{state.error}</p>
      ) : (
        state.data &&
        (!state.data.has_data ? (
          <p className={panelClass}>
            No processed financial rows for these filters. Upload and process
            budget/actual files in Imports.
          </p>
        ) : (
          <>
            {(!state.data.budget_row_count || !state.data.actual_row_count) && (
              <p className={panelClass}>
                One side of the comparison is missing. Missing amounts are shown
                as zero; upload both budget and actual for a complete
                comparison.
              </p>
            )}
            <VarianceSummary data={state.data} />
            <BudgetChart rows={state.data.rows} />
            <VarianceTable
              key={query}
              rows={state.data.rows}
              currency={company.currency}
            />
            <section className={panelClass}>
              <h2 className="text-xl font-semibold">
                Top unfavorable variances
              </h2>
              {state.data.top_unfavorable.length ? (
                <ul className="mt-4 space-y-2">
                  {state.data.top_unfavorable.map((row) => (
                    <li key={`${row.label}:${row.account_type}`}>
                      {row.label} · {row.account_type}:{" "}
                      {money(row.variance_amount, company.currency)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3">No unfavorable variances.</p>
              )}
            </section>
          </>
        ))
      )}
    </div>
  );
}
