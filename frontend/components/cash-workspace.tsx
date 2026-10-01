"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiRequest, type Company } from "../lib/api";
import {
  CompanyScope,
  buttonClass,
  inputClass,
  money,
  panelClass,
} from "./finance-shared";

export type CashBalance = {
  id: string;
  balance_date: string;
  amount: string;
  note: string | null;
};
export type CashItem = {
  id: string;
  expected_date: string;
  description: string;
  category: string;
  direction: "inflow" | "outflow";
  amount: string;
  status: "planned" | "confirmed" | "actual";
  import_id: string | null;
};
type Page<T> = { items: T[]; total: number; page: number; page_size: number };

export function CashWorkspace({ userId }: { userId: string }) {
  return (
    <CompanyScope userId={userId} title="Cash records">
      {(company, busy, setBusy) => (
        <CashPanel company={company} busy={busy} setBusy={setBusy} />
      )}
    </CompanyScope>
  );
}

function CashPanel({
  company,
  busy,
  setBusy,
}: {
  company: Company;
  busy: boolean;
  setBusy: (value: boolean) => void;
}) {
  const [balances, setBalances] = useState<Page<CashBalance>>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
  });
  const [items, setItems] = useState<Page<CashItem>>({
    items: [],
    total: 0,
    page: 1,
    page_size: 50,
  });
  const [balancePage, setBalancePage] = useState(1);
  const [itemPage, setItemPage] = useState(1);
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState(0);
  const [balanceFormVersion, setBalanceFormVersion] = useState(0);
  const [itemFormVersion, setItemFormVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [balanceEdit, setBalanceEdit] = useState<CashBalance | null>(null);
  const [itemEdit, setItemEdit] = useState<CashItem | null>(null);
  const [remove, setRemove] = useState<{
    id: string;
    resource: "cash-balances" | "cash-items";
  } | null>(null);
  const root = `/companies/${company.id}`;
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiRequest<Page<CashBalance>>(
        `${root}/cash-balances?page=${balancePage}&page_size=20`,
        { signal: controller.signal },
      ),
      apiRequest<Page<CashItem>>(
        `${root}/cash-items?page=${itemPage}&page_size=50${query}`,
        { signal: controller.signal },
      ),
    ])
      .then(([balances, items]) => {
        if (controller.signal.aborted) return;
        setBalances(balances);
        setItems(items);
        setLoading(false);
        setError("");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          error instanceof Error
            ? error.message
            : "Cash records could not be loaded.",
        );
        setLoading(false);
      });
    return () => controller.abort();
  }, [root, balancePage, itemPage, query, version]);
  function refresh() {
    setLoading(true);
    setVersion((value) => value + 1);
  }
  async function save(
    resource: "cash-balances" | "cash-items",
    body: Record<string, string>,
    id?: string,
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(id ? `/${resource}/${id}` : `${root}/${resource}`, {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      if (resource === "cash-balances") {
        setBalanceEdit(null);
        setBalanceFormVersion((value) => value + 1);
      } else {
        setItemEdit(null);
        setItemFormVersion((value) => value + 1);
      }
      setNotice("Cash record saved.");
      refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Saving failed.");
    } finally {
      setBusy(false);
    }
  }
  async function deleteRecord() {
    if (!remove) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/${remove.resource}/${remove.id}`, {
        method: "DELETE",
      });
      if (balanceEdit?.id === remove.id) setBalanceEdit(null);
      if (itemEdit?.id === remove.id) setItemEdit(null);
      setRemove(null);
      setNotice("Cash record deleted.");
      refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Deletion failed.");
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || loading;
  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-xl bg-[#fff0e5] p-4">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-[#edf3e9] p-4">
          {notice}
        </p>
      )}
      {remove && (
        <div className={`${panelClass} bg-[#fff6ef]`}>
          <p>Permanently delete this cash record?</p>
          <div className="mt-3 flex gap-4">
            <button
              disabled={busy}
              onClick={() => void deleteRecord()}
              className={buttonClass}
            >
              Confirm deletion
            </button>
            <button
              disabled={busy}
              onClick={() => setRemove(null)}
              className="underline"
            >
              Cancel deletion
            </button>
          </div>
        </div>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <BalanceForm
          key={`balance-${balanceEdit?.id ?? "new"}-${balanceFormVersion}`}
          initial={balanceEdit}
          disabled={disabled}
          onSave={(body) => void save("cash-balances", body, balanceEdit?.id)}
          onCancel={() => setBalanceEdit(null)}
        />
        <CashItemForm
          key={`item-${itemEdit?.id ?? "new"}-${itemFormVersion}`}
          initial={itemEdit}
          disabled={disabled}
          onSave={(body) => void save("cash-items", body, itemEdit?.id)}
          onCancel={() => setItemEdit(null)}
        />
      </div>
      <section className={panelClass}>
        <div className="flex justify-between gap-4">
          <h2 className="text-xl font-semibold">Cash balances</h2>
          <button className="underline" disabled={disabled} onClick={refresh}>
            Refresh records
          </button>
        </div>
        <p className="mt-2 text-sm text-[#53675d]">
          A balance is a dated snapshot. Negative balances are allowed for
          overdrafts.
        </p>
        {loading ? (
          <p role="status" className="mt-4">
            Loading cash records…
          </p>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {["Date", "Amount", "Note", "Actions"].map((label) => (
                      <th scope="col" key={label} className="border-b p-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {balances.items.map((row) => (
                    <tr key={row.id}>
                      <td className="border-b p-3">{row.balance_date}</td>
                      <td className="border-b p-3 whitespace-nowrap">
                        {money(row.amount, company.currency)}
                      </td>
                      <td className="border-b p-3">{row.note || "—"}</td>
                      <td className="border-b p-3">
                        <div className="flex gap-3">
                          <button
                            disabled={disabled}
                            className="underline"
                            aria-label={`Edit balance ${row.balance_date}`}
                            onClick={() => setBalanceEdit(row)}
                          >
                            Edit
                          </button>
                          <button
                            disabled={disabled}
                            className="underline text-[#8b372c]"
                            aria-label={`Delete balance ${row.balance_date}`}
                            onClick={() =>
                              setRemove({
                                id: row.id,
                                resource: "cash-balances",
                              })
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!balances.total && <p className="mt-4">No cash balances yet.</p>}
            <Pagination
              page={balancePage}
              total={balances.total}
              pageSize={20}
              disabled={disabled}
              label="balances"
              onChange={(page) => {
                setBalancePage(page);
                setLoading(true);
              }}
            />
          </>
        )}
      </section>
      <section className={panelClass}>
        <h2 className="text-xl font-semibold">Cash items</h2>
        <p className="mt-2 text-sm text-[#53675d]">
          Manual and imported items. Editing an imported item retains its source
          import.
        </p>
        <form
          className="mt-5 flex flex-wrap items-end gap-3"
          aria-label="Filter cash items"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const filters = new URLSearchParams();
            for (const [key, value] of form.entries())
              if (String(value).trim()) filters.set(key, String(value).trim());
            setQuery(`&${filters}`);
            setItemPage(1);
            refresh();
          }}
        >
          <label className="grid gap-2 text-sm">
            From
            <input type="date" name="from" className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm">
            To
            <input type="date" name="to" className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm">
            Direction
            <select name="direction" className={inputClass}>
              <option value="">All</option>
              <option>inflow</option>
              <option>outflow</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Status
            <select name="status" className={inputClass}>
              <option value="">All</option>
              <option>planned</option>
              <option>confirmed</option>
              <option>actual</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Category
            <input name="category" maxLength={500} className={inputClass} />
          </label>
          <button className={buttonClass} disabled={disabled}>
            Apply cash filters
          </button>
        </form>
        {!loading && (
          <>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {[
                      "Date",
                      "Description / category",
                      "Direction",
                      "Amount",
                      "Status",
                      "Source",
                      "Actions",
                    ].map((label) => (
                      <th key={label} scope="col" className="border-b p-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.items.map((row) => (
                    <tr key={row.id}>
                      <td className="border-b p-3 whitespace-nowrap">
                        {row.expected_date}
                      </td>
                      <th scope="row" className="border-b p-3 font-normal">
                        {row.description}
                        <span className="block text-xs">{row.category}</span>
                      </th>
                      <td className="border-b p-3">{row.direction}</td>
                      <td className="border-b p-3 whitespace-nowrap">
                        {money(row.amount, company.currency)}
                      </td>
                      <td className="border-b p-3">{row.status}</td>
                      <td className="border-b p-3">
                        {row.import_id ? "Imported" : "Manual"}
                      </td>
                      <td className="border-b p-3">
                        <div className="flex gap-3">
                          <button
                            disabled={disabled}
                            className="underline"
                            aria-label={`Edit item ${row.description}`}
                            onClick={() => setItemEdit(row)}
                          >
                            Edit
                          </button>
                          <button
                            disabled={disabled}
                            className="underline text-[#8b372c]"
                            aria-label={`Delete item ${row.description}`}
                            onClick={() =>
                              setRemove({ id: row.id, resource: "cash-items" })
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!items.total && (
              <p className="mt-4">No cash items match these filters.</p>
            )}
            <Pagination
              page={itemPage}
              total={items.total}
              pageSize={50}
              disabled={disabled}
              label="items"
              onChange={(page) => {
                setItemPage(page);
                setLoading(true);
              }}
            />
          </>
        )}
      </section>
    </div>
  );
}

function formValues(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return Object.fromEntries(
    [...new FormData(event.currentTarget).entries()].map(([key, value]) => [
      key,
      String(value).trim(),
    ]),
  );
}

function BalanceForm({
  initial,
  disabled,
  onSave,
  onCancel,
}: {
  initial: CashBalance | null;
  disabled: boolean;
  onSave: (body: Record<string, string>) => void;
  onCancel: () => void;
}) {
  return (
    <form
      aria-label="Cash balance"
      className={panelClass}
      onSubmit={(event) => onSave(formValues(event))}
    >
      <h2 className="text-xl font-semibold">
        {initial ? "Edit cash balance" : "Add cash balance"}
      </h2>
      <fieldset disabled={disabled} className="mt-4 grid gap-4">
        <label className="grid gap-2 text-sm">
          Balance date
          {initial ? (
            <span>{initial.balance_date}</span>
          ) : (
            <input
              className={inputClass}
              name="balance_date"
              type="date"
              required
            />
          )}
        </label>
        <label className="grid gap-2 text-sm">
          Balance amount
          <input
            className={inputClass}
            name="amount"
            type="number"
            step="any"
            min="-100000000000000000000"
            max="100000000000000000000"
            required
            defaultValue={initial?.amount}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Balance note
          <input
            className={inputClass}
            name="note"
            maxLength={500}
            defaultValue={initial?.note ?? ""}
          />
        </label>
        <button className={buttonClass}>Save balance</button>
        {initial && (
          <button type="button" className="underline" onClick={onCancel}>
            Cancel balance edit
          </button>
        )}
      </fieldset>
    </form>
  );
}

function CashItemForm({
  initial,
  disabled,
  onSave,
  onCancel,
}: {
  initial: CashItem | null;
  disabled: boolean;
  onSave: (body: Record<string, string>) => void;
  onCancel: () => void;
}) {
  return (
    <form
      aria-label="Cash item"
      className={panelClass}
      onSubmit={(event) => onSave(formValues(event))}
    >
      <h2 className="text-xl font-semibold">
        {initial ? "Edit cash item" : "Add cash item"}
      </h2>
      <fieldset disabled={disabled} className="mt-4 grid gap-4">
        <label className="grid gap-2 text-sm">
          Expected date
          <input
            className={inputClass}
            name="expected_date"
            type="date"
            required
            defaultValue={initial?.expected_date}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Item description
          <input
            className={inputClass}
            name="description"
            required
            maxLength={500}
            defaultValue={initial?.description}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Item category
          <input
            className={inputClass}
            name="category"
            required
            maxLength={500}
            defaultValue={initial?.category}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Item direction
          <select
            className={inputClass}
            name="direction"
            defaultValue={initial?.direction ?? "inflow"}
          >
            <option>inflow</option>
            <option>outflow</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          Item amount
          <input
            className={inputClass}
            name="amount"
            type="number"
            step="any"
            min="0"
            max="100000000000000000000"
            required
            defaultValue={initial?.amount}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Item status
          <select
            className={inputClass}
            name="status"
            defaultValue={initial?.status ?? "planned"}
          >
            <option>planned</option>
            <option>confirmed</option>
            <option>actual</option>
          </select>
        </label>
        <button className={buttonClass}>Save cash item</button>
        {initial && (
          <button type="button" className="underline" onClick={onCancel}>
            Cancel item edit
          </button>
        )}
      </fieldset>
    </form>
  );
}

export function Pagination({
  page,
  total,
  pageSize,
  disabled,
  label,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  disabled: boolean;
  label: string;
  onChange: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
      <span>
        {total} {label} · page {page}
      </span>
      <button
        disabled={disabled || page === 1}
        className="underline disabled:opacity-40"
        onClick={() => onChange(page - 1)}
      >
        Previous {label}
      </button>
      <button
        disabled={disabled || page * pageSize >= total}
        className="underline disabled:opacity-40"
        onClick={() => onChange(page + 1)}
      >
        Next {label}
      </button>
    </div>
  );
}
