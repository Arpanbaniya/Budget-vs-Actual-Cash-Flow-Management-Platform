# Implementation and working-condition audit

Audit date: October 1, 2026. Reviewed commit: `d97cd3759aca470f694c84f575db4b27dd834a59`.

Specification: `BUDGET_ACTUAL_CASHFLOW_CODEX_END_TO_END_PLAN.md`.
The user's subsequent requirement for one Vercel project overrides the plan's
two-project architecture. The plan was used as an audit checklist, not as new
authorization to run its embedded implementation prompts.

## Verdict

**The core application is implemented, passes its automated checks, is deployed,
and the supplied-account production workflow is working end to end.**

The remaining qualification items are public-signup email configuration,
two-user isolation, and deleting the temporary smoke-test data. Passing tests
with mocked Supabase and Groq services does not replace those account-level
checks.

## Confirmed gaps

1. **Monthly revenue/expense/profit chart was added in this continuation.** The
   backend now returns an exact monthly series and the dashboard renders a table
   and visual trend for revenue, expenses, and operating profit.
2. **Public signup is not ready for arbitrary email addresses.** The production
   Supabase SMTP settings were inspected during this audit: custom SMTP is off.
   Supabase's default sender only delivers to project-team addresses. The supplied
   confirmed account can log in successfully. See [Supabase's SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp).
3. **Two-user isolation and cleanup remain open.** The complete import-to-report
   flow passed for the supplied account. A second confirmed account was not
   available for the cross-account read test, and the temporary demo records were
   left in place because deleting production data is permanent.

## Fresh verification results

| Check | Result |
| --- | --- |
| Backend Ruff | Passed |
| Backend pytest | 154 passed |
| Frontend ESLint | Passed |
| Frontend TypeScript | Passed |
| Frontend Vitest | 21 passed across 11 files |
| Next.js optimized production build | Passed |
| Documented API operations vs application OpenAPI | All 35 method/path combinations present |
| GitHub Actions for reviewed commit | Success; run `36888756743` |
| Vercel status for reviewed commit | Success |
| Live homepage | HTTP 200 |
| Live backend health | HTTP 200, `{"status":"ok"}` |
| Missing bearer token | HTTP 401, safe JSON error and `private, no-store` |
| Invalid bearer token | HTTP 401 `AUTH_INVALID` |
| Unauthenticated companies/variance/forecast/report reads | HTTP 401 |
| Unauthenticated dashboard navigation | Redirected to `/login` |
| CORS preflight from production frontend | HTTP 200 and exact allowed origin |
| CORS preflight from another origin | HTTP 400, no allowed-origin header |
| Authenticated production login | Passed with the supplied account |
| Authenticated company setup | Created and selected `Phase 17 Demo` |
| Protected workspace pages | Variance, cash, forecast, scenarios, insights, and reports rendered |
| Empty-data production insight | Safe deterministic fallback rendered; no console errors |
| Three demo imports | Budget, actual, and cash CSVs uploaded and processed with no row errors |
| Variance and monthly series | Revenue -10,000; expenses +3,000; profit -13,000; September series present |
| Base forecast | Minimum 95,000 in week 2; no threshold breach |
| Downside scenario | Minimum 88,500 in week 2; first threshold breach in week 2 |
| Fact-backed Groq insight | `provider=groq`, `fallback_used=false`, facts and review actions rendered |
| Private Excel report | Ready, downloaded successfully, 8 expected sheets present |
| Current Supabase custom SMTP | Disabled |

The only backend test warning was a dependency deprecation warning concerning
Starlette's HTTPX test client. It did not fail tests.

## Coverage by phase

| Phase | Implementation evidence | Remaining qualification |
| --- | --- | --- |
| 0–1: scope and skeleton | Monorepo, Next.js, FastAPI, configuration, logging, errors, test setup | Present and building |
| 2: data/security/storage | Eight-table schema, indexes, CRUD RLS, composite ownership FKs, two private buckets, templates | Earlier live inspection recorded in SECURITY.md; live two-user behavior still pending |
| 3: authentication | Signup/login/logout, SSR cookies, refresh, bearer validation, protected layout | Public signup email configuration remains open; supplied-account login passed |
| 4: companies | Five CRUD API operations, selector and settings UI | Authenticated create/select passed; full CRUD remains pending |
| 5–6: imports | Signed direct upload, completion, bounded parser, row errors, transactional processing and retry | Real production upload/process not yet exercised |
| 7: variance | Decimal arithmetic, favorability, zero-budget handling, profit, filters, tables/charts | Core calculation tests pass; percentage representation differs as noted below |
| 8: cash records | Balance/item CRUD, date conflict handling, filtering and pagination | Authenticated live CRUD pending |
| 9: forecasts | Opening snapshot, 1–26 weeks, roll-forward, threshold detection | Hand-calculated tests pass; live flow pending |
| 10: scenarios | CRUD, planned-only changes, delays, base/scenario comparison | Rule tests pass; live flow pending |
| 11: dashboard | Shared services, cards, account variance, monthly trend, cash charts, missing-data states | Authenticated live verification pending |
| 12: insights | Fact pack, private cache, Groq provider, deterministic fallback | Fact-backed Groq response passed; deterministic fallback also passed |
| 13: Excel | Eight sheets, formatting, safe cells, private storage, signed downloads, metadata | Production report generated, signed URL downloaded, and all 8 sheets verified |
| 14: hardening | Ownership, validation, private paths, bounds, safe errors and output, retry controls | Earlier live policy inspection plus automated tests; real two-user isolation pending |
| 15: CI/docs | CI gates, READMEs, methods, sample files and screenshot placeholders | Phase 18 results and authenticated screenshots not yet available |
| 16: backend deployment | Existing Vercel Services project, Python pin, production settings, live API checks | Passed |
| 17: frontend deployment | Deployed build, same-origin routing, Supabase URLs and protected redirects | Login, company setup, protected navigation, and empty-data insight fallback passed |
| 18: production smoke test | Demo fixtures and expected results exist | Supplied-account flow passed; second-user isolation and cleanup remain pending |

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
with the first threshold breach in week 2. The same values were verified against
the production records created by the smoke test.

The earlier production audit recorded all eight tables with ownership RLS, both
private buckets, and invoker-only import functions. This audit reviewed their SQL
and tests; it did not create two new users or mutate production data to retest RLS.

To meet the complete definition of done: configure SMTP for public signup, run
the second-user isolation check, and clean up the named smoke-test records after
confirmation. The Groq key, supported model, and provider setting are configured
and fact-backed output has passed in production.

Production frontend: https://flow-forecast.vercel.app/

Production backend origin: https://flow-forecast.vercel.app (API prefix `/api/v1`).

The production smoke test created `Phase 17 Demo` under the supplied account. It
was left in place because deleting a production company is permanent and requires
confirmation at the deletion action.
