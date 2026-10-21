import Link from "next/link";

// Static links only, so the header prerenders with the layout and never waits on the session
export function SiteHeader() {
  return (
    <header className="border-b">
      <nav className="mx-auto flex w-full max-w-2xl items-center gap-4 px-4 py-3 text-sm">
        <Link href="/" className="mr-auto text-base font-semibold">
          QuestFinder
        </Link>
        <Link href="/?new=1" className="font-medium text-primary underline-offset-4 hover:underline">
          New event
        </Link>
        <Link href="/profile" className="underline-offset-4 hover:underline">
          Profile
        </Link>
      </nav>
    </header>
  );
}
