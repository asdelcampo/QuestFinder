// Next.js only inlines NEXT_PUBLIC_ variables that are referenced by their literal names,
// so read them here rather than through a dynamic lookup.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example)",
    );
  }
  // A common slip is pasting the REST endpoint (…/rest/v1/), which breaks every auth call
  if (new URL(url).pathname !== "/") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be the bare project URL, like https://<ref>.supabase.co");
  }
  return { url, key };
}
