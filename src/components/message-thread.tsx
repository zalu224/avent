"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { SendHorizontal } from "lucide-react";
import { Avatar } from "./avatar";
import { markRead, sendMessage } from "@/lib/actions/messages";
import { timeAgo } from "@/lib/format";
import type { Message } from "@/lib/messages";
import { createClient } from "@/lib/supabase/client";
import type { ProfileLite } from "@/lib/types";

const POLL_MS = 6_000;

/**
 * A conversation: the message list, live updates, and the composer.
 *
 * New messages from other people arrive over Supabase Realtime; a light poll
 * for anything newer than the last message runs while the tab is visible as a
 * safety net, so a dropped socket never leaves the thread stale. The composer
 * appends the sender's own message as soon as it saves.
 */
export function MessageThread({
  conversationId,
  meId,
  initialMessages,
  members,
  isGroup,
}: {
  conversationId: string;
  meId: string;
  initialMessages: Message[];
  members: ProfileLite[];
  isGroup: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [sending, startSending] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const latestAt = useRef<string>(initialMessages.at(-1)?.created_at ?? "1970-01-01T00:00:00Z");
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const byId = new Map(members.map((m) => [m.id, m]));

  function append(message: Message) {
    if (message.created_at > latestAt.current) latestAt.current = message.created_at;
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    // Someone else's message showed up while the thread is open: count it as seen.
    if (message.sender_id !== meId && document.visibilityState === "visible") {
      if (readTimer.current) clearTimeout(readTimer.current);
      readTimer.current = setTimeout(() => void markRead(conversationId), 800);
    }
  }

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function fetchNewer() {
      if (document.visibilityState !== "visible") return;
      const { data } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .eq("conversation_id", conversationId)
        .gt("created_at", latestAt.current)
        .order("created_at", { ascending: true })
        .limit(100);
      if (cancelled) return;
      for (const m of (data ?? []) as Message[]) append(m);
      setNow(new Date());
    }

    // Realtime checks row-level security with the user's token, so hand it the
    // session before subscribing; anonymously it would connect and see nothing.
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`conversation:${conversationId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (payload) => append(payload.new as Message)
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[messages] realtime", status, err?.message ?? "");
          }
        });
    })();

    const poll = setInterval(fetchNewer, POLL_MS);
    document.addEventListener("visibilitychange", fetchNewer);

    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", fetchNewer);
      if (readTimer.current) clearTimeout(readTimer.current);
      if (channel) {
        // Leave the channel now, but drop it from the client a moment later so a
        // thread opened right after this one doesn't race the socket teardown.
        const leaving = channel;
        void leaving.unsubscribe();
        setTimeout(() => void supabase.removeChannel(leaving), 1500);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // The sender's own message comes back from the action; show it and clear the box.
  function submit(formData: FormData) {
    setError(null);
    startSending(async () => {
      const result = await sendMessage({}, formData);
      if (result.sent) {
        append(result.sent);
        formRef.current?.reset();
        textarea.current?.focus();
      } else {
        setError(result.error ?? "Your message didn't send. Try again.");
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <div className="flex min-h-[60dvh] flex-col">
      <ol className="flex flex-1 flex-col gap-1 py-4" aria-label="Messages">
        {messages.length === 0 && (
          <li className="py-10 text-center text-muted-2">Say hi. Only people in this conversation can see it.</li>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === meId;
          const sender = byId.get(m.sender_id);
          const prev = messages[i - 1];
          const startsRun = !prev || prev.sender_id !== m.sender_id;
          return (
            <li
              key={m.id}
              className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${startsRun ? "mt-3" : ""}`}
            >
              {!mine && (
                <span className="w-7 shrink-0">
                  {startsRun && sender && <Avatar profile={sender} size={28} />}
                </span>
              )}
              <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                {!mine && isGroup && startsRun && sender && (
                  <span className="mb-0.5 px-1 text-xs text-muted">{sender.display_name || sender.username}</span>
                )}
                <p
                  className={`whitespace-pre-line break-words rounded-2xl px-3.5 py-2 leading-snug ${
                    mine ? "rounded-br-md bg-flare text-on-flare" : "rounded-bl-md bg-surface text-fore"
                  }`}
                  title={new Date(m.created_at).toLocaleString()}
                >
                  {m.body}
                </p>
                {i === messages.length - 1 && (
                  <span className="mt-1 px-1 text-[11px] text-muted">{timeAgo(m.created_at, now)}</span>
                )}
              </div>
            </li>
          );
        })}
        <div ref={bottom} />
      </ol>

      <form
        ref={formRef}
        action={submit}
        className="sticky bottom-20 flex items-end gap-2 rounded-card border border-edge bg-surface p-2 md:bottom-4"
      >
        <input type="hidden" name="conversation_id" value={conversationId} />
        <textarea
          ref={textarea}
          name="body"
          rows={1}
          maxLength={4000}
          required
          placeholder="Message…"
          onKeyDown={onKeyDown}
          className="field max-h-40 min-h-[2.75rem] flex-1 resize-none border-0 bg-transparent"
          aria-label="Message"
        />
        <button type="submit" disabled={sending} className="btn btn-primary shrink-0 px-3" aria-label="Send">
          <SendHorizontal size={18} aria-hidden />
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-flare">
          {error}
        </p>
      )}
    </div>
  );
}
