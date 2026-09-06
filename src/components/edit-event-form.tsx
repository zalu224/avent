"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { EventFieldInputs, type EventFields } from "./event-fields";
import { updateEvent, type CreateEventState } from "@/lib/actions/events";
import { isoToLocalInput } from "@/lib/format";
import type { EventRow } from "@/lib/types";

export function EditEventForm({ event, tz }: { event: EventRow; tz: string }) {
  const [fields, setFields] = useState<EventFields>({
    title: event.title,
    category: event.category,
    starts_at_local: isoToLocalInput(event.starts_at, tz),
    ends_at_local: event.ends_at ? isoToLocalInput(event.ends_at, tz) : "",
    venue_name: event.venue_name ?? "",
    address: event.address ?? "",
    city: event.city ?? "",
    lineup: event.lineup.join(", "),
    price: event.price ?? "",
    ticket_url: event.ticket_url ?? "",
    description: event.description ?? "",
  });
  const [caption, setCaption] = useState(event.caption ?? "");
  const [state, formAction, pending] = useActionState<CreateEventState, FormData>(updateEvent, {});

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-4">
      <input type="hidden" name="id" value={event.id} />
      <input type="hidden" name="tz" value={tz} />

      <div>
        <label htmlFor="caption" className="field-label">
          Caption
        </label>
        <textarea
          id="caption"
          name="caption"
          rows={2}
          maxLength={2000}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="field resize-y"
        />
      </div>

      <EventFieldInputs fields={fields} onChange={setFields} />

      {state.error && (
        <p role="alert" className="text-sm text-flare">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link href={`/events/${event.id}`} className="btn btn-ghost">
          Cancel
        </Link>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
