import { z } from "zod";
import { manilaInputToISO } from "@/lib/format";

// One schema for the Create Event form and the createEvent action, so both apply the same rules.
// Its input is the raw form: every field is a string, and "" means the field was left empty.

export const SESSION_TYPES = ["bouldering", "roped", "intro", "outdoor", "social", "other"] as const;

export const EVENT_FIELDS = [
  "venueId",
  "activity",
  "sessionType",
  "levelMin",
  "levelMax",
  "startsAt",
  "pricePerPerson",
  "capacity",
  "visibility",
  "groupId",
  "bucketItemId",
] as const;

export type EventFormValues = Record<(typeof EVENT_FIELDS)[number], string>;
export type EventFieldErrors = Partial<Record<keyof EventFormValues, string[]>>;

// Fields a form doesn't send (a hidden select, say) come back as ""
export function readEventForm(formData: FormData): EventFormValues {
  return Object.fromEntries(
    EVENT_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as EventFormValues;
}

const WHOLE_NUMBER = /^\d+$/;
// What <input type="datetime-local"> sends, e.g. "2026-10-23T19:00"
const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

// "" becomes null; anything else must be a whole number from min to max
function optionalInt(min: number, max: number, message: string) {
  return z
    .string()
    .trim()
    .refine((v) => v === "" || (WHOLE_NUMBER.test(v) && Number(v) >= min && Number(v) <= max), message)
    .transform((v) => (v === "" ? null : Number(v)));
}

// "" becomes null; anything else must be an id. guid() accepts any 8-4-4-4-12 hex id,
// so fixed seed ids pass too.
function optionalId(message: string) {
  return z
    .string()
    .refine((v) => v === "" || z.guid().safeParse(v).success, message)
    .transform((v) => (v === "" ? null : v));
}

const levelMessage = "Pick a level from V0 to V10.";

export const eventSchema = z
  .object({
    venueId: z.guid("Pick a venue."),
    activity: z
      .string()
      .trim()
      .min(1, "Say what you're doing.")
      .max(60, "Keep it to 60 characters or fewer."),
    sessionType: z.enum(SESSION_TYPES, "Pick a session type."),
    levelMin: optionalInt(0, 10, levelMessage),
    levelMax: optionalInt(0, 10, levelMessage),
    startsAt: z
      .string()
      // The regex alone lets through dates like month 13, which the Date check catches
      .refine((v) => DATETIME_LOCAL.test(v) && !Number.isNaN(new Date(v).getTime()), "Pick a date and time.")
      .transform(manilaInputToISO)
      .refine((iso) => new Date(iso).getTime() > Date.now(), "Pick a time in the future."),
    pricePerPerson: z
      .string()
      .trim()
      .regex(WHOLE_NUMBER, "Enter a whole number of pesos, or 0 if it's free.")
      .transform(Number),
    capacity: optionalInt(2, 50, "Enter 2 to 50 people (you included), or leave it empty for no limit."),
    visibility: z.enum(["public", "private"], "Pick who can see it."),
    groupId: optionalId("Pick a group."),
    bucketItemId: optionalId("That bucket list item wasn't found."),
  })
  .superRefine((event, ctx) => {
    // Social events have no level, so their level fields are ignored (and cleared below)
    if (event.sessionType !== "social") {
      if ((event.levelMin === null) !== (event.levelMax === null)) {
        ctx.addIssue({ code: "custom", path: ["levelMin"], message: "Pick both levels, or All levels for both." });
      } else if (event.levelMin !== null && event.levelMax !== null && event.levelMin > event.levelMax) {
        ctx.addIssue({ code: "custom", path: ["levelMin"], message: "The lowest level must be at or below the highest." });
      }
    }
    if (event.visibility === "private" && event.groupId === null) {
      ctx.addIssue({ code: "custom", path: ["groupId"], message: "Pick a group for a private event." });
    }
    if (event.visibility === "public" && event.groupId !== null) {
      ctx.addIssue({ code: "custom", path: ["groupId"], message: "Public events don't have a group." });
    }
  })
  .transform((event) =>
    event.sessionType === "social" ? { ...event, levelMin: null, levelMax: null } : event,
  );

export type EventInput = z.output<typeof eventSchema>;
