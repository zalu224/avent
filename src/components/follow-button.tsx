"use client";

import { useOptimistic, useTransition } from "react";
import { setFollow } from "@/lib/actions/social";

export function FollowButton({
  targetId,
  following,
  size = "md",
}: {
  targetId: string;
  following: boolean;
  size?: "sm" | "md";
}) {
  const [pending, startTransition] = useTransition();
  const [isFollowing, setIsFollowing] = useOptimistic(following);

  const toggle = () =>
    startTransition(async () => {
      setIsFollowing(!isFollowing);
      await setFollow(targetId, !isFollowing);
    });

  const sizing = size === "sm" ? "px-3 py-1.5 text-xs" : "";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={isFollowing}
      className={`btn ${sizing} ${isFollowing ? "btn-outline" : "btn-primary"}`}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
