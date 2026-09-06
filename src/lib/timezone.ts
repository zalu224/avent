import { cookies } from "next/headers";
import { isValidTimeZone } from "./format";

export const TZ_COOKIE = "tz";

/**
 * The viewer's IANA timezone, written to a cookie by <TimezoneSync /> on the
 * client. Falls back to UTC for the very first request.
 */
export async function getTimeZone(): Promise<string> {
  const store = await cookies();
  const tz = store.get(TZ_COOKIE)?.value;
  return isValidTimeZone(tz) ? tz : "UTC";
}
