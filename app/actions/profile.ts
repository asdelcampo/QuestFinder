"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canCheckOff, getBucketItem } from "@/lib/profile-queries";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  error?: string;
  fieldErrors?: { level?: string[]; title?: string[]; venueId?: string[] };
  saved?: boolean;
  // Echoed back so the add form keeps what the user typed after an error
  title?: string;
  venueId?: string;
};

// "" from the select means "Not set"
const levelSchema = z.object({
  level: z.union([
    z.literal("").transform(() => null),
    z.coerce.number().int().min(0, "Pick a level from V0 to V10.").max(10, "Pick a level from V0 to V10."),
  ]),
});

const bucketItemSchema = z.object({
  title: z.string().trim().min(1, "Give it a name.").max(80, "Keep it to 80 characters or fewer."),
  venueId: z.union([z.literal("").transform(() => null), z.uuid("Pick a venue from the list.")]),
});

const idSchema = z.uuid();

export async function setLevel(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = levelSchema.safeParse({ level: String(formData.get("level") ?? "") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ climbing_level: parsed.data.level })
    .eq("id", user.id);
  if (error) return { error: "Couldn't save your level. Try again." };

  // The level feeds recommendations on both pages
  revalidatePath("/profile");
  revalidatePath("/");
  return { saved: true };
}

export async function addBucketItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    title: String(formData.get("title") ?? ""),
    venueId: String(formData.get("venueId") ?? ""),
  };
  const parsed = bucketItemSchema.safeParse(values);
  if (!parsed.success) return { ...values, fieldErrors: z.flattenError(parsed.error).fieldErrors };

  await getCurrentUser();
  const supabase = await createClient();
  // user_id defaults to auth.uid() in the database, and row-level security checks it
  const { error } = await supabase
    .from("bucket_items")
    .insert({ title: parsed.data.title, venue_id: parsed.data.venueId });
  if (error) return { ...values, error: "Couldn't add that item. Try again." };

  revalidatePath("/profile");
  revalidatePath("/");
  return {};
}

// Delete and check-off are one-button forms, so a failure throws to the error page
// instead of returning form state.
export async function deleteBucketItem(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));

  await getCurrentUser();
  const supabase = await createClient();
  // Row-level security limits this to my own items
  const { error } = await supabase.from("bucket_items").delete().eq("id", id);
  if (error) throw new Error("Couldn't delete that item.");

  revalidatePath("/profile");
  revalidatePath("/");
}

export async function checkOffBucketItem(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));

  const user = await getCurrentUser();
  const supabase = await createClient();
  // Re-check the rule on the server: the event has started and I was going
  const item = await getBucketItem(supabase, id);
  if (!item || !canCheckOff(item, user.id, new Date())) {
    throw new Error("That item can't be checked off yet.");
  }

  const { error } = await supabase
    .from("bucket_items")
    .update({ status: "done", done_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("Couldn't check off that item.");

  revalidatePath("/profile");
  revalidatePath("/");
}
