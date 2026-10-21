"use client";

import { useActionState } from "react";
import { setLevel, type FormState } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const LEVELS = Array.from({ length: 11 }, (_, i) => i); // V0 to V10

// A native select posts a plain form value, which keeps the server action simple
export const selectClassName =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

export function LevelForm({ level }: { level: number | null }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setLevel, {});
  const errors = state.fieldErrors?.level;

  return (
    <form action={formAction} id="level" className="flex flex-col gap-2">
      <Label htmlFor="level-select">Climbing level</Label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id="level-select"
          name="level"
          defaultValue={level === null ? "" : String(level)}
          aria-invalid={errors ? true : undefined}
          aria-describedby={errors ? "level-error" : undefined}
          className={selectClassName}
        >
          <option value="">Not set</option>
          {LEVELS.map((n) => (
            <option key={n} value={n}>
              V{n}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.saved && !pending && <span className="text-sm text-muted-foreground">Saved</span>}
      </div>
      {errors && (
        <p id="level-error" className="text-sm text-destructive">
          {errors[0]}
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
