"use client";

import { useState, useTransition } from "react";
import { deleteEvent } from "@/lib/actions/events";

export function DeleteEventButton({ eventId }: { eventId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn btn-ghost text-sm">
        Delete post
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-2">Delete this post for everyone?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => deleteEvent(eventId))}
        className="btn btn-danger text-sm"
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost text-sm">
        Keep
      </button>
    </div>
  );
}
