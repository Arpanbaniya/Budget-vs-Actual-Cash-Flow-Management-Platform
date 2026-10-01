"""Reserve direct private uploads; verify metadata without downloading file bytes."""

import re
import unicodedata
from datetime import UTC, datetime
from pathlib import PurePosixPath
from typing import Literal
from urllib.parse import parse_qs, urlsplit
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from app.companies import CompanyStore, Store
from app.errors import ApiError
from app.import_parser import ImportValidationError, parse_import

MAX_FILE_BYTES = 5 * 1024 * 1024
BUCKET = "fpna-imports"
Kind = Literal["budget", "actual", "cash"]
Status = Literal["reserved", "uploaded", "processing", "processed", "failed"]
MIME_TYPES = {
    ".csv": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def private_response(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store"


router = APIRouter(prefix="/api/v1", tags=["imports"], dependencies=[Depends(private_response)])


class ReserveImport(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    kind: Kind
    filename: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(max_length=200)
    size_bytes: int = Field(gt=0, strict=True)


class ImportMetadata(BaseModel):
    id: UUID
    user_id: UUID
    company_id: UUID
    kind: Kind
    filename: str
    storage_path: str
    mime_type: str | None
    size_bytes: int | None
    status: Status
    row_count: int | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime
    processed_at: datetime | None = None
    validation_errors: list[dict] = Field(default_factory=list)
    warnings: list[dict] = Field(default_factory=list)


class UploadInstructions(BaseModel):
    signed_url: str
    expires_in_seconds: int = 7200


class Reservation(BaseModel):
    import_id: UUID
    status: Literal["reserved"] = "reserved"
    storage_path: str
    upload: UploadInstructions


def upload_filename(payload: ReserveImport) -> tuple[str, str]:
    name = payload.filename.replace("\\", "/").rsplit("/", 1)[-1]
    extension = PurePosixPath(name).suffix.lower()
    if extension not in MIME_TYPES:
        raise ApiError(422, "FILE_TYPE_INVALID", "Choose a .csv or .xlsx file.")
    if payload.size_bytes > MAX_FILE_BYTES:
        raise ApiError(413, "FILE_TOO_LARGE", "The file must be 5 MB or smaller.")
    accepted = {MIME_TYPES[extension], "", "application/octet-stream"}
    if extension == ".csv":
        accepted.update({"application/csv", "text/plain", "application/vnd.ms-excel"})
    if payload.mime_type.lower() not in accepted:
        raise ApiError(422, "FILE_TYPE_INVALID", "The file type does not match its extension.")
    stem = unicodedata.normalize("NFKD", name[: -len(extension)])
    stem = stem.encode("ascii", "ignore").decode()
    stem = re.sub(r"[^A-Za-z0-9_-]+", "_", stem).strip("_-\u0020")[:160] or "import"
    return f"{stem}{extension}", MIME_TYPES[extension]


def import_scope(store: CompanyStore, import_id: UUID | None = None) -> dict[str, str]:
    params = {"user_id": f"eq.{store.user.user_id}", "select": "*"}
    if import_id:
        params["id"] = f"eq.{import_id}"
    return params


async def owned_import(store: CompanyStore, import_id: UUID) -> ImportMetadata:
    result = await store.request("GET", "rest/v1/imports", params=import_scope(store, import_id))
    rows = result.json()
    if not rows:
        raise ApiError(404, "NOT_FOUND", "Import not found.")
    record = ImportMetadata.model_validate(rows[0])
    # Check parent ownership too; never use arbitrary DB paths for Storage calls.
    await store.get(record.company_id)
    expected = f"{store.user.user_id}/{record.company_id}/{record.id}/{record.filename}"
    if (
        str(record.user_id) != store.user.user_id
        or record.storage_path != expected
        or not re.fullmatch(r"[A-Za-z0-9_-]+\.(csv|xlsx)", record.filename)
    ):
        raise ApiError(409, "IMPORT_INVALID", "The import storage path is invalid.")
    return record


@router.post("/companies/{company_id}/imports/reserve", response_model=Reservation, status_code=201)
async def reserve_import(company_id: UUID, payload: ReserveImport, store: Store) -> Reservation:
    await store.get(company_id)
    filename, mime_type = upload_filename(payload)
    import_id = uuid4()
    path = f"{store.user.user_id}/{company_id}/{import_id}/{filename}"
    await store.request(
        "POST",
        "rest/v1/imports",
        json={
            "id": str(import_id),
            "user_id": store.user.user_id,
            "company_id": str(company_id),
            "kind": payload.kind,
            "filename": filename,
            "storage_path": path,
            "mime_type": mime_type,
            "size_bytes": payload.size_bytes,
            "status": "reserved",
        },
        headers={"Prefer": "return=minimal"},
    )
    try:
        result = await store.request(
            "POST", f"storage/v1/object/upload/sign/{BUCKET}/{path}", json={}
        )
        # Supabase returns a path relative to /storage/v1, with its upload token.
        try:
            body = result.json()
        except ValueError as error:
            raise ApiError(
                503, "UPLOAD_UNAVAILABLE", "An upload link could not be created."
            ) from error
        relative = body.get("url") if isinstance(body, dict) else None
        if not isinstance(relative, str):
            raise ApiError(503, "UPLOAD_UNAVAILABLE", "An upload link could not be created.")
        parsed = urlsplit(relative)
        if (
            parsed.scheme
            or parsed.netloc
            or parsed.fragment
            or parsed.path != f"/object/upload/sign/{BUCKET}/{path}"
            or not parse_qs(parsed.query).get("token")
        ):
            raise ApiError(503, "UPLOAD_UNAVAILABLE", "An upload link could not be created.")
        signed_url = f"{str(store.client.base_url).rstrip('/')}/storage/v1{relative}"
    except ApiError:
        # No link was returned to the caller. Best-effort rollback; a remaining
        # reserved row is visible and can be deleted if rollback is unavailable.
        try:
            await store.request(
                "DELETE",
                "rest/v1/imports",
                params={**import_scope(store, import_id), "status": "eq.reserved"},
            )
        except ApiError:
            pass
        raise
    return Reservation(
        import_id=import_id,
        storage_path=path,
        upload=UploadInstructions(signed_url=signed_url),
    )


@router.post("/imports/{import_id}/complete", response_model=ImportMetadata)
async def complete_import(import_id: UUID, store: Store) -> ImportMetadata:
    record = await owned_import(store, import_id)
    if record.status != "reserved":
        raise ApiError(409, "IMPORT_STATE_CONFLICT", "Only a reserved import can be completed.")
    result = await store.request(
        "GET", f"storage/v1/object/info/{BUCKET}/{record.storage_path}", allowed_statuses=(404,)
    )
    if result.status_code == 404:
        raise ApiError(409, "UPLOAD_MISSING", "The file has not reached Storage. Upload it first.")
    try:
        info = result.json()
    except ValueError as error:
        raise ApiError(
            503, "UPLOAD_UNAVAILABLE", "The uploaded file could not be verified."
        ) from error
    if not isinstance(info, dict):
        raise ApiError(503, "UPLOAD_UNAVAILABLE", "The uploaded file could not be verified.")
    size = info.get("size")
    if not isinstance(size, int) or isinstance(size, bool) or size < 0:
        raise ApiError(503, "UPLOAD_UNAVAILABLE", "The uploaded file size could not be verified.")
    if size > MAX_FILE_BYTES:
        raise ApiError(413, "FILE_TOO_LARGE", "The uploaded file exceeds the 5 MB limit.")
    if size != record.size_bytes:
        raise ApiError(
            422, "UPLOAD_SIZE_MISMATCH", "The uploaded size differs from the reserved file."
        )
    result = await store.request(
        "PATCH",
        "rest/v1/imports",
        params={**import_scope(store, import_id), "status": "eq.reserved"},
        json={"status": "uploaded", "updated_at": datetime.now(UTC).isoformat()},
        headers={"Prefer": "return=representation"},
    )
    rows = result.json()
    if not rows:
        raise ApiError(409, "IMPORT_STATE_CONFLICT", "The import changed. Refresh its status.")
    return ImportMetadata.model_validate(rows[0])


@router.get("/companies/{company_id}/imports", response_model=list[ImportMetadata])
async def list_imports(
    company_id: UUID, store: Store, kind: Kind | None = None, status: Status | None = None
) -> list[ImportMetadata]:
    await store.get(company_id)
    params = {
        **import_scope(store),
        "company_id": f"eq.{company_id}",
        "order": "created_at.desc,id.desc",
    }
    if kind:
        params["kind"] = f"eq.{kind}"
    if status:
        params["status"] = f"eq.{status}"
    records: list[ImportMetadata] = []
    offset = 0
    while True:
        result = await store.request(
            "GET", "rest/v1/imports", params={**params, "limit": "100", "offset": str(offset)}
        )
        rows = result.json()
        records.extend(ImportMetadata.model_validate(row) for row in rows)
        if len(records) > 10000:
            raise ApiError(422, "DATA_LIMIT", "Filter imports to load fewer than 10,000 records.")
        if len(rows) < 100:
            return records
        offset += len(rows)


@router.get("/imports/{import_id}", response_model=ImportMetadata)
async def get_import(import_id: UUID, store: Store) -> ImportMetadata:
    return await owned_import(store, import_id)


@router.post("/imports/{import_id}/process")
async def process_import(import_id: UUID, store: Store) -> dict:
    record = await owned_import(store, import_id)
    token = str(uuid4())
    claim = await store.request(
        "POST",
        "rest/v1/rpc/claim_import",
        json={
            "p_import_id": str(import_id),
            "p_token": token,
        },
    )
    if not claim.json():
        raise ApiError(
            409, "IMPORT_STATE_CONFLICT", "Import cannot be processed in its current state."
        )
    try:
        contents = bytearray()
        async with store.client.stream(
            "GET", f"storage/v1/object/authenticated/{BUCKET}/{record.storage_path}"
        ) as response:
            if not response.is_success:
                raise ApiError(503, "UPLOAD_UNAVAILABLE", "The stored file could not be read.")
            async for chunk in response.aiter_bytes():
                contents.extend(chunk)
                if len(contents) > MAX_FILE_BYTES:
                    raise ApiError(413, "FILE_TOO_LARGE", "The stored file exceeds 5 MB.")
        if len(contents) != record.size_bytes:
            raise ApiError(422, "UPLOAD_SIZE_MISMATCH", "The stored file size has changed.")
        parsed = await run_in_threadpool(
            parse_import, bytes(contents), record.filename, record.kind
        )
        result = await store.request(
            "POST",
            "rest/v1/rpc/commit_import_rows",
            json={
                "p_import_id": str(import_id),
                "p_token": token,
                "p_rows": parsed.rows,
                "p_warnings": parsed.warnings,
            },
        )
        if not result.json():
            raise ApiError(409, "IMPORT_STATE_CONFLICT", "Processing changed. Refresh the import.")
        return {
            "import_id": str(import_id),
            "status": "processed",
            "kind": record.kind,
            "row_count": len(parsed.rows),
            "warnings": parsed.warnings,
        }
    except (ApiError, ImportValidationError, httpx.RequestError) as error:
        issues = error.issues if isinstance(error, ImportValidationError) else []
        message = (
            str(error)
            if isinstance(error, ImportValidationError)
            else (
                error.message
                if isinstance(error, ApiError)
                else "File processing is temporarily unavailable."
            )
        )
        try:
            await store.request(
                "PATCH",
                "rest/v1/imports",
                params={
                    **import_scope(store, import_id),
                    "status": "eq.processing",
                    "processing_token": f"eq.{token}",
                },
                json={
                    "status": "failed",
                    "error_message": message,
                    "validation_errors": issues,
                    "processing_token": None,
                    "processing_started_at": None,
                    "updated_at": datetime.now(UTC).isoformat(),
                },
            )
        except ApiError:
            pass  # A ten-minute lease allows recovery if the database is unavailable.
        if isinstance(error, ImportValidationError):
            raise ApiError(422, "IMPORT_VALIDATION_FAILED", message, {"issues": issues}) from error
        if isinstance(error, httpx.RequestError):
            raise ApiError(503, "UPLOAD_UNAVAILABLE", message) from error
        raise


@router.delete("/imports/{import_id}", status_code=204)
async def delete_import(import_id: UUID, store: Store) -> Response:
    record = await owned_import(store, import_id)
    if record.status == "processing":
        raise ApiError(
            409, "IMPORT_STATE_CONFLICT", "Wait for processing to finish before deleting."
        )
    await store.request(
        "DELETE", f"storage/v1/object/{BUCKET}", json={"prefixes": [record.storage_path]}
    )
    result = await store.request(
        "DELETE",
        "rest/v1/imports",
        params=import_scope(store, import_id),
        headers={"Prefer": "return=representation"},
    )
    if not result.json():
        raise ApiError(404, "NOT_FOUND", "Import not found.")
    # Phase 2 foreign keys cascade financial_lines and cash_items for this import.
    return Response(status_code=204, headers={"Cache-Control": "private, no-store"})
