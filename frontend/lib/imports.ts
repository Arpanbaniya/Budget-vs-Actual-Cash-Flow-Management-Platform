import { getSupabaseConfig } from "./supabase/config";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_KINDS = ["budget", "actual", "cash"] as const;
export const IMPORT_STATUSES = [
  "reserved",
  "uploaded",
  "processing",
  "processed",
  "failed",
] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export type ImportRecord = {
  id: string;
  user_id: string;
  company_id: string;
  kind: ImportKind;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: ImportStatus;
  row_count: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
};

export type UploadReservation = {
  import_id: string;
  status: "reserved";
  storage_path: string;
  upload: { signed_url: string; expires_in_seconds: number };
};

export function importFileType(file: File): string {
  if (!/\.(csv|xlsx)$/i.test(file.name))
    throw new Error("Choose a .csv or .xlsx file.");
  if (file.size === 0) throw new Error("Choose a file that is not empty.");
  if (file.size > MAX_FILE_BYTES)
    throw new Error("The file must be 5 MB or smaller.");
  return /\.csv$/i.test(file.name)
    ? "text/csv"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

export async function uploadReservedFile(
  reservation: UploadReservation,
  file: File,
) {
  const contentType = importFileType(file);
  const target = new URL(reservation.upload.signed_url);
  const project = new URL(getSupabaseConfig().url);
  if (
    target.origin !== project.origin ||
    target.pathname !==
      `/storage/v1/object/upload/sign/fpna-imports/${reservation.storage_path}` ||
    !target.searchParams.get("token")
  ) {
    throw new Error("The upload link is invalid. Reserve a new upload.");
  }
  // File bytes go straight to Storage. The signed token supplies authorization;
  // do not forward the application's bearer token or cookies to this request.
  const result = await fetch(target.toString(), {
    method: "PUT",
    credentials: "omit",
    headers: {
      "Content-Type": contentType,
      "x-upsert": "false",
      "cache-control": "max-age=0",
    },
    body: file,
  });
  if (!result.ok)
    throw new Error(
      "File upload failed. Retry the upload, or confirm it if the file already reached Storage. If the link expired, reserve a new upload.",
    );
}
