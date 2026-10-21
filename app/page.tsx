import { Suspense } from "react";
import { CreateEventDialog } from "@/components/create-event-dialog";
import { EventCard } from "@/components/event-card";
import { Recommendations } from "@/components/recommendations";
import { getCurrentUser } from "@/lib/auth";
import { getRecommendationContext } from "@/lib/profile-queries";
import { getMyGroups, getUpcomingEvents, getVenues } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

// The heading is static, so it prerenders into the shell. The session and the URL's search params
// are request-time data, so everything that reads them streams in behind a <Suspense> boundary.
export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    // Bottom padding keeps the last card clear of the floating dock
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-10 pb-36">
      <header className="flex flex-col gap-2">
        {/* One blue word per headline (DESIGN.md §3.3) */}
        <h1 className="display text-5xl sm:text-6xl">
          What&apos;s <span className="text-primary">happening</span>
        </h1>
        <p className="text-muted-foreground">Upcoming events from your crew and around Manila.</p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading events…</p>}>
        <Feed />
      </Suspense>
      <Suspense fallback={null}>
        <NewEvent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Feed() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [events, context] = await Promise.all([
    getUpcomingEvents(supabase),
    getRecommendationContext(supabase, user.id),
  ]);

  if (events.length === 0) {
    return (
      <div className="glass flex flex-col items-center gap-2 rounded-card p-8 text-center">
        <span aria-hidden className="sticker text-5xl">🗓️</span>
        <p className="display text-2xl">No upcoming events</p>
        <p className="text-muted-foreground">Nothing here yet. Start something?</p>
      </div>
    );
  }
  return (
    <>
      {/* Hides itself when nothing scores */}
      <Recommendations events={events} context={context} limit={3} title="For you" />
      <ul className="flex flex-col gap-6">
        {events.map((event) => (
          <li key={event.id}>
            <EventCard event={event} userId={user.id} />
          </li>
        ))}
      </ul>
    </>
  );
}

// ?new=1 opens Create Event. ?new=1&bucket=<id> pre-fills it from a bucket list item.
async function NewEvent({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const params = await searchParams;
  if (params.new !== "1") return null;

  await getCurrentUser();
  const supabase = await createClient();
  const [venues, groups, bucketItem] = await Promise.all([
    getVenues(supabase),
    getMyGroups(supabase),
    getBucketItem(supabase, params.bucket),
  ]);

  // A bucket item with a venue picks that venue; otherwise its title becomes the activity
  const initial = bucketItem?.venue_id
    ? { venueId: bucketItem.venue_id }
    : bucketItem
      ? { activity: bucketItem.title.slice(0, 60) }
      : undefined;

  return (
    <CreateEventDialog venues={venues} groups={groups} initial={initial} bucketItemId={bucketItem?.id} />
  );
}

// Row-level security only returns your own bucket items, so someone else's id finds nothing
async function getBucketItem(supabase: Awaited<ReturnType<typeof createClient>>, id: string | string[] | undefined) {
  if (typeof id !== "string") return null;
  const { data } = await supabase.from("bucket_items").select("id, title, venue_id").eq("id", id).maybeSingle();
  return data;
}
