import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { Avatar } from "@/components/avatar";
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
    // Bottom padding keeps the last section clear of the floating dock
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 pt-16 pb-36">
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
      {/* The avatar breaks out of the top of the sheet (DESIGN.md §6.13) */}
      <header className="glass relative flex flex-col items-center gap-3 rounded-sheet px-6 pt-16 pb-6 text-center">
        <div className="absolute -top-12">
          <Avatar id={user.id} name={profile.display_name} size="xl" />
        </div>
        <div>
          <h1 className="display text-4xl">{profile.display_name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <ul className="flex flex-wrap justify-center gap-2 text-sm font-semibold">
          <li className="rounded-full border border-white bg-white/70 px-3 py-1">
            <span className="text-primary">{hosted.length}</span> hosting
          </li>
          <li className="rounded-full border border-white bg-white/70 px-3 py-1">
            <span className="text-primary">{joined.length}</span> joined
          </li>
        </ul>
        <QuestProgress done={items.filter((i) => i.status === "done").length} total={items.length} />
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm" className="rounded-full">
            Sign out
          </Button>
        </form>
      </header>

      <section className="glass rounded-3xl p-5">
        <LevelForm level={profile.climbing_level} />
      </section>

      <Recommendations
        events={events}
        context={context}
        limit={5}
        title="Recommended for you"
        emptyText="Nothing to recommend right now."
      />

      <section className="flex flex-col gap-3">
        <h2 className="display text-3xl">
          Your side <span className="text-primary">quests</span>
        </h2>
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
      <h2 className="display text-3xl">{title}</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="glass flex flex-col divide-y divide-white rounded-3xl">
          {events.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div className="flex flex-col gap-1">
                <Link href={`/#event-${event.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
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

// The % bubble from Bump's scratch map, as quest progress (DESIGN.md §6.11)
function QuestProgress({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const percent = Math.round((done / total) * 100);
  return (
    <div className="slab flex items-center gap-3 rounded-3xl px-5 py-3 text-left">
      <span className="display text-4xl">
        {percent}
        <sup className="align-top text-lg opacity-60">%</sup>
      </span>
      <span className="text-sm leading-tight font-semibold">
        of your side quests done
        <br />
        <span className="text-bump-cyan">
          {done} of {total}
        </span>
      </span>
    </div>
  );
}
