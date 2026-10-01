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
Phase 11: commit `7b1cab7`, production and CI success, 119 backend and 18 frontend tests.

Phase 12 adds cached fact-backed insights, optional Groq prioritization, and
deterministic fallback for missing credentials and provider failures.
Phase 12: commit `e301840`, production Ready and CI success, 129 backend and 19 frontend tests.

Phase 13 adds formatted, formula-safe eight-sheet Excel reports, private storage,
five-minute signed downloads, status metadata, and report management.
Phase 13: commit `f621452`, production and CI success, 135 backend and 20 frontend tests.

Phase 14 audits ownership, private storage, bearer authentication, input bounds,
logging, caching, safe Excel output, retries, and deletion semantics. Confirmed
issues have regression tests; see `SECURITY.md`.
Checks: 147 backend and 21 frontend tests, lint/typecheck, and read-only live
RLS, bucket privacy, and import-function inspection.
Phase 14: commit `b880f73`, production and both CI jobs success. Live table policies
also confirmed `auth.uid() = user_id` for each CRUD operation.

Phase 15 updates all READMEs, architecture, API/import/finance/deployment documentation,
populated demo CSVs, screenshot placeholders, and CI permissions/time bounds.
All local gates passed: Ruff, 148 backend tests, frontend lint/typecheck,
21 frontend tests, and an optimized Next.js build. Demo calculations are checked
by an automated test using the shipped samples.

Phase 15: commit `9175f44`, production and both CI jobs success.

Phase 16 finalizes the backend's production environment in the existing Services
project: explicit frontend origin, deterministic AI provider, model/timeout,
logging level, and a validated 1–5 MB import limit enforced throughout uploads.
Python 3.12 and the FastAPI entry point are pinned; Supabase settings remain private.
Local checks: Ruff and 153 backend tests passed.
Phase 16: commit `c012759`, production and CI success. Live health 200, private
API 401/no-store, allowed-origin preflight 200, and unexpected-origin preflight
400 without an allow-origin header were verified.

Phase 17 verifies frontend production settings, shared-domain API routing, and
Supabase's existing Site URL and confirmation/callback allowlist. It also updates
the landing page to describe the implemented workflow. Authenticated happy-path
verification depends on the user's confirmed account and remains tracked in Phase 18.
Frontend lint, typecheck, all 21 tests, and the optimized build passed. Live
`/dashboard` redirects an unauthenticated browser to `/login`, which renders
configured email/password fields without console warnings or errors. Phase 17's
authenticated acceptance checks are still pending; Phase 18 has not started.
Phase 17 deployment: commit `0a8411d`, Vercel production and both CI jobs success.
The updated landing page is visible in production; login/signup render without
console errors, and all nine protected workspace pages redirect signed-out users
to login. Email confirmation is enabled and anonymous sign-in is disabled.
The supplied account then logged in successfully, created `Phase 17 Demo`, and
rendered the protected variance, cash, forecast, scenarios, insights, and reports
pages. A no-data insight request returned the deterministic fallback without
browser console errors.

Continuation audit fix: monthly revenue, expense, and operating-profit series are
now calculated in the backend and rendered on the dashboard with exact-value rows
and a visual trend. Local checks: 154 backend tests and 21 frontend tests passed.

The latest continuation commit is `9d6033a`. Vercel production is Ready with
`AI_PROVIDER=groq` and a server-only Groq key configured. Fact-backed Groq output,
real CSV/XLSX processing, populated finance results, report download, cleanup, and
two-user isolation still require the Phase 18 data workflow.

The user's single-project deployment requirement applies throughout: Next.js and FastAPI
remain services of `flow-forecast`, at https://flow-forecast.vercel.app/.
