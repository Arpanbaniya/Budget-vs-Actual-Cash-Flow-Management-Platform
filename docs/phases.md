# Sequential implementation progress

Each phase is implemented, checked, committed, and deployed before the next begins.
Phases 0–5 are complete. Phase 6 adds CSV/XLSX validation and transactional processing.
The production migration `20261001060000_import_processing.sql` was applied on October 1, 2026.
Phase 6: commit `79f1039`, production Ready, GitHub CI success, 80 backend and
12 frontend tests; parser and processing controls verified.

Phase 7 adds deterministic variance aggregation and the `/variance` page.
Phase 7: commit `f01d1b3`, production and CI success, 93 backend and 13 frontend
tests; variance forms, table, and chart verified in the browser.

Phase 8 adds cash-balance and cash-item CRUD and the `/cash` page.
Phase 8: commit `269ca74`, production and both CI jobs success, 104 backend and
14 frontend tests. Imported cash-item edits verified in the browser.

Phase 9 adds the weekly cash forecast and threshold alerts.
Phase 9: commits `c7e8369`–`5393694`, production and CI success, 108 backend and
15 frontend tests. Forecast chart, table, and threshold warnings verified.

Phase 10 adds owned scenarios and base/scenario forecast comparison.
Phase 10: commit `517a87c`, production and CI success, 117 backend and 17 frontend tests.

Phase 11 adds the composed financial dashboard with period/scenario filters,
financial and cash cards, shared charts, top variances, and missing-data guidance.

The user's single-project deployment requirement applies throughout: Next.js and FastAPI
remain services of `flow-forecast`, at https://flow-forecast.vercel.app/.
