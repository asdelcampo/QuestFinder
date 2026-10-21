import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Log in</h1>
        <p className="text-sm text-muted-foreground">See what your friends are planning.</p>
      </div>
      <AuthForm mode="login" />
    </main>
  );
}
