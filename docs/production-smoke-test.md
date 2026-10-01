# Production smoke test

Run date: October 1, 2026

Target: [flow-forecast.vercel.app](https://flow-forecast.vercel.app/)

## Verified

- Production deployment is Ready on Vercel from the latest repository commit
  `d97cd37` (application code under test is `9d6033a`).
- GitHub Actions CI passed for that commit.
- The supplied account signed in successfully.
- A company named `Phase 17 Demo` was created with NPR currency and a 90,000
  minimum cash threshold.
- The protected variance, cash, forecast, scenarios, insights, and reports pages
  rendered while authenticated.
- An empty-data insight request returned the deterministic fallback and produced
  no browser console errors.
- Production environment configuration contains `AI_PROVIDER=groq` and a
  server-only `GROQ_API_KEY`.
- The shipped budget, actual, and cash CSVs processed successfully with no row
  errors.
- Production variance matched the fixture expectations: revenue `-10,000`,
  expenses `+3,000`, and operating profit `-13,000` NPR.
- The base forecast reached `95,000` NPR in week 2 without a threshold breach.
- The downside scenario reached `88,500` NPR in week 2 and breached the 90,000
  NPR threshold in week 2.
- A populated insight returned `provider=groq` with `fallback_used=false`.
- A private Excel report reached `ready`, its signed download succeeded, and the
  downloaded workbook contained all eight required sheets.

## Still required for the complete plan

- Verify a second account cannot read the first account's company or files.
- Configure custom SMTP if public signup must support arbitrary email addresses.
- Delete the temporary smoke-test company, imports, scenario, balance, and report
  after confirming the records to remove.

The temporary records remain in the supplied account because deleting production
data is permanent and requires confirmation at the deletion action.
