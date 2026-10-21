// Derived event state. Nothing here is stored: it is all computed from the RSVP list.

type RsvpLike = { user_id: string; status: "going" | "waitlist"; created_at: string };
type EventLike = { capacity: number | null; rsvps: RsvpLike[] };

export function goingCount(event: EventLike) {
  return event.rsvps.filter((r) => r.status === "going").length;
}

// null means no limit. Capacity includes the host.
export function spotsLeft(event: EventLike) {
  return event.capacity === null ? null : Math.max(0, event.capacity - goingCount(event));
}

export function isFull(event: EventLike) {
  return spotsLeft(event) === 0;
}

export function myRsvpStatus(event: EventLike, userId: string) {
  return event.rsvps.find((r) => r.user_id === userId)?.status ?? null;
}

// 1-based place in the waitlist, ordered the same way promotion is (created_at, then user_id)
export function waitlistPosition(event: EventLike, userId: string) {
  const queue = event.rsvps
    .filter((r) => r.status === "waitlist")
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.user_id.localeCompare(b.user_id));
  const index = queue.findIndex((r) => r.user_id === userId);
  return index === -1 ? null : index + 1;
}
