# Cash forecasting — Phase 9

The forecast page is `/cash-forecast`; `/forecast` is also supported.

GET `/api/v1/companies/{id}/cash-forecast?start_date=2026-10-01&weeks=13`
supports 1–26 weeks, default 13. It requires an owned company and the latest balance
dated on or before start_date. A missing balance returns 422 CASH_BALANCE_REQUIRED.
That snapshot supplies opening cash directly: older items are not rolled forward.
The UI displays the balance date and warns when it precedes the forecast start.
Use a balance representing opening cash at the start of its date.

Week one starts on start_date (any weekday), includes that date through day six,
and subsequent weeks cover consecutive seven-day windows. All planned, confirmed,
and actual items within those dates contribute; outside dates do not. Empty weeks
carry cash forward. Closing = opening + inflows − outflows. The next opening equals
the previous closing. Python Decimal with 50-digit precision performs the calculations;
API money uses decimal strings. The frontend only formats and plots results.

Minimum projected cash is the smallest weekly closing balance, with the first week
winning ties. Lowest-cash week and first threshold breach use one-based week numbers.
A closing balance strictly below the company's threshold is a breach; equality is
not. Negative closing cash is retained. This is a weekly model: intraday shortfalls,
FX conversion, bank reconciliation, and automatic movement between snapshots are
outside its scope. Scenarios are added separately in Phase 10.
