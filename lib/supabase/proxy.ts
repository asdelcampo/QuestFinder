import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "./env";

const AUTH_PAGES = ["/login", "/signup"];

// Runs before every page: refreshes the auth cookie and redirects based on sign-in state.
// This is only the optimistic first pass. Pages and server actions still check the user themselves.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        // Refreshed tokens go on the request (for this render) and the response (for the browser)
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // Keep this call right after createServerClient: it is what refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const onAuthPage = AUTH_PAGES.includes(request.nextUrl.pathname);

  if (!signedIn && !onAuthPage) return redirectKeepingCookies(request, "/login", response);
  if (signedIn && onAuthPage) return redirectKeepingCookies(request, "/", response);
  return response;
}

function redirectKeepingCookies(request: NextRequest, path: string, from: NextResponse) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
