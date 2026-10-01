# Scenarios — Phase 10

The `/scenarios` page supports create, list, edit, and confirmed deletion. Names are
required (maximum 200 characters). Adjustments are finite decimal percentages from
−100 through 500. Collection delay is an integer 0–365 days. POST/GET
`/api/v1/companies/{id}/scenarios` and GET/PATCH/DELETE `/api/v1/scenarios/{id}`
verify both record and parent-company ownership.

Forecast requests accept optional scenario_id. Only planned items change:
inflow amount × (1 + inflow percentage / 100), outflow amount × (1 + outflow percentage / 100).
Only planned inflow dates are delayed. Confirmed and actual items remain unchanged.
Transformations operate on copies; no source cash record is overwritten.
Delayed collections enter their adjusted weekly buckets, including receipts originally
before the start that move into the window. Dates outside the forecast window are
excluded. No rounding occurs before the weekly calculation.

The forecast page loads owned scenarios, displays the applied scenario name, and
compares base/scenario weekly closing cash and minima. Calculations stay in the backend.
Both forecasts use the same requested dates/weeks; separate reads can reflect intervening
edits, so refresh after changing source cash records.
