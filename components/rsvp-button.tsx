"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cancelRsvp, rsvp, type RsvpResult } from "@/app/actions/rsvp";
import { Button } from "@/components/ui/button";

type Props = {
  eventId: string;
  isHost: boolean;
  status: "going" | "waitlist" | null;
  full: boolean;
  waitlistPosition: number | null;
};

export function RsvpButton({ eventId, isHost, status, full, waitlistPosition }: Props) {
  const [pending, startTransition] = useTransition();

  function run(action: (eventId: string) => Promise<RsvpResult>, success: string) {
    startTransition(async () => {
      const result = await action(eventId);
      if (result.error) toast.error(result.error);
      else toast.success(success);
    });
  }

  if (isHost) {
    return <span className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground">You&apos;re hosting</span>;
  }

  if (status === null) {
    return (
      <Button
        size="lg"
        className="h-11 rounded-full px-6 text-base shadow-[0_8px_20px_rgba(0,57,255,0.3)]"
        onClick={() => run(rsvp, full ? "You're on the waitlist" : "You're in!")}
        disabled={pending}
      >
        {pending ? "Joining…" : full ? "Join waitlist" : "I'm in"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`pop-in rounded-full px-4 py-2 text-sm font-bold ${
          status === "going" ? "bg-check-mint/20 text-[#04704c]" : "bg-secondary text-secondary-foreground"
        }`}
      >
        {status === "going" ? "You're in ✓" : `Waitlist #${waitlistPosition}`}
      </span>
      <Button variant="ghost" size="sm" className="rounded-full" onClick={() => run(cancelRsvp, "You left")} disabled={pending}>
        {pending ? "Leaving…" : "Leave"}
      </Button>
    </div>
  );
}
