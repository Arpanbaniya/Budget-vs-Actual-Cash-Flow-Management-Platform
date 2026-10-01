# Synthetic demo data

These files contain invented records, not real financial transactions.
Create a demo company in NPR with minimum cash threshold **90000**. Upload and
process budget.csv, actual.csv, and cash.csv once each. Set financial dates
**2026-09-01 to 2026-09-30**. Add a cash balance of **100000** dated **2026-10-01**.
Forecast start: **2026-10-01**, 13 weeks.

| Metric | Budget | Actual | Variance | Interpretation |
| --- | ---: | ---: | ---: | --- |
| Revenue | 100000 | 90000 | -10000 | Unfavorable, -10% |
| COGS | 40000 | 38000 | -2000 | Favorable, -5% |
| Operating expense | 20000 | 25000 | 5000 | Unfavorable, 25% |
| Total expenses | 60000 | 63000 | 3000 | Unfavorable |
| Operating profit | 40000 | 27000 | -13000 | Lower profit |

Base week 1 (October 1–7): 100000 + 75000 − 30000 = **145000**.
Week 2 (October 8–14): 145000 − 50000 = **95000**. Remaining weeks close at
95000, which is the minimum; no threshold breach.

Create Downside with inflows **-10%**, outflows **+5%**, collection delay **7 days**.
Only the planned 50000 receipt becomes 45000 and moves from October 2 to 9.
Only the planned 30000 payment becomes 31500; its October 7 date stays fixed.
Confirmed/actual rows remain unchanged.

Scenario week 1: 100000 + 25000 − 31500 = **93500**.
Scenario week 2: 93500 + 45000 − 50000 = **88500**. Remaining weeks close at
88500. Minimum: 88500; first threshold breach: **week 2**.

Insights and reports use these same period/start/scenario settings. Reports should
show original cash source rows and the adjusted scenario forecast. Delete demo
imports/reports only after checking results; import deletion changes future totals.
