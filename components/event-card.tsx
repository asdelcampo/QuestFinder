import { RsvpButton } from "@/components/rsvp-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { isFull, myRsvpStatus, spotsLeft, waitlistPosition } from "@/lib/events";
import { formatLevel, formatPeso, formatWhen, googleMapsUrl } from "@/lib/format";
import type { FeedEvent } from "@/lib/queries";

const SESSION_LABELS: Record<FeedEvent["session_type"], string> = {
  bouldering: "Bouldering",
  roped: "Roped",
  intro: "Intro",
  outdoor: "Outdoor",
  social: "Social",
  other: "Other",
};

function spotsText(event: FeedEvent) {
  const left = spotsLeft(event);
  if (left === null) return "No limit";
  if (left > 0) return `${left} of ${event.capacity} spots left`;
  const waitlisted = event.rsvps.filter((r) => r.status === "waitlist").length;
  return waitlisted > 0 ? `Full · ${waitlisted} waitlisted` : "Full";
}

// First three names in the order they joined, then "+N" for the rest
function goingText(event: FeedEvent) {
  const names = event.rsvps
    .filter((r) => r.status === "going")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => r.profile.display_name);
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} +${names.length - 3}` : shown;
}

export function EventCard({ event, userId }: { event: FeedEvent; userId: string }) {
  return (
    // The id lets the profile and recommendations link straight to this card (/#event-<id>)
    <Card id={`event-${event.id}`} className="scroll-mt-4">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{SESSION_LABELS[event.session_type]}</Badge>
          <Badge variant="outline">{event.visibility === "public" ? "Public" : (event.group?.name ?? "Private")}</Badge>
        </div>
        <CardTitle>{event.activity}</CardTitle>
        <p className="text-muted-foreground">
          <a
            href={googleMapsUrl(event.venue.name, event.venue.google_place_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-4"
          >
            {event.venue.name}
          </a>
          {event.venue.neighborhood && ` · ${event.venue.neighborhood}`}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-1">
        <p>
          {formatWhen(event.starts_at)} · {formatPeso(event.price_per_person)}
          {event.session_type !== "social" && ` · ${formatLevel(event.level_min, event.level_max)}`}
        </p>
        <p>{spotsText(event)}</p>
        <p className="text-muted-foreground">Hosted by {event.host.display_name}</p>
        <p className="text-muted-foreground">Going: {goingText(event)}</p>
      </CardContent>

      <CardFooter>
        <RsvpButton
          eventId={event.id}
          isHost={event.host_id === userId}
          status={myRsvpStatus(event, userId)}
          full={isFull(event)}
          waitlistPosition={waitlistPosition(event, userId)}
        />
      </CardFooter>
    </Card>
  );
}
