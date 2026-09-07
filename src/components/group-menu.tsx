"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MoreHorizontal, UserPlus } from "lucide-react";
import { leaveGroup, renameGroup, type MessageState } from "@/lib/actions/messages";

/** Rename, add people to, or leave a group chat. */
export function GroupMenu({ conversationId, title }: { conversationId: string; title: string | null }) {
  const [state, formAction, pending] = useActionState<MessageState, FormData>(renameGroup, {});

  return (
    <details className="relative">
      <summary
        className="btn btn-ghost list-none px-2 [&::-webkit-details-marker]:hidden"
        aria-label="Group options"
      >
        <MoreHorizontal size={20} aria-hidden />
      </summary>
      <div className="absolute right-0 z-10 mt-1 w-72 rounded-card border border-edge bg-surface p-3 shadow-lg">
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="conversation_id" value={conversationId} />
          <label htmlFor="group-title" className="field-label">
            Group name
          </label>
          <div className="flex gap-2">
            <input
              id="group-title"
              name="title"
              defaultValue={title ?? ""}
              maxLength={80}
              required
              className="field min-w-0 flex-1"
            />
            <button type="submit" disabled={pending} className="btn btn-outline shrink-0 text-sm">
              Save
            </button>
          </div>
          {state.error && (
            <p role="alert" className="text-sm text-flare">
              {state.error}
            </p>
          )}
        </form>

        <Link
          href={`/messages/${conversationId}/add`}
          className="mt-3 flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-edge/60"
        >
          <UserPlus size={16} aria-hidden /> Add people
        </Link>

        <form action={leaveGroup} className="mt-1 border-t border-edge pt-2">
          <input type="hidden" name="conversation_id" value={conversationId} />
          <button
            type="submit"
            className="w-full rounded-lg px-2 py-2 text-left text-sm text-flare hover:bg-edge/60"
          >
            Leave group
          </button>
        </form>
      </div>
    </details>
  );
}
