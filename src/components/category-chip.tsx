import { CATEGORY_LABELS, type EventCategory } from "@/lib/types";

export function CategoryChip({ category }: { category: EventCategory }) {
  return <span className="chip">{CATEGORY_LABELS[category] ?? category}</span>;
}
