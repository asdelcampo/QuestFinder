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

  function run(action: (eventId: string) => Promise<RsvpResult>) {
    startTransition(async () => {
      const result = await action(eventId);
      if (result.error) toast.error(result.error);
    });
  }

  if (isHost) return <p className="text-sm font-medium">You&apos;re hosting</p>;

  if (status === null) {
    return (
      <Button onClick={() => run(rsvp)} disabled={pending}>
        {pending ? "Joining…" : full ? "Join waitlist" : "Join"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">
        {status === "going" ? "Going ✓" : `Waitlist #${waitlistPosition}`}
      </span>
      <Button variant="outline" size="sm" onClick={() => run(cancelRsvp)} disabled={pending}>
        {pending ? "Leaving…" : "Leave"}
      </Button>
    </div>
  );
}
