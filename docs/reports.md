# Private Excel reports

`POST /api/v1/companies/{id}/reports/excel` takes `from`, `to`,
`cash_start_date`, and optional owned `scenario_id`. A dated opening balance is
required. It generates Executive Summary, Variance Analysis, Department Analysis,
Cash Forecast, Scenario, Source Budget, Source Actual, and Source Cash sheets.

The report reuses variance and forecast services. Financial sources cover the
selected period. Cash sources cover the 13-week window and, for delayed scenarios,
the earlier days that can move into that window. Source Cash retains original
dates and amounts; scenario adjustments appear in Cash Forecast. Only planned
items change. Data reads are not a single database snapshot; avoid edits during
generation if an exact point-in-time reconciliation is needed.

Each sheet records company, financial period, currency, and UTC generation time,
with styled/frozen headers, filters, and column widths. User text is sanitized for
formula injection and illegal XML characters. No formulas or macros are emitted.
Amounts with more than 15 significant digits are stored as text to preserve their
value beyond Excel's numeric precision. Limits: 100,000 source rows and 20 MB output.

Files use the private `fpna-reports` bucket and an exact
`user/company/report/report.xlsx` path. Metadata records generating/ready/failed.
Generation failures retain a readable failed entry and attempt object cleanup.
Interrupted generating entries may be deleted after ten minutes.

`GET /api/v1/companies/{id}/reports?page=1&page_size=20` lists metadata.
`GET /api/v1/reports/{id}` returns a fresh signed download URL valid for 300
seconds when ready. URLs are not stored in metadata. Keep them private: anyone
holding a still-valid URL can download that file. `DELETE /api/v1/reports/{id}`
removes the object before metadata; a storage failure preserves the entry for retry.

The `/reports` page supports generation, pagination, link refresh, download, and
confirmed permanent deletion. Existing signed URLs expire naturally; deleting the
file prevents later downloads. See [Supabase signed URLs](https://supabase.com/docs/reference/python/storage-from-createsignedurl).
