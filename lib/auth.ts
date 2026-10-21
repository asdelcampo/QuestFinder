import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string };

// The one place pages read the session. getClaims() verifies the token, unlike getSession(),
// which trusts whatever is in the cookie.
export async function getCurrentUser(): Promise<CurrentUser> {
  // getClaims() compares the token's expiry with the current time, which Next.js won't allow in a
  // prefetched shell. connection() keeps the session check at request time only.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  return { id: claims.sub, email: claims.email ?? "" };
}
