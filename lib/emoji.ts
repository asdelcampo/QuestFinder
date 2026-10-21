import type { Database } from "@/lib/database.types";

type SessionType = Database["public"]["Enums"]["session_type"];

// DESIGN.md §5: objects, not line icons. Native emoji for now.
const SESSION_EMOJI: Record<SessionType, string> = {
  bouldering: "🧗",
  roped: "🪢",
  intro: "🎓",
  outdoor: "🏞️",
  social: "🍽️",
  other: "✨",
};

const VENUE_EMOJI: Record<string, string> = {
  food: "🍽️",
  cafe: "☕",
  park: "🌳",
  climbing: "🧗",
};

export const SESSION_LABELS: Record<SessionType, string> = {
  bouldering: "Bouldering",
  roped: "Roped",
  intro: "Intro",
  outdoor: "Outdoor",
  social: "Social",
  other: "Other",
};

// Social plans take their look from the place (coffee, dinner, park); climbs from the session type
export function eventEmoji(sessionType: SessionType, venueCategory: string) {
  if (sessionType === "social" || sessionType === "other") return VENUE_EMOJI[venueCategory] ?? SESSION_EMOJI[sessionType];
  return SESSION_EMOJI[sessionType];
}

export function venueEmoji(category: string | null | undefined) {
  return (category && VENUE_EMOJI[category]) || "📍";
}
