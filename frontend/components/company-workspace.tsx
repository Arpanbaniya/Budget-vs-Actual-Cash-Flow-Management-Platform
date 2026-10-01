"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiRequest, type Company } from "../lib/api";
import { CompanyForm, type CompanySettings, MONTHS } from "./company-form";

const panelClass =
  "rounded-[1.5rem] border border-[#d8e1d7] bg-white p-6 sm:p-8";

export function CompanyWorkspace({
  mode,
  userId,
}: {
  mode: "manage" | "dashboard";
  userId: string;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [createVersion, setCreateVersion] = useState(0);
  const [retryVersion, setRetryVersion] = useState(0);
  const selectionKey = `flow-forecast:company:${userId}`;
  const selected = companies.find((company) => company.id === selectedId);

  const choose = useCallback(
    (id: string) => {
      setSelectedId(id);
      setConfirmDelete(false);
      try {
        localStorage.setItem(selectionKey, id);
      } catch {
        /* Selection still works without storage. */
      }
    },
    [selectionKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<Company[]>("/companies", { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setCompanies(result);
        setLoadFailed(false);
        let saved = "";
        try {
          saved = localStorage.getItem(selectionKey) ?? "";
        } catch {
          /* Use the first company. */
        }
        choose(
          result.some((company) => company.id === saved)
            ? saved
            : (result[0]?.id ?? ""),
        );
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadFailed(true);
          setError(
            error instanceof Error
              ? error.message
              : "Companies could not be loaded.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [choose, selectionKey, retryVersion]);

  async function save(settings: CompanySettings, id?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const company = await apiRequest<Company>(
        id ? `/companies/${id}` : "/companies",
        {
          method: id ? "PATCH" : "POST",
          body: JSON.stringify(settings),
        },
      );
      setCompanies((current) =>
        id
          ? current.map((item) => (item.id === id ? company : item))
          : [...current, company],
      );
      choose(company.id);
      if (!id) setCreateVersion((version) => version + 1);
      setNotice(
        id ? "Company settings saved." : "Company created. It is now selected.",
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Company could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest<void>(`/companies/${selected.id}`, { method: "DELETE" });
      const remaining = companies.filter(
        (company) => company.id !== selected.id,
      );
      setCompanies(remaining);
      choose(remaining[0]?.id ?? "");
      setNotice("Company and its associated records and files deleted.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Company could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="py-10 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#407a5e]">
            Private workspace
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            {mode === "manage" ? "Your companies" : "Company overview"}
          </h1>
          <p className="mt-3 max-w-xl leading-7 text-[#53675d]">
            {mode === "manage"
              ? "Set the currency, fiscal year, and cash threshold for each company."
              : "Choose a company to view its planning settings."}
          </p>
        </div>
        {companies.length > 0 && (
          <div className="w-full sm:w-72">
            <label
              htmlFor="company-selector"
              className="mb-2 block text-sm font-medium"
            >
              Selected company
            </label>
            <select
              id="company-selector"
              value={selectedId}
              disabled={busy || loading}
              onChange={(event) => choose(event.target.value)}
              className="w-full rounded-xl border border-[#cbd7cd] bg-white px-4 py-3"
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-[#e6c6ae] bg-[#fff6ef] p-4 text-sm text-[#794a2c]"
        >
          {error}{" "}
          {error.toLowerCase().includes("sign in") && (
            <Link href="/login" className="ml-2 underline">
              Sign in
            </Link>
          )}
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="mt-6 rounded-xl bg-[#eaf3e7] p-4 text-sm text-[#244a38]"
        >
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status" className="mt-10 text-[#53675d]">
          Loading your companies…
        </p>
      ) : loadFailed ? (
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            setRetryVersion((version) => version + 1);
          }}
          className="mt-6 rounded-xl border border-[#cbd7cd] bg-white px-4 py-2"
        >
          Retry loading companies
        </button>
      ) : mode === "dashboard" ? (
        selected ? (
          <section className={`${panelClass} mt-8`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold">{selected.name}</h2>
              <Link
                href="/companies"
                className="rounded-xl border border-[#cbd7cd] px-4 py-2 text-sm font-medium hover:bg-[#f3f7f1]"
              >
                Edit company settings
              </Link>
            </div>
            <dl className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ["Currency", selected.currency],
                [
                  "Fiscal year starts",
                  MONTHS[selected.fiscal_year_start_month - 1],
                ],
                [
                  "Minimum cash threshold",
                  `${selected.currency} ${selected.minimum_cash_threshold}`,
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-[#f3f7f1] p-5">
                  <dt className="text-sm text-[#53675d]">{label}</dt>
                  <dd className="mt-2 break-words text-xl font-semibold">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 text-sm leading-6 text-[#53675d]">
              Upload your budget, actual, or cash files to prepare your company
              data. Financial summaries will appear when file processing is
              added.
            </p>
            <Link
              href="/imports"
              className="mt-4 inline-block rounded-xl bg-[#164d3b] px-5 py-3 font-medium text-white"
            >
              Upload company files
            </Link>
          </section>
        ) : (
          <section className={`${panelClass} mt-8`}>
            <h2 className="text-2xl font-semibold">
              Start with your first company
            </h2>
            <p className="mt-3 text-[#53675d]">
              Create a company to organize your finance planning.
            </p>
            <Link
              href="/companies"
              className="mt-6 inline-block rounded-xl bg-[#164d3b] px-5 py-3 font-medium text-white"
            >
              Create a company
            </Link>
          </section>
        )
      ) : (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-6">
            <section className={panelClass}>
              <h2 className="text-xl font-semibold">Company list</h2>
              {companies.length === 0 ? (
                <p className="mt-4 leading-6 text-[#53675d]">
                  No companies yet. Create your first company below.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {companies.map((company) => (
                    <li key={company.id}>
                      <button
                        type="button"
                        aria-pressed={company.id === selectedId}
                        disabled={busy}
                        onClick={() => choose(company.id)}
                        className={`w-full rounded-xl border p-4 text-left ${company.id === selectedId ? "border-[#407a5e] bg-[#eef5eb]" : "border-[#d8e1d7] hover:bg-[#f6f7f4]"}`}
                      >
                        <span className="block break-words font-medium">
                          {company.name}
                        </span>
                        <span className="mt-1 block text-sm text-[#53675d]">
                          {company.currency} · Fiscal year starts in{" "}
                          {MONTHS[company.fiscal_year_start_month - 1]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className={panelClass}>
              <h2 className="mb-6 text-xl font-semibold">Create a company</h2>
              <CompanyForm
                key={createVersion}
                busy={busy}
                onSave={(settings) => save(settings)}
              />
            </section>
          </div>
          {selected ? (
            <section className={panelClass}>
              <h2 className="mb-2 break-words text-2xl font-semibold">
                Settings for {selected.name}
              </h2>
              <p className="mb-6 text-sm text-[#53675d]">
                Changes apply to the selected company.
              </p>
              <CompanyForm
                key={`${selected.id}:${selected.updated_at}`}
                company={selected}
                busy={busy}
                onSave={(settings) => save(settings, selected.id)}
              />
              <div className="mt-8 border-t border-[#d8e1d7] pt-6">
                <h3 className="font-semibold">Delete company</h3>
                <p className="mt-2 text-sm leading-6 text-[#53675d]">
                  This permanently removes the company, its financial records,
                  and its private import and report files.
                </p>
                {confirmDelete ? (
                  <div className="mt-4 rounded-xl border border-[#e6c6ae] bg-[#fff6ef] p-4">
                    <p className="text-sm font-medium">
                      Permanently delete {selected.name}?
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove()}
                        className="rounded-xl bg-[#8b372c] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {busy ? "Deleting…" : "Permanently delete"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmDelete(false)}
                        className="rounded-xl border border-[#cbd7cd] bg-white px-4 py-2 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                    className="mt-4 rounded-xl border border-[#e6c6ae] px-4 py-2 text-sm font-medium text-[#8b372c]"
                  >
                    Delete company
                  </button>
                )}
              </div>
            </section>
          ) : (
            <section className={`${panelClass} border-dashed`}>
              <h2 className="text-xl font-semibold">Company settings</h2>
              <p className="mt-3 leading-6 text-[#53675d]">
                Create or select a company to edit its settings.
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
