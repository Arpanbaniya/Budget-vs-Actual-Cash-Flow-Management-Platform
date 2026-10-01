"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, type Company } from "../lib/api";
import { ImportPanel } from "./import-panel";

export function ImportWorkspace({ userId }: { userId: string }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const selectionKey = `flow-forecast:company:${userId}`;

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<Company[]>("/companies", { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        let saved = "";
        try {
          saved = localStorage.getItem(selectionKey) ?? "";
        } catch {
          /* Use first company. */
        }
        const id = result.some((company) => company.id === saved)
          ? saved
          : (result[0]?.id ?? "");
        setCompanies(result);
        setSelectedId(id);
        try {
          localStorage.setItem(selectionKey, id);
        } catch {
          /* Selection works without storage. */
        }
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
  }, [selectionKey, retry]);

  const selected = companies.find((company) => company.id === selectedId);
  return (
    <div className="py-10 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#527254]">
            Company data
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Imports
          </h1>
          <p className="mt-3 max-w-xl leading-7 text-[#53675d]">
            Upload budget, actual, and cash files to your private workspace.
          </p>
        </div>
        {companies.length > 0 && (
          <div className="w-full sm:w-72">
            <label
              htmlFor="import-company"
              className="mb-2 block text-sm font-medium"
            >
              Selected company
            </label>
            <select
              id="import-company"
              value={selectedId}
              disabled={busy || loading}
              onChange={(event) => {
                setSelectedId(event.target.value);
                try {
                  localStorage.setItem(selectionKey, event.target.value);
                } catch {
                  /* Keep selection in memory. */
                }
              }}
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
      {loading ? (
        <p role="status" className="mt-8">
          Loading your companies…
        </p>
      ) : error ? (
        <div role="alert" className="mt-8 rounded-xl bg-[#fff6ef] p-4">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setLoading(true);
              setRetry((value) => value + 1);
            }}
            className="mt-3 underline"
          >
            Retry loading companies
          </button>
        </div>
      ) : selected ? (
        <ImportPanel
          key={selected.id}
          company={selected}
          busy={busy}
          onBusyChange={setBusy}
        />
      ) : (
        <section className="mt-8 rounded-3xl border border-[#d8e1d7] bg-white p-8">
          <h2 className="text-2xl font-semibold">Create a company first</h2>
          <p className="mt-3 text-[#53675d]">
            Each import belongs to one company.
          </p>
          <Link
            href="/companies"
            className="mt-6 inline-block rounded-xl bg-[#164d3b] px-5 py-3 font-medium text-white"
          >
            Create a company
          </Link>
        </section>
      )}
    </div>
  );
}
