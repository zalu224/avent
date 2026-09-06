"use client";

import { useState } from "react";
import { Check, Link2, Send } from "lucide-react";

export function ShareButton({
  title,
  url,
  compact = false,
}: {
  title: string;
  /** Absolute or relative URL to share; defaults to the current page. */
  url?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const target = url ? new URL(url, window.location.origin).toString() : window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url: target });
        return;
      }
      await navigator.clipboard.writeText(target);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // User dismissed the share sheet or clipboard is unavailable.
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={share}
        aria-label={copied ? "Link copied" : "Share"}
        className={`btn btn-ghost px-2 ${copied ? "text-glow-ink" : ""}`}
      >
        {copied ? <Check size={20} aria-hidden /> : <Send size={20} aria-hidden />}
      </button>
    );
  }

  return (
    <button type="button" onClick={share} className="btn btn-outline">
      {copied ? (
        <>
          <Check size={14} aria-hidden /> Link copied
        </>
      ) : (
        <>
          <Link2 size={14} aria-hidden /> Share
        </>
      )}
    </button>
  );
}
