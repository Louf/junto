"use client";

import Link from "next/link";
import { useActionState } from "react";
import { sendMagicLink } from "./actions";

export default function RecoverPage() {
  const [state, action, pending] = useActionState(sendMagicLink, null);

  return (
    <main className="mx-auto w-full max-w-md px-6 pt-8 pb-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[15px] text-muted active:opacity-60"
      >
        ← Back
      </Link>
      <h1 className="mt-4 text-[32px] font-semibold leading-tight tracking-tight">
        Sign in
      </h1>
      <p className="mt-1 text-[15px] text-muted">
        We&rsquo;ll email you a magic link. Any events you&rsquo;ve created with
        this email will appear in your account.
      </p>
      <form action={action} className="mt-8 flex flex-col gap-4">
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full rounded-xl bg-foreground/[0.05] px-4 py-3 text-[16px] outline-none"
        />
        <button
          type="submit"
          disabled={pending || state?.ok}
          className="h-14 rounded-2xl bg-accent text-accent-fg text-[17px] font-semibold disabled:opacity-60 active:scale-[0.98] transition"
        >
          {pending ? "Sending…" : state?.ok ? "Sent ✓" : "Send magic link"}
        </button>
      </form>
      {state?.ok && (
        <p className="mt-6 rounded-2xl bg-success/15 text-success px-4 py-3 text-sm">
          Check your inbox. Tap the link to sign in.
        </p>
      )}
      {state && !state.ok && (
        <p className="mt-6 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-3 text-sm">
          {state.error}
        </p>
      )}
    </main>
  );
}
