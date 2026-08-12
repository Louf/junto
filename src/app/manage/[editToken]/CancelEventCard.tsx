"use client";

import { useState, useTransition } from "react";
import { cancelEvent, restoreEvent } from "./actions";

type Props = {
  token: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  /** Drives the warning — money in play makes this consequential. */
  pledgeCount: number;
};

export function CancelEventCard({
  token,
  cancelledAt,
  cancelReason,
  pledgeCount,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ sent: number; failed: number } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function onCancel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await cancelEvent(token, fd);
      if (res.ok) {
        setError(null);
        setConfirming(false);
        setNotice({ sent: res.sent, failed: res.failed });
      } else {
        setError(res.error);
      }
    });
  }

  if (cancelledAt) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[15px] font-medium">This event is cancelled</p>
        <p className="mt-1 text-[13px] leading-[1.5] text-muted">
          The page is still reachable so anyone who already signed up or sent
          money can see what happened. Signups and payments are closed, and
          everyone attached to the event has been emailed.
        </p>
        {cancelReason && (
          <p className="mt-3 rounded-xl bg-foreground/[0.04] px-4 py-3 text-[14px] leading-[1.5]">
            {cancelReason}
          </p>
        )}

        {notice && (
          <p
            className={`mt-3 rounded-xl px-4 py-3 text-[14px] leading-[1.5] ${
              notice.failed > 0
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : "bg-success/15 text-success"
            }`}
          >
            {notice.sent > 0 &&
              `Told ${notice.sent} ${notice.sent === 1 ? "person" : "people"}.`}
            {notice.failed > 0 &&
              ` Couldn't reach ${notice.failed} ${
                notice.failed === 1 ? "person" : "people"
              } — you may need to contact them yourself.`}
            {notice.sent === 0 && notice.failed === 0 && "Nobody to notify yet."}
          </p>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await restoreEvent(token);
              if (!res.ok) setError(res.error);
            })
          }
          className="mt-3 h-11 rounded-2xl border border-border px-4 text-[14px] transition disabled:opacity-60"
        >
          {pending ? "Restoring…" : "Un-cancel this event"}
        </button>
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-11 w-full rounded-2xl border border-border text-[14px] text-muted transition hover:bg-foreground/5"
      >
        Cancel this event
      </button>
    );
  }

  return (
    <form
      onSubmit={onCancel}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <p className="text-[15px] font-medium">Cancel this event?</p>
      <p className="text-[13px] leading-[1.5] text-muted">
        Everyone who signed up or sent money gets an email. The page stays up
        with a cancelled notice so people can see what happened, and signups
        and payments close immediately. You can undo this, but the emails
        can&rsquo;t be unsent.
      </p>

      {pledgeCount > 0 && (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-[14px] leading-[1.5]">
          {pledgeCount === 1
            ? "1 person has already reported sending money."
            : `${pledgeCount} people have already reported sending money.`}{" "}
          They&rsquo;ll see your note and your email address on the page so they
          can ask about a refund.
        </p>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          What happened
          <span className="ml-1 font-normal text-muted">· optional</span>
        </span>
        <textarea
          name="reason"
          rows={3}
          maxLength={500}
          placeholder="Venue fell through — we'll reschedule for next month."
          className="w-full rounded-xl border border-transparent bg-foreground/[0.04] px-4 py-3 text-[16px] outline-none transition placeholder:text-muted focus:border-foreground/20"
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
          className="h-12 flex-1 rounded-2xl bg-red-600 text-[15px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? "Cancelling…" : "Cancel event"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="h-12 rounded-2xl border border-border px-4 text-[15px] transition disabled:opacity-60"
        >
          Keep it
        </button>
      </div>
    </form>
  );
}

export default CancelEventCard;
