import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { BucketList, type BucketListItem } from "@/components/bucket-list";
import { LevelForm } from "@/components/level-form";
import { Recommendations } from "@/components/recommendations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { myRsvpStatus, waitlistPosition } from "@/lib/events";
import { formatWhen } from "@/lib/format";
import { canCheckOff, getBucketItems, getProfile, getRecommendationContext } from "@/lib/profile-queries";
import { getUpcomingEvents, getVenues, type FeedEvent } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
      <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Back to events
      </Link>
      {/* Everything below reads the session, so it streams in behind a boundary */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading your profile…</p>}>
        <Profile />
      </Suspense>
    </main>
  );
}

async function Profile() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [profile, events, venues, bucketItems, context] = await Promise.all([
    getProfile(supabase, user.id),
    getUpcomingEvents(supabase),
    getVenues(supabase),
    getBucketItems(supabase),
    getRecommendationContext(supabase, user.id),
  ]);

  const now = new Date();
  const items: BucketListItem[] = bucketItems.map((item) => ({
    id: item.id,
    title: item.title,
    status: item.status,
    venueName: item.venue?.name ?? null,
    event: item.event ? { id: item.event.id, activity: item.event.activity, startsAt: item.event.starts_at } : null,
    canCheckOff: canCheckOff(item, user.id, now),
  }));

  const hosted = events.filter((e) => e.host_id === user.id);
  const joined = events.filter((e) => e.host_id !== user.id && myRsvpStatus(e, user.id) !== null);

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{profile.display_name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </header>

      <LevelForm level={profile.climbing_level} />

      <Recommendations
        events={events}
        context={context}
        limit={5}
        title="Recommended for you"
        emptyText="Nothing to recommend right now."
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Bucket list</h2>
        <BucketList items={items} venues={venues} />
      </section>

      <EventList title="Events you're hosting" events={hosted} userId={user.id} emptyText="You're not hosting anything yet." />
      <EventList title="Events you've joined" events={joined} userId={user.id} emptyText="You haven't joined any upcoming events." />
    </>
  );
}

type EventListProps = { title: string; events: FeedEvent[]; userId: string; emptyText: string };

function EventList({ title, events, userId, emptyText }: EventListProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {events.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex flex-col gap-1">
                <Link href={`/#event-${event.id}`} className="font-medium underline-offset-4 hover:underline">
                  {event.activity}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {event.venue.name} · {formatWhen(event.starts_at)}
                </p>
              </div>
              <RsvpBadge event={event} userId={userId} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RsvpBadge({ event, userId }: { event: FeedEvent; userId: string }) {
  if (event.host_id === userId) return <Badge variant="secondary">Hosting</Badge>;
  if (myRsvpStatus(event, userId) === "waitlist") {
    return <Badge variant="outline">Waitlist #{waitlistPosition(event, userId)}</Badge>;
  }
  return <Badge>Going</Badge>;
}
