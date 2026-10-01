# Direct imports — Phase 5

The protected `/imports` page uses the same user-specific company selection as `/companies` and `/dashboard`. Users select budget, actual, or cash and a CSV/XLSX file. Blank CSV templates are downloadable for each kind. Files remain private; processing validates and saves financial rows after upload.

## Upload flow

1. Browser validates extension, nonempty size, and maximum 5 MB (5,242,880 bytes).
2. `POST /api/v1/companies/{company_id}/imports/reserve` verifies ownership and creates a `reserved` row, then signs a private `fpna-imports` upload.
3. Browser PUTs the original file directly to `upload.signed_url`, with the canonical content type. No file bytes, application bearer token, or cookies are sent through FastAPI.
4. `POST /api/v1/imports/{import_id}/complete` verifies owner, company, storage path, reserved state, object existence, and actual size. A conditional update changes the state to `uploaded`.

All API calls require the user's Supabase bearer token; database and Storage calls retain that JWT so RLS applies. Upload URLs are returned only by reservation and have a two-hour lifetime. Metadata responses do not include upload tokens. Successful import responses are private and not cacheable.

## API

| Method | Path | Result |
| --- | --- | --- |
| POST | `/api/v1/companies/{company_id}/imports/reserve` | 201 reservation and signed upload URL |
| POST | `/api/v1/imports/{import_id}/complete` | 200 uploaded metadata |
| GET | `/api/v1/companies/{company_id}/imports` | 200 metadata array; optional `kind` and `status` filters |
| GET | `/api/v1/imports/{import_id}` | 200 metadata, or 404 |
| DELETE | `/api/v1/imports/{import_id}` | 204 after object and row deletion |

Reservation example:

```json
{
  "kind": "budget",
  "filename": "budget_2026.xlsx",
  "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "size_bytes": 125432
}
```

Response:

```json
{
  "import_id": "uuid",
  "status": "reserved",
  "storage_path": "user_uuid/company_uuid/import_uuid/budget_2026.xlsx",
  "upload": {
    "signed_url": "https://project.supabase.co/storage/v1/object/upload/sign/fpna-imports/...?...",
    "expires_in_seconds": 7200
  }
}
```

Filename is required, trimmed, and limited to 255 input characters. Directory components are removed; the stored filename uses a bounded ASCII stem and lowercase `.csv`/`.xlsx`. MIME metadata is normalized to the extension's canonical type. Blank/unspecified MIME (`""`), octet-stream, and common CSV browser types are accepted; incompatible MIME is rejected. `size_bytes` must be a positive integer. Unknown request fields are rejected.

Oversize files return 413. Invalid extension, kind, MIME, or reservation size return 422. Missing objects and non-reserved completion return 409. A stored size different from the reservation returns 422; unverifiable size returns 503. Another user's company/import returns 404 before any Storage operation. Lists paginate all records; processing is described below.

## Recovery and deletion

If transfer fails, the row remains reserved and the current page can retry using the same reservation and file. If completion fails after transfer, use **Confirm stored upload** or the history row's **Confirm upload** to retry without retransferring bytes. Refresh loads current history. After a browser reload, the file and signed URL are not retained; a stored file can still be confirmed, or an unfinished reservation can be deleted and replaced. If completion succeeded but its response was lost, Refresh shows the uploaded state; another completion attempt correctly returns 409.

Signing failure triggers best-effort rollback of the reserved row. If rollback also fails, the reserved row remains visible for deletion. Delete removes the specific object via Storage, then deletes the import row; `financial_lines` and `cash_items` cascade through the Phase 2 foreign keys. A missing object does not prevent deletion. Cleanup failure retains the import so deletion can be retried. Deletion is blocked while an import is processing.

Storage and database operations are not atomic: if database deletion fails after object removal, metadata remains and a retry finishes deletion. Previously issued signed upload links are bearer capabilities and remain valid until expiry; deleting a reservation does not revoke its link, so a late transfer can leave an orphan private object. The application cannot complete a deleted import. Keep upload links private; automatic orphan cleanup is not implemented in this phase.

## Setup and verification

The existing Phase 2 schema, private buckets, and Phase 3 environment variables are sufficient; Phase 6 adds the import-processing migration; no service-role key is used. Production uses the single Vercel project and shared origin. Local development runs FastAPI on port 8000 and Next.js on port 3000 with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.

Backend tests mock Auth, database, and Storage, including size checks, ownership, state conflicts, filtering/pagination, signing rollback, and cascading deletion. Frontend tests exercise reserve → PUT → complete, rejection before reservation, retry, confirmation recovery, filters, company selection, template links, and deletion failures. Browser verification uses the real client and FastAPI with simulated Supabase services; production smoke checks verify deployment and authentication gates.

References: [Supabase signed uploads](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl), [uploading with a signed token](https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl), [object metadata](https://supabase.com/docs/reference/javascript/storage-from-info).

## Processing — Phase 6

`POST /api/v1/imports/{id}/process` accepts uploaded/failed imports. Interrupted processing
can be recovered after a ten-minute lease. Each run has a unique token: a stale worker
cannot commit over its replacement. CSV is UTF-8 (optional BOM); XLSX uses the first sheet,
literal values only, no macros. Both support up to 50,000 data rows and 64 columns.

Budget/actual headings: `period,department,account_code,account_name,account_type,amount`.
Cash headings: `expected_date,description,category,direction,amount,status`.
Periods accept YYYY-MM or YYYY-MM-DD and normalize to the first day of the month.
Cash dates require YYYY-MM-DD. Account types are revenue, cogs, operating_expense,
other_income, other_expense. Cash direction is inflow/outflow and status is
planned/confirmed/actual. Cash amounts must be nonnegative. Signed financial amounts
are preserved with warnings. Text is trimmed; account codes remain strings.
Extra columns are ignored with a warning; malformed/missing/duplicate headings fail.
At most 100 row-numbered errors/warnings are returned and persisted in import metadata.

The backend downloads the private object with the caller's JWT, enforces the byte limit
and reserved size again, and validates every row before writing any derived data.
The Phase 6 migration adds `claim_import` and `commit_import_rows`: security-invoker
Postgres functions retain caller privileges and RLS. Row replacement and processed
metadata are committed in one transaction. Failed validation leaves no partial rows;
processed imports cannot be processed again. Correct a bad source file by deleting
its failed import and uploading the corrected file. Retry addresses transient errors.

Verification includes pure CSV/XLSX tests, API ownership/retry tests, and frontend
Process control, row counts, and warnings. No service-role key is used.

