import type { Metadata } from "next";
import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EventListItem } from "@/components/event-card";
import { PageHeading } from "@/components/page-heading";
import { dayKey } from "@/lib/format";
import { getCalendarEvents, type CalendarFilter } from "@/lib/queries";
import { createClient, requireUserId } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/timezone";
import type { EventWithMeta } from "@/lib/types";

export const metadata: Metadata = { title: "Calendar" };

const FILTERS: { key: CalendarFilter; label: string }[] = [
  { key: "all", label: "Everyone I follow" },
  { key: "going", label: "I’m going" },
  { key: "mine", label: "My posts" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseMonth(m: string | undefined, tz: string) {
  const match = m?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const y = Number(match[1]);
    const mo = Number(match[2]);
    if (mo >= 1 && mo <= 12) return new TZDate(y, mo - 1, 1, tz);
  }
  return startOfMonth(new TZDate(new Date(), tz));
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; f?: string }>;
}) {
  const { m, f } = await searchParams;
  const userId = await requireUserId();
  const supabase = await createClient();
  const tz = await getTimeZone();
  const now = new Date();

  const filter: CalendarFilter = f === "going" || f === "mine" ? f : "all";
  const monthStart = parseMonth(m, tz);
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const events = await getCalendarEvents(
    supabase,
    userId,
    gridStart.toISOString(),
    gridEnd.toISOString(),
    filter
  );

  const byDay = new Map<string, EventWithMeta[]>();
  for (const e of events) {
    const key = dayKey(e.starts_at, tz);
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }

  const monthParam = (d: Date) => format(d, "yyyy-MM");
  const href = (month: Date, fk: CalendarFilter) =>
    `/calendar?m=${monthParam(month)}${fk === "all" ? "" : `&f=${fk}`}` as const;

  const monthDays = days.filter((d) => isSameMonth(d, monthStart));
  const daysWithEvents = monthDays.filter((d) => byDay.has(format(d, "yyyy-MM-dd")));

  return (
    <>
      <PageHeading title="Calendar" sub="Every night your circle has plans" />

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter">
        {FILTERS.map((opt) => (
          <Link
            key={opt.key}
            href={href(monthStart, opt.key)}
            aria-current={filter === opt.key ? "true" : undefined}
            className={`btn text-sm ${filter === opt.key ? "btn-glow" : "btn-outline"}`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={href(subMonths(monthStart, 1), filter)}
            aria-label="Previous month"
            className="btn btn-ghost px-2"
          >
            <ChevronLeft size={20} aria-hidden />
          </Link>
          <h2 className="font-display text-lg font-bold">{format(monthStart, "MMMM yyyy")}</h2>
          <Link
            href={href(addMonths(monthStart, 1), filter)}
            aria-label="Next month"
            className="btn btn-ghost px-2"
          >
            <ChevronRight size={20} aria-hidden />
          </Link>
        </div>

        <div className="grid grid-cols-7 text-center text-xs font-medium text-muted">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const dayEvents = byDay.get(key) ?? [];
            const inMonth = isSameMonth(d, monthStart);
            const today = isToday(d);
            const iAmIn = dayEvents.some((e) =>
              e.rsvps.some((r) => r.user_id === userId && r.status !== "interested")
            );
            const content = (
              <>
                <span
                  className={`text-sm leading-none ${
                    today ? "rounded-full bg-fore px-1.5 py-0.5 font-bold text-canvas" : ""
                  }`}
                >
                  {format(d, "d")}
                </span>
                {dayEvents.length > 0 && (
                  <span className="mt-1 flex gap-0.5" aria-hidden>
                    {dayEvents.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className={`h-1.5 w-1.5 rounded-full ${iAmIn ? "bg-glow" : "bg-flare"}`}
                      />
                    ))}
                  </span>
                )}
              </>
            );
            const base = `flex h-14 flex-col items-center justify-start rounded-md pt-2 ${
              inMonth ? "text-fore" : "text-muted/40"
            }`;
            return dayEvents.length > 0 ? (
              <a
                key={key}
                href={`#d-${key}`}
                aria-label={`${format(d, "EEEE, MMMM d")}: ${dayEvents.length} events`}
                className={`${base} bg-edge hover:bg-edge-2`}
              >
                {content}
              </a>
            ) : (
              <div key={key} className={base}>
                {content}
              </div>
            );
          })}
        </div>
      </div>

      <section className="mt-8" aria-label="Events this month">
        {daysWithEvents.length === 0 ? (
          <div className="px-2 py-8 text-center text-muted-2">
            <p>Nothing on the calendar for {format(monthStart, "MMMM")} yet.</p>
            <Link href="/events/new" className="btn btn-primary mt-4">
              Post a flyer
            </Link>
          </div>
        ) : (
          daysWithEvents.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            return (
              <div key={key} id={`d-${key}`} className="mb-6 scroll-mt-4">
                <h3 className="mb-1 font-display text-base font-bold">
                  {format(d, "EEEE, MMMM d")}
                </h3>
                <ul>
                  {byDay.get(key)!.map((e) => (
                    <EventListItem key={e.id} event={e} tz={tz} currentUserId={userId} now={now} />
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
