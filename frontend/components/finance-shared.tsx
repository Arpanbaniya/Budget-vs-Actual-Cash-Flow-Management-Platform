"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { apiRequest, type Company } from "../lib/api";

export const panelClass = "rounded-3xl border border-[#d8e1d7] bg-white p-6";
export const inputClass =
  "rounded-xl border border-[#cbd7cd] bg-white px-3 py-2";
export const buttonClass =
  "rounded-xl bg-[#164d3b] px-4 py-2 text-white disabled:opacity-50";

export function money(value: string | number | null, currency?: string) {
  if (value === null) return "—";
  const formatter = new Intl.NumberFormat("en", {
    style: currency ? "currency" : "decimal",
    currency,
    maximumFractionDigits: 2,
  });
  // Modern Intl accepts exact decimal strings; the older TypeScript lib signature
  // excludes them. Keep the string intact instead of rounding through Number.
  const formatExact = formatter.format as (value: string | number) => string;
  return formatExact(value);
}

export function CompanyScope({
  userId,
  title,
  children,
}: {
  userId: string;
  title: string;
  children: (
    company: Company,
    busy: boolean,
    setBusy: (busy: boolean) => void,
  ) => ReactNode;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const key = `flow-forecast:company:${userId}`;
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<Company[]>("/companies", { signal: controller.signal })
      .then((rows) => {
        if (controller.signal.aborted) return;
        let saved = "";
        try {
          saved = localStorage.getItem(key) ?? "";
        } catch {}
        setCompanies(rows);
        setSelected(
          rows.some((row) => row.id === saved) ? saved : (rows[0]?.id ?? ""),
        );
        setError("");
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          error instanceof Error
            ? error.message
            : "Companies could not be loaded.",
        );
        setLoading(false);
      });
    return () => controller.abort();
  }, [key, retry]);
  const company = companies.find((row) => row.id === selected);
  return (
    <div className="py-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-semibold">{title}</h1>
        {companies.length > 0 && (
          <label className="grid gap-2 text-sm">
            Selected company
            <select
              className={inputClass}
              disabled={busy}
              value={selected}
              onChange={(event) => {
                setSelected(event.target.value);
                try {
                  localStorage.setItem(key, event.target.value);
                } catch {}
              }}
            >
              {companies.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {loading ? (
        <p role="status">Loading companies…</p>
      ) : error ? (
        <div role="alert">
          {error}
          <button
            className={`${buttonClass} ml-4`}
            onClick={() => {
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          >
            Retry
          </button>
        </div>
      ) : company ? (
        <div key={company.id}>{children(company, busy, setBusy)}</div>
      ) : (
        <p>
          Create a company to begin.{" "}
          <Link className="underline" href="/companies">
            Manage companies
          </Link>
        </p>
      )}
    </div>
  );
}

export function BudgetChart({
  rows,
}: {
  rows: { label: string; budget_amount: string; actual_amount: string }[];
}) {
  const values = rows.slice(0, 12);
  const max = Math.max(
    1,
    ...values.flatMap((row) => [
      Math.abs(Number(row.budget_amount)),
      Math.abs(Number(row.actual_amount)),
    ]),
  );
  return (
    <figure className={panelClass}>
      <figcaption className="mb-4 text-xl font-semibold">
        Budget vs actual{" "}
        <span className="text-sm font-normal">
          · Budget (green), actual (gold)
        </span>
      </figcaption>
      <svg
        role="img"
        aria-label="Budget versus actual amounts; values are listed in the variance table"
        viewBox={`0 0 800 ${Math.max(60, values.length * 55)}`}
        className="w-full"
      >
        <line
          x1="420"
          x2="420"
          y1="0"
          y2={values.length * 55}
          stroke="#b8c6bb"
        />
        {values.map((row, index) => (
          <g key={`${row.label}-${index}`}>
            <text x="0" y={index * 55 + 26} fontSize="13">
              {row.label.slice(0, 26)}
            </text>
            {[row.budget_amount, row.actual_amount].map((value, n) => {
              const width = (Math.abs(Number(value)) / max) * 340;
              return (
                <rect
                  key={n}
                  x={Number(value) < 0 ? 420 - width : 420}
                  y={index * 55 + n * 20 + 3}
                  width={width}
                  height="16"
                  fill={n ? "#bb963f" : "#164d3b"}
                />
              );
            })}
          </g>
        ))}
      </svg>
      {rows.length > 12 && (
        <p className="text-xs">
          Showing the first 12 groups. All groups are in the table.
        </p>
      )}
    </figure>
  );
}
