# Variance methodology — Phase 7

Only rows belonging to processed imports are analyzed. Date filters are inclusive
and apply to normalized monthly periods. Amounts use Python Decimal throughout;
API money and percentages are decimal strings, preserving database precision.
The browser formats values and chart coordinates; it does not calculate finance results.

Variance = actual − budget. Percentage = variance / abs(budget) × 100.
Zero budget yields a null percentage and an unbudgeted label, including zero actual.
Revenue and other income: positive variance is favorable. COGS, operating expenses,
and other expenses: negative variance is favorable. Zero variance is neutral.

Revenue includes revenue and other_income. Expenses include cogs, operating_expense,
and other_expense. Operating profit = revenue − expenses; its variance is actual
profit − budget profit. Signed imported amounts are retained, without sign conversion.

Account groups use account code and type; department/month groups also retain type
so income and expenses are never assigned an ambiguous favorability label.
All duplicate source lines contribute additively, including multiple processed imports.
Delete superseded imports before uploading replacements to avoid counting both versions.
Top unfavorable groups are sorted by absolute monetary variance, limited to ten.
Missing budget/actual groups use zero and the UI identifies missing comparison data.

GET `/api/v1/companies/{id}/variance?from=2026-01-01&to=2026-12-31&group_by=account`
accepts optional department and account/department/month grouping.
GET `/api/v1/companies/{id}/financial-lines` accepts the same date/department filters,
kind and account_type, page >= 1 and page_size 1–100. It returns items, total, page,
and page_size. Every request checks company ownership and uses the caller's JWT/RLS.
