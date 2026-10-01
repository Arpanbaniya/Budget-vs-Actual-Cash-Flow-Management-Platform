# Cash records — Phase 8

The `/cash` page manages dated opening balances and cash inflows/outflows.
Amounts are finite decimals (up to ten decimal places and absolute value 10^20).
Balances may be negative; cash-item amounts must be nonnegative and direction carries
the sign. Descriptions/categories are required and limited to 500 characters.
Only planned, confirmed, and actual statuses are supported.

Each company/date may have one balance. Duplicate dates return 409. Edit changes
amount/note; dates are immutable. Newest balances are listed first. Cash items can
change expected date, description, category, direction, amount, and status.
Imported items are visible alongside manual items; editing preserves import_id and
source_row. Deleting their import also deletes these edited imported items.

POST/GET `/api/v1/companies/{id}/cash-balances` and `/cash-items` create/list records.
PATCH/DELETE `/api/v1/cash-balances/{id}` and `/cash-items/{id}` edit/delete them.
Lists return items, total, page, page_size. Page starts at one; page_size is 1–100.
Cash items support inclusive from/to dates, direction, status, and category filters.
The UI shows 20 balances and 50 items per page. Pagination and forms remain usable
after errors; deletion requires confirmation. No forecast calculation is performed
by these record-management endpoints.

All endpoints verify the caller and parent-company ownership, using the caller's JWT
for database RLS. Owner/company/import identifiers cannot be supplied or changed in
request bodies. The existing schema and environment variables are sufficient.
