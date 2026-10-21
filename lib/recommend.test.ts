import { describe, expect, it } from "vitest";
import { median, recommend, scoreEvent, type RecommendationContext, type ScorableEvent } from "@/lib/recommend";

const ME = "me";
const HOST = "host";

function makeEvent(overrides: Partial<ScorableEvent> = {}): ScorableEvent {
  return {
    host_id: HOST,
    session_type: "bouldering",
    level_min: null,
    level_max: null,
    price_per_person: 500,
    starts_at: "2026-10-25T11:00:00+00:00",
    capacity: null,
    venue: { id: "venue-1" },
    rsvps: [{ user_id: HOST, status: "going", created_at: "2026-10-20T00:00:00+00:00" }],
    ...overrides,
  };
}

// A context where no signal fires, so each test turns on only the one it checks
function makeCtx(overrides: Partial<RecommendationContext> = {}): RecommendationContext {
  return {
    userId: ME,
    level: null,
    bucketVenueIds: new Set(),
    friendIds: new Set(),
    medianJoinedPrice: null,
    ...overrides,
  };
}

const going = (userId: string) => ({ user_id: userId, status: "going" as const, created_at: "2026-10-21T00:00:00+00:00" });

describe("scoreEvent signals", () => {
  it("returns null when nothing matches", () => {
    expect(scoreEvent(makeEvent(), makeCtx())).toBeNull();
  });

  it("scores a bucket-list venue match", () => {
    const ctx = makeCtx({ bucketVenueIds: new Set(["venue-1"]) });
    expect(scoreEvent(makeEvent(), ctx)).toEqual({ score: 3, reason: "on your bucket list" });
  });

  it("scores level fit inside the range and for all-levels sessions", () => {
    const ctx = makeCtx({ level: 2 });
    expect(scoreEvent(makeEvent({ level_min: 0, level_max: 3 }), ctx)).toEqual({ score: 2, reason: "fits your level" });
    expect(scoreEvent(makeEvent(), ctx)).toEqual({ score: 2, reason: "fits your level" });
    expect(scoreEvent(makeEvent({ level_min: 4, level_max: 6 }), ctx)).toBeNull();
  });

  it("skips level fit for social events and when no level is set", () => {
    expect(scoreEvent(makeEvent({ session_type: "social" }), makeCtx({ level: 2 }))).toBeNull();
    expect(scoreEvent(makeEvent({ level_min: 0, level_max: 3 }), makeCtx({ level: null }))).toBeNull();
  });

  it("scores friends going, 2 points each", () => {
    const ctx = makeCtx({ friendIds: new Set(["a"]) });
    const event = makeEvent({ rsvps: [going(HOST), going("a")] });
    expect(scoreEvent(event, ctx)).toEqual({ score: 2, reason: "1 friend going" });
  });

  it("caps friends going at 3 and ignores waitlisted friends", () => {
    const ctx = makeCtx({ friendIds: new Set(["a", "b", "c", "d", "e"]) });
    const event = makeEvent({
      rsvps: [going("a"), going("b"), going("c"), going("d"), { ...going("e"), status: "waitlist" }],
    });
    expect(scoreEvent(event, ctx)).toEqual({ score: 6, reason: "3 friends going" });
  });

  it("scores price fit at or below the median, and skips it with no history", () => {
    const ctx = makeCtx({ medianJoinedPrice: 500 });
    expect(scoreEvent(makeEvent({ price_per_person: 500 }), ctx)).toEqual({ score: 1, reason: "in your usual price range" });
    expect(scoreEvent(makeEvent({ price_per_person: 501 }), ctx)).toBeNull();
    expect(scoreEvent(makeEvent({ price_per_person: 0 }), makeCtx())).toBeNull();
  });

  it("labels with the two strongest signals and sums them all", () => {
    const ctx = makeCtx({
      bucketVenueIds: new Set(["venue-1"]),
      friendIds: new Set(["a", "b"]),
      level: 1,
      medianJoinedPrice: 1000,
    });
    const event = makeEvent({ rsvps: [going(HOST), going("a"), going("b")] });
    expect(scoreEvent(event, ctx)).toEqual({ score: 3 + 2 + 4 + 1, reason: "2 friends going, on your bucket list" });
  });
});

describe("scoreEvent exclusions", () => {
  const ctx = makeCtx({ bucketVenueIds: new Set(["venue-1"]) });

  it("excludes full events", () => {
    expect(scoreEvent(makeEvent({ capacity: 1 }), ctx)).toBeNull();
  });

  it("excludes events I already joined or am waitlisted on", () => {
    expect(scoreEvent(makeEvent({ rsvps: [going(HOST), going(ME)] }), ctx)).toBeNull();
    expect(scoreEvent(makeEvent({ rsvps: [going(HOST), { ...going(ME), status: "waitlist" }] }), ctx)).toBeNull();
  });

  it("excludes my own events", () => {
    expect(scoreEvent(makeEvent({ host_id: ME, rsvps: [] }), ctx)).toBeNull();
  });
});

describe("recommend", () => {
  it("ranks a V0–V3 bouldering session above a V4–V6 one for a V1 climber", () => {
    const beginner = makeEvent({ level_min: 0, level_max: 3, starts_at: "2026-10-27T11:00:00+00:00" });
    const advanced = makeEvent({ level_min: 4, level_max: 6, starts_at: "2026-10-23T11:00:00+00:00" });
    const ctx = makeCtx({ level: 1, medianJoinedPrice: 1000 });

    const picks = recommend([advanced, beginner], ctx, 5);
    expect(picks.map((p) => p.event)).toEqual([beginner, advanced]);
    expect(picks[0].reason).toBe("fits your level, in your usual price range");
  });

  it("breaks ties by the sooner start, drops zero scores, and applies the limit", () => {
    const ctx = makeCtx({ bucketVenueIds: new Set(["venue-1"]) });
    const later = makeEvent({ starts_at: "2026-10-28T11:00:00+00:00" });
    const sooner = makeEvent({ starts_at: "2026-10-24T11:00:00+00:00" });
    const unscored = makeEvent({ venue: { id: "venue-2" } });

    expect(recommend([later, unscored, sooner], ctx, 5).map((p) => p.event)).toEqual([sooner, later]);
    expect(recommend([later, unscored, sooner], ctx, 1).map((p) => p.event)).toEqual([sooner]);
  });
});

describe("median", () => {
  it("handles empty, odd, and even lists", () => {
    expect(median([])).toBeNull();
    expect(median([900, 0, 500])).toBe(500);
    expect(median([0, 400, 600, 1000])).toBe(500);
  });
});
