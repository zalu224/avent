"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const COOKIE = "tz";

/**
 * Stores the browser's IANA timezone in a cookie so server-rendered dates
 * and calendar grouping match what the viewer expects. Refreshes once when
 * the cookie is first written or changes.
 */
export function TimezoneSync() {
  const router = useRouter();

  useEffect(() => {
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz) return;

    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
    const current = match ? decodeURIComponent(match[1]) : null;
    if (current === tz) return;

    document.cookie = `${COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);

  return null;
}
