import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <span aria-hidden className="sticker tilt-left w-fit text-5xl">
          🧗
        </span>
        <h1 className="display text-5xl">
          Welcome <span className="text-primary">back</span>
        </h1>
        <p className="text-muted-foreground">See what your friends are planning.</p>
      </div>
      <div className="glass rounded-card p-6">
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
