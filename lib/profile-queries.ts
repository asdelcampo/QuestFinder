import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { median, type RecommendationContext } from "@/lib/recommend";

type Client = SupabaseClient<Database>;

// Every function here runs as the signed-in user, so row-level security applies.
// Call them after getCurrentUser(), which makes the render request-time.

export async function getProfile(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, climbing_level")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

// The linked event's RSVPs tell us whether the owner was going, for the check-off prompt
const BUCKET_SELECT = `
  id, title, status, done_at, created_at,
  venue:venues(id, name),
  event:events(id, activity, starts_at, status, rsvps(user_id, status))
`;

// Bucket items are owner-only, so this returns just my own items
export async function getBucketItems(supabase: Client) {
  const { data, error } = await supabase.from("bucket_items").select(BUCKET_SELECT).order("created_at");
  if (error) throw error;
  return data;
}

export async function getBucketItem(supabase: Client, id: string) {
  const { data, error } = await supabase.from("bucket_items").select(BUCKET_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export type BucketItem = Awaited<ReturnType<typeof getBucketItems>>[number];

// Spec Rule 4: offer check-off once the planned event has started, if I was going
export function canCheckOff(item: BucketItem, userId: string, now: Date) {
  if (item.status !== "planned" || !item.event) return false;
  const started = new Date(item.event.starts_at) <= now;
  const wasGoing = item.event.rsvps.some((r) => r.user_id === userId && r.status === "going");
  return started && wasGoing;
}

// Everything scoreEvent() needs besides the events themselves
export async function getRecommendationContext(supabase: Client, userId: string): Promise<RecommendationContext> {
  const [profile, bucket, members, joined] = await Promise.all([
    supabase.from("profiles").select("climbing_level").eq("id", userId).single(),
    supabase.from("bucket_items").select("venue_id").in("status", ["wishlist", "planned"]),
    // Row-level security returns only members of my own groups, so these are my friends (and me)
    supabase.from("group_members").select("user_id"),
    // Past events count too: they are my price history
    supabase.from("rsvps").select("event:events(price_per_person)").eq("user_id", userId).eq("status", "going"),
  ]);
  for (const result of [profile, bucket, members, joined]) {
    if (result.error) throw result.error;
  }

  const bucketVenueIds = new Set<string>();
  for (const item of bucket.data ?? []) if (item.venue_id) bucketVenueIds.add(item.venue_id);

  const friendIds = new Set((members.data ?? []).map((m) => m.user_id));
  friendIds.delete(userId);

  const prices = (joined.data ?? []).flatMap((r) => (r.event ? [r.event.price_per_person] : []));

  return {
    userId,
    level: profile.data?.climbing_level ?? null,
    bucketVenueIds,
    friendIds,
    medianJoinedPrice: median(prices),
  };
}
