import { fmt } from "@/lib/format";

export function DateBadge({
  iso,
  tz,
  past = false,
  size = "md",
}: {
  iso: string;
  tz: string;
  past?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dims =
    size === "lg"
      ? "h-24 w-24 [--day:2.75rem] [--meta:0.8rem]"
      : size === "sm"
        ? "h-12 w-12 [--day:1.25rem] [--meta:0.6rem]"
        : "h-16 w-16 [--day:1.75rem] [--meta:0.7rem]";
  const tone = past ? "bg-plum-2 text-lilac" : "bg-glow text-ink";

  return (
    <time
      dateTime={iso}
      className={`flex shrink-0 flex-col items-center justify-center rounded-lg leading-none ${dims} ${tone}`}
    >
      <span className="font-semibold uppercase tracking-wide" style={{ fontSize: "var(--meta)" }}>
        {fmt(iso, tz, "MMM")}
      </span>
      <span className="font-display font-black" style={{ fontSize: "var(--day)" }}>
        {fmt(iso, tz, "d")}
      </span>
      <span className="font-medium" style={{ fontSize: "var(--meta)" }}>
        {fmt(iso, tz, "EEE")}
      </span>
    </time>
  );
}
