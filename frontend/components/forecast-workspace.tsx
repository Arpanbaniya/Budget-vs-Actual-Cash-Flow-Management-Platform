"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest, type Company } from "../lib/api";
import {
  CompanyScope,
  buttonClass,
  inputClass,
  money,
  panelClass,
} from "./finance-shared";

export type ForecastWeek = {
  week_number: number;
  week_start: string;
  week_end: string;
  opening_cash: string;
  inflows: string;
  outflows: string;
  closing_cash: string;
  threshold_breached: boolean;
};
export type ForecastResult = {
  currency: string;
  start_date: string;
  weeks: number;
  opening_cash: string;
  balance_date: string;
  minimum_projected_cash: string;
  lowest_cash_week: number;
  minimum_cash_threshold: string;
  first_threshold_breach_week: number | null;
  scenario: null | { id: string; name: string };
  weekly: ForecastWeek[];
};

export function ForecastWorkspace({ userId }: { userId: string }) {
  return (
    <CompanyScope userId={userId} title="Cash forecast">
      {(company) => <ForecastPanel company={company} />}
    </CompanyScope>
  );
}

export function ForecastPanel({ company }: { company: Company }) {
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [weeks, setWeeks] = useState(13);
  const [query, setQuery] = useState(`start_date=${start}&weeks=13`);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    data?: ForecastResult;
    error?: string;
    loading: boolean;
  }>({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<ForecastResult>(
      `/companies/${company.id}/cash-forecast?${query}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            error:
              error instanceof Error
                ? error.message
                : "Forecast could not be loaded.",
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
        start_date: start,
        weeks: String(weeks),
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
          Forecast start
          <input
            className={inputClass}
            required
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Number of weeks
          <input
            className={inputClass}
            required
            type="number"
            min="1"
            max="26"
            value={weeks}
            onChange={(event) => setWeeks(Number(event.target.value))}
          />
        </label>
        <button className={buttonClass} disabled={state.loading}>
          Update forecast
        </button>
      </form>
      {state.loading ? (
        <p role="status">Loading forecast…</p>
      ) : state.error ? (
        <p role="alert" className={panelClass}>
          {state.error}{" "}
          <Link href="/cash" className="underline">
            Manage cash records
          </Link>
        </p>
      ) : (
        state.data && <ForecastView data={state.data} />
      )}
    </div>
  );
}

export function ForecastView({ data }: { data: ForecastResult }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <section className={panelClass}>
          <h2 className="font-semibold">Opening cash</h2>
          <p className="mt-3 text-2xl">
            {money(data.opening_cash, data.currency)}
          </p>
          <p className="mt-2 text-sm">Balance dated {data.balance_date}</p>
        </section>
        <section className={panelClass}>
          <h2 className="font-semibold">Minimum projected cash</h2>
          <p className="mt-3 text-2xl">
            {money(data.minimum_projected_cash, data.currency)}
          </p>
          <p className="mt-2 text-sm">
            Lowest closing cash: week {data.lowest_cash_week}
          </p>
        </section>
        <section className={panelClass}>
          <h2 className="font-semibold">First threshold breach</h2>
          <p className="mt-3 text-2xl">
            {data.first_threshold_breach_week === null
              ? "None"
              : `Week ${data.first_threshold_breach_week}`}
          </p>
          <p className="mt-2 text-sm">
            Threshold: {money(data.minimum_cash_threshold, data.currency)}
          </p>
        </section>
      </div>
      {data.balance_date < data.start_date && (
        <p className="rounded-xl bg-[#fff5e8] p-4 text-sm">
          Opening cash uses the latest balance on or before the start date.
          Earlier cash items are not rolled forward. Add a current opening
          balance for a current forecast.
        </p>
      )}
      {data.first_threshold_breach_week !== null && (
        <p role="status" className="rounded-xl bg-[#fff0e5] p-4">
          Projected closing cash first falls below the minimum threshold in week{" "}
          {data.first_threshold_breach_week}.
        </p>
      )}
      <CashChart data={data} />
      <ForecastTable data={data} />
    </div>
  );
}

export function CashChart({ data }: { data: ForecastResult }) {
  const values = data.weekly.map((week) => Number(week.closing_cash));
  const threshold = Number(data.minimum_cash_threshold);
  const low = Math.min(0, threshold, ...values),
    high = Math.max(0, threshold, ...values);
  const span = Math.max(1, high - low);
  const y = (value: number) => 240 - ((value - low) / span) * 200;
  const x = (index: number) =>
    110 + (index / Math.max(1, values.length - 1)) * 650;
  return (
    <figure className={panelClass}>
      <figcaption className="text-xl font-semibold">
        Projected closing cash
      </figcaption>
      <svg
        role="img"
        aria-label="Weekly projected closing cash and minimum threshold; values are listed in the forecast table"
        viewBox="0 0 800 280"
        className="mt-4 w-full"
      >
        <text x="0" y="44" fontSize="12">
          {money(high)}
        </text>
        <text x="0" y="240" fontSize="12">
          {money(low)}
        </text>
        <line
          x1="110"
          x2="760"
          y1={y(threshold)}
          y2={y(threshold)}
          stroke="#aa593b"
          strokeDasharray="6 4"
        />
        <polyline
          points={values
            .map((value, index) => `${x(index)},${y(value)}`)
            .join(" ")}
          fill="none"
          stroke="#164d3b"
          strokeWidth="3"
        />
        {values.map((value, index) => (
          <g key={index}>
            <circle
              cx={x(index)}
              cy={y(value)}
              r="4"
              fill={
                data.weekly[index].threshold_breached ? "#aa593b" : "#164d3b"
              }
            />
            <text x={x(index)} y="270" fontSize="11" textAnchor="middle">
              {index + 1}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-xs text-[#53675d]">
        Week number · Dashed line: minimum cash threshold
      </p>
    </figure>
  );
}

export function ForecastTable({ data }: { data: ForecastResult }) {
  return (
    <section className={panelClass}>
      <h2 className="text-xl font-semibold">Weekly forecast</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "Week",
                "Dates",
                "Opening",
                "Inflows",
                "Outflows",
                "Closing",
                "Threshold",
              ].map((label) => (
                <th scope="col" key={label} className="border-b p-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.weekly.map((week) => (
              <tr
                key={week.week_number}
                className={week.threshold_breached ? "bg-[#fff5e8]" : ""}
              >
                <th scope="row" className="border-b p-3">
                  {week.week_number}
                </th>
                <td className="border-b p-3 whitespace-nowrap">
                  {week.week_start} – {week.week_end}
                </td>
                {[
                  week.opening_cash,
                  week.inflows,
                  week.outflows,
                  week.closing_cash,
                ].map((value, index) => (
                  <td key={index} className="border-b p-3 whitespace-nowrap">
                    {money(value, data.currency)}
                  </td>
                ))}
                <td className="border-b p-3">
                  {week.threshold_breached
                    ? "Below minimum"
                    : "Within threshold"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
