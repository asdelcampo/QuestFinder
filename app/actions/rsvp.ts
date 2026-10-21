"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type RsvpResult = { error?: string };

// Messages the rsvp and cancel_rsvp functions raise on purpose. They are safe to show as-is.
const KNOWN_ERRORS = [
  "Not signed in",
  "Event not found",
  "This event is closed",
  "Hosts cancel the event instead of leaving",
];

function friendlyError(message: string) {
  return KNOWN_ERRORS.includes(message) ? message : "Something went wrong. Try again.";
}

const eventIdSchema = z.guid();

// Both functions lock the event row in Postgres, so capacity holds even when two people click at once
export async function rsvp(eventId: string): Promise<RsvpResult> {
  if (!eventIdSchema.safeParse(eventId).success) return { error: "Event not found" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("rsvp", { p_event: eventId });
  if (error) return { error: friendlyError(error.message) };

  revalidatePath("/");
  revalidatePath("/profile");
  return {};
}

export async function cancelRsvp(eventId: string): Promise<RsvpResult> {
  if (!eventIdSchema.safeParse(eventId).success) return { error: "Event not found" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_rsvp", { p_event: eventId });
  if (error) return { error: friendlyError(error.message) };

  revalidatePath("/");
  revalidatePath("/profile");
  return {};
}
