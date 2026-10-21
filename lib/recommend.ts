// Recommendation scoring (spec Rule 3, amended in implementation.md §2). Pure: no I/O, so it is
// easy to test. The query already returns only upcoming, open, visible events, so past events
// never reach this code.
import { isFull } from "@/lib/events";

// The parts of a feed event that scoring reads. FeedEvent from lib/queries.ts fits this shape.
export type ScorableEvent = {
  host_id: string;
  session_type: string;
  level_min: number | null;
  level_max: number | null;
  price_per_person: number;
  starts_at: string;
  capacity: number | null;
  venue: { id: string } | null;
  rsvps: { user_id: string; status: "going" | "waitlist"; created_at: string }[];
};

export type RecommendationContext = {
  userId: string;
  level: number | null;
  bucketVenueIds: Set<string>; // venues of my wishlist and planned bucket items
  friendIds: Set<string>; // people I share a group with, not counting me
  medianJoinedPrice: number | null; // null when I have joined nothing
};

type Signal = { points: number; label: string };

// Level fit only means something for climbing sessions. Social events have no level range,
// which would otherwise read as "all levels" and give every dinner the points.
const CLIMBING_TYPES = new Set(["bouldering", "roped", "intro", "outdoor"]);

export function fitsLevel(event: ScorableEvent, level: number) {
  if (event.level_min === null || event.level_max === null) return true; // all levels
  return event.level_min <= level && level <= event.level_max;
}

export function scoreEvent(event: ScorableEvent, ctx: RecommendationContext) {
  if (event.host_id === ctx.userId) return null;
  if (isFull(event)) return null;
  if (event.rsvps.some((r) => r.user_id === ctx.userId)) return null;

  const signals: Signal[] = [];

  if (event.venue && ctx.bucketVenueIds.has(event.venue.id)) {
    signals.push({ points: 3, label: "on your bucket list" });
  }

  if (CLIMBING_TYPES.has(event.session_type) && ctx.level !== null && fitsLevel(event, ctx.level)) {
    signals.push({ points: 2, label: "fits your level" });
  }

  const friendsGoing = event.rsvps.filter((r) => r.status === "going" && ctx.friendIds.has(r.user_id));
  const friends = Math.min(3, friendsGoing.length);
  if (friends > 0) {
    signals.push({ points: 2 * friends, label: `${friends} ${friends === 1 ? "friend" : "friends"} going` });
  }

  if (ctx.medianJoinedPrice !== null && event.price_per_person <= ctx.medianJoinedPrice) {
    signals.push({ points: 1, label: "in your usual price range" });
  }

  const score = signals.reduce((total, s) => total + s.points, 0);
  if (score === 0) return null;

  // The label shows the two strongest signals. sort() is stable, so ties keep the order above.
  const reason = [...signals]
    .sort((a, b) => b.points - a.points)
    .slice(0, 2)
    .map((s) => s.label)
    .join(", ");
  return { score, reason };
}

// Highest score first; on a tie, the sooner event first
export function recommend<T extends ScorableEvent>(events: T[], ctx: RecommendationContext, limit: number) {
  const picks: { event: T; score: number; reason: string }[] = [];
  for (const event of events) {
    const result = scoreEvent(event, ctx);
    if (result) picks.push({ event, ...result });
  }
  // starts_at is an ISO timestamp from Postgres, so string order is time order
  return picks
    .sort((a, b) => b.score - a.score || a.event.starts_at.localeCompare(b.event.starts_at))
    .slice(0, limit);
}

export function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
