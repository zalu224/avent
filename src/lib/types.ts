export const EVENT_CATEGORIES = [
  "concert",
  "rave",
  "club",
  "festival",
  "party",
  "sports",
  "comedy",
  "art",
  "food",
  "other",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  concert: "Concert",
  rave: "Rave",
  club: "Club night",
  festival: "Festival",
  party: "Party",
  sports: "Sports",
  comedy: "Comedy",
  art: "Art",
  food: "Food & drink",
  other: "Event",
};

export const RSVP_STATUSES = ["interested", "going", "went"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  first_name?: string | null;
  last_name?: string | null;
  email_notifications?: boolean;
  reminder_emails?: boolean;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileLite = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url"
>;

export type EventRow = {
  id: string;
  author_id: string;
  title: string;
  caption: string | null;
  description: string | null;
  category: EventCategory;
  venue_name: string | null;
  address: string | null;
  city: string | null;
  starts_at: string;
  ends_at: string | null;
  lineup: string[];
  tags: string[];
  price: string | null;
  ticket_url: string | null;
  organizer_name: string | null;
  organizer_url: string | null;
  event_url: string | null;
  link_checks: Record<string, LinkCheckSummary>;
  timezone: string;
  image_url: string | null;
  image_path: string | null;
  ai_extracted: boolean;
  ai_confidence: number | null;
  created_at: string;
  updated_at: string;
};

export type LinkCheckSummary = {
  source: "flyer" | "google" | "user";
  checked_at: string;
  final_url: string;
  host: string;
  safe_browsing: "ok" | "unchecked" | "flagged";
  corroborated: boolean;
};

export type RsvpLite = {
  user_id: string;
  status: RsvpStatus;
  profile: ProfileLite | null;
};

export type EventWithMeta = EventRow & {
  author: ProfileLite;
  rsvps: RsvpLite[];
  /** Filled in by getFeed for the feed cards. */
  comment_count?: number;
};

export type CommentWithAuthor = {
  id: string;
  event_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: ProfileLite;
};

export type ProfileStats = {
  followers: number;
  following: number;
  posts: number;
  beenTo: number;
};
