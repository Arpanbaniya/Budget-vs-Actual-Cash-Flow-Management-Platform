# Security

## Reporting a vulnerability

Use the repository's private security reporting channel when available. Do not
post credentials, financial records, signed URLs, or working exploit data in public
issues. Contact the repository owner privately if private reporting is unavailable.

## Controls

- FastAPI verifies bearer tokens with this project's Supabase Auth server. It
  uses the caller's JWT and publishable key for data and Storage operations.
  No service-role key or locally decoded unverified JWT authorizes requests.
- All eight application tables have owner RLS for select/insert/update/delete.
  Composite foreign keys prevent attaching another user's company or import.
  Backend queries explicitly scope owners and verify parent ownership too.
- Both Storage buckets are private. Object policies require the owning user UUID
  as the first path segment. Imports and reports validate their complete expected
  paths before accessing objects. Downloads are signed for five minutes.
- Import RPCs are security invoker functions with an empty search path, available
  to authenticated callers only. Row locks, tokens, and a ten-minute processing
  lease protect retries; derived-row replacement and completion are transactional.
- Uploads allow CSV/XLSX only, with a five MB limit verified at reservation,
  completion, and processing. Parsing has row, column, ZIP entry, expanded-size,
  formula, and macro limits. CSV is UTF-8; XLSX uses the first sheet.
- API financial writes reject non-finite or excessive amounts, invalid dates,
  unknown fields, null/empty patches, invalid statuses, and out-of-range scenarios.
  Forecast weeks are bounded to 1–26. Reads paginate internally and have limits.
- API responses containing auth/workspace information use `private, no-store`.
  CORS uses explicit origins, bearer headers, and no cross-origin credentials.
  The public health response carries no financial information.
- Errors expose stable codes and safe messages. Request logs record only route
  templates, methods, status, and timestamps. HTTP transport debug logging is
  disabled. Groq secrets are server-only, hidden in settings representations, and
  never returned. Environment variants are ignored by Git.
- Insight requests send calculated aggregates, never uploaded files or source
  transactions. Provider choices are validated against existing fact/action IDs.
  Model prose cannot introduce figures, causes, or investment advice.
- Excel output sanitizes user text and illegal XML characters; no formulas or
  macros are generated. High-precision amounts are text. Web money formatting
  preserves decimal strings; chart coordinates use approximate numeric scaling.
- Deletes remove private bytes before metadata and derived-row cascades. Failures
  preserve retryable entries. The UI requires confirmation for permanent deletes.

## Practical limits

Authenticated owners can edit their own data through Supabase's granted CRUD
policies. RLS isolates users; it does not protect a user from corrupting their own
records outside the application. Never share a valid signed download URL: anyone
holding it can download the corresponding file until expiry or object deletion.

Already-issued signed upload capabilities last two hours. A late upload after
reservation deletion can leave a private orphan. Storage/database deletion is
not one transaction; company/report/import cleanup can require retry. Imports
interrupted in processing can be retried after the lease expires. Interrupted
reports can be deleted after ten minutes and regenerated. There is no automatic
orphan sweep, background job system, application rate limiter, or enterprise audit
trail. Platform/Auth limits still apply. Keep deployment logs and account access
restricted. Use confirmed accounts and configure SMTP for public signup.

## Verification

Regression tests cover bearer rejection, owner scoping, parent ownership, private
paths, storage failures, date/amount bounds, non-cacheable auth responses,
safe Excel cells, retry-safe imports, scenario rules, and precision. Unit tests use
mock Supabase/Groq services; they do not prove live two-user isolation by themselves.
Record authenticated production checks separately in the smoke-test results.

Read-only production inspection on October 1, 2026 confirmed RLS on all eight
tables, four policies per table, private `fpna-imports` and `fpna-reports` buckets,
and `security_definer=false` for both import RPC functions.
