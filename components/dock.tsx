"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Floating glass dock instead of a nav bar (DESIGN.md §6.7). Hidden on the auth pages,
// where there's nowhere to go yet.
export function Dock() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/signup") return null;

  return (
    <nav
      aria-label="Main"
      className="glass fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex w-fit items-center gap-3 rounded-full p-2"
    >
      <DockLink href="/" label="Events" icon="🗓️" active={pathname === "/"} />
      <Link
        href="/?new=1"
        aria-label="New event"
        className="slab flex size-16 items-center justify-center rounded-full text-3xl font-light transition-transform active:scale-95"
      >
        +
      </Link>
      <DockLink href="/profile" label="Profile" icon="🙂" active={pathname === "/profile"} />
    </nav>
  );
}

function DockLink({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex w-20 flex-col items-center gap-0.5 rounded-full py-1.5 text-xs font-semibold transition-colors ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span aria-hidden className="text-xl">
        {icon}
      </span>
      {label}
    </Link>
  );
}
