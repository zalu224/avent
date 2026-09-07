import { Users } from "lucide-react";
import { Avatar } from "./avatar";
import type { ProfileLite } from "@/lib/types";

/** Two overlapping avatars for a group, or a people icon when there's nobody else yet. */
export function GroupAvatar({ people, size = 44 }: { people: ProfileLite[]; size?: number }) {
  const [a, b] = people;
  if (!a) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-edge text-muted"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <Users size={size * 0.5} />
      </span>
    );
  }
  if (!b) return <Avatar profile={a} size={size} />;
  const small = Math.round(size * 0.68);
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }} aria-hidden>
      <span className="absolute left-0 top-0">
        <Avatar profile={a} size={small} />
      </span>
      <span className="absolute bottom-0 right-0 rounded-full ring-2 ring-canvas">
        <Avatar profile={b} size={small} />
      </span>
    </span>
  );
}
