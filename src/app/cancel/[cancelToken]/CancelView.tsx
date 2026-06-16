"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { releaseSlot } from "./actions";

export function CancelView({
  token,
  signupName,
  jobTitle,
  eventName,
  eventSlug,
}: {
  token: string;
  signupName: string;
  jobTitle: string;
  eventName: string;
  eventSlug: string;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    start(async () => {
      const res = await releaseSlot(token);
      if (res.ok) setDone(true);
      else setError(res.error);
    });
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-success/15 flex items-center justify-center text-success text-2xl">
          ✓
        </div>
        <h1 className="mt-5 text-[24px] font-semibold">Slot released</h1>
        <p className="mt-2 text-muted">
          Thanks for letting us know. Someone else can take it now.
        </p>
        <Link
          href={`/e/${eventSlug}`}
          className="mt-8 inline-flex h-12 items-center justify-center rounded-2xl bg-accent text-accent-fg px-6 text-[15px] font-semibold"
        >
          Back to event
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[24px] font-semibold leading-tight tracking-tight">
        Release your slot?
      </h1>
      <p className="mt-2 text-muted">
        {signupName}, you&rsquo;re signed up for <strong>{jobTitle}</strong> at{" "}
        <strong>{eventName}</strong>.
      </p>
      <button
        disabled={pending}
        onClick={onClick}
        className="mt-8 h-14 w-full rounded-2xl bg-red-500 text-white text-[17px] font-semibold disabled:opacity-60 active:scale-[0.98] transition"
      >
        {pending ? "Releasing…" : "Yes, release my slot"}
      </button>
      <Link
        href={`/e/${eventSlug}`}
        className="mt-3 flex h-12 items-center justify-center rounded-2xl border border-border text-[15px] active:scale-[0.98] transition"
      >
        Never mind
      </Link>
      {error && (
        <div className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
