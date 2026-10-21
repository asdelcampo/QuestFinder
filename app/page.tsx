import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

// Placeholder home until the feed lands in Phase 4
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">QuestFinder</h1>
      {/* Reading the session is request-time work, so it streams in behind a boundary */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <SignedInAs />
      </Suspense>
    </main>
  );
}

async function SignedInAs() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm">Signed in as {user.email}</p>
      <form action={signOut}>
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}
