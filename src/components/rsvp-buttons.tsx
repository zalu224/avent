"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { setRsvp } from "@/lib/actions/events";
import type { RsvpStatus } from "@/lib/types";

export function RsvpButtons({
  eventId,
  status,
  past,
  size = "md",
}: {
  eventId: string;
  status: RsvpStatus | null;
  past: boolean;
  size?: "sm" | "md";
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic<RsvpStatus | null>(status);

  const choose = (next: RsvpStatus | null) =>
    startTransition(async () => {
      setCurrent(next);
      await setRsvp(eventId, next);
    });

  const sizing = size === "sm" ? "px-3 py-1.5 text-xs" : "";

  if (past) {
    const went = current === "went" || current === "going";
    return (
      <button
        type="button"
        onClick={() => choose(went ? null : "went")}
        disabled={pending}
        aria-pressed={went}
        className={`btn ${sizing} ${went ? "btn-glow" : "btn-outline"}`}
      >
        {went ? (
          <>
            <Check size={16} aria-hidden /> Went
          </>
        ) : (
          "I went"
        )}
      </button>
    );
  }

  const going = current === "going";
  const interested = current === "interested";

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => choose(going ? null : "going")}
        disabled={pending}
        aria-pressed={going}
        className={`btn ${sizing} ${going ? "btn-glow" : "btn-primary"}`}
      >
        {going ? (
          <>
            <Check size={16} aria-hidden /> Going
          </>
        ) : (
          "I'm in"
        )}
      </button>
      <button
        type="button"
        onClick={() => choose(interested ? null : "interested")}
        disabled={pending}
        aria-pressed={interested}
        className={`btn ${sizing} ${interested ? "border-glow text-glow btn-outline" : "btn-outline"}`}
      >
        {interested ? "Interested" : "Maybe"}
      </button>
    </div>
  );
}
