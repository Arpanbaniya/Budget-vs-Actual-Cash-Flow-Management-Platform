import { type FormEvent } from "react";

import { type Company } from "../lib/api";

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type CompanySettings = Pick<
  Company,
  "name" | "currency" | "fiscal_year_start_month" | "minimum_cash_threshold"
>;

type Props = {
  company?: Company;
  busy: boolean;
  onSave: (settings: CompanySettings) => Promise<void>;
};

const inputClass =
  "w-full rounded-xl border border-[#cbd7cd] bg-white px-4 py-3 outline-none focus:border-[#164d3b] focus:ring-2 focus:ring-[#b9d8c0]";

export function CompanyForm({ company, busy, onSave }: Props) {
  const prefix = company ? "settings" : "create";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    await onSave({
      name: String(values.get("name")).trim(),
      currency: String(values.get("currency")).trim().toUpperCase(),
      fiscal_year_start_month: Number(values.get("fiscal_year_start_month")),
      minimum_cash_threshold: String(values.get("minimum_cash_threshold")),
    });
  }
  return (
    <form
      onSubmit={submit}
      aria-label={company ? "Company settings" : "Create company"}
    >
      <fieldset
        disabled={busy}
        className="grid gap-5 disabled:opacity-60 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <label
            htmlFor={`${prefix}-name`}
            className="mb-2 block text-sm font-medium"
          >
            Company name
          </label>
          <input
            id={`${prefix}-name`}
            name="name"
            required
            maxLength={200}
            defaultValue={company?.name ?? ""}
            className={inputClass}
            placeholder="ABC Pvt Ltd"
          />
        </div>
        <div>
          <label
            htmlFor={`${prefix}-currency`}
            className="mb-2 block text-sm font-medium"
          >
            Currency code
          </label>
          <input
            id={`${prefix}-currency`}
            name="currency"
            required
            pattern="[A-Za-z]{3}"
            maxLength={3}
            defaultValue={company?.currency ?? "USD"}
            title="Three letters, such as NPR or USD"
            className={`${inputClass} uppercase`}
          />
          <p className="mt-2 text-xs text-[#53675d]">
            Three letters, such as NPR, USD, or INR.
          </p>
        </div>
        <div>
          <label
            htmlFor={`${prefix}-month`}
            className="mb-2 block text-sm font-medium"
          >
            Fiscal year starts
          </label>
          <select
            id={`${prefix}-month`}
            name="fiscal_year_start_month"
            defaultValue={company?.fiscal_year_start_month ?? 1}
            className={inputClass}
          >
            {MONTHS.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor={`${prefix}-threshold`}
            className="mb-2 block text-sm font-medium"
          >
            Minimum cash threshold
          </label>
          <input
            id={`${prefix}-threshold`}
            name="minimum_cash_threshold"
            type="number"
            required
            min="0"
            step="any"
            defaultValue={company?.minimum_cash_threshold ?? "0"}
            className={inputClass}
          />
          <p className="mt-2 text-xs text-[#53675d]">
            The minimum cash balance you want to maintain, in the company&apos;s
            currency.
          </p>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-[#164d3b] px-5 py-3 font-medium text-white hover:bg-[#0c3829] sm:col-span-2"
        >
          {busy ? "Saving…" : company ? "Save settings" : "Create company"}
        </button>
      </fieldset>
    </form>
  );
}
