# Finance methodology

## Variance

Variance = actual − budget. Percentage = variance / abs(budget) × 100.
Zero budget yields a null percentage and an unbudgeted label. Positive income
variance is favorable; negative expense variance is favorable. Zero is neutral.
Negative source adjustments remain signed. Missing budget or actual groups are zero.

Revenue includes revenue + other_income. Expenses include cogs + operating_expense
+ other_expense. Operating profit = revenue − expenses. Its variance is actual
operating profit − budget operating profit. This is the application's specified
management subtotal; it is not a claim about a statutory accounting presentation.

Account groups use account code plus account type. Department/month groups retain
account type to avoid mixing income and expense favorability. Top unfavorable
groups sort by absolute variance, descending. Processed imports are additive.
Date filters compare normalized monthly periods. Currency is a display label;
there is no foreign-exchange conversion or mixed-currency consolidation.

## Cash

The newest cash snapshot on or before the start supplies opening cash directly.
Earlier cash items are not rolled forward. Each week is seven days from the chosen
start, inclusive. Closing = opening + inflows − outflows; next opening = closing.
All planned/confirmed/actual items inside the window contribute. Empty weeks roll
forward; negative closing cash remains negative. Default 13 weeks, maximum 26.

Minimum cash is the lowest weekly closing balance, with first week winning ties.
A breach means closing cash strictly below the threshold; equality is not a breach.
This model checks weekly closing cash, not intraday or intraweek liquidity.

## Scenarios

Only planned items change. Amount becomes amount × (1 + adjustment_pct / 100),
with separate inflow/outflow rates from −100% to +500%. Planned inflows move by
collection_delay_days (0–365); outflow dates and confirmed/actual items remain
unchanged. Delayed receipts from before the start can enter the window. Derived
forecasts never mutate source rows. Compare base and scenario using the same start.

## Precision and interpretation

Python Decimal arithmetic uses 50-digit context for finance aggregation. APIs
return decimals as strings; modern Intl formats strings without binary-number
rounding. Chart scaling is approximate; tables retain source/service values.
Excel stores amounts exceeding 15 significant digits as text. Input amounts are
bounded to magnitude 1e20 and ten decimal places.

Commentary is based on calculated facts, not additional model calculations. A
forecast is a timing model, not a prediction of customer behavior. Fiscal-year
start is stored as a company setting; current date filters are explicit calendar
dates and do not auto-adjust to a fiscal year. See [demo calculations](samples/README.md).
