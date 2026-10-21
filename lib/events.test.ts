import { describe, expect, it } from "vitest";
import { goingCount, isFull, myRsvpStatus, spotsLeft, waitlistPosition } from "@/lib/events";

type Status = "going" | "waitlist";
const rsvp = (user_id: string, status: Status, created_at: string) => ({ user_id, status, created_at });

const T1 = "2026-10-21T01:00:00Z";
const T2 = "2026-10-21T02:00:00Z";
const T3 = "2026-10-21T03:00:00Z";

describe("spots", () => {
  it("counts only going RSVPs against capacity", () => {
    const event = { capacity: 4, rsvps: [rsvp("host", "going", T1), rsvp("a", "going", T2)] };
    expect(goingCount(event)).toBe(2);
    expect(spotsLeft(event)).toBe(2);
    expect(isFull(event)).toBe(false);
  });

  it("is full when going reaches capacity", () => {
    const event = {
      capacity: 2,
      rsvps: [rsvp("host", "going", T1), rsvp("a", "going", T2), rsvp("b", "waitlist", T3)],
    };
    expect(spotsLeft(event)).toBe(0);
    expect(isFull(event)).toBe(true);
  });

  it("has no limit when capacity is null", () => {
    const event = { capacity: null, rsvps: [rsvp("host", "going", T1)] };
    expect(spotsLeft(event)).toBeNull();
    expect(isFull(event)).toBe(false);
  });
});

describe("my RSVP", () => {
  const event = { capacity: 2, rsvps: [rsvp("host", "going", T1), rsvp("a", "waitlist", T2)] };

  it("finds the user's status, or null", () => {
    expect(myRsvpStatus(event, "a")).toBe("waitlist");
    expect(myRsvpStatus(event, "nobody")).toBeNull();
  });
});

describe("waitlistPosition", () => {
  it("orders by created_at, then user_id, whatever the array order", () => {
    const event = {
      capacity: 2,
      rsvps: [
        rsvp("late", "waitlist", T3),
        rsvp("zed", "waitlist", T2),
        rsvp("amy", "waitlist", T2),
        rsvp("host", "going", T1),
      ],
    };
    expect(waitlistPosition(event, "amy")).toBe(1);
    expect(waitlistPosition(event, "zed")).toBe(2);
    expect(waitlistPosition(event, "late")).toBe(3);
  });

  it("is null for someone not on the waitlist", () => {
    const event = { capacity: 2, rsvps: [rsvp("host", "going", T1)] };
    expect(waitlistPosition(event, "host")).toBeNull();
  });
});
