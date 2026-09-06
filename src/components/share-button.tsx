"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // User dismissed the share sheet or clipboard is unavailable.
    }
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
