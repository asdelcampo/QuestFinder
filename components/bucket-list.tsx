"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addBucketItem, checkOffBucketItem, deleteBucketItem, type FormState } from "@/app/actions/profile";
import { selectClassName } from "@/components/level-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatWhen } from "@/lib/format";

export type BucketListItem = {
  id: string;
  title: string;
  status: "wishlist" | "planned" | "done";
  venueName: string | null;
  event: { id: string; activity: string; startsAt: string } | null;
  canCheckOff: boolean; // worked out on the server, which knows the time and my RSVP
};

type Venue = { id: string; name: string; neighborhood: string };

const STATUS_PILL = {
  wishlist: { label: "Wishlist", className: "border border-border bg-white/70 text-muted-foreground" },
  planned: { label: "Planned", className: "bg-secondary text-secondary-foreground" },
  done: { label: "Done", className: "bg-check-mint/20 text-[#04704c]" },
} as const;

export function BucketList({ items, venues }: { items: BucketListItem[]; venues: Venue[] }) {
  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add your first side quest.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <BucketRow key={item.id} item={item} />
          ))}
        </ul>
      )}
      <div className="glass rounded-3xl p-4">
        <AddItemForm venues={venues} />
      </div>
    </div>
  );
}

function BucketRow({ item }: { item: BucketListItem }) {
  const pill = STATUS_PILL[item.status];
  return (
    <li className="glass flex gap-4 rounded-3xl p-4">
      {/* Done items get Bump's mint "visited" check on the sticker (DESIGN.md §6.5) */}
      <span aria-hidden className="relative h-fit text-4xl leading-none">
        <span className="sticker">🎯</span>
        {item.status === "done" && (
          <span className="pop-in absolute -right-2 -bottom-1 flex size-5 items-center justify-center rounded-full border-2 border-white bg-check-mint text-[11px] font-black text-white">
            ✓
          </span>
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold">{item.title}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pill.className}`}>{pill.label}</span>
        </div>
        {item.venueName && <p className="text-sm font-semibold text-primary">{item.venueName}</p>}
        {item.event && (
          // Feed cards carry id="event-<id>", so this scrolls to the event
          <Link href={`/#event-${item.event.id}`} className="text-sm text-periwinkle underline-offset-4 hover:underline">
            {item.event.activity} · {formatWhen(item.event.startsAt)}
          </Link>
        )}

        {item.canCheckOff && (
          <form action={checkOffBucketItem} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={item.id} />
            <span className="text-sm font-semibold">Did you do it?</span>
            <SubmitButton size="sm" className="rounded-full" pendingLabel="Checking off…">
              Check off
            </SubmitButton>
          </form>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {item.status === "wishlist" && (
            // The feed opens Create Event pre-filled from this item and marks it planned on submit
            <Button size="sm" className="rounded-full" render={<Link href={`/?new=1&bucket=${item.id}`} />} nativeButton={false}>
              Make it happen
            </Button>
          )}
          <form action={deleteBucketItem}>
            <input type="hidden" name="id" value={item.id} />
            <SubmitButton size="sm" variant="ghost" className="rounded-full" pendingLabel="Deleting…">
              Delete
            </SubmitButton>
          </form>
        </div>
      </div>
    </li>
  );
}

function AddItemForm({ venues }: { venues: Venue[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addBucketItem, {});
  const titleErrors = state.fieldErrors?.title;
  const venueErrors = state.fieldErrors?.venueId;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="bucket-title">New item</Label>
        <Input
          id="bucket-title"
          name="title"
          required
          maxLength={80}
          placeholder="Try Po & Pilar"
          defaultValue={state.title}
          aria-invalid={titleErrors ? true : undefined}
          aria-describedby={titleErrors ? "bucket-title-error" : undefined}
        />
        {titleErrors && (
          <p id="bucket-title-error" className="text-sm text-destructive">
            {titleErrors[0]}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="bucket-venue">Venue (optional)</Label>
        <select
          id="bucket-venue"
          name="venueId"
          defaultValue={state.venueId ?? ""}
          aria-invalid={venueErrors ? true : undefined}
          aria-describedby={venueErrors ? "bucket-venue-error" : undefined}
          className={selectClassName}
        >
          <option value="">No venue</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {`${v.name}, ${v.neighborhood}`}
            </option>
          ))}
        </select>
        {venueErrors && (
          <p id="bucket-venue-error" className="text-sm text-destructive">
            {venueErrors[0]}
          </p>
        )}
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Adding…" : "Add to bucket list"}
      </Button>
    </form>
  );
}

// Disables itself while its own form is submitting
function SubmitButton({
  pendingLabel,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
