"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  fieldErrors?: { email?: string[]; password?: string[]; displayName?: string[] };
  // Echoed back so the form keeps what the user typed (never the password)
  email?: string;
  displayName?: string;
};

const signUpSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
  displayName: z.string().trim().max(40, "Keep it to 40 characters or fewer."),
});

const logInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

function readForm(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
  };
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const values = readForm(formData);
  const echo = { email: values.email, displayName: values.displayName };
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) return { ...echo, fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    // The signup trigger copies this into profiles, falling back to the email prefix when empty
    options: { data: { display_name: parsed.data.displayName } },
  });

  if (error) {
    const taken = error.code === "user_already_exists";
    return { ...echo, error: taken ? "That email already has an account. Log in instead." : error.message };
  }
  // No session means Supabase is set to require email confirmation
  if (!data.session) return { ...echo, error: "Check your inbox to confirm your email, then log in." };

  redirect("/");
}

export async function logIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const values = readForm(formData);
  const parsed = logInSchema.safeParse(values);
  if (!parsed.success) {
    return { email: values.email, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const wrong = error.code === "invalid_credentials";
    return { email: values.email, error: wrong ? "Wrong email or password." : error.message };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
