"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { z } from "zod";
import { createEvent, type EventFormState } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isoToManilaInput } from "@/lib/format";
import {
  eventSchema,
  readEventForm,
  SESSION_TYPES,
  type EventFieldErrors,
  type EventFormValues,
} from "@/lib/validation";

type Option = { id: string; name: string };
type Venue = Option & { neighborhood: string | null };

type Props = {
  venues: Venue[];
  groups: Option[];
  // Pre-fill from a bucket list item ("Make it happen")
  initial?: { venueId?: string; activity?: string };
  bucketItemId?: string;
};

const LEVELS = Array.from({ length: 11 }, (_, level) => level);

// Native selects post their value with the form, styled to match <Input>
const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

export function CreateEventDialog({ venues, groups, initial, bucketItemId }: Props) {
  const router = useRouter();
  // The URL is the source of truth (?new=1), so the dialog survives back/forward and Activity
  // restoring a hidden page shows the right state
  const open = useSearchParams().get("new") === "1";

  const [state, formAction, pending] = useActionState<EventFormState, FormData>(createEvent, {});
  // Errors from checking the form in the browser, before it is sent
  const [clientErrors, setClientErrors] = useState<EventFieldErrors | null>(null);
  const errors = clientErrors ?? state.fieldErrors ?? {};

  const values: EventFormValues = state.values ?? {
    venueId: initial?.venueId ?? "",
    activity: initial?.activity ?? "",
    sessionType: "",
    levelMin: "",
    levelMax: "",
    startsAt: "",
    pricePerPerson: "",
    capacity: "",
    visibility: "public",
    groupId: "",
    bucketItemId: bucketItemId ?? "",
  };
  // These two show or hide other fields, so they are controlled
  const [sessionType, setSessionType] = useState(values.sessionType);
  const [visibility, setVisibility] = useState(values.visibility);
  // Greys out past days in the picker. The schema still checks the time on submit.
  const [minStart] = useState(() => isoToManilaInput(new Date().toISOString()));

  // Same schema as the server. Stopping the submit here keeps the typed values in place.
  function checkOnClient(event: React.FormEvent<HTMLFormElement>) {
    const result = eventSchema.safeParse(readEventForm(new FormData(event.currentTarget)));
    if (result.success) {
      setClientErrors(null);
      return;
    }
    event.preventDefault();
    setClientErrors(z.flattenError(result.error).fieldErrors);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && router.push("/", { scroll: false })}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
          <DialogDescription>You&apos;re counted as going. Times are Manila time.</DialogDescription>
        </DialogHeader>

        {/* noValidate: the schema's messages show instead of the browser's */}
        <form action={formAction} onSubmit={checkOnClient} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="bucketItemId" value={values.bucketItemId} />

          <Field name="venueId" label="Venue" errors={errors.venueId}>
            <select id="venueId" name="venueId" defaultValue={values.venueId} className={selectClass} {...invalid(errors.venueId, "venueId")}>
              <option value="">Pick a venue</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.neighborhood ? `${venue.name} · ${venue.neighborhood}` : venue.name}
                </option>
              ))}
            </select>
          </Field>

          <Field name="activity" label="Activity" errors={errors.activity}>
            <Input
              id="activity"
              name="activity"
              maxLength={60}
              placeholder="Climb, then dinner"
              defaultValue={values.activity}
              {...invalid(errors.activity, "activity")}
            />
          </Field>

          <Field name="sessionType" label="Session type" errors={errors.sessionType}>
            <select
              id="sessionType"
              name="sessionType"
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className={selectClass}
              {...invalid(errors.sessionType, "sessionType")}
            >
              <option value="">Pick a type</option>
              {SESSION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type[0].toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </Field>

          {/* Social events have no level, so the selects aren't shown or sent */}
          {sessionType !== "social" && (
            <div className="grid grid-cols-2 gap-3">
              <Field name="levelMin" label="Lowest level" errors={errors.levelMin}>
                <LevelSelect name="levelMin" defaultValue={values.levelMin} errors={errors.levelMin} />
              </Field>
              <Field name="levelMax" label="Highest level" errors={errors.levelMax}>
                <LevelSelect name="levelMax" defaultValue={values.levelMax} errors={errors.levelMax} />
              </Field>
            </div>
          )}

          <Field name="startsAt" label="Date and time" errors={errors.startsAt}>
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              min={minStart}
              defaultValue={values.startsAt}
              {...invalid(errors.startsAt, "startsAt")}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field name="pricePerPerson" label="Price per person (₱)" errors={errors.pricePerPerson}>
              <Input
                id="pricePerPerson"
                name="pricePerPerson"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                placeholder="0 for free"
                defaultValue={values.pricePerPerson}
                {...invalid(errors.pricePerPerson, "pricePerPerson")}
              />
            </Field>
            <Field name="capacity" label="People, you included" errors={errors.capacity}>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                inputMode="numeric"
                min={2}
                max={50}
                step={1}
                placeholder="No limit"
                defaultValue={values.capacity}
                {...invalid(errors.capacity, "capacity")}
              />
            </Field>
          </div>

          <Field name="visibility" label="Who can see it" errors={errors.visibility}>
            <select
              id="visibility"
              name="visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className={selectClass}
              {...invalid(errors.visibility, "visibility")}
            >
              <option value="public">Public</option>
              <option value="private">Private (one of your groups)</option>
            </select>
          </Field>

          {visibility === "private" && (
            <Field name="groupId" label="Group" errors={errors.groupId}>
              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">You&apos;re not in any groups yet.</p>
              ) : (
                <select id="groupId" name="groupId" defaultValue={values.groupId} className={selectClass} {...invalid(errors.groupId, "groupId")}>
                  <option value="">Pick a group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// aria attributes that tie a control to its error message
function invalid(errors: string[] | undefined, name: string) {
  return errors ? { "aria-invalid": true, "aria-describedby": `${name}-error` } : {};
}

function Field({ name, label, errors, children }: { name: string; label: string; errors?: string[]; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {errors && (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {errors[0]}
        </p>
      )}
    </div>
  );
}

function LevelSelect({ name, defaultValue, errors }: { name: string; defaultValue: string; errors?: string[] }) {
  return (
    <select id={name} name={name} defaultValue={defaultValue} className={selectClass} {...invalid(errors, name)}>
      <option value="">All levels</option>
      {LEVELS.map((level) => (
        <option key={level} value={level}>
          V{level}
        </option>
      ))}
    </select>
  );
}
