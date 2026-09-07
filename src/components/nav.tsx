"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  LogOut,
  MessageCircle,
  Newspaper,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { Avatar } from "./avatar";
import { signOut } from "@/lib/actions/auth";
import type { ProfileLite } from "@/lib/types";

const DESKTOP_ITEMS = [
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/discover", label: "Search events", icon: Search },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/people", label: "People", icon: Users },
  { href: "/activity", label: "Activity", icon: Bell },
] as const;

const MOBILE_ITEMS = [
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/discover", label: "Search", icon: Search },
  { href: "/events/new", label: "Post", icon: Plus },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
] as const;

export function Nav({
  profile,
  unreadMessages = 0,
}: {
  profile: ProfileLite;
  /** Conversations with something unseen; shown as a badge. */
  unreadMessages?: number;
}) {
  const pathname = usePathname();
  const profileHref = `/u/${profile.username}` as const;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-edge bg-surface px-5 py-7 md:flex">
        <Link href="/feed" className="font-display text-xl font-black tracking-tight">
          Headcount
        </Link>

        <Link
          href="/events/new"
          aria-current={isActive("/events/new") ? "page" : undefined}
          className="mt-7 flex items-center justify-center gap-2 rounded-full bg-flare px-4 py-2.5 font-semibold text-on-flare hover:bg-flare-deep"
        >
          <Plus size={18} aria-hidden /> New post
        </Link>

        <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
          {DESKTOP_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors ${
                  active ? "bg-surface text-fore" : "text-muted-2 hover:bg-surface hover:text-fore"
                }`}
              >
                <Icon size={20} aria-hidden />
                {label}
                {href === "/messages" && unreadMessages > 0 && (
                  <span className="ml-auto rounded-full bg-flare px-2 py-0.5 text-xs font-semibold text-on-flare">
                    {unreadMessages}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-edge pt-4">
          <Link
            href={profileHref}
            aria-current={isActive(profileHref) ? "page" : undefined}
            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface"
          >
            <Avatar profile={profile} size={32} />
            <span className="min-w-0">
              <span className="block truncate font-semibold leading-tight">
                {profile.display_name || profile.username}
              </span>
              <span className="block truncate text-xs text-muted">@{profile.username}</span>
            </span>
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-2 hover:bg-surface hover:text-fore"
          >
            <Settings size={18} aria-hidden /> Settings
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted-2 hover:bg-surface hover:text-fore"
            >
              <LogOut size={18} aria-hidden /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar: people + activity */}
      <div className="flex items-center justify-between px-4 pt-4 md:hidden">
        <Link href="/feed" className="font-display text-lg font-black tracking-tight">
          Headcount
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/messages"
            aria-label={unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : "Messages"}
            className={`relative rounded-full p-2 ${isActive("/messages") ? "bg-surface text-fore" : "text-muted-2"}`}
          >
            <MessageCircle size={20} aria-hidden />
            {unreadMessages > 0 && (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-flare" aria-hidden />
            )}
          </Link>
          <Link
            href="/people"
            aria-label="People"
            className={`rounded-full p-2 ${isActive("/people") ? "bg-surface text-fore" : "text-muted-2"}`}
          >
            <Users size={20} aria-hidden />
          </Link>
          <Link
            href="/activity"
            aria-label="Activity"
            className={`rounded-full p-2 ${isActive("/activity") ? "bg-surface text-fore" : "text-muted-2"}`}
          >
            <Bell size={20} aria-hidden />
          </Link>
        </div>
      </div>

      {/* Mobile tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-edge bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {MOBILE_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          const isPost = href === "/events/new";
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                active ? "text-fore" : "text-muted"
              }`}
            >
              {isPost ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-flare text-on-flare">
                  <Icon size={18} aria-hidden />
                </span>
              ) : (
                <Icon size={22} aria-hidden className="h-7" />
              )}
              {label}
            </Link>
          );
        })}
        <Link
          href={profileHref}
          aria-current={isActive(profileHref) ? "page" : undefined}
          aria-label="Your profile"
          className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
            isActive(profileHref) ? "text-fore" : "text-muted"
          }`}
        >
          <Avatar profile={profile} size={26} className="h-7" />
          You
        </Link>
      </nav>
    </>
  );
}
