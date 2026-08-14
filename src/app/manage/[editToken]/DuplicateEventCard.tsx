"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { duplicateEvent } from "./actions";
import { DateTimePicker } from "@/components/DateTimePicker";
import { browserZone } from "@/lib/dates";

type Props = {
  token: string;
  jobCount: number;
  hasFund: boolean;
};

/**
 * A meal team runs the same rota every month. Without this, that's a full
 * re-entry every time.
 */
export function DuplicateEventCard({ token, jobCount, hasFund }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [eventAt, setEventAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!eventAt) {
      setError("Pick a date and time for the new event.");
      return;
    }

    const fd = new FormData();
    fd.set("event_at", eventAt.toISOString());
    fd.set("event_tz", browserZone());

    startTransition(async () => {
      const res = await duplicateEvent(token, fd);
      if (res.ok) router.push(`/manage/${res.editToken}?welcome=1`);
      else setError(res.error);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 w-full rounded-2xl border border-dashed border-border text-[14px] text-foreground/80 transition hover:bg-foreground/5"
      >
        Run this again
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <p className="text-[15px] font-medium">Run this again</p>
      <p className="text-[13px] leading-[1.5] text-muted">
        Creates a new event with the same details and{" "}
        {jobCount === 1 ? "job" : `${jobCount} jobs`}
        {hasFund ? ", and the same payment details" : ""}. Signups
        {hasFund ? ", payments and amounts" : ""} start fresh, and you&rsquo;ll
        get a new link to share.
      </p>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">When&rsquo;s the next one?</span>
        <DateTimePicker
          value={eventAt}
          onChange={(d) => {
            setError(null);
            setEventAt(d);
          }}
          minDate={new Date()}
        />
      </label>

      {error && (
        <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-12 flex-1 rounded-2xl bg-accent text-[15px] font-semibold text-accent-fg transition active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create it"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="h-12 rounded-2xl border border-border px-4 text-[15px] transition disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default DuplicateEventCard;
