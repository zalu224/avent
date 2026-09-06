"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Compass, LogOut, Plus, Settings, Users } from "lucide-react";
import { Avatar } from "./avatar";
import { signOut } from "@/lib/actions/auth";
import type { ProfileLite } from "@/lib/types";

const ITEMS = [
  { href: "/feed", label: "Feed", icon: Compass },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/events/new", label: "Post", icon: Plus },
  { href: "/people", label: "People", icon: Users },
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
        <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            const isPost = href === "/events/new";
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors ${
                  isPost
                    ? "mt-3 bg-flare text-ink hover:bg-flare-deep"
                    : active
                      ? "bg-plum text-cream"
                      : "text-lilac-2 hover:bg-plum hover:text-cream"
                }`}
              >
                <Icon size={20} aria-hidden />
                {isPost ? "Post a flyer" : label}
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

      {/* Mobile tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-plum-2 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {ITEMS.map(({ href, label, icon: Icon }) => {
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
