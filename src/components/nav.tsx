"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Compass,
  LogOut,
  Newspaper,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import { Avatar } from "./avatar";
import { signOut } from "@/lib/actions/auth";
import type { ProfileLite } from "@/lib/types";

const DESKTOP_ITEMS = [
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/people", label: "People", icon: Users },
  { href: "/activity", label: "Activity", icon: Bell },
] as const;

const MOBILE_ITEMS = [
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/events/new", label: "Post", icon: Plus },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
] as const;

export function Nav({ profile }: { profile: ProfileLite }) {
  const pathname = usePathname();
  const profileHref = `/u/${profile.username}` as const;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-plum-2 bg-ink px-5 py-7 md:flex">
        <Link href="/feed" className="font-display text-xl font-black tracking-tight">
          Headcount
        </Link>

        <Link
          href="/events/new"
          aria-current={isActive("/events/new") ? "page" : undefined}
          className="mt-7 flex items-center justify-center gap-2 rounded-full bg-flare px-4 py-2.5 font-semibold text-ink hover:bg-flare-deep"
        >
          <Plus size={18} aria-hidden /> Post a flyer
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
                  active ? "bg-plum text-cream" : "text-lilac-2 hover:bg-plum hover:text-cream"
                }`}
              >
                <Icon size={20} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-plum-2 pt-4">
          <Link
            href={profileHref}
            aria-current={isActive(profileHref) ? "page" : undefined}
            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-plum"
          >
            <Avatar profile={profile} size={32} />
            <span className="min-w-0">
              <span className="block truncate font-semibold leading-tight">
                {profile.display_name || profile.username}
              </span>
              <span className="block truncate text-xs text-lilac">@{profile.username}</span>
            </span>
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-lilac-2 hover:bg-plum hover:text-cream"
          >
            <Settings size={18} aria-hidden /> Settings
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-lilac-2 hover:bg-plum hover:text-cream"
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
            href="/people"
            aria-label="People"
            className={`rounded-full p-2 ${isActive("/people") ? "bg-plum text-cream" : "text-lilac-2"}`}
          >
            <Users size={20} aria-hidden />
          </Link>
          <Link
            href="/activity"
            aria-label="Activity"
            className={`rounded-full p-2 ${isActive("/activity") ? "bg-plum text-cream" : "text-lilac-2"}`}
          >
            <Bell size={20} aria-hidden />
          </Link>
        </div>
      </div>

      {/* Mobile tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-plum-2 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
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
                active ? "text-cream" : "text-lilac"
              }`}
            >
              {isPost ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-flare text-ink">
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
            isActive(profileHref) ? "text-cream" : "text-lilac"
          }`}
        >
          <Avatar profile={profile} size={26} className="h-7" />
          You
        </Link>
      </nav>
    </>
  );
}
