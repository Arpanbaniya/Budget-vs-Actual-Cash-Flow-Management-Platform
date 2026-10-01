# Production smoke test

Run date: October 1, 2026

Target: [flow-forecast.vercel.app](https://flow-forecast.vercel.app/)

## Verified

- Production deployment is Ready on Vercel from commit `9d6033a`.
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

## Still required for the complete plan

- Upload and process the shipped budget, actual, and cash CSV samples.
- Verify populated variance, cash forecast, scenario, dashboard, and insight
  results against the documented expected values.
- Verify a private Excel report is generated and downloadable.
- Verify a second account cannot read the first account's company or files.
- Configure custom SMTP if public signup must support arbitrary email addresses.

The in-app browser file chooser did not accept the local sample files during this
run, so these data-dependent steps are intentionally left unclaimed. The demo
company remains in the supplied account because deleting it is permanent and
requires confirmation at the deletion action.
