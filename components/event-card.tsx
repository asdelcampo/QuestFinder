import { AvatarCluster } from "@/components/avatar";
import { RsvpButton } from "@/components/rsvp-button";
import { eventEmoji, SESSION_LABELS } from "@/lib/emoji";
import { isFull, myRsvpStatus, spotsLeft, waitlistPosition } from "@/lib/events";
import { formatLevel, formatPeso, formatWhen, googleMapsUrl } from "@/lib/format";
import type { FeedEvent } from "@/lib/queries";

// Glass card in the shape of Bump's place card (DESIGN.md §6.5): emoji sticker, heavy title,
// venue in blue, then status around the people going rather than in a table.
export function EventCard({ event, userId }: { event: FeedEvent; userId: string }) {
  const left = spotsLeft(event);
  const full = isFull(event);
  const waitlisted = event.rsvps.filter((r) => r.status === "waitlist").length;
  // In the order they joined, so the host and early birds come first
  const going = event.rsvps
    .filter((r) => r.status === "going")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => ({ id: r.user_id, name: r.profile.display_name }));
  const emoji = eventEmoji(event.session_type, event.venue.category);

  return (
    // The id lets the profile and recommendations link straight to this card (/#event-<id>)
    <article id={`event-${event.id}`} className="glass relative scroll-mt-6 rounded-card p-5">
      {full && (
        <span className="sticker tilt-right pop-in absolute -top-3 right-4 rounded-md bg-signal-red px-2.5 py-1 display text-xl text-white">
          FULL!
        </span>
      )}

      <div className="flex items-start gap-4">
        <span aria-hidden className="sticker text-5xl leading-none">
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="display text-[28px]">{event.activity}</h3>
          <p className="mt-1 text-sm">
            <a
              href={googleMapsUrl(event.venue.name, event.venue.google_place_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-semibold text-primary underline-offset-4 hover:underline"
            >
              {event.venue.name}
            </a>
            <span className="text-muted-foreground"> · {event.venue.neighborhood}</span>
          </p>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-2 text-sm font-medium">
        <Pill>{formatWhen(event.starts_at)}</Pill>
        <Pill>{formatPeso(event.price_per_person)}</Pill>
        <Pill>{SESSION_LABELS[event.session_type]}</Pill>
        {event.session_type !== "social" && <Pill>{formatLevel(event.level_min, event.level_max)}</Pill>}
        {event.visibility === "public" ? (
          <Pill>🌍 Public</Pill>
        ) : (
          <li className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
            🔒 {event.group?.name ?? "Private"}
          </li>
        )}
      </ul>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Spots left={left} capacity={event.capacity} full={full} waitlisted={waitlisted} />
          <div className="flex items-center gap-2">
            <AvatarCluster people={going} emoji={emoji} />
            <span className="text-sm text-muted-foreground">Hosted by {event.host.display_name}</span>
          </div>
        </div>
        <RsvpButton
          eventId={event.id}
          isHost={event.host_id === userId}
          status={myRsvpStatus(event, userId)}
          full={full}
          waitlistPosition={waitlistPosition(event, userId)}
        />
      </div>
    </article>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <li className="rounded-full border border-white bg-white/70 px-3 py-1">{children}</li>;
}

// "Bigger than you'd expect" numbers (DESIGN.md §6.5)
function Spots({ left, capacity, full, waitlisted }: { left: number | null; capacity: number | null; full: boolean; waitlisted: number }) {
  if (left === null) return <p className="display text-2xl text-periwinkle">No limit</p>;
  if (full) {
    return (
      <p className="display text-2xl text-signal-red">
        Full{waitlisted > 0 && <span className="font-sans text-sm font-semibold text-muted-foreground"> · {waitlisted} waitlisted</span>}
      </p>
    );
  }
  return (
    <p className="flex items-baseline gap-1.5">
      <span className="display text-4xl text-bump-ultra">{left}</span>
      <span className="text-sm font-semibold text-periwinkle">
        {left === 1 ? "spot" : "spots"} left of {capacity}
      </span>
    </p>
  );
}
