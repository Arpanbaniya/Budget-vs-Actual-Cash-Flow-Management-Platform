# Budget vs Actual + Cash Flow Management
## Beginner Learning Guide

> This file is for **you**. Read the matching phase before asking Codex to implement it.

# 1. What the project solves

Many companies manage finance with several spreadsheets:

```text
Budget.xlsx
Actuals.xlsx
Cash_Forecast.xlsx
Management_Report.xlsx
```

Every month someone has to export accounting data, compare it with the budget, update cash forecasts, create charts, and explain the main differences to management.

This project centralizes that workflow:

```text
Budget + Actuals + Cash Plan
            ↓
       Data validation
            ↓
    Budget vs Actual
            ↓
   13-week cash forecast
            ↓
     Scenario planning
            ↓
 Management dashboard
            ↓
Groq explanation OR deterministic fallback
            ↓
      Excel report
```

Typical users are FP&A analysts, finance managers, CFOs, accountants, and business owners.

The system should answer:

- Is revenue above or below budget?
- Which department overspent?
- Which accounts caused the largest unfavorable variances?
- Is operating profit on plan?
- What will cash look like over the next 13 weeks?
- When might cash fall below the company's minimum threshold?
- What happens if collections arrive late or expenses increase?
- What should management investigate?

# 2. Input data

The MVP deliberately uses structured CSV/XLSX files instead of PDFs.

## Budget and Actual files

Required columns:

```text
period
department
account_code
account_name
account_type
amount
```

Example:

```csv
period,department,account_code,account_name,account_type,amount
2026-01,Sales,4000,Product Revenue,revenue,1000000
2026-01,Marketing,6100,Advertising,operating_expense,100000
2026-01,Operations,5000,Cost of Sales,cogs,550000
```

Allowed account types:

```text
revenue
cogs
operating_expense
other_income
other_expense
```

## Cash plan file

Required columns:

```text
expected_date
description
category
direction
amount
status
```

Example:

```csv
expected_date,description,category,direction,amount,status
2026-10-05,Customer collections,Customer receipts,inflow,500000,planned
2026-10-07,Payroll,Payroll,outflow,250000,confirmed
2026-10-10,Supplier payment,Suppliers,outflow,300000,planned
```

Direction:

```text
inflow
outflow
```

Status:

```text
planned
confirmed
actual
```

# 3. Budget vs Actual concepts

Budget = what management expected.

Actual = what really happened.

Variance:

```text
Variance = Actual - Budget
```

Variance percentage:

```text
Variance % = Variance / |Budget|
```

If budget is zero, the system must not divide by zero. It should return no percentage and label the item as unbudgeted.

## Favorability

For revenue and other income:

```text
Actual > Budget → favorable
Actual < Budget → unfavorable
```

For costs and expenses:

```text
Actual > Budget → unfavorable
Actual < Budget → favorable
```

This is why the software needs `account_type`.

A positive variance is not automatically good.

# 4. Operating profit

For this MVP:

```text
Total Revenue = Revenue + Other Income

Total Expenses =
COGS + Operating Expenses + Other Expenses

Operating Profit =
Total Revenue - Total Expenses
```

The system calculates budget operating profit, actual operating profit, and their variance.

# 5. 13-week cash forecast

Profit and cash are not the same.

The cash forecast works week by week:

```text
Opening Cash
+ Inflows
- Outflows
= Closing Cash
```

The next week's opening cash equals the previous week's closing cash.

The system calculates:

- projected closing cash each week
- minimum projected cash
- lowest-cash week
- first week below the minimum cash threshold

# 6. Cash threshold

A company may decide it wants at least:

```text
NPR 500,000
```

in cash.

If the forecast says:

```text
Week 7 closing cash = NPR 300,000
```

the system flags a threshold breach.

It should not automatically tell management to borrow, cut staff, or take any other action. It provides information for a human decision.

# 7. Scenario planning

A scenario changes assumptions.

Example downside scenario:

```text
planned inflows -10%
planned outflows +5%
planned customer collections delayed 7 days
```

Only `planned` cash items are adjusted.

`confirmed` and `actual` items stay unchanged.

This lets management compare:

```text
Base
Upside
Downside
```

# 8. What Groq does

Python calculates:

- variance
- variance %
- favorability
- operating profit
- cash forecast
- threshold breaches
- scenario results

Groq only receives these already-calculated facts and writes a clearer management explanation.

Example facts:

```text
Revenue variance = -9%
Marketing variance = +40% unfavorable
Operating profit variance = -22%
Minimum projected cash = 300,000
Threshold = 500,000
Threshold breach = Week 7
```

Groq may explain:

> Revenue is below budget while marketing expenditure is above budget. The 13-week cash forecast also shows a potential threshold breach in Week 7.

Groq is not the calculator.

# 9. Fallback agent

If Groq is disabled, missing, rate limited, or unavailable, normal Python rules create commentary.

Example:

```text
Revenue was 9% below budget.
Marketing was 40% above budget and classified as unfavorable.
Projected cash falls below the minimum threshold in Week 7.
```

The application therefore still works without AI.

# 10. System architecture

The system has four major parts:

```text
Next.js frontend
FastAPI backend
Supabase
Groq
```

## Next.js

Responsible for:

- login/signup screens
- dashboard
- uploads
- tables
- charts
- scenario forms
- report downloads

## FastAPI

Responsible for:

- API validation
- parsing CSV/XLSX
- variance calculations
- profit calculations
- cash forecasting
- scenarios
- Groq/fallback
- Excel report generation

## Supabase

Responsible for:

- user authentication
- PostgreSQL database
- private file storage

## Groq

Responsible only for optional written explanations.

# 11. Why two Vercel projects

One GitHub repository contains:

```text
frontend/
backend/
supabase/
docs/
```

Deployment:

```text
Vercel Project 1 → frontend/ → Next.js
Vercel Project 2 → backend/  → FastAPI
```

This cleanly separates the web app from the Python API.

# 12. Why uploads go directly to Supabase

We do not send Excel files through the Vercel backend upload request.

Instead:

```text
Browser
→ asks FastAPI for upload permission
→ receives temporary signed Supabase URL
→ uploads directly to private Supabase Storage
→ tells FastAPI upload finished
→ FastAPI downloads and processes file
```

This is better for a serverless deployment.

# 13. Phase 1 — Project skeleton

Codex creates the frontend/backend folders and basic health endpoint.

You learn:

- frontend vs backend
- monorepo structure
- environment variables
- local development

Done when:

```text
Next.js runs
FastAPI runs
GET /api/v1/health works
basic tests pass
```

# 14. Phase 2 — Supabase database and storage

Codex creates tables such as:

```text
companies
imports
financial_lines
cash_balances
cash_items
scenarios
analysis_results
reports
```

It also creates private storage buckets and Row Level Security.

You learn:

- table
- row
- primary key
- foreign key
- `user_id`
- RLS

Important idea:

```text
User A must never see User B's financial data.
```

# 15. Phase 3 — Authentication

Flow:

```text
User logs in
→ Supabase session
→ frontend gets access token
→ frontend sends bearer token to FastAPI
→ FastAPI verifies user
```

You learn:

```text
authentication = who are you?
authorization = what are you allowed to access?
```

# 16. Phase 4 — Company setup

User creates a company with:

```text
name
currency
fiscal year starting month
minimum cash threshold
```

All later records belong to a company.

# 17. Phase 5 — Import upload

User chooses:

```text
Budget
Actual
Cash
```

and uploads CSV/XLSX.

The file is stored privately in Supabase.

You learn:

- private object storage
- signed upload URLs
- file lifecycle

# 18. Phase 6 — Import processing

FastAPI checks:

- required columns
- valid dates
- numeric amounts
- account type values
- cash directions
- cash statuses

If valid, rows are inserted into the database.

If invalid, the user sees row-level errors.

You learn:

> Good financial analysis requires validated source data.

# 19. Phase 7 — Variance engine

The engine matches budget and actual and calculates:

```text
budget
actual
variance
variance %
favorability
```

It also calculates revenue, expenses, operating profit, and top unfavorable variances.

You learn practical FP&A analysis.

# 20. Phase 8 — Cash data

The user can:

- record a dated cash balance
- add/edit/delete cash items
- view imported cash items

This creates the data required for forecasting.

# 21. Phase 9 — 13-week forecast

The engine groups inflows and outflows into weekly buckets.

It finds:

- closing cash
- minimum cash
- lowest week
- threshold breach

You learn short-term liquidity planning.

# 22. Phase 10 — Scenario engine

The system adjusts planned items based on a scenario.

Example:

```text
planned inflows -10%
planned outflows +5%
collection delay +7 days
```

You learn how management forecasts uncertainty.

# 23. Phase 11 — Dashboard

The dashboard combines the important outputs.

KPIs:

```text
Budget Revenue
Actual Revenue
Revenue Variance
Budget Expenses
Actual Expenses
Budget Operating Profit
Actual Operating Profit
Latest Cash
13-Week Minimum Cash
First Threshold Breach
Top Unfavorable Variance
```

You learn how raw finance data becomes management information.

# 24. Phase 12 — Groq + fallback

FastAPI builds a verified fact pack.

Groq explains it.

If Groq fails, deterministic Python commentary runs.

You learn the proper role of AI:

```text
AI explains.
Deterministic code calculates.
```

# 25. Phase 13 — Excel report

The system generates an Excel workbook with:

```text
Executive Summary
Variance Analysis
Department Analysis
Cash Forecast
Scenario
Source Budget
Source Actual
Source Cash
```

You learn why Excel remains important in finance workflows.

# 26. Phase 14 — Security and reliability

Codex checks:

- authentication
- user ownership
- private storage
- file restrictions
- API validation
- safe Excel output
- secret handling

You learn that finance software must protect both data and calculations.

# 27. Phase 15 — CI

GitHub Actions runs automated tests whenever code changes.

You learn:

```text
Continuous Integration
```

A pull request or push should fail if important tests fail.

# 28. Phase 16 — Backend Vercel deployment

FastAPI becomes available at a production URL.

Example:

```text
https://fpna-api.vercel.app
```

The health endpoint is tested.

Secrets are configured in Vercel, not GitHub.

# 29. Phase 17 — Frontend Vercel deployment

Next.js becomes available at:

```text
https://fpna-dashboard.vercel.app
```

The frontend is configured with the production API URL.

The backend is configured to allow the frontend origin.

# 30. Phase 18 — Production smoke test

You act like a real user:

```text
signup
create company
upload budget
upload actual
upload cash
set balance
check variance
check forecast
create scenario
request Groq analysis
test fallback
generate Excel
```

Only after this works is the project complete.

# 31. What you should be able to explain

By the end you should be able to answer:

- What is a budget?
- What is actual?
- What is a variance?
- Why is expense favorability opposite to revenue?
- What is operating profit?
- Why can a profitable company run out of cash?
- What is a 13-week cash forecast?
- What is a scenario?
- Why does Groq not calculate financial values?
- What happens when Groq fails?
- What does RLS protect?
- Why are uploaded files private?
- Why are the frontend and backend deployed separately?

# 32. Final mental model

Always remember:

```text
DATA
 ↓
VALIDATION
 ↓
DETERMINISTIC CALCULATION
 ↓
FINANCIAL INTERPRETATION
 ↓
DASHBOARD / REPORT
 ↓
OPTIONAL AI EXPLANATION
```

Do not build:

```text
DATA
 ↓
AI guesses everything
```
