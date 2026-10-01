# Company management — Phase 4

Signed-in users manage their companies at `/companies`. The dashboard displays the selected company's settings. The selector is saved under a user-specific browser preference, so selection persists when switching between those pages. No imports or finance calculations are included in Phase 4.

## API

Every endpoint requires `Authorization: Bearer <Supabase access token>`.

| Method | Path | Result |
| --- | --- | --- |
| POST | `/api/v1/companies` | 201 with the created company |
| GET | `/api/v1/companies` | 200 with an array of the user's companies |
| GET | `/api/v1/companies/{company_id}` | 200 with one owned company, or 404 |
| PATCH | `/api/v1/companies/{company_id}` | 200 with updated settings, or 404 |
| DELETE | `/api/v1/companies/{company_id}` | 204 after file cleanup and database deletion, or 404 |

Create example:

```json
{
  "name": "ABC Pvt Ltd",
  "currency": "NPR",
  "fiscal_year_start_month": 7,
  "minimum_cash_threshold": "500000.25"
}
```

`name` is required and is trimmed to 1–200 characters. Currency is a three-letter code normalized to uppercase; its default is USD. Fiscal month must be an integer from 1–12 and defaults to January. The minimum cash threshold must be a finite, nonnegative decimal and defaults to zero. Decimal strings preserve exact amounts; the API also accepts JSON numbers. Responses return the threshold as a decimal string along with ID, user ID, and creation/update timestamps.

PATCH accepts only those four settings, requires at least one field, and rejects explicit null values. Unknown fields such as `user_id` or `id` are rejected. Validation failures return 422 in the standard API error shape. Lists read all database pages in creation order.

## Ownership and deletion

FastAPI validates the user's token with Supabase Auth. Creation sets `user_id` from that verified identity. Every read, update, and delete adds an explicit owner filter, and all database requests use the user's JWT so Row Level Security remains active. Another user's company is indistinguishable from a missing company: it returns 404. No service-role key is used.

Deletion first verifies ownership, then lists files recursively under `{user_id}/{company_id}` in `fpna-imports` and `fpna-reports`. It removes objects through the Storage API and deletes the company row; existing foreign keys cascade related database rows. Storage and database changes cannot be one atomic transaction. If file cleanup fails, the company row remains and the request returns an error; some files may already be removed, and retrying continues cleanup. The UI asks for confirmation before deleting.

## Configuration and verification

Phase 4 uses the existing Phase 2 schema and Phase 3 Supabase variables. No new migration or key is required. Local development needs FastAPI on port 8000, `FRONTEND_ORIGINS=http://localhost:3000`, and `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` in the frontend. Production leaves the API base unset and uses the shared Vercel origin.

Backend tests cover CRUD, defaults, invalid fiscal months and settings, precise decimal thresholds, ownership isolation, authentication, list pagination, nested Storage cleanup, and cleanup failures. Frontend tests cover creation, selection, editing, deletion confirmation, retry, and preserved form input after an error. Browser verification exercised the real client and FastAPI against simulated Supabase responses; production smoke checks verify route protection and deployment.

References: [Supabase Data API](https://supabase.com/docs/guides/api), [Storage object deletion](https://supabase.com/docs/guides/storage/management/delete-objects).
