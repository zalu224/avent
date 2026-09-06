"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { Avatar } from "./avatar";
import { addComment, deleteComment, type CommentState } from "@/lib/actions/events";
import { timeAgo } from "@/lib/format";
import type { CommentWithAuthor } from "@/lib/types";

export function Comments({
  eventId,
  comments,
  currentUserId,
}: {
  eventId: string;
  comments: CommentWithAuthor[];
  currentUserId: string;
}) {
  return (
    <section aria-labelledby="comments-heading" className="mt-8">
      <h2 id="comments-heading" className="font-display text-lg font-bold">
        {comments.length === 0 ? "Start the plan" : `Plans (${comments.length})`}
      </h2>
      <p className="mt-1 text-sm text-muted">
        Sort out rides, meet-up spots and who’s getting tickets.
      </p>

      <ul className="mt-4 flex flex-col gap-4">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Link href={`/u/${c.author.username}`} className="shrink-0">
              <Avatar profile={c.author} size={32} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <Link href={`/u/${c.author.username}`} className="font-semibold hover:underline">
                  {c.author.display_name || c.author.username}
                </Link>{" "}
                <span className="text-muted">{timeAgo(c.created_at)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-line leading-relaxed">{c.body}</p>
            </div>
            {c.author_id === currentUserId && (
              <DeleteCommentButton commentId={c.id} eventId={eventId} />
            )}
          </li>
        ))}
      </ul>

      <CommentForm eventId={eventId} />
    </section>
  );
}

function DeleteCommentButton({ commentId, eventId }: { commentId: string; eventId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => deleteComment(commentId, eventId))}
      className="self-start text-xs text-muted hover:text-flare disabled:opacity-50"
    >
      Delete
    </button>
  );
}

function CommentForm({ eventId }: { eventId: string }) {
  const action = addComment.bind(null, eventId);
  const [state, formAction, pending] = useActionState<CommentState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.savedAt) formRef.current?.reset();
  }, [state.savedAt]);

  return (
    <form ref={formRef} action={formAction} className="mt-5 flex flex-col gap-2">
      <label htmlFor="comment-body" className="sr-only">
        Add to the plan
      </label>
      <textarea
        id="comment-body"
        name="body"
        rows={2}
        required
        maxLength={1000}
        placeholder="Who’s driving? Meet at the door at 10?"
        className="field resize-y"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-flare" role="alert">
          {state.error}
        </p>
        <button type="submit" disabled={pending} className="btn btn-outline">
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
