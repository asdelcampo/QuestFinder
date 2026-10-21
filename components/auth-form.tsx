"use client";

import Link from "next/link";
import { useActionState } from "react";
import { logIn, signUp, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    mode === "signup" ? signUp : logIn,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode === "signup" && (
        <Field
          name="displayName"
          label="Display name (optional)"
          autoComplete="nickname"
          defaultValue={state.displayName}
          errors={state.fieldErrors?.displayName}
        />
      )}
      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.email}
        errors={state.fieldErrors?.email}
      />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        required
        minLength={mode === "signup" ? 8 : undefined}
        errors={state.fieldErrors?.password}
      />

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Please wait…" : mode === "signup" ? "Sign up" : "Log in"}
      </Button>

      <p className="text-sm text-muted-foreground">
        {mode === "signup" ? "Already have an account? " : "New here? "}
        <Link href={mode === "signup" ? "/login" : "/signup"} className="underline underline-offset-4">
          {mode === "signup" ? "Log in" : "Sign up"}
        </Link>
      </p>
    </form>
  );
}

type FieldProps = React.ComponentProps<"input"> & { name: string; label: string; errors?: string[] };

function Field({ name, label, errors, ...inputProps }: FieldProps) {
  const errorId = `${name}-error`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? errorId : undefined}
        {...inputProps}
      />
      {errors && (
        <p id={errorId} className="text-sm text-destructive">
          {errors[0]}
        </p>
      )}
    </div>
  );
}
