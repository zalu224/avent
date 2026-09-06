import type { NextRequest } from "next/server";
import { buildIcs } from "@/lib/calendar-links";
import { getEvent } from "@/lib/queries";
import { getSiteUrl } from "@/lib/site";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });

  const userId = await getCurrentUserId();
  if (!userId) return new Response("Sign in required", { status: 401 });

  const supabase = await createClient();
  const event = await getEvent(supabase, id);
  if (!event) return new Response("Not found", { status: 404 });

  const siteUrl = await getSiteUrl();
  const body = buildIcs(event, `${siteUrl}/events/${event.id}`);
  const filename = `${event.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "event"}.ics`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
