"use client";

import { useActionState, useMemo, useState } from "react";
import { Avatar } from "./avatar";
import type { MessageState } from "@/lib/actions/messages";
import type { ProfileLite } from "@/lib/types";

/**
 * Pick people for a new conversation (one person = a DM, more = a group) or to
 * add to an existing group. The list is who you follow and who follows you.
 */
export function PeoplePicker({
  people,
  action,
  conversationId,
  submitLabel,
}: {
  people: ProfileLite[];
  action: (prev: MessageState, formData: FormData) => Promise<MessageState>;
  /** Set when adding to an existing group. */
  conversationId?: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<MessageState, FormData>(action, {});
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) => p.username.toLowerCase().includes(q) || (p.display_name ?? "").toLowerCase().includes(q)
    );
  }, [people, query]);

  const isGroup = !conversationId && picked.size > 1;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-4">
      {conversationId && <input type="hidden" name="conversation_id" value={conversationId} />}
      {[...picked].map((id) => (
        <input key={id} type="hidden" name="member" value={id} />
      ))}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search people you follow"
        className="field"
        aria-label="Search people"
      />

      {isGroup && (
        <div>
          <label htmlFor="title" className="field-label">
            Group name
          </label>
          <input id="title" name="title" maxLength={80} placeholder="Friday crew" className="field" />
        </div>
      )}

      <ul className="max-h-[50dvh] divide-y divide-edge overflow-y-auto" aria-label="People">
        {shown.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-2">
            {people.length === 0 ? "Follow a few people first, then you can message them." : "No one matches."}
          </li>
        )}
        {shown.map((p) => {
          const on = picked.has(p.id);
          return (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-3 py-2.5">
                <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="size-4 accent-flare" />
                <Avatar profile={p} size={36} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.display_name || p.username}</span>
                  <span className="block truncate text-sm text-muted">@{p.username}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {state.error && (
        <p role="alert" className="text-sm text-flare">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">
          {picked.size === 0 ? "Nobody picked yet" : `${picked.size} picked`}
        </span>
        <button type="submit" disabled={pending || picked.size === 0} className="btn btn-primary">
          {pending ? "Starting…" : isGroup ? "Create group" : submitLabel}
        </button>
      </div>
    </form>
  );
}
