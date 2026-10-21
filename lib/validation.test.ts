import { describe, expect, it } from "vitest";
import { z } from "zod";
import { eventSchema, type EventFormValues } from "@/lib/validation";

const VENUE = "b1000000-0000-4000-8000-000000000002";
const GROUP = "a1000000-0000-4000-8000-000000000001";

// datetime-local value a day from now, in Manila time (UTC+8)
function manilaInput(offsetMs: number) {
  return new Date(Date.now() + offsetMs + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
const DAY = 24 * 60 * 60 * 1000;

const valid: EventFormValues = {
  venueId: VENUE,
  activity: "  Bouldering night  ",
  sessionType: "bouldering",
  levelMin: "1",
  levelMax: "3",
  startsAt: manilaInput(DAY),
  pricePerPerson: "650",
  capacity: "4",
  visibility: "public",
  groupId: "",
  bucketItemId: "",
};

function errorsFor(values: Partial<EventFormValues>) {
  const result = eventSchema.safeParse({ ...valid, ...values });
  expect(result.success).toBe(false);
  return z.flattenError(result.error!).fieldErrors;
}

describe("eventSchema", () => {
  it("accepts a valid payload and converts it for the database", () => {
    const result = eventSchema.parse(valid);
    expect(result).toMatchObject({
      venueId: VENUE,
      activity: "Bouldering night",
      levelMin: 1,
      levelMax: 3,
      pricePerPerson: 650,
      capacity: 4,
      groupId: null,
      bucketItemId: null,
    });
    // Manila wall time converted to a UTC instant
    expect(result.startsAt).toMatch(/Z$/);
  });

  it("requires a venue", () => {
    expect(errorsFor({ venueId: "" }).venueId).toBeDefined();
  });

  it("requires an activity of 1 to 60 characters", () => {
    expect(errorsFor({ activity: "   " }).activity).toBeDefined();
    expect(errorsFor({ activity: "x".repeat(61) }).activity).toBeDefined();
  });

  it("requires a known session type", () => {
    expect(errorsFor({ sessionType: "yoga" }).sessionType).toBeDefined();
  });

  it("rejects a start time in the past", () => {
    expect(errorsFor({ startsAt: manilaInput(-60 * 60 * 1000) }).startsAt).toEqual(["Pick a time in the future."]);
  });

  it("rejects a malformed start time", () => {
    expect(errorsFor({ startsAt: "2026-13-01T10:00" }).startsAt).toEqual(["Pick a date and time."]);
  });

  it("rejects a negative or fractional price, and accepts free", () => {
    expect(errorsFor({ pricePerPerson: "-1" }).pricePerPerson).toBeDefined();
    expect(errorsFor({ pricePerPerson: "1.5" }).pricePerPerson).toBeDefined();
    expect(eventSchema.parse({ ...valid, pricePerPerson: "0" }).pricePerPerson).toBe(0);
  });

  it("allows capacity 2 to 50, or empty for no limit", () => {
    expect(errorsFor({ capacity: "1" }).capacity).toBeDefined();
    expect(errorsFor({ capacity: "51" }).capacity).toBeDefined();
    expect(eventSchema.parse({ ...valid, capacity: "" }).capacity).toBeNull();
  });

  it("rejects a level outside V0 to V10", () => {
    expect(errorsFor({ levelMax: "11" }).levelMax).toBeDefined();
  });

  it("needs both levels or neither", () => {
    expect(errorsFor({ levelMax: "" }).levelMin).toBeDefined();
    const allLevels = eventSchema.parse({ ...valid, levelMin: "", levelMax: "" });
    expect([allLevels.levelMin, allLevels.levelMax]).toEqual([null, null]);
  });

  it("needs the lowest level at or below the highest", () => {
    expect(errorsFor({ levelMin: "4", levelMax: "2" }).levelMin).toBeDefined();
  });

  it("clears levels for social events", () => {
    const social = eventSchema.parse({ ...valid, sessionType: "social", levelMin: "5", levelMax: "2" });
    expect([social.levelMin, social.levelMax]).toEqual([null, null]);
  });

  it("requires a group for private events", () => {
    expect(errorsFor({ visibility: "private", groupId: "" }).groupId).toBeDefined();
    expect(eventSchema.parse({ ...valid, visibility: "private", groupId: GROUP }).groupId).toBe(GROUP);
  });

  it("rejects a group on public events", () => {
    expect(errorsFor({ visibility: "public", groupId: GROUP }).groupId).toBeDefined();
  });

  it("rejects a malformed bucket item id", () => {
    expect(errorsFor({ bucketItemId: "not-an-id" }).bucketItemId).toBeDefined();
  });
});
