import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

// One select shared by the feed, the profile, and recommendations.
// rsvps joins events and profiles, so the host embed needs the !host_id hint to pick a path.
const EVENT_SELECT = `
  id, activity, session_type, level_min, level_max, starts_at, price_per_person,
  capacity, visibility, status, host_id,
  venue:venues(id, name, neighborhood, category, google_place_id, lat, lng),
  group:groups(id, name),
  host:profiles!host_id(display_name),
  rsvps(user_id, status, created_at, profile:profiles(display_name))
`;

// Upcoming, open events the signed-in user can see. Row-level security does the visibility
// filtering. Call after getCurrentUser(), which makes the render request-time.
export async function getUpcomingEvents(supabase: Client) {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("status", "open")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at");
  if (error) throw error;
  return data;
}

export type FeedEvent = Awaited<ReturnType<typeof getUpcomingEvents>>[number];

// Groups the user belongs to (the policy only returns your own groups)
export async function getMyGroups(supabase: Client) {
  const { data, error } = await supabase.from("groups").select("id, name").order("name");
  if (error) throw error;
  return data;
}

export async function getVenues(supabase: Client) {
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, neighborhood, category")
    .order("name");
  if (error) throw error;
  return data;
}
