import { type NextRequest } from "next/server";

import { updateSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/login",
    "/signup",
    "/dashboard/:path*",
    "/auth/:path*",
    "/companies/:path*",
    "/imports/:path*",
    "/variance/:path*",
    "/cash/:path*",
    "/forecast/:path*",
    "/cash-forecast/:path*",
    "/scenarios/:path*",
    "/insights/:path*",
    "/reports/:path*",
  ],
};
