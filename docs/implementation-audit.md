# Implementation and working-condition audit

Audit date: October 1, 2026. Reviewed commit: `0369f315ce5797b8b7af11ac0058871ecbcf492f`.

Specification: `BUDGET_ACTUAL_CASHFLOW_CODEX_END_TO_END_PLAN.md`.
The user's subsequent requirement for one Vercel project overrides the plan's
two-project architecture. The plan was used as an audit checklist, not as new
authorization to run its embedded implementation prompts.

## Verdict

**The core application is implemented, passes its automated checks, and is deployed.
It is not yet fully complete against the plan or verified end to end in production.**

The remaining items include public-signup email configuration,
live Groq configuration/verification, and authenticated production acceptance tests.
Passing tests with mocked Supabase and Groq services does not prove the complete
production import-to-report flow.

## Confirmed gaps

1. **Monthly revenue/expense/profit chart was added in this continuation.** The
   backend now returns an exact monthly series and the dashboard renders a table
   and visual trend for revenue, expenses, and operating profit.
2. **Public signup is not ready for arbitrary email addresses.** The production
   Supabase SMTP settings were inspected during this audit: custom SMTP is off.
   Supabase's default sender only delivers to project-team addresses. Existing
   confirmed accounts may still log in; successful login was not exercised here.
   See [Supabase's SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp).
3. **Groq is implemented but disabled in production.** Production uses
   `AI_PROVIDER=none`; deterministic commentary is the configured behavior.
   Groq success/failure handling is covered by mocks, not a live provider call.
   Enabling it requires a server-side key and the provider setting, followed by
   deployment and a live test. No key was requested or exposed during this audit.
4. **Phase 17 authenticated checks and Phase 18 remain incomplete.** The Codex
   browser is still at the login form with no confirmed session available.
   Live company CRUD, three import/process flows, finance results, scenarios,
   insight output, private report generation/download, cleanup, and isolation
   between two actual users have not been verified as one production workflow.
   This is a verification gap, not evidence that all those features are broken.

## Fresh verification results

| Check | Result |
| --- | --- |
| Backend Ruff | Passed |
| Backend pytest | 153 passed |
| Frontend ESLint | Passed |
| Frontend TypeScript | Passed |
| Frontend Vitest | 21 passed across 11 files |
| Next.js optimized production build | Passed |
| Documented API operations vs application OpenAPI | All 35 method/path combinations present |
| GitHub Actions for reviewed commit | Success; run `36875416122` |
| Vercel status for reviewed commit | Success |
| Live homepage | HTTP 200 |
| Live backend health | HTTP 200, `{"status":"ok"}` |
| Missing bearer token | HTTP 401, safe JSON error and `private, no-store` |
| Invalid bearer token | HTTP 401 `AUTH_INVALID` |
| Unauthenticated companies/variance/forecast/report reads | HTTP 401 |
| Unauthenticated dashboard navigation | Redirected to `/login` |
| CORS preflight from production frontend | HTTP 200 and exact allowed origin |
| CORS preflight from another origin | HTTP 400, no allowed-origin header |
| Current browser login form | Renders; no authenticated session available |
| Current Supabase custom SMTP | Disabled |

The only backend test warning was a dependency deprecation warning concerning
Starlette's HTTPX test client. It did not fail tests.

## Coverage by phase

| Phase | Implementation evidence | Remaining qualification |
| --- | --- | --- |
| 0–1: scope and skeleton | Monorepo, Next.js, FastAPI, configuration, logging, errors, test setup | Present and building |
| 2: data/security/storage | Eight-table schema, indexes, CRUD RLS, composite ownership FKs, two private buckets, templates | Earlier live inspection recorded in SECURITY.md; live two-user behavior still pending |
| 3: authentication | Signup/login/logout, SSR cookies, refresh, bearer validation, protected layout | Public signup email configuration and successful production login remain open |
| 4: companies | Five CRUD API operations, selector and settings UI | Covered by mocks; authenticated live CRUD pending |
| 5–6: imports | Signed direct upload, completion, bounded parser, row errors, transactional processing and retry | Real production upload/process not yet exercised |
| 7: variance | Decimal arithmetic, favorability, zero-budget handling, profit, filters, tables/charts | Core calculation tests pass; percentage representation differs as noted below |
| 8: cash records | Balance/item CRUD, date conflict handling, filtering and pagination | Authenticated live CRUD pending |
| 9: forecasts | Opening snapshot, 1–26 weeks, roll-forward, threshold detection | Hand-calculated tests pass; live flow pending |
| 10: scenarios | CRUD, planned-only changes, delays, base/scenario comparison | Rule tests pass; live flow pending |
| 11: dashboard | Shared services, cards, account variance, monthly trend, cash charts, missing-data states | Authenticated live verification pending |
| 12: insights | Fact pack, private cache, Groq provider, deterministic fallback | Provider is disabled in production; real Groq request pending |
| 13: Excel | Eight sheets, formatting, safe cells, private storage, signed downloads, metadata | Workbook/mock tests pass; real generation/download pending |
| 14: hardening | Ownership, validation, private paths, bounds, safe errors and output, retry controls | Earlier live policy inspection plus automated tests; real two-user isolation pending |
| 15: CI/docs | CI gates, READMEs, methods, sample files and screenshot placeholders | Phase 18 results and authenticated screenshots not yet available |
| 16: backend deployment | Existing Vercel Services project, Python pin, production settings, live API checks | Passed |
| 17: frontend deployment | Deployed build, same-origin routing, Supabase URLs and protected redirects | Successful login and authenticated FastAPI calls pending |
| 18: production smoke test | Demo fixtures and expected results exist | Not completed |

## Documented differences from the literal specification

- One Vercel Services project is intentional and follows the user's later request.
- API financial values use decimal strings to preserve precision rather than the
  numeric JSON examples in the plan.
- The plan's variance-percent formula returns a ratio; the implementation returns
  percentage points (`-10` for a ten-percent unfavorable variance) and the UI
  appends `%`. The implementation is internally consistent and documented in
  `docs/variance-methodology.md`, but API consumers must use the implemented units.
- Report files are named `report.xlsx` instead of `management_report.xlsx`.
- Groq selects existing facts and review actions; the backend renders the wording.
  This prevents invented figures but is more constrained than free-form commentary.
- Backend modules are organized under `app/` rather than the illustrative nested
  `domain/` tree. Finance functions are still deterministic and independently tested.

## Evidence boundaries and completion work

The included demo test verifies revenue variance -10,000, expense variance +3,000,
profit variance -13,000, base minimum cash 95,000, and downside minimum cash 88,500
with the first threshold breach in week 2. These are local calculations over the
shipped fixtures, not results from production records.

The earlier production audit recorded all eight tables with ownership RLS, both
private buckets, and invoker-only import functions. This audit reviewed their SQL
and tests; it did not create two new users or mutate production data to retest RLS.

To meet the complete definition of done: configure SMTP for public signup;
finish authenticated Phase 17 checks;
then run Phase 18 sequentially, including real imports, report download, two-user
isolation, and cleanup. Enable and test Groq if the checklist's live-Groq item is
required; deterministic mode is already the configured fallback.

Production frontend: https://flow-forecast.vercel.app/

Production backend origin: https://flow-forecast.vercel.app (API prefix `/api/v1`).

No application code or production settings were changed by this audit.
