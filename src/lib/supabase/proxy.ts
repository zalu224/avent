import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, isSupabaseConfigured } from "./env";

const EVENT_SHARE_RE = /^\/events\/([0-9a-f-]{36})\/?$/i;

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/e/") ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/robots.txt" ||
    pathname === "/manifest.webmanifest"
  );
}

/**
 * Refreshes the Supabase session cookie on every request and applies the
 * app's auth redirects. Runs from src/proxy.ts.
 */
export async function updateSession(request: NextRequest) {
  // Before the database integration is connected, let pages render their
  // own "not connected yet" state instead of failing every request.
  if (!isSupabaseConfigured()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        Object.entries(headers ?? {}).forEach(([k, v]) =>
          response.headers.set(k, v)
        );
      },
    },
  });

  // Do not run code between createServerClient and getClaims: a session
  // refresh may be needed and skipping it can log users out at random.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  // Shared event links work signed out: send visitors to the public view.
  const share = pathname.match(EVENT_SHARE_RE);
  if (!signedIn && share) {
    const publicUrl = request.nextUrl.clone();
    publicUrl.pathname = `/e/${share[1]}`;
    return NextResponse.redirect(publicUrl);
  }

  if (!signedIn && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (pathname !== "/feed") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    signedIn &&
    (pathname === "/" || pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password")
  ) {
    const feedUrl = request.nextUrl.clone();
    feedUrl.pathname = "/feed";
    feedUrl.search = "";
    const redirectResponse = NextResponse.redirect(feedUrl);
    response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c));
    return redirectResponse;
  }

  return response;
}
