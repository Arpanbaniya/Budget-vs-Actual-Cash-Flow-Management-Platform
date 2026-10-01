import { createClient } from "./supabase/client";

export type Company = {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  fiscal_year_start_month: number;
  minimum_cash_threshold: string;
  created_at: string;
  updated_at: string;
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { data, error } = await createClient().auth.getSession();
  if (error || !data.session)
    throw new Error("Your session expired. Please sign in again.");
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  const requestHeaders = new Headers(options.headers);
  requestHeaders.set("Content-Type", "application/json");
  requestHeaders.set("Authorization", `Bearer ${data.session.access_token}`);
  const response = await fetch(`${base}/api/v1${path}`, {
    ...options,
    cache: "no-store",
    credentials: "omit",
    headers: requestHeaders,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (
      response.status === 422 &&
      body?.error?.code === "REQUEST_INVALID" &&
      (path === "/companies" || /^\/companies\/[^/?]+$/.test(path))
    ) {
      throw new ApiRequestError(
        "Check the company name, three-letter currency, fiscal month, and nonnegative cash threshold.",
        response.status,
        body?.error?.code,
      );
    }
    throw new ApiRequestError(
      body?.error?.message ?? "The request failed. Please try again.",
      response.status,
      body?.error?.code,
    );
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}
