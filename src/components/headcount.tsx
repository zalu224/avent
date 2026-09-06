import { Avatar } from "./avatar";
import { pluralize } from "@/lib/format";
import type { RsvpLite } from "@/lib/types";

export function Headcount({
  rsvps,
  past = false,
  max = 4,
}: {
  rsvps: RsvpLite[];
  past?: boolean;
  max?: number;
}) {
  const going = rsvps.filter((r) => r.status === "going" || r.status === "went");
  const interested = rsvps.filter((r) => r.status === "interested");
  const shown = [...going, ...interested].filter((r) => r.profile).slice(0, max);
  const goingWord = past ? "went" : "going";

  if (going.length === 0 && interested.length === 0) {
    return <p className="text-sm text-lilac">{past ? "Nobody logged this one." : "Nobody's in yet. Be first."}</p>;
  }

  return (
    <div className="flex items-center gap-2.5">
      {shown.length > 0 && (
        <div className="flex -space-x-2">
          {shown.map((r) => (
            <Avatar
              key={r.user_id}
              profile={r.profile!}
              size={26}
              className="ring-2 ring-ink"
            />
          ))}
        </div>
      )}
      <p className="text-sm text-lilac-2">
        {going.length > 0 && <span className="font-semibold text-cream">{pluralize(going.length, "person", "people")} {goingWord}</span>}
        {going.length > 0 && interested.length > 0 && ", "}
        {interested.length > 0 && <span>{interested.length} interested</span>}
      </p>
    </div>
  );
}
