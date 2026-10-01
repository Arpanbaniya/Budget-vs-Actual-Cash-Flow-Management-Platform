# Financial dashboard

`GET /api/v1/companies/{id}/dashboard` takes `from`, `to`, optional
`cash_start_date` (today by default), and optional owned `scenario_id`.
It reuses the variance and 13-week forecast services. All amounts remain decimal
strings in JSON. Revenue, expenses, operating profit, top unfavorable account
variances, and chart series use only processed imports in the selected period.

Latest cash means the newest snapshot on or before the forecast start. It is
used directly, without rolling forward earlier cash items. The dashboard keeps
financial data visible when a cash snapshot is missing and links to cash entry.
Missing budget or actual amounts are zero and visibly flagged. Invalid scenarios
and service failures remain errors; they are not treated as missing data.

The `/dashboard` page supports period, cash-start, and scenario controls, summary
cards, charts, a top variance table, and a weekly cash table.
