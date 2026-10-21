"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { eventSchema, readEventForm, type EventFieldErrors, type EventFormValues } from "@/lib/validation";

export type EventFormState = {
  error?: string;
  fieldErrors?: EventFieldErrors;
  // Echoed back so the form keeps what the user typed
  values?: EventFormValues;
};

type DbError = { code: string; message: string };

// The form checks the same rules first, so these mostly fire on a race (the start time passed
// while the form was open) or a tampered request. Constraint names come from the schema migration.
function dbErrorToFields(error: DbError): EventFieldErrors | null {
  if (error.message.includes("Start time must be in the future")) {
    return { startsAt: ["Pick a time in the future."] };
  }
  if (error.message.includes("group_iff_private")) return { groupId: ["Pick a group for a private event."] };
  if (error.message.includes("level_range")) {
    return { levelMin: ["The lowest level must be at or below the highest."] };
  }
  if (error.message.includes("events_capacity_check")) {
    return { capacity: ["Enter 2 to 50 people, or leave it empty for no limit."] };
  }
  // 42501 is a row-level security refusal: here, a private event for a group you're not in
  if (error.code === "42501") return { groupId: ["You can only post to a group you're in."] };
  return null;
}

export async function createEvent(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const values = readEventForm(formData);
  const parsed = eventSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const event = parsed.data;

  const supabase = await createClient();
  // No host_id: the column defaults to auth.uid(), and the insert grant doesn't include it
  const { data, error } = await supabase
    .from("events")
    .insert({
      venue_id: event.venueId,
      activity: event.activity,
      session_type: event.sessionType,
      level_min: event.levelMin,
      level_max: event.levelMax,
      starts_at: event.startsAt,
      price_per_person: event.pricePerPerson,
      capacity: event.capacity,
      visibility: event.visibility,
      group_id: event.groupId,
    })
    .select("id")
    .single();

  if (error) {
    const fieldErrors = dbErrorToFields(error);
    if (fieldErrors) return { values, fieldErrors };
    return { values, error: "Couldn't create the event. Try again." };
  }

  if (event.bucketItemId) {
    // Row-level security limits this to your own items. Only a wishlist item moves to planned.
    // The event already exists, so a failure here doesn't undo it; the item just stays on the wishlist.
    await supabase
      .from("bucket_items")
      .update({ status: "planned", event_id: data.id })
      .eq("id", event.bucketItemId)
      .eq("status", "wishlist");
  }

  revalidatePath("/");
  revalidatePath("/profile");
  // Leaving ?new=1 closes the dialog
  redirect("/");
}
